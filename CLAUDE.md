# FoodVoice

Aplicación web para pedir comida a un local por voz o de forma manual, con
trazabilidad del pedido de punta a punta.

**Estado del código**: **E1 · Acceso y usuarios**, **E3 · Administración de
menú**, **E2 · Gestión de pedidos**, **E9 · Navegación y experiencia visual**,
**E4 · Trazabilidad del pedido** y **E6 · Búsqueda por voz** están
**construidas y verificadas**. Los tres espacios de trabajo —`apps/web`,
`services/api` y `packages/shared`— están poblados, y las dos capas
automáticas pasan en verde: **587 pruebas unitarias** de `services/api` (143)
y `packages/shared` (233), más **211 pruebas** sobre `apps/web`, todas con sus
umbrales de cobertura, y **613 de integración en 80 baterías** contra
PostgreSQL real — E9 no agrega baterías de integración porque no toca
`services/api`; E4 agrega tres; E6 agrega cuatro.

Las seis validaciones funcionales se ejecutaron a mano —E1 el 2026-08-15, con
las esperas reales de 15 y 30 minutos; E3 el 2026-08-16, sus 56 pasos; E2 el
2026-08-18, sus 40 pasos; E9 el 2026-08-19, sus 26 pasos (dos rondas de
enmiendas incluidas); E4 el 2026-08-23, sus 12 pasos; E6 el 2026-08-24, sus 16
pasos (nueve por Claude contra la aplicación real, siete por una persona con
micrófono real)— y su detalle está en el `verificacion.md` de cada spec.

**Las tres primeras no fueron un trámite, y esa es la lección que conviene
llevarse a las épicas siguientes**: cada una encontró defectos reales que
ninguna prueba automática detectaba, siempre del mismo tipo —cada pieza
funcionaba aislada y aun así el usuario no veía lo que la spec le promete—.
**E9 y E4 son las dos primeras que no encontraron ninguno.**

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
- En E4: tampoco encontró ningún defecto. Su alcance es igual de acotado que el
  de E9 por una razón distinta —es una capa de solo lectura sobre datos que E2
  ya escribe y protege a nivel de base de datos (Principio XII); no hay
  máquina de estados nueva ni escritura que pueda salir mal—, así que
  esperarlo era razonable, no una casualidad.
- En E6: tampoco encontró ningún defecto en los 16 pasos de `quickstart.md`,
  pero sí un defecto real antes de darla por cerrada, en la evaluación con el
  modelo real (T038): el SDK de Anthropic reintentaba por su cuenta encima
  del reintento explícito de D-065, empujando la cola de latencia muy por
  encima de los 5s de SC-004 — corregido con `maxRetries: 0`. Y, al usar la
  aplicación durante la propia validación, se agregó FR-028 (botón manual
  "Agregar" en los resultados de búsqueda) con una enmienda chica a la spec
  antes de tocar el código, mismo patrón que ya usó E9.

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
de pantalla reales (FR-039). La verificación funcional de las métricas de
pedidos, que esperaba a E4, ya está cerrada — ver "Lo que E4 añadió al código"
abajo. La apuesta central de E3 —que una descripción en prosa bien escrita
baste para la búsqueda por voz, sin diccionario de sinónimos— **la confirmó
E6**: SC-001 se cumplió contra el modelo real sin enriquecer el catálogo. La
siguiente épica del orden sugerido es **E5** (el orden es E1 → E3 → E2 → E4 →
E6 → E5 → E7 → E8); **E9 es transversal y no participa de ese orden** — se
completó en paralelo, envolviendo con navegación las pantallas que E1+E3+E2 ya
habían construido.

### Lo que E4 añadió al código

- **`packages/shared`**: dos tipos de solo lectura en `types/api.ts` —
  `OrderStatusEventDto` (una entrada de la línea de tiempo: estado anterior,
  estado resultante, nombre y rol del actor, fecha/hora) y `OrderDetailDto`
  (`OrderSummaryDto` extendido por composición con `history`). **Sin enums,
  esquemas Zod ni mensajes nuevos** — reutiliza `ETIQUETA_ROL` (E1) y
  `ETIQUETA_ESTADO_PEDIDO` (E2) tal cual.
