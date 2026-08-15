# Imagen de `apps/web` (D-013). Multi-etapa sobre node:22-alpine, con la salida
# standalone de Next.js para que la imagen final no arrastre el árbol completo
# de node_modules.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

# --- Dependencias -----------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @foodvoice/web... --filter @foodvoice/shared...

# --- Compilación ------------------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @foodvoice/shared build \
 && pnpm --filter @foodvoice/web build

# --- Imagen final -----------------------------------------------------------
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

# Usuario sin privilegios provisto por la propia imagen (uid 1000).
USER node

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
