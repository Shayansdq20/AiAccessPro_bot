# Moving Pro Ai Access to a new VPS

A complete, ordered runbook for migrating the bot + admin panel from one server
to another with **zero data loss** and minimal downtime. Follow the phases in
order. Placeholders: `OLD_IP`, `NEW_IP`, and your domains
(`api.never-happened.ir`, `admin.never-happened.ir`).

> Golden rule: **do NOT stop or wipe the old server until the new one is fully
> verified** (bot answers `/start`). The old box is your rollback.

> Naming note (brand rename): the current production install predates the
> rename — its folder is `~/premium-hub` and its `.env` has
> `POSTGRES_USER/POSTGRES_DB=premium_hub`. **Keep that `.env` as is.** The
> dump/restore commands below read the DB user/name from the container's own
> environment, so they work with either name. On the NEW server the folder can
> be `~/pro-ai-access` because its Postgres volume is created fresh and then
> filled from the dump. Never rename the folder of a running install — Docker
> names the volume after the folder, so the database would come up empty.

---

## Phase 0 — On the OLD server: back up (don't stop anything yet)

```sh
cd ~/premium-hub                    # the OLD install's folder (pre-rename name)

# 1. database dump (all users, wallets, orders, referrals, inventory)
#    single quotes: $POSTGRES_USER/$POSTGRES_DB expand INSIDE the container
sudo docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > ~/pro_ai_access.sql.gz

# 2. nginx configs + SSL certificates
sudo tar -czf ~/nginx-backup.tar.gz -C / etc/nginx etc/letsencrypt

# 3. confirm you have all three files to carry over (dump must not be ~20 bytes)
ls -lh ~/pro_ai_access.sql.gz ~/nginx-backup.tar.gz ~/premium-hub/.env
```

The three things you must move: **`.env`**, **`pro_ai_access.sql.gz`**, **`nginx-backup.tar.gz`**.
The `.env` is critical — it holds `ENCRYPTION_KEY`. If that changes, every
encrypted VPN config / inventory item / delivery becomes unreadable.

---

## Phase 1 — On the NEW server: prepare the host

```sh
# packages (Docker runs everything; no Node/pnpm/Postgres on the host)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo apt install -y git nginx certbot python3-certbot-nginx

# Docker network fix — prevents the corepack/npm "Connection refused" build
# failure that happens on many VPSes (MTU/DNS inside the build container)
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{ "dns": ["8.8.8.8", "1.1.1.1"], "mtu": 1400 }
EOF
sudo systemctl restart docker

# swap, if the VPS has < 3 GB RAM (Docker build can OOM otherwise)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# firewall: only SSH + web (app ports & Postgres stay bound to localhost)
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
```

GitHub access for the private repo — SSH deploy key:

```sh
ssh-keygen -t ed25519 -C "pro-ai-access-vps" -f ~/.ssh/id_ed25519 -N ""
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
cat ~/.ssh/id_ed25519.pub
```

Add that public key at `https://github.com/Shayansdq20/AiAccessPro_bot/settings/keys`
→ **Add deploy key** (read-only). Then `ssh -T git@github.com` should greet you.

---

## Phase 2 — Copy the backups OLD → NEW

From your laptop (or scp directly server-to-server):

```sh
scp root@OLD_IP:~/pro_ai_access.sql.gz   root@NEW_IP:~/
scp root@OLD_IP:~/nginx-backup.tar.gz  root@NEW_IP:~/
scp root@OLD_IP:~/premium-hub/.env     root@NEW_IP:~/pro-ai-access.env
```

---

## Phase 3 — On the NEW server: deploy

```sh
git clone git@github.com:Shayansdq20/AiAccessPro_bot.git ~/pro-ai-access
cd ~/pro-ai-access
cp ~/pro-ai-access.env .env          # SAME .env = same ENCRYPTION_KEY (mandatory)
                                     # (and same POSTGRES_* — leave them premium_hub)

# 1. start ONLY Postgres first
COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d postgres
sleep 10

# 2. restore the database BEFORE the API ever boots (order matters!)
gunzip -c ~/pro_ai_access.sql.gz \
  | sudo docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# 3. now build + start everything (migrations auto-apply on api boot)
sudo docker compose build api
sudo docker compose build admin
sudo docker compose up -d
sudo docker compose ps               # api must be Up (healthy)
```

