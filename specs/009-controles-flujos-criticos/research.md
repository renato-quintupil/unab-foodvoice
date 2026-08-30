# Fase 0 · Investigación: E8 · Controles y administración

Ocho decisiones. No hay `[NEEDS CLARIFICATION]` pendiente — la spec salió de
`/speckit.clarify` con una sola pregunta (el tratamiento constitucional del
cierre administrativo), ya resuelta y aplicada en la enmienda 4.0.0 del
Principio XII antes de este plan.

## D-082 · El motivo de una intervención administrativa vive en `OrderStatusEvent`, no en `Order`

**Decisión**: `OrderStatusEvent` gana una columna nulable `reason`, poblada
únicamente cuando `actorRole = ADMINISTRADOR` (forzar transición o cierre
administrativo). `Order` no gana ninguna columna nueva para esto.

**Razón**: a diferencia de `rejectionReason`/`complaintReason` (E2/E7), que
viven en `Order` porque están atados a un **desenlace terminal único** del
pedido, el motivo de HU-07 puede acompañar una transición **intermedia**
(por ejemplo, forzar `creado → en_preparacion`). Un pedido puede tener más
de una intervención administrativa a lo largo de su vida (se fuerza una
transición y, más tarde, se cierra administrativamente); una columna en
`Order` solo podría guardar la última, perdiendo las anteriores y violando
la garantía de historial íntegro del Principio XII. El evento es, por
diseño, la única entidad que ya representa "un motivo asociado a un cambio
de estado puntual, para siempre" (D-047/D-048 de E2).

**Alternativas consideradas**:
- *Una columna `adminReason` en `Order`, mismo molde que `rejectionReason`*:
  descartada — pierde el motivo de una intervención anterior si el pedido
  recibe una segunda intervención o sigue avanzando, y el resto del
  historial (E4) ya muestra motivos por evento cuando hace falta mostrar
  más de uno con el tiempo, no por pedido.

## D-083 · Dos funciones nuevas en `machine.ts`, sin tocar `SIGUIENTE`

**Decisión**: `packages/shared/src/order-state/machine.ts` gana
`transicionesForzablesPorAdmin(desde)` (Historia 1: reutiliza `SIGUIENTE`
pero excluye la retroceso `asignado_repartidor → en_preparacion`, reservada
al repartidor dueño del pedido) y `puedeCerrarseAdministrativamente(desde)`
(Historia 2: `true` para cualquier estado no terminal). La tabla `SIGUIENTE`
—que describe el camino normal por el que avanza cada rol— no cambia.

**Razón**: meter las cuatro aristas nuevas de la enmienda 4.0.0
(`{creado, en_preparacion, asignado_repartidor, entregado} → cerrado`)
directamente dentro de `SIGUIENTE` haría que `transicionesValidas(creado)`
devolviera `[en_preparacion, rechazado, cerrado]`, y con eso **Historia 1
(forzar la transición normal siguiente) y Historia 2 (cerrar
administrativamente, saltándose pasos) quedarían indistinguibles** para
cualquier código que consulte `SIGUIENTE` — exactamente la ambigüedad que la
spec definió como dos acciones separadas. Mantener el cierre administrativo
como un predicado aparte, igual que ya se hizo con la restricción de rol de
la retroceso (D-XXX de E5: la tabla no sabe que la retroceso es exclusiva
del repartidor, esa regla vive en el servicio), preserva `SIGUIENTE` como
"el camino que cada rol recorre normalmente" y dos funciones explícitas
como "lo que además puede hacer un administrador".

**Alternativas consideradas**:
- *Agregar las cuatro aristas a `SIGUIENTE`*: descartada por la razón de
  arriba — colapsa dos acciones distintas de la spec en una sola.
- *Una función única `puedeForzarAdmin(desde, hacia)` con un `switch`
  interno*: descartada — dos funciones con nombre propio documentan mejor
  la frontera entre Historia 1 e Historia 2 que un único predicado
  combinado, sin ganar líneas de código reales.

## D-084 · Bitácora dual: `OrderStatusEvent` para pedidos, `AdminAuditLog` extendido solo para pausar/reanudar