- **`services/api`**: tres endpoints `GET` de solo lectura, uno por rol —
  `GET /orders/:id` (cliente, solo pedidos propios), `GET
  /business/orders/:id` (negocio, cualquier pedido — v1 es mono-local,
  Principio VIII, sin filtro de "negocio propietario") y `GET
  /admin/dashboard/orders/:id` (administrador, sin restricción, dentro de
  `DashboardController` que ya exponía el reporte de HU-10). Los tres
  construyen el mismo `OrderDetailDto` leyendo `OrderStatusEvent` —que E2 ya
  escribe de forma append-only desde su propia transacción— sin escribir en
  ninguna tabla. El 404 de "pedido ajeno" y "pedido inexistente" es
  **intencionalmente el mismo** (FR-005): ninguno de los dos revela si el
  pedido existe.
- **Sin migración de base de datos**: `order_status_event` y su índice
  (`order_id, occurred_at, id`) ya existían desde E2, pensados de antemano
  para esta consulta.
- **`apps/web`**: tres pantallas de detalle nuevas —`/cliente/pedidos/[id]`,
  `/negocio/pedidos/[id]`, `/admin/pedidos/[id]`—, las tres renderizadas por
  un único componente de presentación (`components/historial-pedido.tsx`,
  D-051) para no triplicar la línea de tiempo. Enlazadas desde las pantallas
  que ya existían (`/cliente/pedidos`, `/negocio/pedidos` y su vista de
  rechazados, la columna "Pedido" del reporte de admin).
- **Cierra una verificación pendiente de HU-10 (E1)**: las métricas y el
  reporte de pedidos del panel de administrador solo podían probarse
  funcionalmente una vez que existieran pedidos con historial real; con los
  pedidos que E2 permite crear y el historial que E4 expone, esa validación
  ya se hizo (`specs/001-acceso-y-usuarios/verificacion.md`, actualización
  2026-08-23).

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

### Lo que E6 añadió al código

- **`packages/shared`**: enums `SearchChannel`/`SearchIntent`; esquema
  `SearchRequestSchema` (`query` 1–300 caracteres); tipos `SearchInterpretation`,
  `SemanticSearchResponse`, `AddResolutionResponse`, y `dietaryTags: string[]`
  en `ProductDto`; los cuatro mensajes fijos de E6.
- **`services/api`**: el módulo `menu-search`, con `SemanticIntentProvider`
  como interfaz y `AnthropicSemanticIntentProvider` como única implementación
  (usa `@anthropic-ai/sdk`, tool use forzado, timeout de `LLM_TIMEOUT_MS` y un
  reintento explícito ante JSON inválido, D-057/D-065). Un único endpoint,
  `POST /menu/search`, despacha por `intent` (`SEARCH` o `ADD`) dentro del
  mismo servicio (D-056) — no hay dos endpoints ni dos caminos de escritura.
  `SearchThrottlerGuard` extiende `ThrottlerModule` con `getTracker()` sobre
  `sesion.id` en vez de IP (D-058, 20 solicitudes/300s).
- **Garantías de solo lectura hasta la confirmación** (FR-008, FR-020 a
  FR-023): la interpretación del modelo se valida contra un `Set` de los IDs
  realmente enviados en la proyección (allowlist, FR-005), se reconsulta
  `active && available` inmediatamente antes de responder (FR-006/FR-007), y
  agregar al carrito reutiliza el servicio de carrito ya existente de E2 —sin
  endpoint de escritura nuevo y paralelo (FR-022, D-063)—, con `intent: 'ADD'`
  aceptando más de un producto por frase (D-066, corrección post-implementación:
  la primera versión resolvía solo el primero y descartaba el resto en
  silencio).
- **Migración nueva**: `dietary_tag` (vocabulario controlado, en v1 solo
  "Vegano", precargado por semilla, sin pantalla de administración) y
  `search_log` (metadatos técnicos únicamente —sesión, canal, estado final,
  latencia, tokens, modelo, código de error—, **nunca la frase textual del
  cliente ni audio**, FR-017/FR-027), más la tabla de unión implícita
  `Product`↔`DietaryTag`.
- **`apps/web`**: `menu/_components/busqueda-por-voz.tsx` (campo de texto +
  micrófono con `SpeechRecognition`, consentimiento explícito vía
  `window.confirm` antes de activarlo, FR-018) y `confirmacion-agregado.tsx`,
  integrados en `/menu` junto a los filtros manuales de E3 sin ocultarlos
  (Principio VI). El checkbox "Apto para veganos" se agregó al formulario de
  producto de E3, reutilizado por alta y edición.