> If a build fails on `corepack`/`pnpm` with "Connection refused", it's the
> Docker network issue — the daemon.json fix in Phase 1 prevents it. If it still
> happens, retry the build (layers resume) or re-check `/etc/docker/daemon.json`.

Restore Nginx + SSL:

```sh
sudo tar -xzf ~/nginx-backup.tar.gz -C /
sudo nginx -t && sudo systemctl restart nginx
```

If `nginx -t` complains about a missing cert, skip the tar restore and issue
fresh certs instead (after Phase 4 DNS points here):
`sudo certbot --nginx -d admin.never-happened.ir -d api.never-happened.ir`

---

## Phase 4 — Point DNS at the new server

In your DNS panel (Cloudflare), change the **A records** for `api` and `admin`
to **`NEW_IP`**. Lower the TTL first (e.g. 60s) if you can, so it propagates fast.

Confirm from a couple of resolvers:

```sh
dig +short api.never-happened.ir @1.1.1.1     # should print NEW_IP
dig +short api.never-happened.ir @8.8.8.8     # should print NEW_IP
```

---

## Phase 5 — Re-point the Telegram webhook (the step that trips people up)

Telegram **caches the webhook host's IP** and won't reliably re-resolve after a
DNS change. Force it by pinning the IP explicitly to the new server:

```sh
cd ~/pro-ai-access
TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d= -f2-)
SECRET=$(grep TELEGRAM_WEBHOOK_SECRET .env | cut -d= -f2-)
SERVER_IP=$(curl -s https://api.ipify.org)
echo "Pinning Telegram to: $SERVER_IP"

curl -s "https://api.telegram.org/bot$TOKEN/deleteWebhook?drop_pending_updates=true"; echo
curl -s "https://api.telegram.org/bot$TOKEN/setWebhook" \
  --data-urlencode "url=https://api.never-happened.ir/telegram/webhook" \
  --data-urlencode "secret_token=$SECRET" \
  --data-urlencode "ip_address=$SERVER_IP"; echo
curl -s "https://api.telegram.org/bot$TOKEN/getWebhookInfo"; echo
```

`ip_address` makes Telegram connect straight to the new server, bypassing its DNS
cache, while still sending `Host: api.never-happened.ir` so Nginx serves the
right site + cert. (To go back to pure-DNS later, `setWebhook` again without
`ip_address`.)

---

## Phase 6 — Verify (all must pass before decommissioning the old box)

```sh
curl http://127.0.0.1:3001/health                        # {"status":"ok",...}
TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d= -f2-)
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"  # ip = NEW_IP, no last_error, pending 0
```

Then in Telegram:
- send `/start` → bot replies with the menu
- open `https://admin.never-happened.ir` → login works
- do one test purchase end-to-end (charge wallet → buy → receive delivery)

---

## Phase 7 — Decommission the OLD server (only after Phase 6 passes)

```sh
# on the OLD server
cd ~/premium-hub
sudo docker compose down
sudo systemctl disable --now nginx
```

Keep the old server's disk/backup for a few days as a safety net, then delete it.

---

## The gotchas that cause 90% of migration pain

1. **Same `ENCRYPTION_KEY`** — always copy the old `.env`. A new key orphans all
   encrypted payloads.
2. **Restore the DB before the first API boot** — otherwise `migrate deploy`
   creates empty tables and the restore can conflict.
3. **Webhook stuck on the old IP** — use the `ip_address` pin in Phase 5.
4. **Docker build "Connection refused"** — the `daemon.json` DNS+MTU fix (Phase 1).
5. **Don't stop the old server early** — it's your rollback until `/start` works
   on the new one.
