# Premium Hub — AI/Developer Handoff Guide

This document describes the system **as actually built** (July 2026 rebuild). It supersedes all earlier drafts. The Persian product spec (`PREMIUM_HUB_AI_PRODUCT_SPEC_FA.md`) remains valid for product intent; where its stack details differ, this file wins. Engineering conventions live in `CLAUDE.md`; day-to-day store operation in `OPERATIONS_GUIDE_FA.md`.

## Working mode for the next AI

Plan first, implement second. Never guess business rules that affect money, credentials, or customer access — read the code (it is the source of truth) and ask only high-impact questions. Never request or store real secrets; if a secret was ever pasted into a chat, tell the owner to rotate it.

## What this system is

A Telegram-first storefront selling digital services: premium accounts (Spotify/ChatGPT/…), VPN configs with automatic provisioning, licenses, codes — extensible to gift cards and crypto payments. Users buy through a Telegram bot with a ledger-based wallet; the owner operates through a bilingual web admin panel and a Telegram quick panel.

## Stack

TypeScript everywhere, pnpm monorepo:

| Piece | Tech |
|---|---|
| API + bot (one app) | NestJS 11, grammY 1.x |
| Admin panel | Next.js 15 App Router, Tailwind 4, hand-rolled fa/en i18n with RTL |
| Database | PostgreSQL 16, Prisma 6 (`packages/db/prisma/schema.prisma`) |
| Deploy | Docker Compose (postgres/api/admin/backup), Nginx + certbot on the VPS |
| Tests | Vitest integration tests against a real Postgres (21 tests, money + races) |

Repo: `github.com/shayansdq/premium-hub` (private). Production runs on the owner's VPS behind `admin.never-happened.ir` / `api.never-happened.ir` (Nginx template: `deploy/nginx/premium-hub.conf`).

## Core flows (implemented and verified)

1. **/start** → user + wallet created; greeting by Telegram first name; Persian default; emoji reply-keyboard menu; all labels/messages admin-editable (Setting `bot_messages`, merged over built-ins by `TextsService`).
2. **Catalog** → categories → products → plans, all by editing one message. Plans group under `optionGroup` tabs. Products with `useDurationTabs` show ۱-۴ ماه tabs; price = `durationPrice(base, months, durationExtraPercent)` where each extra month adds N% of base (per-product setting; 100 = ×months, owner uses 45 for VPNs).
3. **Wallet top-up** → presets (admin-configured in `manual_payment_settings`) or custom amount → card-to-card (exactly ONE receipt photo; text/files rejected; cancellable) or Zarinpal (request/verify adapter, server-side callback verification only). Receipt goes to all `TELEGRAM_ADMIN_IDS` as a photo with approve/reject buttons AND to the panel /operations page with the image. Approval credits the wallet idempotently (`payment:<id>` ledger reference) and notifies the user with amount + new balance.
4. **Checkout** → price snapshot into OrderItem, optional discount code (validated: active/expiry/max-uses/per-user/min-order), wallet debit + order + redemption in one transaction, shortfall prompt with exact-amount charge button.
5. **Fulfillment** (priority order):
   - `variant.provisioner === 'xui'` → **automatic VPN provisioning** on a 3x-ui (Sanaei) panel: client created on the plan's inbound with volume = plan-GB × months and expiry = months × 30 days; buyer receives subscription link + direct config link (vless/vmess/trojan built from inbound stream settings) + QR image + editable notes (`delivery.vpnNotes`). Panel failure → manual delivery fallback + admin alert. Delivery meta stores clientEmail/uuid/subId for traffic lookups.
   - `auto_inventory` / `hybrid_prefer_inventory` → claim encrypted inventory with `FOR UPDATE SKIP LOCKED` (double-sell impossible), decrypt, send to buyer, mark delivered.
   - `manual_admin` (and hybrid without stock) → pending Delivery + admin notification; sent later from /operations or reflected in "My Services".
