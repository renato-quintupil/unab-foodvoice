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

# Semilla del administrador inicial al arrancar (FR-028, D-010).
#
# **Nunca es el modo por defecto**: solo corre si alguien fija
# `ADMIN_SEED_ON_BOOT=true` de forma deliberada. En local la semilla se ejecuta a
# mano según `quickstart.md`, y este bloque no altera ese flujo; existe para los
# despliegues gestionados —Railway y equivalentes— donde no hay forma cómoda de
# entrar al contenedor a ejecutar una orden suelta.
#
# Es seguro dejarlo activado de forma permanente: la semilla es idempotente por
# `ADMIN_SEED_EMAIL` normalizado, de modo que en los arranques siguientes
# encuentra al administrador y no toca nada. Y si el correo está ocupado por
# alguien que no es un administrador activo, falla en vez de promover la cuenta
# en silencio, lo que aquí deja el contenedor sin arrancar: es el
# comportamiento que se quiere, porque esa situación exige que la mire una
# persona.
if [ "$ADMIN_SEED_ON_BOOT" = "true" ]; then
  echo "Ejecutando la semilla del administrador inicial..."
  node dist-seed/prisma/seed.js
fi

echo "Arrancando la API..."
exec node dist/main.js
