#!/bin/sh
# Arranque de `api` (D-013).
#
# Las migraciones se aplican antes de que NestJS empiece a atender peticiones, y
# `set -e` hace que un fallo termine el contenedor con código distinto de cero:
# `restart: on-failure` lo reintenta, en lugar de dejarlo atendiendo peticiones
# contra un esquema que no corresponde al código.
#
# Arranques concurrentes no compiten: `prisma migrate deploy` toma un advisory
# lock en PostgreSQL; una instancia aplica y la otra encuentra el esquema al día.
set -e

echo "Aplicando migraciones..."
npx prisma migrate deploy

echo "Arrancando la API..."
exec node dist/main.js
