# Pro Ai Access

Telegram-first storefront for digital services (premium accounts, VPN configs, licenses, gift cards) with a wallet-based purchase flow, hybrid fulfillment, and a bilingual (فارسی/English) web admin panel.

Built as a TypeScript monorepo:

| App / package | Stack | Purpose |
|---|---|---|
| `apps/api` | NestJS 11 + grammY | REST API, Telegram bot, payments, fulfillment |
| `apps/admin` | Next.js 15 + Tailwind 4 | Admin panel (RTL Persian + English) |
| `packages/db` | Prisma 6 + PostgreSQL 16 | Schema, migrations, encryption helpers, seed |
| `packages/shared` | TypeScript | Enums, money helpers, fa/en bot message catalogs |

## Architecture highlights

- **Ledger-first wallet** — balances are never overwritten. Every credit/debit/adjustment is an immutable `WalletLedger` row with a globally-unique `reference` (`payment:<id>`, `order:<id>`), which makes all money operations idempotent. Concurrent operations are serialized with row locks (`SELECT … FOR UPDATE`).
- **Idempotent payment approval** — a payment flips from `pending` exactly once; the wallet credit is deduplicated by the ledger reference. Approving twice (even concurrently) can never double-credit.
- **Race-safe inventory** — auto delivery claims stock with `FOR UPDATE SKIP LOCKED`, so two simultaneous purchases can never receive the same account/config.
- **Encrypted at rest** — inventory payloads and delivery messages are AES-256-GCM encrypted with `ENCRYPTION_KEY`; the admin panel never displays raw payloads after creation.
- **Payment provider registry** — `manual` (card-to-card + receipt photo) and `zarinpal` (request/verify, server-side callback verification) ship today; a crypto processor is just another provider class, no core changes.
- **Restart-safe bot state** — grammY sessions persist in Postgres (`BotSession`), so pending receipt/support/amount flows survive deploys.
- **Editable bot copy** — every bot message/button label can be overridden per-language from the panel (`/bot-texts`); empty fields fall back to built-in defaults; the menu router recognizes customized/emoji labels.
- **Real admin auth** — `AdminUser` accounts (argon2) with roles (`owner`, `operator`, `support`, `catalog_manager`), 30-day sessions, and an `AuditLog` for every sensitive action from day one.

## Local development

Requirements: Node 22+, pnpm 10, Docker.

```sh
cp .env.example .env            # fill in TELEGRAM_BOT_TOKEN etc.
pnpm install
docker compose up -d postgres   # localhost:5433
pnpm db:migrate                 # prisma migrate dev
pnpm --filter @pro-ai-access/db build && pnpm db:seed   # demo catalog (optional)
pnpm dev:api                    # bot in polling mode + API on :3001
pnpm dev:admin                  # admin panel on :3000
```

- With `TELEGRAM_MODE=polling` no public domain is needed — message your bot right away.
- The initial owner admin is created on API boot from `ADMIN_INITIAL_EMAIL` / `ADMIN_INITIAL_PASSWORD`.

### Tests

Money-critical paths (ledger idempotency, double-approval, overdraw, inventory double-sell race, discount rules, duration pricing) are covered by integration tests against a real Postgres:

```sh
docker compose up -d postgres
pnpm --filter @pro-ai-access/api test
```

## Production deployment (VPS + Docker Compose)

```sh
git clone <this-repo> pro-ai-access && cd pro-ai-access
cp .env.example .env
nano .env       # real secrets! use: openssl rand -hex 32
COMPOSE_PARALLEL_LIMIT=1 docker compose up -d --build
docker compose ps
```

Production `.env` essentials:

```env
NODE_ENV=production
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://api.your-domain.com
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 32>
PUBLIC_API_URL=https://api.your-domain.com
ADMIN_WEB_URL=https://admin.your-domain.com
API_INTERNAL_URL=http://api:3001
```

The API container applies `prisma migrate deploy` automatically on start, then sets the Telegram webhook itself (with secret-token validation). All container ports bind to `127.0.0.1` only; Postgres is never published beyond localhost. A `backup` container runs daily `pg_dump` into `./backups/` (14-day retention).

### Nginx

```nginx
server {
  server_name admin.your-domain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
server {
  server_name api.your-domain.com;
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```sh
sudo certbot --nginx -d admin.your-domain.com -d api.your-domain.com
```

### Updating

```sh
git pull
COMPOSE_PARALLEL_LIMIT=1 docker compose up -d --build api admin
docker compose logs api --tail=100
```

### Health checks

```sh
curl https://api.your-domain.com/health            # {"status":"ok"}
docker compose ps                                  # all Up
TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d= -f2-)
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

## Admin panel map

`/login` → session · `/` dashboard · `/operations` pending receipts (photo visible) + manual deliveries · `/orders` `/payments` filterable lists · `/users` + `/users/[id]` (ledger, orders, payments, wallet adjust) · `/catalog/{categories,products,variants,inventory}` full create/edit/delete with selects · `/discounts` · `/support` + ticket threads · `/bot-texts` per-language copy editor · `/payment-settings` card details + wallet presets · `/audit` owner-only action log.

## Bot UX map

Reply-keyboard menu (📦 👛 🧾 🛒 🎁 💬 👤 🌐) → catalog browsing edits a single message (category → product → plans), with `optionGroup` tabs and VPN duration tabs (۱-۴ ماه, price × months). Wallet: balance → charge → admin-configured presets or custom amount → card-to-card (exactly one receipt photo; admins get the photo + approve/reject buttons) or Zarinpal. Checkout confirms with price/balance, debits the wallet, delivers stock instantly (decrypted payload) or queues manual delivery. `/admin` gives Telegram admins pending payments (with photos) and deliveries. `/start`, `/language`, `/topup` (legacy shortcut) round it out.

## Extending (designed-for roadmap)

- **Gift cards** — create a product with `kind=gift_card` and `auto_inventory`; codes are encrypted inventory items. No code changes needed.
- **Crypto payments** — implement the provider trio (`request`/`verify`/callback) beside `zarinpal.provider.ts`, register it in the payments module, add a method button in the bot's `chooseMethod`.
- **Live pricing** — the `PriceRate` table is ready; add a `PriceSource` adapter (e.g. USD→IRT feed) and a scheduled refresh, then compute variant prices from base currency + markup.
- **More languages** — add a catalog to `packages/shared/src/i18n` and extend the `Language` enum.

## Security notes

- Never commit `.env`; rotate any token that ever leaks (BotFather token, admin password, secrets).
- `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` must be distinct random values — changing `ENCRYPTION_KEY` makes existing encrypted inventory unreadable.
- Telegram webhook requests are verified via `X-Telegram-Bot-Api-Secret-Token`.
- Receipt uploads and support messages are rate-limited per user.
