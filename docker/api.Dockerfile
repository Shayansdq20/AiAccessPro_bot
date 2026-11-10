# ---------- build ----------
FROM node:22-slim AS build
ENV CI=true
# openssl lets Prisma detect the correct native engine variant
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @pro-ai-access/shared --filter @pro-ai-access/db --filter @pro-ai-access/api

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api

RUN pnpm --filter @pro-ai-access/shared build \
 && pnpm --filter @pro-ai-access/db build \
 && pnpm --filter @pro-ai-access/api build

# Replace node_modules with production-only deps, then regenerate the
# Prisma client (the prod re-link drops the previously generated client).
RUN pnpm install --prod --frozen-lockfile --filter @pro-ai-access/shared --filter @pro-ai-access/db --filter @pro-ai-access/api \
 && pnpm --filter @pro-ai-access/db exec prisma generate

# ---------- runtime ----------
FROM node:22-slim
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/package.json ./package.json

EXPOSE 3001
# Apply migrations, then start. Migration deploy is idempotent.
CMD ["/bin/sh", "-c", "node packages/db/node_modules/prisma/build/index.js migrate deploy --schema packages/db/prisma/schema.prisma && node apps/api/dist/main.js"]
