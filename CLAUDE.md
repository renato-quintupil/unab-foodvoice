# FoodVoice

Aplicación web para pedir comida a un local por voz o de forma manual, con
trazabilidad del pedido de punta a punta.

**Estado del código**: **E1 · Acceso y usuarios** y **E3 · Administración de
menú** están **construidas y verificadas**. Los tres espacios de trabajo
—`apps/web`, `services/api` y `packages/shared`— están poblados, y las dos capas
automáticas pasan en verde: **439 pruebas unitarias** con sus umbrales de
cobertura y **434 de integración en 38 baterías** contra PostgreSQL real.

Las dos validaciones funcionales se ejecutaron a mano —E1 el 2026-08-15, con las
esperas reales de 15 y 30 minutos; E3 el 2026-08-16, sus 56 pasos— y su detalle
está en el `verificacion.md` de cada spec.

**Ninguna de las dos fue un trámite, y esa es la lección que conviene llevarse a
las épicas siguientes**: cada una encontró **dos defectos** que ninguna prueba
automática detectaba, siempre del mismo tipo —cada pieza funcionaba aislada y aun
así el usuario no veía lo que la spec le promete—.

- En E1: el error de formulario no quedaba asociado a su campo, y cuatro
  pantallas usaban un mensaje recortado en lugar del compartido (T133, T134).
- En E3: dar de baja un producto **no confirmaba nada**, porque el aviso vivía en
  la fila que desaparecía en ese mismo instante; y el rechazo de la reactivación
  se anunciaba **dos veces**, con dos `role="alert"` idénticos.

Fuera de v1 por decisión declarada: auditoría formal de accesibilidad y lectores
de pantalla reales (FR-039), y la verificación funcional de las métricas de
pedidos, que espera a E2/E4. La siguiente épica del orden sugerido es **E2**
(el orden es E1 → E3 → E2 → E4 → E6 → E5 → E7 → E8, porque E4 registra el
historial sobre pedidos que E2 crea).

### Lo que E3 añadió al código

- **`packages/shared`**: enums `Dimension`, `PriceTier` y `ProductStatus`;
  `validarDescripcion` con las tres condiciones de sustancia de FR-039;
  `formatearPrecio` (`$4.990`) y `recortarDescripcion` (160 caracteres, sin
  partir palabras); los esquemas de categoría, producto y consulta del menú.
- **`services/api`**: los módulos `categories`, `products` y `menu`. Los dos
  primeros son exclusivos del rol negocio; `menu` está abierto a los cuatro roles
  y **su ausencia de `@Roles` es deliberada**, por eso vive en su propio módulo.
- **Tramos de precio derivados, sin columna** (`products/price-tier.ts`): se
  calculan en cada consulta sobre los productos activos, y `null` significa que
  **no hay tramos**, no que falló el cálculo.
- **`apps/web`**: `/negocio/categorias`, `/negocio/productos` y `/menu` con su
  ficha. La semilla del catálogo (`prisma/seed/catalogo.ts`) carga 6 categorías y
  12 productos y se encadena con la de E1 en un solo `db:seed`.

## Stack y decisiones vigentes

- **Monorepo pnpm 9 + Turborepo** sobre Node.js 22 LTS, TypeScript 5 con
  `strict: true` en los tres paquetes.
- **`apps/web`** — Next.js 15 (App Router), React 19, TailwindCSS 4, shadcn/ui,
  react-hook-form + resolver de Zod. Actúa como **BFF**: el navegador solo habla
  con Next.js, que reenvía a la API por la red interna de Docker (cookie
  same-origin, sin CORS).
- **`services/api`** — NestJS 11, Prisma 6, bcrypt (coste 12), Zod. Monolito con
  módulos internos (`auth`, `users`, `dashboard`, `audit`, `health`,
  `categories`, `products`, `menu`).
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
pnpm --filter api db:seed          # administrador y catálogo, idempotente
pnpm dev                           # api :3001 · web :3000

pnpm test              # unitarios (falla si no se cumplen los umbrales de cobertura)
pnpm test:integration  # API contra PostgreSQL efímera en Docker
pnpm lint && pnpm typecheck && pnpm build
```

Alternativa íntegra en contenedores: `docker compose up --build`.
Detalle de variables, umbrales y validación funcional en el `quickstart.md` de
cada épica: `specs/001-acceso-y-usuarios/` y
`specs/002-administracion-menu-productos/`.

**Producción**: el despliegue lo dispara un tag `v*`, que reejecuta el CI
completo sobre el commit etiquetado antes de publicar. Instructivo, variables
por servicio y comprobaciones posteriores en `docs/despliegue-produccion.md`.

## Convenciones

- **Todo texto visible al usuario, en español**; identificadores técnicos en
  inglés. Los mensajes fijos viven en `packages/shared`, nunca duplicados.
- **Validación una sola vez**: los esquemas Zod de `packages/shared` son la única
  puerta de entrada de datos, en frontend y backend.
- **Autorización declarativa** con guards de NestJS (`@Roles(...)`), para que su
  ausencia sea visible en revisión de código.
- Base de datos en `snake_case` singular (`user`, `session`, `admin_audit_log`,
  `category`, `product`).
- **Ningún secreto en el repositorio**; `.env` está en `.gitignore`.
- Ramas de funcionalidad `NNN-nombre-en-kebab` (p. ej. `001-acceso-y-usuarios`);
  commits Conventional Commits con el asunto en español (`docs: ...`, `feat: ...`).
- Cada endpoint, pantalla y test se remite a un requisito de la spec. Si algo no
  está en la spec, no se construye: se enmienda la spec primero.
- Los tests unitarios no bastan para unicidad, transacciones ni atomicidad: eso
  se cubre con la capa de integración.

Las reglas de producto viven en `.specify/memory/constitution.md` y el estado del producto en `specs/README.md`.

## Releases

**La unidad de release es la épica, y el disparador es su verificación
funcional**, no el final de la implementación. La distinción no es formal: E1
pasaba todas las pruebas automáticas y aun así SC-007 y SC-036 fallaban en la
validación manual. Un tag puesto antes habría declarado estable algo que no lo
era.

El momento exacto: `specs/NNN-.../verificacion.md` con todos sus criterios de
éxito verificados y la rama ya integrada en `main`.

- Una **minor** por épica verificada: `v0.1.0` para E1, `v0.2.0` para E3, y así
  hasta `v1.0.0` cuando estén todas las de v1.
- Los **patch** quedan para correcciones sobre una épica ya liberada.
- **No** disparan release: terminar `/speckit.implement` sin verificación, cerrar
  una HU suelta, ni los cambios de documentación o de specs.

Mecánica: versión alineada en los cuatro `package.json`, tag anotado sobre `main`
y notas que enlacen a la spec y al registro de verificación de la épica.

```bash
git tag -a v0.2.0 -m "..." && git push origin v0.2.0
gh release create v0.2.0 --repo renato-quintupil/unab-foodvoice --title "..." --notes "..."
```

---

## Spec-kit

- Antes de ejecutar el flujo de `/speckit.specify`, SIEMPRE ejecuta primero el hook `before_specify` (skill `speckit-git-feature`) para crear la rama de la feature, y espera su resultado antes de crear la spec.
- Tras completar `/speckit.specify`, verifica con `git branch --show-current` que estamos en la rama `NNN-nombre-feature` y no en `master`. Si no es así, avísame antes de continuar.
