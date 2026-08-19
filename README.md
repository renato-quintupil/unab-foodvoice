# FoodVoice

Aplicación web para pedir comida a un local por voz o de forma manual, con
trazabilidad del pedido de punta a punta.

**Estado**: **E1 · Acceso y usuarios** y **E3 · Administración de menú**,
construidas y verificadas (`v0.2.0`). E1 entrega el cimiento de identidad
—padrón de usuarios con rol, autenticación con sesión y panel de solo lectura
del administrador—; E3 añade el catálogo —categorías, productos y el menú que
consultan los cuatro roles—. Las épicas siguientes construyen sobre ellas.

## Estructura

```text
apps/web/          Next.js 15 · App Router. Actúa además como BFF: el navegador
                   solo habla con Next.js, que reenvía a la API por la red
                   interna de Docker.
services/api/      NestJS 11 · monolito con módulos internos (auth, users,
                   dashboard, audit, health, categories, products, menu).
packages/shared/   Contratos de dominio: enums, esquemas Zod, mensajes en
                   español y máquina de estados del pedido. Única fuente de
                   verdad de los tres, y no puede depender de los otros dos.
```

## Cómo iniciar el proyecto

### Requisitos previos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22 LTS (`>=22 <23`) | Ejecutar los tres espacios de trabajo |
| pnpm | 9 (`9.15.4`, fijada en `packageManager`) | Gestor del monorepo; `corepack enable` la instala |
| Docker | con Compose v2 | PostgreSQL 16, y el modo íntegro en contenedores |

### 1. Variables de entorno

```bash
cp .env.example .env
```

Hay que completar las cinco obligatorias: `POSTGRES_PASSWORD`, `DATABASE_URL`,
`API_INTERNAL_URL`, `ADMIN_SEED_EMAIL` y `ADMIN_SEED_PASSWORD` (de 8 a 72
caracteres; **nunca** tiene valor por defecto). Si falta alguna, el arranque
falla nombrándola y termina con código distinto de cero: no hay arranque
degradado ni valor de reserva.

Para desarrollo local, con los servicios fuera de Docker:

```dotenv
DATABASE_URL=postgresql://foodvoice:<POSTGRES_PASSWORD>@localhost:5432/foodvoice
API_INTERNAL_URL=http://localhost:3001
```

Dentro de contenedores, los mismos valores apuntan a `postgres:5432` y
`http://api:3001`. `.env` está en `.gitignore` y no se versiona nunca.

### 2. Instalar, migrar y sembrar

```bash
pnpm install
docker compose up -d postgres      # solo la base de datos
pnpm --filter api db:migrate       # aplica las migraciones de Prisma
pnpm --filter api db:seed          # administrador (E1) + catálogo (E3), idempotente
```

La semilla es idempotente: repetirla no cambia nada. Deja el administrador de
`ADMIN_SEED_EMAIL`, las dos dimensiones de clasificación, 6 categorías y 12
productos activos.

### 3. Levantar la aplicación

```bash
pnpm dev                           # api :3001 · web :3000
```

Se entra por **http://localhost:3000** con las credenciales del administrador
semilla. Los usuarios de rol **negocio** y **cliente** se crean desde el panel de
administración, ya con la sesión abierta.

### Alternativa: todo en contenedores

```bash
docker compose up --build
```

Levanta `postgres`, `api` y `web`; **solo `web` publica puerto** hacia el
anfitrión, de modo que el navegador solo habla con Next.js y la cookie de sesión
queda same-origin.

#### Comandos de Docker Compose

| Comando | Qué hace | Cuándo usarlo |
|---|---|---|
| `docker compose up --build` | Construye las imágenes (si cambió el código o el `Dockerfile`) y levanta `postgres`, `api` y `web`. Con `-d` corre en segundo plano. | Primera vez, o después de tocar código/dependencias. |
| `docker compose up -d` | Levanta los contenedores sin reconstruir imágenes. | Volver a levantar todo sin cambios de código. |
| `docker compose stop` | Detiene los contenedores **sin borrarlos**. El volumen de datos y los contenedores en sí quedan intactos, listos para retomar. | Pausar el trabajo del día. |
| `docker compose start` | Vuelve a arrancar contenedores ya existentes que fueron detenidos con `stop`. No reconstruye ni recrea nada. | Retomar después de un `stop`. |
| `docker compose start <servicio>` | Arranca solo un contenedor puntual, por ejemplo `docker compose start postgres`. | Cuando solo necesitas un servicio (p. ej. la base de datos para conectar un cliente externo). |
| `docker compose down` | Detiene y **elimina** los contenedores y la red. El volumen `foodvoice_pgdata` (los datos) **sobrevive**, porque no se pide `-v`. | Limpiar contenedores para recrearlos desde cero (p. ej. tras cambiar `docker-compose.yml`), sin perder los datos. |
| `docker compose down -v` | Igual que `down`, pero además **borra el volumen de datos**. Arranque totalmente limpio: la próxima vez que subas `postgres`, se inicializa vacío y hay que correr `db:migrate` y `db:seed` de nuevo. | Solo cuando quieras empezar de cero a propósito — es **destructivo e irreversible**. |