6. **Orders / My Services** → inline button lists with detail views; services show the decrypted delivered payload and, for x-ui services, live remaining traffic from the panel.
7. **Support** → tickets + messages, admin replies from the panel push to the user's Telegram.
8. **/admin (Telegram)** → pending receipt photos with approve/reject, pending deliveries.

## Data model notes

All models in `packages/db/prisma/schema.prisma`. Highlights: `WalletLedger` (immutable, unique `reference`, signed amounts, `balanceAfter`); `ProductVariant.provisioner` + `provisionerConfig` (`{inboundId, gb}`); `Product.useDurationTabs` + `durationExtraPercent`; `Delivery.type` (`auto_inventory | auto_api | manual`) + encrypted `payloadEnc` + `meta`; `AdminUser` (argon2, roles owner/support/operator/catalog_manager) + hashed-token `AdminSession`; `AuditLog` written for every sensitive action; `BotSession` (grammY session persistence); `PriceRate` (reserved for future live pricing).

## Security model

- Admin panel: session token in httpOnly cookie on the admin domain; Next server forwards it as Bearer to the API; roles enforced by guard (`owner` bypasses).
- Telegram webhook: secret-token validated by grammY; **the secret must be a random hex string** (Telegram rejects URLs — this actually happened, see Incident log).
- Encryption: AES-256-GCM via `ENCRYPTION_KEY` for inventory payloads, delivery texts, provisioned configs. Changing the key orphans existing ciphertexts.
- x-ui panel credentials only in env (`XUI_BASE_URL/USERNAME/PASSWORD`, `XUI_SUB_BASE_URL`, optional `XUI_PUBLIC_HOST`); the admin API never exposes them.
- Docker ports bound to 127.0.0.1; Postgres unpublished except localhost:5433 for dev; daily `pg_dump` backups (14-day retention).

## Incident log (real production issues + fixes)

1. **API crash-loop, empty webhook** — `.env` had the template `api.example.com` as webhook URL and a real URL in the SECRET field. Fix: correct values; code now survives webhook failure without crashing (logged error instead).
2. **"Application error" on admin login** — API container down; login action crashed on fetch. Fix: `apiLogin` never throws; login form distinguishes "invalid credentials" from "API unreachable".
3. **No admin navigation on mobile** — sidebar was `md:` only. Fix: `<details>` hamburger header (no JS).
4. **Prisma engine mismatch in Docker** — build stage had no openssl → engine fell back to openssl-1.1 while runtime needed 3.0.x. Fix: install openssl in build stage + pinned `binaryTargets`.
5. **`pnpm prune --prod` fails in workspaces** — replaced with prod-only re-install + regenerate Prisma client; `ENV CI=true` required.
6. **Wallet duplicate-reference race** — after P2002 the tx is aborted; the old code queried inside it. Fix: resolve the existing ledger row outside the tx. Covered by tests.
7. **Env edits ignored** — Docker doesn't re-read `.env`; always `up -d --force-recreate`.

## Deploy runbook

```sh
# first time
gh repo clone shayansdq/premium-hub && cd premium-hub
cp .env.example .env && nano .env       # see README for required values
COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build
# nginx + certbot: deploy/nginx/premium-hub.conf

# updates
git pull && COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build api admin

# health
curl https://api.<domain>/health
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"   # url set, no last_error
```

Webhook registers itself on api start. Migrations apply automatically (`prisma migrate deploy` in container CMD).

## Roadmap hooks (designed, not yet built)

- **Gift cards**: product `kind=gift_card` + inventory codes — works today, zero code.
- **Crypto payments**: new provider class beside `zarinpal.provider.ts` (request/verify/callback) + a method button in `wallet.handler.chooseMethod`.
- **Live pricing**: `PriceRate` table exists; add a rate-source adapter + scheduled refresh, then derive variant prices from base currency + markup.
- **x-ui extensions**: renewal (extend expiry/volume of existing client via `updateClient`), auto-disable notifications, multi-panel support (make panel credentials per-inbound instead of global env).
- **Admin**: additional admin users UI, 2FA, audit filters.
