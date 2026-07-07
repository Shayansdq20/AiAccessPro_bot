# Premium Hub Telegram Bot - AI Handoff Guide

This file is written for another AI engineer/model that will continue, recreate, audit, or extend this project. Treat it as the source of product context and engineering constraints before making decisions.

## Mandatory Working Mode

Before implementing anything, start in **Plan Mode**.

The next AI must not immediately write code. It should first:

1. Inspect the repository and current deployment state.
2. Restate the product goal and current implementation.
3. Ask only high-impact questions that cannot be answered from the repo.
4. Produce a decision-complete implementation plan.
5. Wait for approval before making large changes, unless the user explicitly asks to implement a small fix.

Use this exact principle:

> Plan first, implement second. Do not guess business rules, payment behavior, fulfillment rules, or admin permissions when they can materially affect money, credentials, or customer access.

## One-Shot Prompt For Another AI

You can paste this section into another AI model:

```text
You are helping me build and improve a professional Telegram commerce bot called Premium Hub.

Start in Plan Mode. First inspect the repo and understand the current implementation. Do not code immediately.

The bot sells digital services such as Spotify Premium, ChatGPT Plus, Gemini Premium, VPN plans by location, and other account/config-based services. Users interact mostly through Telegram. Each user is identified by their Telegram unique ID and gets a profile, wallet, random display username, order history, service history, discount usage, and support tickets.

The system has:
- Telegram bot UX for users and admins.
- Wallet ledger.
- Manual receipt payments.
- Zarinpal-ready online gateway adapter.
- Product categories, products, variants, options.
- Hybrid fulfillment: automatic inventory delivery or manual admin delivery.
- Admin web panel.
- Admin login page.
- Persian/English language support for Telegram bot and admin panel.
- PostgreSQL database through Prisma.
- Docker Compose deployment on VPS.
- Nginx + HTTPS domains:
  - admin.never-happened.ir
  - api.never-happened.ir

Your first task is to understand what already exists, identify risks/gaps, and produce a plan before implementation.

Important constraints:
- Never expose secrets or bot tokens.
- Treat money and wallet operations as high-risk.
- Wallet balance must be ledger-based and idempotent.
- Sensitive inventory payloads must stay encrypted at rest.
- Admin actions should be auditable.
- Use existing stack and patterns unless there is a strong reason not to.
- For deployment, prefer Docker Compose and avoid manual one-off server changes unless documented.

After your plan is approved, implement carefully, test, and explain exactly how to deploy the change.
```

## Product Summary

Premium Hub is a Telegram-first digital services storefront.

The intended users are customers who buy digital products/services from a Telegram channel or bot. The owner/admin manages products, prices, inventory, payments, orders, fulfillment, discounts, support, and users.

Primary products include:

- Spotify Premium accounts
- ChatGPT Plus accounts
- Gemini Premium accounts
- VPN subscriptions/configs by location
- Other digital accounts, codes, credentials, or service access

Core UX goals:

- Fast purchase flow inside Telegram.
- Clear wallet balance and exact top-up amount.
- Manual payment option from day one.
- Online payment provider integration ready for later use.
- Admin can manage urgent operations from Telegram.
- Admin can manage catalog and operations from a web panel.

## Current Stack

- Language: TypeScript
- Backend/API: NestJS
- Telegram bot: Telegraf
- Database: PostgreSQL
- ORM: Prisma
- Admin panel: Next.js App Router
- Deployment: Docker Compose
- Reverse proxy: Nginx
- SSL: Certbot / Let's Encrypt

Important paths:

- `apps/api`: NestJS API and Telegram bot
- `apps/admin`: Next.js admin panel
- `prisma/schema.prisma`: database schema
- `prisma/migrations`: production migrations
- `docker-compose.yml`: services for PostgreSQL, API, admin
- `docker/api.Dockerfile`: API image
- `docker/admin.Dockerfile`: admin image
- `.env.example`: environment template
- `README.md`: basic setup guide

## Current Deployment Context

Production-like VPS domains:

- Admin panel: `https://admin.never-happened.ir`
- API/webhook: `https://api.never-happened.ir`

Docker exposed ports:

- Admin: `3000`
- API: `3001`
- PostgreSQL: `5432`

Nginx proxies:

