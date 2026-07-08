# CLAUDE.md — Premium Hub

Telegram-first digital-services store: NestJS+grammY bot/API, Next.js 15 admin panel (fa/en RTL), Prisma+PostgreSQL, Docker Compose deploy. GitHub: `shayansdq/premium-hub` (private).

## Commands

```sh
pnpm install
docker compose up -d postgres        # local Postgres on 127.0.0.1:5433
pnpm db:migrate                      # prisma migrate dev (packages/db)
pnpm build                           # shared -> db -> api -> admin (order matters)
pnpm dev:api                         # bot polling + API :3001
pnpm dev:admin                       # panel :3000
cd apps/api && pnpm test             # 21 integration tests (needs postgres container)
```

Tests run against a real `premium_hub_test` database (auto-created by `test/global-setup.ts`). Env for tests is injected by `vitest.config.ts` — no `.env` needed.

## Architecture (where things live)

- `packages/shared` — enums, money helpers (`formatAmount`, `parseAmount`, `durationPrice`), fa/en bot message catalogs (`src/i18n`). **Every user-facing bot string is a key here, in both languages.**
- `packages/db` — Prisma schema/migrations, `encryptPayload`/`decryptPayload` (AES-256-GCM), demo seed.
- `apps/api/src/modules/`
  - `wallet` — ledger-first money core (see invariants below)
  - `payments` — PaymentsService + `providers/` (manual, zarinpal); provider = request/verify pair
  - `fulfillment` — mode strategies + `inventory.service` (SKIP LOCKED claiming)
  - `xui` — 3x-ui (Sanaei) panel client for automatic VPN provisioning; pure link builder in `xui-link.ts`
  - `bot` — grammY: `bot.service` (wiring, polling/webhook), `handlers/` per domain, Postgres-backed sessions (`BotSession`)
  - `admin-api` — REST controllers for the panel, guarded by `AdminAuthGuard` + `@Roles(...)`
  - `settings` — `SettingsService` (60s-cached `Setting` rows) + `TextsService` (built-in messages merged with admin overrides)
- `apps/admin` — Next.js App Router; server components fetch via `src/lib/api.ts` (Bearer token from `admin_token` httpOnly cookie); mutations are inline server actions calling `apiAction`; UI text in `src/lib/i18n.ts` (both languages, always).

## Money invariants (do not weaken)

1. Wallet balance is **never** written directly — every change is a `WalletLedger` row with a globally-unique `reference` (`payment:<id>`, `order:<id>`, `adjust:<uuid>`), created in the same tx that updates the cached balance with a `SELECT … FOR UPDATE` row lock.
2. After a P2002 on the reference, the tx is aborted — resolve the existing row **outside** the transaction (see `wallet.service.ts` catch).
3. Payment approval flips `pending → approved` via `updateMany` (idempotent) and credits inside the same tx.
4. Inventory is claimed with `FOR UPDATE SKIP LOCKED` — never `findFirst`+`update`.
5. Inventory payloads, delivery messages, and provisioned configs are encrypted at rest; never log them.
6. Amounts are `BigInt` Toman; API responses pass through `BigIntInterceptor` (BigInt→string). Keep it when adding controllers.

## Conventions

- New bot flow that awaits user input → add a variant to `SessionData.pending` (`bot.context.ts`); it's Postgres-persisted and restart-safe. Handle it in `misc.handler.ts` `handlePendingText`.
- New bot copy → add the key to BOTH `packages/shared/src/i18n/en.ts` and `fa.ts`; it becomes admin-editable in /bot-texts automatically.
- Multi-month pricing: `durationPrice(base, months, product.durationExtraPercent)` — 100 = ×months, 45 = each extra month adds 45% of base. Used in `orders.service.quote` AND `catalog.handler` tab labels; keep them in sync via the shared helper.
- New payment provider: class beside `zarinpal.provider.ts` with request/verify + callback route; wire into `PaymentsService`, add a method button in `wallet.handler.chooseMethod`.
- New API provisioner (like x-ui): follow `variant.provisioner` + `provisionerConfig` pattern; branch in `fulfillment.service.fulfillOrder` **with a manual-delivery fallback on failure**.
- Catalog deletes: hard delete first, fall back to `isActive=false` cascade — deleted items must vanish from all selects.

## Gotchas (learned the hard way)

- Docker builds need `ENV CI=true` for pnpm and openssl installed in the build stage for Prisma engine detection; schema pins `binaryTargets` for debian x64 + linux arm64.
- `.env` changes require `docker compose up -d --force-recreate api admin` — compose never re-reads env on its own.
- grammY: `webhookCallback()` and `bot.start()` are mutually exclusive — `bot.service.ts` picks by `TELEGRAM_MODE`.
- `TELEGRAM_WEBHOOK_SECRET` must be a random token (hex) — Telegram rejects URLs/special chars.
- Don't enable tsc `incremental` — it breaks Nest's `deleteOutDir` builds.
- Bot startup failures (webhook or polling) are caught and logged, never crash the API; preserve that.

## Deploy

VPS: `git pull && COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build api admin`. Migrations auto-apply on api start (`prisma migrate deploy` in the container CMD). Nginx config: `deploy/nginx/premium-hub.conf`. All ports bind to 127.0.0.1; backups via the `backup` compose service into `./backups/`.
