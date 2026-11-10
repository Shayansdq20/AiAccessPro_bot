# ---------- build ----------
FROM node:22-slim AS build
ENV CI=true
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/storefront/package.json apps/storefront/
RUN pnpm install --frozen-lockfile --filter @pro-ai-access/shared --filter @pro-ai-access/storefront

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/storefront apps/storefront

RUN pnpm --filter @pro-ai-access/shared build \
 && pnpm --filter @pro-ai-access/storefront build

# ---------- runtime (Next.js standalone) ----------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/storefront/.next/standalone ./
COPY --from=build /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build /app/apps/storefront/public ./apps/storefront/public

EXPOSE 3002
ENV PORT=3002 HOSTNAME=0.0.0.0
CMD ["node", "apps/storefront/server.js"]
