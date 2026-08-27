# Fase 0 · Investigación: E5 · Reparto

Siete decisiones. No hay `[NEEDS CLARIFICATION]` pendiente — la spec salió de `/speckit.clarify`
sin preguntas abiertas, y las tres ambigüedades de alcance (autoservicio, un pedido a la vez,
soltar un pedido) ya se resolvieron con el usuario antes de escribir la spec.

## D-066 · Dos columnas nuevas en `Order`, sin tabla de asignación separada

**Decisión**: `Order` gana `deliveryUserId` (nullable, FK a `User`) y `assignedAt` (nullable,
`timestamptz`). Ninguna tabla nueva.

**Razón**: la relación es 1-a-1 en un momento dado (un pedido tiene a lo sumo un repartidor
asignado; el historial de *quién lo tuvo antes* ya lo cubre `OrderStatusEvent`, que registra cada
transición con su actor). Es el mismo criterio que ya usó E2 con `rejectionReason`: un dato que
solo tiene sentido en cierto estado del pedido vive como columna nullable en la misma fila, no en
una tabla aparte.

**Alternativas consideradas**:
- *Tabla `DeliveryAssignment` con historial propio de asignaciones*: descartada por el Principio
  I — `OrderStatusEvent` ya registra cada transición con su actor (incluidas "tomar" y "soltar"
  como eventos separados); una tabla paralela duplicaría esa trazabilidad sin agregar nada que
  HU-04 pida.
- *Guardar el repartidor solo en `OrderStatusEvent`, sin columna en `Order`*: descartada porque
  "¿quién tiene este pedido ahora?" es una pregunta de lectura frecuente (Historia 2, cada carga
  de la lista de disponibles) que exigiría reconstruir el estado a partir del último evento en
  cada consulta, en vez de leer una columna indexada.

## D-067 · Un controlador nuevo, `DeliveryOrdersController`, reutilizando `OrdersService`

**Decisión**: `@Controller('delivery/orders')`, con `@Roles(Role.REPARTIDOR)`, viviendo en
`OrdersModule` junto a `OrdersController` y `BusinessOrdersController`. Sin módulo nuevo.

**Razón**: mismo criterio que ya documentó E2 al separar `BusinessOrdersController` de
`OrdersController` — "el negocio no tiene carrito ni confirma pedidos […] mezclar las dos rutas
en un mismo controlador obligaría a decidir el rol endpoint por endpoint". El repartidor tampoco
tiene carrito ni confirma ni acepta/rechaza; sus acciones (ver disponibles, tomar, ver su pedido,
soltar) son una tercera superficie de autorización tan distinta de las otras dos que un
controlador compartido perdería la ventaja de que `@Roles` sea visible en revisión de código sin
leer el cuerpo del método (convención declarada en `CLAUDE.md`, "Autorización declarativa").

**Alternativas consideradas**:
- *Agregar los cuatro endpoints a `OrdersController` (el del cliente) condicionando por rol*:
  descartada por la misma razón que ya rechazó E2 mezclar negocio y cliente.
- *Un módulo `delivery` nuevo, independiente de `orders`*: descartado por el Principio I — las
  cuatro operaciones son lecturas y escrituras sobre `Order`; crear un módulo aparte solo para
  reexportar `OrdersService` no gana nada, y el propio `OrdersModule` ya agrupa los tres
  controladores de la entidad `Order` (cliente, negocio, y ahora repartidor).

## D-068 · "Tomar" se resuelve con una escritura condicionada, igual que `transicionar()` de E2

**Decisión**: `PUT /delivery/orders/:id/take` ejecuta `updateMany({ where: { id, status:
'en_preparacion', deliveryUserId: null }, data: { status: 'asignado_repartidor', deliveryUserId,
assignedAt: now } })` dentro de una transacción que también llama a `registrarEvento`. Si
`count === 0`, se relee el pedido para decidir el código de error correcto (404 si no existe,
409 si ya tiene repartidor o ya no está en `en_preparacion`).

**Razón**: es exactamente el patrón que `OrdersService.transicionar()` ya usa para
aceptar/rechazar en E2 — una escritura que solo tiene efecto si la fila sigue en el estado
esperado, sin `SELECT … FOR UPDATE` explícito ni bloqueo pesimista. Introducir un mecanismo de
concurrencia distinto para esta épica sería la complejidad anticipada que el Principio I prohíbe,
cuando el proyecto ya tiene uno que funciona y está probado.

**Alternativas consideradas**:
- *Bloqueo pesimista (`SELECT … FOR UPDATE`) sobre la fila del pedido*: descartado — E2 ya evaluó
  esta opción para el carrito (D-037) y la reservó para el caso donde hace falta leer y decidir
  sobre varias filas relacionadas antes de escribir (carrito + líneas); aquí es una sola fila con
  una condición simple, que la escritura condicionada resuelve sin bloqueo.

## D-069 · "Un repartidor, un pedido a la vez" es un índice único parcial, no solo una comprobación de aplicación

**Decisión**: `CREATE UNIQUE INDEX order_one_active_delivery_per_user_key ON "order"
(delivery_user_id) WHERE status = 'asignado_repartidor';` — mismo mecanismo que
`address_one_active_default_per_user_key` de E2 (`WHERE active AND is_default`).

