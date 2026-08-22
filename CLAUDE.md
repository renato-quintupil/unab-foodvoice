# FoodVoice

Aplicación web para pedir comida a un local por voz o de forma manual, con
trazabilidad del pedido de punta a punta.

**Estado del código**: **E1 · Acceso y usuarios**, **E3 · Administración de
menú**, **E2 · Gestión de pedidos** y **E9 · Navegación y experiencia visual**
están **construidas y verificadas**. Los tres espacios de trabajo —`apps/web`,
`services/api` y `packages/shared`— están poblados, y las dos capas automáticas
pasan en verde: **522 pruebas unitarias** con sus umbrales de cobertura (más
las 5 suites nuevas de E9, 188 pruebas en total sobre `apps/web`) y **587 de integración
en 73 baterías** contra PostgreSQL real — E9 no agrega baterías de integración
porque no toca `services/api`.

Las cuatro validaciones funcionales se ejecutaron a mano —E1 el 2026-08-15, con
las esperas reales de 15 y 30 minutos; E3 el 2026-08-16, sus 56 pasos; E2 el
2026-08-18, sus 40 pasos; E9 el 2026-08-19, sus 26 pasos (dos rondas de
enmiendas incluidas)— y su detalle está en el `verificacion.md` de cada spec.

**Las tres primeras no fueron un trámite, y esa es la lección que conviene
llevarse a las épicas siguientes**: cada una encontró defectos reales que
ninguna prueba automática detectaba, siempre del mismo tipo —cada pieza
funcionaba aislada y aun así el usuario no veía lo que la spec le promete—.
**E9 es la primera que no encontró ninguno.**

- En E1: el error de formulario no quedaba asociado a su campo, y cuatro
  pantallas usaban un mensaje recortado en lugar del compartido (T133, T134).
- En E3: dar de baja un producto **no confirmaba nada**, porque el aviso vivía en
  la fila que desaparecía en ese mismo instante; y el rechazo de la reactivación
  se anunciaba **dos veces**, con dos `role="alert"` idénticos.
- En E2: el error de una dirección puntual demasiado corta al confirmar un
  pedido se mostraba **en inglés** —el mensaje por omisión de Zod, sin
  traducir—, mientras el resto de la misma pantalla sí estaba en español.
- En E9: ningún defecto de la validación en sí, pero sí dos correcciones
  después de darla por cerrada, ambas al seguir usando la aplicación con el
  header ya puesto: las landing genéricas de cliente y negocio (E1/E3)
  quedaron duplicando lo que el header ya ofrecía (FR-016), y el encabezado de
  administrador quedó con el estilo visual anterior a HU-16 mientras cliente y
  negocio ya tenían el rediseño (FR-017). Las dos se corrigieron con una
  enmienda chica a la spec antes de tocar el código, no colaron directo. Su
  alcance —navegación y presentación sobre pantallas ya construidas, sin
  lógica de negocio nueva— es más chico y más fácil de demostrar completo que
  el de las tres anteriores; no es evidencia de que la validación manual haya
  dejado de aportar valor en general.

A eso se suma una tercera lección, de la prueba de humo que se hizo sobre
contenedores antes de integrar E3: **el despliegue es una capa aparte, y las
pruebas automáticas no dicen nada sobre si la aplicación arranca**. Allí
apareció que `docker-entrypoint.sh` con finales CRLF —lo que Git deja por
omisión en Windows— rompía el arranque de `api` con un error que no menciona los
finales de línea; de ahí el `.gitattributes` de la raíz, que **no se debe
borrar**. Las otras dos: la ficha de un producto inexistente respondía 200 en
lugar de 404, y el aviso de éxito sobrevivía al cambio de filtros —o sea, la
corrección del primer defecto de E3 creó otro de su misma familia—. El detalle
está en el `verificacion.md` de E3.

Fuera de v1 por decisión declarada: auditoría formal de accesibilidad y lectores
de pantalla reales (FR-039), y la verificación funcional de las métricas de
pedidos, que espera a E4 (registra el historial sobre el que se miden). La
siguiente épica del orden sugerido sigue siendo **E4** (el orden es E1 → E3 →
E2 → E4 → E6 → E5 → E7 → E8); **E9 es transversal y no participa de ese
orden** — se completó en paralelo, envolviendo con navegación las pantallas que
E1+E3+E2 ya habían construido.

### Lo que E9 añadió al código

- **`apps/web`** únicamente — E9 no toca `services/api` ni `packages/shared`.
- **Shell de navegación por rol**: `cliente/layout.tsx` y `negocio/layout.tsx`
  (nuevos, mismo patrón que `admin/layout.tsx` desde E1), cada uno con su
  componente `_components/navegacion.tsx` — header superior en escritorio,
  barra inferior en mobile vía `hidden md:block` / `md:hidden`, sin duplicar
  componentes.
- **Selector de dirección** (`components/selector-direccion.tsx`): reutiliza
  `PUT /addresses/:id/default` de E2 para cambiar la predeterminada desde el
  encabezado — **sin regla de negocio nueva**.
- **`/menu` despacha el encabezado según `sesion.role`** dentro de
  `menu/page.tsx`, porque es una ruta compartida por los cuatro roles y no
  admite un `layout.tsx` anidado bajo `cliente/`. `admin` y `repartidor` no
  reciben header nuevo ahí, igual que antes de E9.
