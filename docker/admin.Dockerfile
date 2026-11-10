# ---------- build ----------
FROM node:22-slim AS build
ENV CI=true
RUN corepack enable && corepack prepare pnpm@10.34.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @pro-ai-access/shared --filter @pro-ai-access/admin

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/admin apps/admin

RUN pnpm --filter @pro-ai-access/shared build \
 && pnpm --filter @pro-ai-access/admin build

# ---------- runtime (Next.js standalone) ----------
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/admin/server.js"]