**Razón**: FR-004 es una invariante de datos ("nunca dos pedidos con el mismo repartidor en
`asignado_repartidor`"), no solo una regla de flujo de la interfaz. Una comprobación previa en
la aplicación (`SELECT` antes del `UPDATE`) es necesaria para dar un mensaje amigable, pero **no
alcanza sola** bajo concurrencia real: dos solicitudes de "tomar" de pedidos distintos, enviadas
por el mismo repartidor casi al mismo tiempo, podrían pasar ambas la comprobación antes de que
cualquiera de las dos escrituras se confirme. El índice hace que la segunda escritura falle en
la base de datos aunque la comprobación previa la haya dejado pasar — la misma razón por la que
E2 usó un índice parcial en vez de confiar solo en la lógica de `AddressesService`.

**Alternativas consideradas**:
- *Solo una comprobación de aplicación, sin índice*: descartada por la razón de arriba — no
  cierra la ventana de carrera entre dos pedidos distintos.
- *Una columna booleana `hasActiveDelivery` en `User`*: descartada por el Principio I — es
  información derivable de `Order` (`EXISTS (SELECT 1 FROM order WHERE delivery_user_id = ? AND
  status = 'asignado_repartidor')`), y mantenerla sincronizada agregaría una escritura más a
  cada transición sin necesidad.

## D-070 · El teléfono del cliente vive en un DTO nuevo, `DeliveryOrderDto`

**Decisión**: `packages/shared` agrega `DeliveryOrderDto = OrderSummaryDto & { customerPhone:
string }`, devuelto únicamente por `GET /delivery/orders/current`. `GET
/delivery/orders/available` sigue devolviendo `OrderSummaryDto[]`, sin teléfono.

**Razón**: mismo criterio de extensión aditiva que `OrderDetailDto` de E4 (`OrderSummaryDto &
{ history }`) — ningún consumidor existente de `OrderSummaryDto` (E2, E4, E9) se ve afectado, y
el teléfono no se filtra por accidente a la lista de disponibles porque esa lista usa un tipo
distinto que ni siquiera tiene el campo.

**Alternativas consideradas**:
- *Agregar `customerPhone` directamente a `OrderSummaryDto`*: descartado de plano — expondría el
  teléfono en `GET /orders` (cliente), `GET /business/orders` (negocio) y la lista de
  disponibles del repartidor, violando el Principio X en los tres casos que no lo necesitan.
- *Un endpoint separado solo para el teléfono*: descartado por el Principio I — el repartidor ya
  necesita los demás datos del pedido en curso (productos, dirección) en la misma pantalla; dos
  llamadas para una sola vista no simplifica nada.

## D-071 · `registrarEvento` no necesita ningún cambio: ya acepta cualquier rol

**Decisión**: reutilizar `registrarEvento` de `orders.service.ts` tal cual está, sin modificar su
firma ni su cuerpo. E5 es simplemente su tercer y cuarto llamador (tomar, soltar), además de
aceptar/rechazar (E2).

**Razón**: al revisar el código (`services/api/src/orders/orders.service.ts:305-313`) el helper
**ya** recibe `actorRole: Role` como parámetro genérico — E2 nunca lo restringió a `NEGOCIO` en
su firma, solo en sus dos únicas llamadas hasta hoy. No hace falta la generalización que E4 había
anotado como pendiente: esa anotación resultó ser innecesaria una vez revisado el código real, no
una tarea de esta épica. La única acción concreta es documentar en el comentario del propio
helper que ahora tiene llamadores con más de un rol.

**Alternativas consideradas**:
- *Duplicar la inserción de `OrderStatusEvent` dentro de los nuevos métodos de `OrdersService`*:
  descartado por el Principio I — reescribir la misma inserción tres veces en el mismo archivo es
  exactamente el tipo de duplicación que un helper ya resuelto existe para evitar.

## D-072 · Cuatro mensajes nuevos, ningún mensaje reutilizado con un significado distinto

**Decisión**: `MSG_SIN_PEDIDOS_DISPONIBLES`, `MSG_PEDIDO_YA_NO_DISPONIBLE`,
`MSG_REPARTIDOR_YA_TIENE_PEDIDO`, `MSG_PEDIDO_NO_ASIGNADO_A_TI` — cuatro constantes nuevas en
`packages/shared/src/messages/etiquetas.ts` (o el archivo de mensajes que corresponda por
convención del paquete), cada una con un único significado y un único productor.

**Razón**: el catálogo de errores de la API es cerrado y cada mensaje tiene un solo dueño
(convención ya establecida en `services/api/src/common/errors.ts`); reutilizar
`MSG_PEDIDO_NO_PENDIENTE` (E2, pensado para "no está en `creado`") para los tres casos nuevos de
esta épica confundiría dos invariantes distintas de la máquina de estados bajo un mismo texto.

**Alternativas consideradas**:
- *Reutilizar `MSG_PEDIDO_NO_PENDIENTE` para "ya no está disponible"*: descartado — ese mensaje
  específicamente dice que el pedido no está en `creado`, un estado que no es relevante aquí
  (esta épica trabaja sobre `en_preparacion`/`asignado_repartidor`); reutilizarlo sería un texto
  técnicamente incorrecto para el repartidor que lo lea.
