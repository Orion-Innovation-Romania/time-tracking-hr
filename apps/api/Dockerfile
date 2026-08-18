# ---- deps (with dev, for building) ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @ttah/shared build \
 && pnpm --filter @ttah/api prisma:generate \
 && pnpm --filter @ttah/api build \
 && /app/node_modules/.bin/tsc -p /app/apps/api/tsconfig.build.json

# ---- runtime ----
FROM node:22-alpine AS runtime
RUN corepack enable && apk add --no-cache tini
ENV NODE_ENV=production
WORKDIR /app
# Bring the whole built workspace (node_modules include the generated Prisma client)
COPY --from=build /app ./
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
# Apply pending migrations, then start. `start:prod` is the same command used outside Docker.
CMD ["pnpm", "--filter", "@ttah/api", "start:prod"]