- `admin.never-happened.ir` -> `127.0.0.1:3000`
- `api.never-happened.ir` -> `127.0.0.1:3001`

Telegram webhook should be:

```text
https://api.never-happened.ir/telegram/webhook
```

The VPS is small. Building Docker images on `1 CPU / 1GB RAM / 10GB disk` is slow and fragile. Prefer at least:

```text
Minimum: 2 CPU / 2GB RAM / 25GB storage
Better: 2 CPU / 4GB RAM / 40GB storage
```

If staying on small VPS, use swap and serial compose builds:

```sh
COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build
```

## Environment Variables

Never commit `.env`. Never paste real tokens into public chats.

Required production values:

```env
NODE_ENV=production
DATABASE_URL=postgresql://premium_hub:premium_hub@postgres:5432/premium_hub?schema=public
API_PORT=3001

ADMIN_WEB_URL=https://admin.never-happened.ir
PUBLIC_API_URL=https://api.never-happened.ir
NEXT_PUBLIC_API_URL=http://api:3001

TELEGRAM_BOT_TOKEN=replace-with-real-botfather-token
TELEGRAM_WEBHOOK_URL=https://api.never-happened.ir
TELEGRAM_ADMIN_IDS=replace-with-numeric-telegram-id

JWT_SECRET=replace-with-random-secret
ADMIN_API_TOKEN=replace-with-random-secret
ADMIN_PANEL_PASSWORD=replace-with-strong-admin-password
ENCRYPTION_KEY=replace-with-random-secret
CURRENCY=IRT

ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=true
ZARINPAL_CALLBACK_URL=https://api.never-happened.ir/payments/zarinpal/callback
```

Generate secrets:

```sh
openssl rand -hex 32
```

Use different values for `JWT_SECRET`, `ADMIN_API_TOKEN`, and `ENCRYPTION_KEY`.
Use a strong separate value for `ADMIN_PANEL_PASSWORD`.

If any real secret was shared with an AI, rotate it immediately.

## Database Model

The Prisma schema models the main commerce system.

Core entities:

- `User`: Telegram identity, generated display username, status.
- `User.language`: persisted language preference, currently `fa` or `en`.
- `Wallet`: one wallet per user.
- `WalletLedger`: immutable wallet entries with `balanceAfter`; wallet balance must be derived from ledger.
- `ProductCategory`: product grouping.
- `Product`: service family.
- `ProductVariant`: purchasable plan with price, fulfillment mode, and optional `optionGroup` for Telegram tab-style grouping such as `1 month`, `2 months`, or `4 months`.
- `ProductOption`: configurable options for a product.
- `InventoryItem`: encrypted ready-to-deliver account/config/license.
- `Order`: purchase record with price snapshot.
- `OrderItem`: purchased variant snapshot.
- `Payment`: manual or gateway top-up/payment record.
- `ManualReceipt`: Telegram file receipt and admin decision.
- `DiscountCode`: percent/fixed discount configuration.
- `DiscountRedemption`: per-user/order usage record.
- `Delivery`: automatic or manual delivery record.
- `SupportTicket`: support conversation container.
- `SupportMessage`: user/admin messages.
- `AdminUser`: future role-based admin identity.
- `AuditLog`: future sensitive action log.
- `Setting`: runtime/config storage.
  - `bot_messages`: JSON object used for editable Telegram button labels and bot message templates.

Important enums:

- `FulfillmentMode`: `auto_inventory`, `manual_admin`, `hybrid_prefer_inventory`
- `PaymentType`: `manual`, `gateway`
- `PaymentStatus`: `pending`, `approved`, `rejected`, `failed`, `cancelled`
- `OrderStatus`: `pending_payment`, `paid`, `fulfilling`, `delivered`, `cancelled`, `refunded`
- `DiscountType`: `percent`, `fixed`

Production migrations exist under `prisma/migrations`. `docker-compose.yml` runs:

```sh
npx prisma migrate deploy
```

This must stay true for production deploys.

## Telegram Bot UX

Current user-facing menu:

- English: `Products`, `Wallet`, `My Services`, `Orders`, `Discount Code`, `Support`, `Profile`, `Language`
- Persian: `محصولات`, `کیف پول`, `سرویس‌های من`, `سفارش‌ها`, `کد تخفیف`, `پشتیبانی`, `پروفایل`, `زبان`

Commands:

- `/start`: creates/updates user profile from Telegram ID and shows main menu.
- `/topup <amount>`: legacy/manual shortcut only. The preferred UX is the wallet screen button flow.
- `/admin`: shows Telegram admin quick panel if sender Telegram ID is in `TELEGRAM_ADMIN_IDS`.
- `/language`: lets user choose Persian or English.

Current flow:

1. User sends `/start`.
2. Bot creates user and wallet if not already present.
3. User sees a friendly greeting using their Telegram saved name first, then Telegram username, then generated display username.
4. User browses categories/products/variants in a single-message inline flow where possible.
   - Telegram shows categories first.
   - After category selection, the same bot message should be edited to show product buttons.
   - After product selection, the same bot message should be edited to show plan/variant buttons.
   - If variants have `optionGroup`, Telegram should show tab-like buttons at the top, for example `1 month`, `2 months`, `3 months`, `4 months`.
   - Selecting an option group edits the same message and updates the visible plan/price buttons under that group.
   - VPN/config products have special duration tabs even if separate monthly variants do not exist. The bot shows `1`, `2`, `3`, and `4` month tabs, multiplies the base plan price by the selected duration, and stores the selected duration in the order item options.
5. User selects a variant.
5. System quotes price.
6. If wallet has enough balance, order is created and wallet debited.
7. If balance is low, bot prompts exact top-up amount.
8. Wallet top-up is button-first:
   - user taps Wallet
   - user sees balance
   - user taps Charge Wallet
   - bot shows admin-configurable preset buttons plus Custom Amount
   - custom amount asks for a number, then continues to payment method
9. User chooses manual receipt or online gateway.
10. Manual payment shows admin-configurable card/payment instructions before asking for the receipt.
11. Manual receipts must be exactly one Telegram photo. Text/files during receipt collection should be rejected with a helpful message.
12. User can cancel pending manual receipt upload and return to the menu.
13. Manual receipts are sent to admins for approve/reject with full user/payment context and the actual receipt photo visible.
    - Telegram admin notification must use `sendPhoto` with the receipt image, caption, and approve/reject buttons.
    - If `sendPhoto` is unreliable, bot must forward/copy the original user receipt message to admins and then send approve/reject controls.
    - Web admin operations page must display the receipt image before approve/reject.
    - Never ask an admin to approve a manual receipt from text-only metadata.
14. Approved payments credit wallet idempotently and notify the user that the wallet was charged, including charge amount and new balance.
15. Fulfillment is automatic if inventory exists, otherwise pending manual admin delivery.
16. Auto-inventory delivery must send the actual decrypted service/account/config details to the user after purchase.

Fulfillment mode behavior:

- `auto_inventory`: product must be fulfilled from available inventory. If no inventory exists, it should create a clear pending delivery and tell the admin exactly that inventory is missing.
- `manual_admin`: always creates pending delivery for admin to manually send service details.
- `hybrid_prefer_inventory`: uses inventory when available; otherwise falls back to pending manual delivery.
- If an admin believes inventory exists but the order becomes pending, check that the inventory item belongs to the exact purchased variant and has status `available`.

Known UX gaps:

- Discount code entry is not yet a full conversation flow.
- Product options are modeled but not fully integrated into Telegram checkout.
- User state is currently in-memory for pending support/payment receipt flows; it should be persisted for production resilience.
- Bot copy is localized in Persian/English and can be overridden from the admin panel for core menu labels and bot messages.

Editable bot text behavior:

- Admins manage editable bot copy from `/bot-texts`.
- Values are stored in `Setting.key = bot_messages`.
- Empty fields fall back to built-in defaults.
- Template messages support placeholders such as:
  - `{username}`
  - `{amount}`
  - `{id}`
  - `{status}`
  - `{balance}`
  - `{telegramId}`
- If menu button labels are changed, the Telegram reply keyboard uses the new labels and the bot text handler recognizes the new labels.
- Manual receipt prompts and payment approval notifications should also be editable or generated from admin-configured settings.
- Wallet must never instruct normal users to use `/topup` in the primary UX. Even if an old editable `walletBalance` override exists, the bot should use the button-first wallet flow.
- Orders and My Services should use inline "glass" buttons like product/language selection. The list screen shows buttons, and tapping an item opens the detailed order/service view.

Manual payment requirements:

- Admin must be able to configure card/payment instructions from the web panel:
  - card number
  - payable recipient full name
  - optional bank name
  - optional extra instructions
- These settings are stored in `Setting.key = manual_payment_settings`.
- Wallet preset amounts and labels are also stored in `manual_payment_settings`.
- When the user chooses manual wallet charge, the bot must show:
  - exact amount
  - card number
  - recipient name
  - extra notes
  - a cancel option
- The bot must accept only one receipt photo. It should not accept text or document receipts in this step.
- The submitted receipt photo must be visible in Telegram admin tools and the web admin panel. Approval without seeing the image is not acceptable.
- After successful admin approval, the bot must notify the user with the credited amount and current wallet balance.

Delivery display requirements:

- User-facing order and service views must show product title, variant/plan title, total, status, and delivery state, not just raw order IDs.
- If a product variant uses `auto_inventory` or `hybrid_prefer_inventory` and inventory exists, the bot must send the decrypted inventory payload to the buyer after wallet purchase.
- Admin receipt notifications should include enough context to approve safely: user display name, Telegram ID, amount, and payment ID.

## Admin Panel

Current Next.js pages:

- `/login`: password-protected admin login.
- `/`: dashboard metrics
- `/users`: searchable user list with Telegram identity, wallet balance, and activity counts
- `/users/[id]`: user profile, wallet ledger, orders, payments, support tickets, and wallet adjustment
- `/catalog`: catalog overview and navigation hub
- `/catalog/categories`: create/list categories, view product count, and delete categories
- `/catalog/products`: create/list products with category select, relation display, plan counts, and delete products
- `/catalog/variants`: create/list purchasable plans with product select, price, fulfillment mode, order count, and inventory status breakdown
- `/catalog/inventory`: create/list encrypted inventory payloads with exact category/product/plan relation, status, reserved order, and delete/retire action
- `/bot-texts`: edit Telegram button labels and bot messages in Persian/English
- `/payment-settings`: configure manual payment/card instructions shown by the Telegram bot
- `/operations`: approve/reject payments and send manual deliveries
- `/support`: view support tickets

Admin API protection:

- API admin routes use `ADMIN_API_TOKEN`.
- The Next.js server sends the token to the API.
- Browser admin pages are protected by a first-pass `ADMIN_PANEL_PASSWORD` login and an HTTP-only cookie.

Current catalog improvements:

- Admin no longer needs to manually type `categoryId`, `productId`, or `variantId`.
- Category/product/plan forms use select controls.
- The catalog overview shows high-level counts and links to dedicated entity pages.
- Each catalog entity has a focused page instead of one crowded mixed page.
- Plan creation supports an optional group/duration field (`optionGroup`). Plans with the same product and group are shown under the same Telegram tab.
- Inventory counts are no longer shown as one ambiguous total. Plan rows show `available`, `reserved`, `delivered`, and `retired` counts.
- `available` inventory is the important count for `auto_inventory`; delivered or retired inventory must not be treated as sellable stock.
- Delete actions remove catalog entities from admin lists and selection controls so deleted products/plans cannot be selected again by mistake.
- The API attempts hard delete first. If historical order relations prevent physical deletion, the record and its children are hidden by setting them inactive, so they no longer appear in product, plan, or inventory selection screens.
- Available inventory can be physically deleted. Non-available inventory can be retired and hidden to preserve operational history.
- The Telegram button hierarchy is explicit: category button -> product button -> plan button.
- Main Telegram menu buttons and important inline buttons should have tasteful emojis for better visual scanning. The bot should still recognize reply-keyboard buttons even when the label has an emoji prefix or is customized from the admin panel.

Current user management improvements:

- Admin can search users by Telegram ID, Telegram username, first name, last name, or generated display username.
- Admin can open a user detail page instead of managing everything in one dashboard screen.
- User detail page shows profile data, wallet balance, wallet ledger, orders, payments, and support tickets.
- Wallet changes are made through audited-style ledger entries via the wallet service, not by overwriting the balance.

Current bot text management improvements:

- Admin can edit/delete custom text by clearing fields in `/bot-texts`.
- Button labels and message templates are saved to the database and picked up by the bot with a short cache.
- This keeps Telegram UX configurable without code changes for common copy and button naming changes.

Known admin gaps:

- No full edit UI for existing catalog entities yet; current controls cover create/list/delete-safe.
- No dedicated list pages for payments beyond pending operations and user detail history.
- No audit log UI yet.
- Current login is simple password/cookie auth. It should be upgraded to a full admin user/session system.
- Wallet adjustment actions should be connected to explicit `AuditLog` records with acting admin identity once full admin users exist.

Recommended next admin improvements:

1. Upgrade login from shared password to admin users, sessions, roles, and optional 2FA.
2. Add edit/disable/delete product, category, variant, discount, and inventory flows.
3. Add inventory list with status and bulk import.
4. Add dedicated order/payment list pages with filtering and status actions.
5. Add audit log page.
6. Add role enforcement in the UI and API.
7. Add richer per-product Telegram button layouts and option builders from the admin panel.

## Payment System

Manual payment:

- Implemented.
- User submits receipt file through Telegram.
- Admin approves/rejects.
- Approval credits wallet with idempotent reference `payment:<paymentId>`.

Gateway payment:

- Zarinpal provider adapter exists.
- Request/verify structure exists.
- Merchant ID and callback URL must be configured.
- Gateway flow should be tested with Zarinpal sandbox/production before real launch.

Important payment rules:

- Do not credit a payment twice.
- Do not debit wallet if balance is insufficient.
- Do not overwrite wallet balance directly.
- All manual admin wallet adjustments must create ledger entries and audit logs.

## Fulfillment System

Fulfillment modes:

- `auto_inventory`: deliver an available `InventoryItem`.
- `manual_admin`: create pending delivery for admin.
- `hybrid_prefer_inventory`: deliver inventory if available, otherwise pending manual delivery.

Inventory payloads are encrypted at rest through `CryptoService`.

Important fulfillment rules:

- Never expose raw inventory payloads in logs.
- Mark inventory delivered after use.
- Manual delivery should be recorded in `Delivery`.
- Future improvement: notify user automatically with decrypted delivery payload after successful fulfillment.

## Security Requirements

Mandatory:

- Rotate leaked tokens immediately.
- Keep `.env` out of Git.
- Keep Telegram bot token private.
- Keep `ADMIN_API_TOKEN` private.
- Encrypt inventory payloads.
- Use HTTPS for Telegram webhook.
- Use idempotent references for payments and wallet entries.
- Back up PostgreSQL.

Recommended hardening:

- Add Telegram webhook secret token validation.
- Add rate limits for support and payment receipt uploads.
- Add admin login with password or Telegram OAuth-like flow.
- Replace the first-pass admin password cookie with proper admin users and session rotation.
- Add role enforcement for admin actions.
- Add audit logs for all payment, wallet, delivery, catalog, and discount changes.
- Restrict PostgreSQL port from public internet; ideally remove `5432:5432` from production compose unless remote DB access is required.
- Restrict Docker published ports `3000` and `3001` to localhost if Nginx is on the same machine.

Production port hardening example:

```yaml
ports:
  - "127.0.0.1:3001:3001"
```

and:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

## Deployment Runbook

Basic VPS deploy:

```sh
git clone https://github.com/shayansdq/premmium_hub_telegram_bot.git
cd premmium_hub_telegram_bot
cp .env.example .env
nano .env
COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build
sudo docker compose ps
```

After code updates:

```sh
cd ~/premmium_hub_telegram_bot
git pull
COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build
sudo docker compose logs api --tail=120
sudo docker compose logs admin --tail=120
```

Nginx should proxy:

```nginx
server {
  server_name admin.never-happened.ir;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  server_name api.never-happened.ir;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

SSL:

```sh
sudo certbot --nginx -d admin.never-happened.ir -d api.never-happened.ir
```

Telegram webhook:

```sh
TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d= -f2-)
curl -X POST "https://api.telegram.org/bot$TOKEN/deleteWebhook"
curl -X POST "https://api.telegram.org/bot$TOKEN/setWebhook" -d "url=https://api.never-happened.ir/telegram/webhook"
curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

## Troubleshooting Notes From This Deployment

Issues already encountered and fixed:

- Admin Docker build failed because `apps/admin/public` did not exist.
  - Fixed by adding `apps/admin/public/.gitkeep`.
- Admin container restarted because root `/app/package.json` was missing.
  - Fixed in `docker/admin.Dockerfile`.