- **Fila de categorías del menú** (`menu/_components/filtros-menu.tsx`):
  comparte la misma función `aplicar()` que el combobox "Tipo de comida" ya
  existente — un solo estado, no dos sincronizados.
- **Identidad visual** (`.tema-voz` en `globals.css`, tipografía Bricolage
  Grotesque vía `next/font/google`, login rediseñado): redefine los mismos
  nombres de variable CSS que ya usan `Button`/`Input` dentro de un wrapper,
  sin tocar `:root` ni el código de esos componentes — por eso `admin` queda
  sin cambios visuales.
- **Deliberadamente no construido**: badges de conteo (carrito, pedidos
  pendientes) que aparecían en el mockup de referencia — ninguna FR los pedía.
- **Landings de cliente y negocio redirigen** (`/cliente` → `/menu`,
  `/negocio` → `/negocio/pedidos`) en vez de mostrar la pantalla genérica de
  botones de E1/E3, que quedó duplicando el header nuevo (FR-016, detectado al
  usar la aplicación). `/repartidor` sigue usando `InicioDeRol` sin cambios:
  no tiene header, así que no es redundante ahí.
- **`NavegacionAdmin` recibió el mismo rediseño que cliente y negocio**
  (FR-017, segunda enmienda post-verificación): marca, íconos, estado activo,
  barra mobile y `.tema-voz` en `admin/layout.tsx`. Sus dos destinos —Panel y
  Usuarios— no cambiaron. Ojo con el bug que encontró su propia prueba:
  `/admin` es prefijo de toda ruta administrativa, así que "Panel" necesita
  comparación exacta, no `startsWith`, o queda marcado activo en
  `/admin/usuarios` también.

### Lo que E2 añadió al código

- **`packages/shared`**: `RECHAZADO` en el contrato de estados del pedido;
  esquemas de carrito, dirección y confirmación/rechazo de pedido; los catorce
  mensajes fijos de E2 y la etiqueta «Pendiente»/«Rechazado».
- **`services/api`**: los módulos `cart`, `addresses` y `orders`. `orders`
  expone dos controladores —cliente (`POST/GET /orders`) y negocio (bandeja,
  aceptar, rechazar, rechazados)—, ambos con `@Roles`. El historial de estados
  (`OrderStatusEvent`) se escribe con un helper transaccional privado: **no
  tiene endpoint ni DTO público** en E2, lo incorpora E4.
- **Garantías a nivel de base de datos**: índice único parcial para la
  dirección predeterminada por cliente, trigger `BEFORE UPDATE OR DELETE` que
  vuelve el historial de estados append-only, y transacciones interactivas con
  `updateMany` condicionado para que aceptar/rechazar un pedido tenga
  exactamente un ganador bajo carrera.
- **`apps/web`**: `/cliente/carrito`, `/cliente/direcciones`,
  `/cliente/pedidos` (con su confirmación) y `/negocio/pedidos` (con su
  bandeja paginada y los rechazados). El carrito recalcula precio y
  disponibilidad en cada lectura, sin congelarlos.

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

## Seguimiento en GitHub (Milestones + Project)

El seguimiento de épicas pendientes vive en dos lugares de GitHub, distintos y
complementarios — no hay que elegir uno:

- **Milestone por épica pendiente** (`E4`…`E8`, uno por cada fila "Sin
  especificar"/"Borrador de HU" de `specs/README.md`): agrupa el issue de esa
  épica y su `docs/epicas-hu/HU-NN-*.md` o spec asociada. Da % de avance y
  conteo abierto/cerrado, nada más — no tiene vistas ni estados intermedios.
- **Project "FoodVoice · Avance por épica"** (`https://github.com/users/renato-quintupil/projects/1`,
  vinculado al repo `unab-foodvoice`): el mismo conjunto de issues, con dos
  campos propios —`Status` (`Todo`/`In Progress`/`Done`) y `Épica` (las 9
  épicas)— y dos vistas: `View 1` en tabla y `Tablero` en Kanban agrupado por
  `Status`. Al arrancar una épica, su tarjeta se arrastra a `In Progress` en
  el Tablero; al verificarla, a `Done`.
- Cada issue de épica lleva la etiqueta `epica` (morada); las tareas
  individuales de `tasks.md`, si se abren como issues, usan `tarea` como
  sub-issue de su épica.
- Las épicas ya **Terminadas** (E1, E3, E2, E9) no tienen issue abierto ni
  milestone — su seguimiento es el `specs/README.md`, no GitHub. Solo se abre
  issue/milestone para una épica cuando empieza su especificación.
- **Configurar el "Group by" de una vista de Project es exclusivo de la UI
  web** — la API GraphQL no expone mutación para eso (`createProjectV2View`
  sí existe, pero `groupByFields` no es configurable por API).

---

## Spec-kit

- Antes de ejecutar el flujo de `/speckit.specify`, SIEMPRE ejecuta primero el hook `before_specify` (skill `speckit-git-feature`) para crear la rama de la feature, y espera su resultado antes de crear la spec.
- Tras completar `/speckit.specify`, verifica con `git branch --show-current` que estamos en la rama `NNN-nombre-feature` y no en `master`. Si no es así, avísame antes de continuar.