> **Un solo Postgres por volumen a la vez.** El volumen tiene nombre fijo
> (`foodvoice_pgdata` en `docker-compose.yml`), así que si tienes más de un
> checkout o rama de este repo (por ejemplo, otro worktree), **ambos apuntan al
> mismo volumen** aunque estén en carpetas distintas. Levantar dos contenedores
> de `postgres` al mismo tiempo sobre ese volumen es inseguro: Postgres toma un
> lock exclusivo sobre los datos, y hacerlo igual fuerza una recuperación de
> caída (crash recovery) cada vez que uno "le quita" el turno al otro. Antes de
> levantar `postgres` en un checkout, confirma que no está corriendo en otro
> (`docker ps -a`).

## Cómo ejecutar las pruebas

```bash
pnpm test              # unitarias (439); fallan si no se cumplen los umbrales de cobertura
pnpm test:integration  # 434 de integración en 38 baterías, contra PostgreSQL real
pnpm lint
pnpm typecheck
pnpm build
```

`test:integration` levanta por sí sola una PostgreSQL efímera en Docker
(`docker-compose.test.yml`, proyecto `foodvoice-test`) mediante su
`pretest:integration`; **Docker tiene que estar corriendo**. No toca la base de
desarrollo.

Para acotar el alcance mientras se trabaja en un solo espacio:

```bash
pnpm --filter api test
pnpm --filter web test
pnpm --filter @foodvoice/shared test
```

Las cuatro comprobaciones en verde **no bastan** para dar una épica por
terminada: la verificación funcional es manual y es la que dispara el release.
Ambas épicas cerradas encontraron ahí dos defectos cada una que ninguna prueba
automática detectaba. Los guiones paso a paso están en el `quickstart.md` de cada
spec.

### Comandos de base de datos

```bash
pnpm --filter api db:migrate    # crear/aplicar migraciones en desarrollo
pnpm --filter api db:deploy     # aplicarlas sin generarlas (producción)
pnpm --filter api db:generate   # regenerar el cliente de Prisma
pnpm --filter api db:seed       # volver a sembrar (idempotente)
```

El detalle completo —variables una por una, umbrales de cobertura y validación
funcional— vive en los quickstart de cada épica:
[E1](./specs/001-acceso-y-usuarios/quickstart.md) y
[E3](./specs/002-administracion-menu-productos/quickstart.md). Lo de arriba es la
ruta corta, no su reemplazo.

## Documentación del producto

| Documento | Qué contiene |
|---|---|
| [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) | Las reglas de producto que rigen sobre todas las épicas |
| [`specs/README.md`](./specs/README.md) | Estado del producto y sus épicas |
| [`specs/001-acceso-y-usuarios/spec.md`](./specs/001-acceso-y-usuarios/spec.md) | Qué hace E1 y por qué |
| [`specs/001-acceso-y-usuarios/plan.md`](./specs/001-acceso-y-usuarios/plan.md) | Cómo se construye, con sus decisiones y sus desviaciones declaradas |
| [`specs/001-acceso-y-usuarios/contracts/`](./specs/001-acceso-y-usuarios/contracts/) | Los doce endpoints y la superficie de `packages/shared` |
| [`specs/002-administracion-menu-productos/spec.md`](./specs/002-administracion-menu-productos/spec.md) | Qué hace E3 y por qué |
| [`docs/despliegue-produccion.md`](./docs/despliegue-produccion.md) | Despliegue a producción: lo dispara un tag `v*` |
| [`CLAUDE.md`](./CLAUDE.md) | Convenciones del repositorio |

## Convenciones

Todo texto visible al usuario va en español y vive en `packages/shared`; los
identificadores técnicos, en inglés. Cada endpoint, pantalla y prueba se remite
a un requisito de la especificación: **si algo no está en la spec, no se
construye — se enmienda la spec primero.**