**Decisión**: forzar una transición y cerrar administrativamente **no**
escriben en `AdminAuditLog` — su registro de solo-inserción ya es
`OrderStatusEvent` (protegido por el mismo disparador `BEFORE UPDATE OR
DELETE` desde E2). `AdminAuditLog` se extiende únicamente para pausar y
reanudar el servicio, que no tienen ningún pedido al que asociarse:
`AdminAction` gana `PAUSAR_SERVICIO` y `REANUDAR_SERVICIO`, `targetUserId`
pasa a ser nulable (no hay un "usuario objetivo" en una acción sobre el
servicio completo) y se agrega una columna `reason` nulable.

**Razón**: FR-014 exige que las cuatro acciones queden en "una bitácora de
solo-inserción, inmutable" — no exige que sea **una sola tabla física**.
Construir un objetivo polimórfico en `AdminAuditLog` (columnas
`targetUserId`/`targetOrderId`, ambas nulables, con la regla "como mucho una
de las dos" viviendo en el código) para las dos acciones sobre pedidos
duplicaría un registro que `OrderStatusEvent` ya provee, ya es inmutable, y
además es el único lugar que los roles no administradores pueden llegar a
ver (vía E4) — el `AdminAuditLog` de E1 sigue sin pantalla de consulta en
v1. Dos tablas, cada una con su propio lector natural (E4 para pedidos, la
bitácora administrativa —sin pantalla, igual que en E1— para el servicio),
es menos código que una tabla polimórfica nueva (Principio I).

**Alternativas consideradas**:
- *`AdminAuditLog` con `targetOrderId` nulable para las cuatro acciones*:
  descartada — duplica en una segunda tabla un dato que `OrderStatusEvent`
  ya guarda de forma inmutable, sin ningún lector que lo necesite ahí.
- *Tabla de auditoría completamente nueva y genérica (objetivo
  polimórfico con un `targetType`)*: descartada — ninguna otra épica del
  mapa necesita ese nivel de generalidad hoy; sería la complejidad
  anticipada que el Principio I prohíbe.

## D-085 · El estado del servicio es una fila única (`ServiceStatus`, `id` fijo), no una columna en otra tabla

**Decisión**: tabla nueva `ServiceStatus` con exactamente una fila
(`id: 'singleton'`, sembrada por la migración), `paused: boolean`,
`pauseReason: string?`, `pausedAt: DateTime?`, `pausedByUserId: string?`.
`OrdersService.confirmar()` lee esa fila al inicio de su transacción.

**Razón**: v1 es mono-local (Principio VIII) — no hay "el negocio pausado"
por fila de `User` con rol `NEGOCIO`, hay un único servicio que pausar. Una
tabla de una sola fila, con `id` constante en vez de un mecanismo de
unicidad más elaborado, es el molde más simple para un dato de configuración
singleton: no hay ninguna consulta que liste "los servicios pausados" ni
ninguna razón para que exista más de una fila, así que no hace falta ni
índice único parcial ni `CHECK` — el propio código, que siempre lee y
escribe por el `id` fijo, es la única puerta de entrada.

**Alternativas consideradas**:
- *Columna `paused` en alguna fila de `User` con rol `NEGOCIO`*: descartada
  — ata un concepto de todo el servicio a una fila de usuario concreta, y
  v1 no garantiza que exista exactamente un usuario `NEGOCIO`.
- *Variable de entorno o config estática*: descartada — pausar es una
  acción en caliente, ejecutada por un administrador desde la aplicación,
  no un valor de despliegue.

## D-086 · Un solo mensaje de motivo obligatorio, compartido por las tres acciones administrativas

**Decisión**: `MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO` es una única constante
que validan `ForceOrderTransitionSchema`, `AdminCloseOrderSchema` y
`PauseServiceSchema`.

**Razón**: a diferencia de `MSG_MOTIVO_RECHAZO_REQUERIDO` /
`MSG_MOTIVO_RECLAMO_REQUERIDO` (E2/E7, mensajes distintos porque son dos
formularios de dos roles distintos, en dos pantallas distintas, con
distinto contexto para quien lo lee), las tres acciones de HU-07 comparten
actor (`ADMINISTRADOR`), superficie (`/admin/operaciones` y el detalle de
pedido del admin) y el mismo significado exacto de "escribe por qué
interviniste". Un mensaje por acción sería la misma frase repetida tres
veces con nombres de constante distintos.

**Alternativas consideradas**:
- *Tres mensajes distintos, uno por acción*: descartada — no hay ninguna
  diferencia de contexto que el texto necesite reflejar; sería divergencia
  sin motivo (Principio I).

## D-087 · Un cuarto controlador en `OrdersModule`, no un módulo administrativo aparte

**Decisión**: `AdminOrdersController` (`admin/orders`) se agrega como
cuarto controlador de `OrdersModule` —junto a `OrdersController`,
`BusinessOrdersController`, `DeliveryOrdersController`—, inyectando el mismo
`OrdersService`. `ServiceStatusController` (`admin/service`) vive en un
módulo nuevo y pequeño, `ServiceStatusModule`, porque no pedidos sino un
estado de configuración distinto.

**Razón**: mismo criterio que ya fijó D-067 de E5 al agregar
`DeliveryOrdersController` al módulo existente en vez de crear un módulo de
reparto aparte — las cuatro acciones sobre pedidos de esta épica son
transiciones más sobre `OrdersService`, no un dominio nuevo. Pausar/reanudar
el servicio sí es un dominio distinto (no hay `Order` involucrado), así que
no fuerza esa relación dentro de `OrdersModule`.

**Alternativas consideradas**:
- *Un módulo `AdminModule` que agrupe pedidos, servicio y, a futuro, otras
  acciones administrativas*: descartada — anticipa acciones administrativas
  que ninguna HU pide todavía (Principio III); si aparecen, se decide
  entonces.

## D-088 · El bloqueo de pedidos nuevos se comprueba dentro de la propia transacción de `confirmar()`, sin guard ni middleware nuevo

**Decisión**: `OrdersService.confirmar()` lee `ServiceStatus` como primer
paso de su transacción existente y lanza `servicioPausado()` si
`paused = true`, antes de tocar el carrito. No hay ningún guard de NestJS ni
middleware que intercepte todas las rutas.

**Razón**: la pausa solo afecta **una** acción (`POST /orders`) — el resto
del sistema debe seguir funcionando con normalidad mientras el servicio está
pausado (FR-011). Un guard o middleware global tendría que excluir
explícitamente todas las demás rutas, invirtiendo la responsabilidad: es más
simple y más difícil de omitir por accidente comprobarlo donde ya se
comprueban las demás condiciones de `confirmar()` (carrito vacío,
disponibilidad, precio), en el mismo lugar y con el mismo patrón.

**Alternativas consideradas**:
- *Guard `ServicePausedGuard` aplicado solo a `OrdersController`*:
  descartada — una comprobación de una única regla de negocio no amerita un
  guard nuevo (los guards existentes son de sesión y de rol, transversales a
  toda la aplicación); sería una capa de indirección sin necesidad real.

## D-089 · Pantalla nueva `/admin/operaciones`, tercer destino de `NavegacionAdmin`

**Decisión**: pantalla nueva que muestra el estado del servicio (`GET
/admin/service/status`) y los botones de pausar/reanudar. `NavegacionAdmin`
(E9) gana un tercer destino, "Operaciones", junto a "Panel" y "Usuarios". El
detalle de pedido del administrador (`/admin/pedidos/[id]`, ya construido
por E4) gana las acciones de forzar transición y cerrar administrativamente,
sin necesitar una pantalla propia — actúa sobre el pedido que ya está
mirando.

**Razón**: mismo criterio que ya fijó D-089 (E9, HU-15/16): cada acción vive
donde el usuario ya está mirando el dato sobre el que actúa. Pausar/reanudar
no tiene un pedido puntual sobre el que anclarse, así que necesita su propio
destino; forzar/cerrar sí lo tiene (el detalle de pedido de E4), así que se
agrega ahí en vez de crear una pantalla de "acciones sobre pedidos" aparte.

**Alternativas consideradas**:
- *Una sola pantalla "Operaciones" que liste también pedidos atascados para
  actuar sobre ellos ahí*: descartada — la spec declaró la detección como
  discrecional, sin ningún criterio ni listado automático de "atascados"
  (Assumptions de `spec.md`); construir ese listado sería alcance fantasma.