- **Decisión deliberada, no un defecto**: "Agregar al carrito por voz" activa
  el micrófono en cada clic y nunca reenvía texto ya escrito en el campo —la
  primera versión reenviaba la última *búsqueda*, no una instrucción real de
  agregar (commit `1b5ea02`)—, así que la Historia 2 completa exige dictado
  real y no es simulable escribiendo texto ni por automatización de
  navegador; se verificó con una persona y un micrófono real.
- **FR-028, agregada durante la propia validación funcional**: cada resultado
  de búsqueda tiene su propio botón "Agregar" de un clic, reutilizando
  `AgregarAlCarrito` (mismo componente que ya usa el catálogo completo,
  FR-002 de E3) — sin memoria conversacional entre solicitudes: el agregado
  por voz sigue sin entender referencias al contenido en pantalla ("la que
  está en pantalla"), decisión ya tomada en Assumptions y confirmada, no
  revertida, por este hallazgo.
- **Semilla**: `catalogo.ts` crea la fila `DietaryTag` "Vegano" y marca dos
  productos (Sándwich Vegetariano de Berenjena, Ensalada de Quinoa y Palta).

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
- Las épicas ya **Terminadas** (E1, E3, E2, E9) tienen issue cerrado
  (`epica`, sin milestone) solo para que el Project las muestre en `Done`; su
  fuente de verdad sigue siendo `specs/README.md` y el `verificacion.md` de
  cada una, no el issue.
- **Configurar el "Group by" de una vista de Project es exclusivo de la UI
  web** — la API GraphQL no expone mutación para eso (`createProjectV2View`
  sí existe, pero `groupByFields` no es configurable por API).
- **Esto no es automatización de CI**: nadie más que Claude, siguiendo los
  pasos de la sección `## Spec-kit` de abajo, mantiene el Project al día. Si
  una rama se crea o una épica se verifica sin pasar por una conversación con
  Claude, el Project queda desactualizado hasta que se sincronice a mano.
- IDs de referencia para las mutaciones GraphQL (`updateProjectV2ItemFieldValue`,
  `addProjectV2ItemById`) sobre el Project:
  - `projectId`: `PVT_kwHOD-ZNOM4BhImJ`
  - Campo `Status` (`PVTSSF_lAHOD-ZNOM4BhImJzhgFgt8`): `Todo=f75ad846` ·
    `In Progress=47fc9ee4` · `Done=98236657`
  - Campo `Épica` (`PVTSSF_lAHOD-ZNOM4BhImJzhgFhEo`): un `singleSelectOptionId`
    por cada una de las 9 épicas — listarlas con
    `gh api graphql -f query='{ user(login:"renato-quintupil") { projectV2(number:1) { field(name:"Épica") { ... on ProjectV2SingleSelectField { options { id name } } } } } }'`
    si hace falta re-obtenerlos (por ejemplo tras un `--force` o recreación del campo).

---

## Spec-kit

- Antes de ejecutar el flujo de `/speckit.specify`, SIEMPRE ejecuta primero el hook `before_specify` (skill `speckit-git-feature`) para crear la rama de la feature, y espera su resultado antes de crear la spec.
- Tras completar `/speckit.specify`, verifica con `git branch --show-current` que estamos en la rama `NNN-nombre-feature` y no en `master`. Si no es así, avísame antes de continuar.
- **Al crear la rama de una épica nueva** (justo después de que el hook
  `before_specify` confirme `BRANCH_NAME`): si la épica no tiene issue en
  GitHub todavía, créalo con `gh issue create --label epica` (título
  `EN · Nombre de la épica`, body con las HU y la ruta de la spec); si ya
  existe, reábrelo si estaba cerrado. En ambos casos, agrégalo al Project
  (`gh project item-add 1 --owner renato-quintupil --url ...`) y setea
  `Status = In Progress` y `Épica` correspondiente vía
  `updateProjectV2ItemFieldValue` (ver IDs en "Seguimiento en GitHub" arriba).
- **Al completar la verificación funcional de una épica** (mismo momento que
  dispara el tag de release en `## Releases`, es decir `verificacion.md` con
  todos los criterios cumplidos y la rama ya en `main`): cierra el issue de
  esa épica (`gh issue close ... --reason completed`) y actualiza su ítem del
  Project a `Status = Done`. Hazlo como parte del mismo paso en que se crea el
  tag, no antes.
