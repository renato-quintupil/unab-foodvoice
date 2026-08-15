# FoodVoice

Aplicación web para pedir comida a un local por voz o de forma manual, con
trazabilidad del pedido de punta a punta.

**Estado del código**: E1 · Acceso y usuarios está **construida y verificada**
en las cuatro fases del plan (`specs/001-acceso-y-usuarios/plan.md`). Los tres
espacios de trabajo —`apps/web`, `services/api` y `packages/shared`— están
poblados, y las dos capas automáticas pasan en verde: unitarios con sus umbrales
de cobertura, e integración con 19 baterías y 180 pruebas contra PostgreSQL real.

Quedan **dos verificaciones que exigen una persona** y no código, ambas trazadas
en `specs/001-acceso-y-usuarios/verificacion.md`: la guía funcional completa con
las esperas reales de 15 y 30 minutos (T126) y el recorrido en cuatro navegadores
desde 360 píxeles (T123). Mientras T126 no se ejecute, SC-001, SC-007, SC-036 y
SC-038 no están verificados. La siguiente épica del orden sugerido es E4.

## Stack y decisiones vigentes

- **Monorepo pnpm 9 + Turborepo** sobre Node.js 22 LTS, TypeScript 5 con
  `strict: true` en los tres paquetes.
- **`apps/web`** — Next.js 15 (App Router), React 19, TailwindCSS 4, shadcn/ui,
  react-hook-form + resolver de Zod. Actúa como **BFF**: el navegador solo habla
  con Next.js, que reenvía a la API por la red interna de Docker (cookie
  same-origin, sin CORS).
- **`services/api`** — NestJS 11, Prisma 6, bcrypt (coste 12), Zod. Monolito con
  módulos internos (`auth`, `users`, `dashboard`, `audit`, `health`).
- **`packages/shared`** — fuente única de contratos: enums, esquemas Zod,
  mensajes en español y máquina de estados del pedido. No puede depender de
  `apps/web` ni de `services/api`.
- **PostgreSQL 16** con `prisma migrate`. **Sesión con estado** en base de datos
  e identificador opaco (UUID v4) en cookie `httpOnly`; nada de JWT. El rol se
  congela en la sesión: un cambio de rol rige desde el próximo inicio de sesión.
- **Docker Compose** para postgres + api + web; solo `web` publica puerto.

## Arranque y pruebas en local

```bash
cp .env.example .env               # variables obligatorias; sin ellas el arranque falla
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate
pnpm --filter api db:seed          # administrador semilla, idempotente
pnpm dev                           # api :3001 · web :3000

pnpm test              # unitarios (falla si no se cumplen los umbrales de cobertura)
pnpm test:integration  # API contra PostgreSQL efímera en Docker
pnpm lint && pnpm typecheck && pnpm build
```

Alternativa íntegra en contenedores: `docker compose up --build`.
Detalle de variables, umbrales y validación funcional en
`specs/001-acceso-y-usuarios/quickstart.md`.

## Convenciones

- **Todo texto visible al usuario, en español**; identificadores técnicos en
  inglés. Los mensajes fijos viven en `packages/shared`, nunca duplicados.
- **Validación una sola vez**: los esquemas Zod de `packages/shared` son la única
  puerta de entrada de datos, en frontend y backend.
- **Autorización declarativa** con guards de NestJS (`@Roles(...)`), para que su
  ausencia sea visible en revisión de código.
- Base de datos en `snake_case` singular (`user`, `session`, `admin_audit_log`).
- **Ningún secreto en el repositorio**; `.env` está en `.gitignore`.
- Ramas de funcionalidad `NNN-nombre-en-kebab` (p. ej. `001-acceso-y-usuarios`);
  commits Conventional Commits con el asunto en español (`docs: ...`, `feat: ...`).
- Cada endpoint, pantalla y test se remite a un requisito de la spec. Si algo no
  está en la spec, no se construye: se enmienda la spec primero.
- Los tests unitarios no bastan para unicidad, transacciones ni atomicidad: eso
  se cubre con la capa de integración.

Las reglas de producto viven en `.specify/memory/constitution.md` y el estado del producto en `specs/README.md`.

---

## Spec-kit

- Antes de ejecutar el flujo de `/speckit.specify`, SIEMPRE ejecuta primero el hook `before_specify` (skill `speckit-git-feature`) para crear la rama de la feature, y espera su resultado antes de crear la spec.
- Tras completar `/speckit.specify`, verifica con `git branch --show-current` que estamos en la rama `NNN-nombre-feature` y no en `master`. Si no es así, avísame antes de continuar.
