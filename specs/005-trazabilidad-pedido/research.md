# Fase 0 · Investigación: E4 · Trazabilidad del pedido

Cuatro decisiones, todas de bajo riesgo porque E4 no introduce datos ni escrituras nuevas: solo
decide cómo exponer lo que E2 ya construyó. No hay `[NEEDS CLARIFICATION]` pendiente — la spec
salió del `/speckit.clarify` sin preguntas.

## D-051 · Un `OrderDetailDto` compartido por los tres roles

**Decisión**: agregar un único tipo en `packages/shared`, `OrderDetailDto = OrderSummaryDto &
{ history: OrderStatusEventDto[] }`, consumido por los tres endpoints nuevos (cliente, negocio,
admin).

**Razón**: las tres historias de usuario piden la misma información —estado actual más la
secuencia de cambios—; lo único que cambia entre ellas es *quién puede pedirla*, no *qué forma
tiene la respuesta*. Un tipo único evita que cliente y negocio vean el historial con campos
distintos por accidente, y es lo que permite que el admin (Historia 3) reutilice exactamente el
mismo componente de presentación que cliente y negocio si el plan de UI lo decide así en la
Fase 1.

**Alternativas consideradas**:
- *Un DTO por rol* (`ClientOrderDetailDto`, `BusinessOrderDetailDto`, `AdminOrderDetailDto`):
  descartado por el Principio I — no hay ninguna diferencia de campos entre ellos hoy, así que
  triplicar el tipo sería complejidad anticipada sin requisito que la pida.
- *Incrustar `history` directamente en `OrderSummaryDto`*: descartado porque `OrderSummaryDto`
  ya lo consumen las listas de E2 (`GET /orders`, `GET /business/orders`) que **no** necesitan el
  historial completo en cada fila; cargarlo siempre sería trabajo de base de datos innecesario en
  las pantallas que E4 no toca.

## D-052 · Endpoints: reutilizar los prefijos de ruta existentes, no crear uno compartido

**Decisión**: `GET /orders/:id` en `OrdersController` (cliente), `GET /business/orders/:id` en
`BusinessOrdersController` (negocio), y `GET /admin/dashboard/orders/:id` en
`DashboardController` (admin). Ningún controlador ni módulo nuevo.

**Razón**: E2 ya separó `OrdersController` y `BusinessOrdersController` explícitamente "porque
el negocio no tiene carrito ni confirma pedidos" (comentario de
`business-orders.controller.ts`); la misma razón aplica a la consulta de detalle — mezclar
ambas rutas bajo un controlador nuevo obligaría a decidir el rol endpoint por endpoint, que es
justo lo que E2 ya evitó. El admin ya tiene su propio reporte (`GET
/admin/dashboard/orders`, HU-10) — agregar `:id` al mismo controlador es la extensión mínima que
la propia spec de HU-03 propone como pregunta a resolver, y aquí se resuelve como sí (FR-009).

**Alternativas consideradas**:
- *Un `OrderHistoryController` nuevo con las tres rutas*: descartado por el Principio I —
  agregaría un cuarto módulo para reexponer autorización que los controladores existentes ya
  implementan con `@Roles`, sin ganar nada a cambio.
- *Un solo endpoint `/orders/:id` que resuelve el rol internamente*: descartado porque el guard
  `@Roles` declarativo (convención del proyecto, ver CLAUDE.md "Autorización declarativa") deja
  de ser visible en revisión de código si un único controlador bifurca la lógica de acceso según
  el rol del que llama.

## D-053 · v1 es mono-local: sin filtro de "negocio propietario"

**Decisión**: `GET /business/orders/:id` no filtra por ningún identificador de negocio — solo
exige `@Roles(NEGOCIO)`, igual que `GET /business/orders` y `GET /business/orders/rejected` ya
hacen hoy.

**Razón**: el Principio VIII de la constitución declara explícitamente que "«por local» no se
modela mientras el producto sea mono-local" — no existe una tabla `Business` ni una columna que
relacione un `Order` con un negocio. La spec original de esta épica asumía un escenario de
"pedido de otro negocio" que es imposible en el esquema actual; se corrigió durante esta fase de
planificación (documentado en `checklists/requirements.md` de la spec). Si en el futuro se
admite un segundo local, esta decisión caduca junto con la excepción del Principio VIII, y
tendrá que revisarse junto con el resto del catálogo — no antes.

**Alternativas consideradas**:
- *Agregar una columna `businessId` a `Order` "por si acaso"*: descartado de plano por el
  Principio I y el Principio III — ninguna historia de usuario pide multi-negocio en v1, y
  anticiparlo sería alcance fantasma.

## D-054 · El actor del historial se muestra por nombre, reutilizando `User.fullName`

**Decisión**: `OrderStatusEventDto` expone `actorName: string` (copiado de `User.fullName` en el
momento de la consulta, no congelado) junto a `actorRole: Role`, que se traduce en pantalla con
`ETIQUETA_ROL` (ya existe desde E1).

**Razón**: la spec pide "quién actuó, con qué rol" como dos datos distintos (FR-002). El sistema
ya guarda `fullName` para todo usuario desde E1 y ya lo expone en el panel de administración; no
es una recolección de dato nuevo (Principio V), y evita quedarse solo con un UUID técnico que no
significa nada para un cliente o un negocio leyendo su propio historial.

**Alternativas consideradas**:
- *Congelar el nombre en `OrderStatusEvent` al momento del evento* (como sí se congela el rol,
  `actorRole`, desde E2): descartado — el rol se congela porque el Principio XII exige saber qué
  función ejercía el actor *aunque su rol cambie después*; el nombre de una persona no tiene ese
  mismo requisito de negocio, y congelarlo exigiría una columna nueva y una migración que ninguna
  historia de usuario pide. Se lee en vivo desde `User` en cada consulta, igual que el patrón que
  `MenuService` (E3) ya usa para no congelar precio ni nombre de producto en el carrito.
- *No mostrar el nombre, solo el rol*: descartado porque no satisface FR-002 tal como está
  redactado ("quién actuó, con qué rol" son dos campos, no uno).
