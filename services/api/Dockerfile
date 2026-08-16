# Imagen de `services/api` (D-013). Multi-etapa sobre node:22-alpine.
#
# El `entrypoint` ejecuta `prisma migrate deploy` **antes** de arrancar el
# servidor, y solo lanza NestJS si termina bien: así el orden migración → semilla
# queda garantizado por construcción, y una migración fallida deja el contenedor
# sin arrancar en lugar de atender peticiones contra un esquema que no
# corresponde al código.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

# --- Dependencias -----------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter @foodvoice/api... --filter @foodvoice/shared...

# --- Compilación ------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/api services/api
# `build:seed` compila la semilla a `dist-seed/`, aparte de `dist/`, para que el
# `entrypoint` pueda ejecutarla sin depender de `tsx` ni de ninguna otra
# herramienta de desarrollo. Va antes del `prune` porque necesita el compilador.
RUN pnpm --filter @foodvoice/shared build \
 && pnpm --filter @foodvoice/api exec prisma generate \
 && pnpm --filter @foodvoice/api build \
 && pnpm --filter @foodvoice/api build:seed \
 && pnpm prune --prod

# --- Imagen final -----------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=build --chown=node:node /repo/services/api ./services/api
COPY --chown=node:node services/api/docker-entrypoint.sh ./services/api/docker-entrypoint.sh
RUN chmod +x ./services/api/docker-entrypoint.sh

WORKDIR /repo/services/api

# Usuario sin privilegios provisto por la propia imagen (uid 1000).
USER node

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