- Bot received `/start` but failed because database tables did not exist.
  - Fixed by adding initial Prisma migration.
- VPS with `1 CPU / 1GB RAM / 10GB storage` builds very slowly.
  - Use swap, serial compose build, or upgrade VPS.
- Browser on one network could not reach admin while mobile could.
  - Server was fine; issue was laptop/network/DNS/cache path.

Useful checks:

```sh
sudo docker compose ps
sudo docker compose logs api --tail=120
sudo docker compose logs admin --tail=120
sudo ss -tulpn | grep -E ':80|:443|:3000|:3001'
curl -L https://admin.never-happened.ir | head -40
curl -I https://api.never-happened.ir
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" https://api.never-happened.ir/admin/dashboard
```

Expected:

- Admin root returns HTML with `Premium Hub Admin`.
- `/login` should be required before admin pages if no valid `admin_session` cookie exists.
- API root returns `404`; this is normal because `/` has no route.
- `/admin/dashboard` returns `401` without token; this is normal.
- Telegram `/start` should create a user and return the menu after migrations are applied.

## Testing

Current automated tests are minimal:

```sh
npm test
```

Build check:

```sh
npm run build
```

Prisma schema validation:

```sh
DATABASE_URL='postgresql://premium_hub:premium_hub@localhost:5432/premium_hub?schema=public' npx prisma validate
```

## Production Troubleshooting Notes

- If API logs show `TypeError: Do not know how to serialize a BigInt`, the API is trying to return Prisma `BigInt` fields such as `User.telegramId` directly as JSON. The project includes a global response middleware in `apps/api/src/main.ts` using `serializeBigInt` to convert all nested bigint values to strings before Express sends JSON. Keep this behavior in place when adding new admin or bot API responses.
- If `docker compose ps` does not show `premium_hub_telegram_bot-api-1` as `Up`, the bot webhook and admin API will not work even if the admin Next.js container is running. Check `sudo docker compose logs api --tail=120`, fix the startup error, then rebuild only the API when possible.
- After pulling code on the VPS, rebuild and recreate the API/admin containers so Docker does not keep running old images:

```sh
cd ~/premmium_hub_telegram_bot
git pull
COMPOSE_PARALLEL_LIMIT=1 sudo docker compose up -d --build api admin
sudo docker compose ps
```

Recommended test expansion:

- Wallet credit/debit idempotency.
- Manual payment approve/reject idempotency.
- Discount expiry, max uses, per-user limit.
- Inventory auto delivery and fallback to manual delivery.
- Telegram `/start` integration with test database.
- Admin API authorization.
- Zarinpal request/verify mocked tests.

## Recommended Next Development Plan

Before coding, create a Plan Mode proposal around these priorities:

1. Stabilize production security.
   - Rotate leaked secrets.
   - Add webhook secret validation.
   - Bind Docker ports to `127.0.0.1`.
   - Close public PostgreSQL port.

2. Improve admin usability.
   - Upgrade login/session.
   - Add product/category/variant listing.
   - Replace raw ID inputs with selects.
   - Add edit/deactivate buttons.

3. Complete buyer UX.
   - Add Persian copy.
   - Expand and polish both Persian and English copy.
   - Add discount-code conversation.
   - Add product option selection.
   - Add clear order confirmation and delivery messages.

4. Make bot state durable.
   - Persist pending receipt/support states.
   - Handle restart-safe conversations.

5. Production payments.
   - Finish and sandbox-test Zarinpal.
   - Add success/failure redirect pages.
   - Record provider reference and audit trail.

6. Operations and monitoring.
   - Add daily backup cron.
   - Add health check endpoint.
   - Add basic logging/alerts.
   - Add CI/CD or prebuilt Docker images so small VPS does not build from source.

## Definition Of Done For A Production Launch

The system is launch-ready only when:

- `/start` works from Telegram.
- Admin can create at least one category, product, variant, and inventory item.
- User can top up wallet manually.
- Admin can approve receipt.
- User can purchase with wallet.
- Delivery works for both auto inventory and manual delivery.
- Admin dashboard loads over HTTPS.
- API webhook is configured and has no fresh Telegram errors.
- PostgreSQL has backups.
- All leaked or shared secrets are rotated.
- Domain DNS works from multiple networks.
- Docker containers are `Up` after reboot.
