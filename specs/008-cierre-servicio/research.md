# Fase 0 · Investigación: E7 · Cierre del servicio

Ocho decisiones. No hay `[NEEDS CLARIFICATION]` pendiente — la spec salió de
`/speckit.clarify` sin preguntas: las tres ambigüedades de alcance
(quién dispara cada transición, si el reclamo bloquea el cierre, hasta
dónde llega el reclamo) ya se habían resuelto con el usuario antes de
escribir la spec.

## D-073 · `complaintReason` es una columna nulable más en `Order`

**Decisión**: `Order` gana `complaintReason` (nullable, `text`). Ninguna
tabla nueva.

**Razón**: mismo criterio exacto que `rejectionReason` (E2) — un dato que
solo tiene sentido en cierto desenlace del pedido vive como columna nulable
en la misma fila, no en una tabla aparte. No hay ninguna consulta que
necesite filtrar o indexar por él (a diferencia de `delivery_user_id` en
E5), así que tampoco hace falta un índice nuevo.

**Alternativas consideradas**:
- *Tabla `Complaint` separada, con relación 1-a-1 a `Order`*: descartada
  por el Principio I — no hay ningún requisito de esta épica que necesite
  más de un reclamo por pedido, ni un ciclo de vida propio del reclamo
  (estado, asignación, resolución) que justifique una entidad aparte.

## D-074 · `entregar()` y `cerrar()` son métodos propios, no una generalización de `transicionar()`

**Decisión**: `OrdersService` gana dos métodos nuevos, `entregar(id,
repartidorId)` y `cerrar(id, clienteId, complaintReason)`, cada uno con su
propia escritura condicionada — ninguno reutiliza el helper privado
`transicionar()` que ya usan `aceptar`/`rechazar`.

**Razón**: `transicionar()` está hardcodeado a `where: { id, status:
CREADO }` y a `actorRole: Role.NEGOCIO` dentro de su llamada a
`registrarEvento` — generalizarlo para aceptar un `desde` y un `actorRole`
arbitrarios tendría sentido si esta épica fuera la primera en necesitarlo,
pero **E5 ya resolvió la misma pregunta escribiendo `tomar`/`soltar` como
métodos propios** en vez de forzar ese helper a un tercer caso de uso. Dos
precedentes en la misma dirección son más señal que uno: el helper sirve
bien a su único caso de uso (negocio decide sobre `creado`), y forzarlo a
servir a todos sería la complejidad anticipada que el Principio I prohíbe.

**Alternativas consideradas**:
- *Generalizar `transicionar()` con parámetros `desde`/`actorRole`*:
  descartada — ya la descartó E5 por la misma razón, y repetir la pregunta
  aquí sin un caso de uso nuevo que la justifique sería no aprender de esa
  decisión.

## D-075 · El fallo de "entregar" reutiliza el error de E5, sin código nuevo

**Decisión**: cuando `entregar()` falla porque el pedido no está en
`asignado_repartidor` asignado a ese repartidor, se lanza
`pedidoNoAsignadoATi()` (`409 DELIVERY_ORDER_NOT_YOURS`) — el mismo error
que ya usa `soltar()` de E5.

**Razón**: el significado es idéntico en los dos casos — "este pedido no
está en el estado y con el repartidor que tu acción esperaba" —, así que
crear un cuarto código de error (`DELIVERY_ORDER_NOT_DELIVERABLE` o
similar) solo por pertenecer a una épica distinta violaría el catálogo
cerrado de errores (`services/api/src/common/errors.ts`) sin ganar
precisión real para quien lo recibe.

**Alternativas consideradas**:
- *Un código de error nuevo, `DELIVERY_ORDER_NOT_ASSIGNED`*: descartado —
  el mensaje sería palabra por palabra el mismo que ya existe, y el
  catálogo de errores del proyecto no admite sinónimos de un código ya
  declarado (mismo criterio que evitó duplicar `MSG_PEDIDO_NO_PENDIENTE`
  en D-072 de E5).

## D-076 · Un código de error nuevo para el cliente: `409 ORDER_NOT_DELIVERED`

**Decisión**: cuando el cliente intenta confirmar o reclamar un pedido que
no está en `entregado` (incluidos los ya `cerrado`), se lanza
`pedidoNoEntregado()` (`409 ORDER_NOT_DELIVERED`,
`MSG_PEDIDO_NO_ENTREGADO`). Un segundo mensaje nuevo,
`MSG_MOTIVO_RECLAMO_REQUERIDO`, cubre el reclamo sin motivo.

**Razón**: a diferencia del caso del repartidor (D-075), aquí sí hace falta
un código nuevo — ningún error existente describe "este pedido no está
entregado" desde la perspectiva del cliente; `ORDER_NOT_PENDING` (E2)
describe específicamente que un pedido no está en `creado`, un estado
distinto y con una causa de negocio distinta.

**Alternativas consideradas**:
- *Reutilizar `ORDER_NOT_PENDING`*: descartado — el mensaje literal dice
  "ya no está pendiente", que es incorrecto y confuso para un pedido que
  en realidad está `en_preparacion` o `asignado_repartidor` (ninguno de los
  dos es "pendiente" en el sentido de HU-01).

## D-077 · Un solo método de servicio, dos rutas HTTP, para confirmar y reclamar

**Decisión**: `cerrar(id, clienteId, complaintReason: string | null)` es un
único método; `PUT /orders/:id/confirm` lo llama con `complaintReason:
null`, `PUT /orders/:id/complain` con el motivo ya validado por
`ComplainOrderSchema`.

**Razón**: mismo criterio que ya usan `aceptar`/`rechazar` de E2 —dos rutas
HTTP con nombres claros para quien integra el frontend, una sola
transacción de escritura por debajo, sin duplicar la lógica de
concurrencia ni el registro de historial.

**Alternativas consideradas**:
- *Un solo endpoint `PUT /orders/:id/close` con un `complaint` opcional en
  el cuerpo*: descartado — mezclar "confirmar" y "reclamar" en un único
  cuerpo con un campo opcional oscurece la intención en el contrato HTTP
  (¿qué pasa si `complaint` es una cadena vacía?, D-036 de E2 ya evitó esta
  ambigüedad separando `VALIDATION_ERROR` de conflictos de negocio); dos
  rutas explícitas la eliminan de raíz.

## D-078 · El reclamo se muestra reutilizando `HistorialPedido`, sin tocar las tres páginas de detalle

**Decisión**: `apps/web/src/components/historial-pedido.tsx` (E4, D-051)
gana una condición más, simétrica a la que ya muestra `rejectionReason`:
cuando el último evento del historial es `CERRADO` y `pedido.complaintReason`
existe, se muestra el motivo.

**Razón**: es exactamente la razón de ser de `HistorialPedido` — una sola
presentación para las tres pantallas de detalle (cliente, negocio, admin)
que ya evita triplicar la línea de tiempo. Agregar el reclamo ahí es la
extensión mínima; ninguna de las tres páginas (`cliente/pedidos/[id]`,
`negocio/pedidos/[id]`, `admin/pedidos/[id]`) necesita saber que el campo
existe.

**Alternativas consideradas**:
- *Mostrar el reclamo solo en la pantalla del cliente*: descartado — FR-011
  exige explícitamente que el negocio lo vea, y `HistorialPedido` ya sirve
  a los tres roles sin distinción de contenido.

## D-079 · Sin pantalla nueva del repartidor: "Marcar entregado" se agrega a `pedido-en-curso.tsx`

**Decisión**: el botón nuevo vive en el mismo componente que ya construyó
E5 para "Soltar pedido", no en una pantalla ni componente aparte.

**Razón**: ambas acciones actúan sobre el mismo pedido en curso, en el
mismo momento de la interacción del repartidor; separarlas en componentes
distintos solo porque pertenecen a épicas distintas rompería la cohesión
visual sin ninguna ventaja técnica.

## D-080 · Confirmar es un clic directo; reclamar exige el diálogo con motivo

**Decisión**: "Todo bien" es una acción directa, sin `ConfirmarAccion`
—mismo patrón que "Aceptar" (E2) y "Tomar" (E5)—; "Reclamar" sí usa el
diálogo con un campo de texto obligatorio, mismo patrón que "Rechazar"
(E2, `DialogoRechazo`).

**Razón**: confirmar no tiene ningún efecto que deba explicarse ni
deshacerse — cierra el pedido con normalidad, el camino esperado en la
mayoría de los casos (SC-002 lo mide en 1 clic). Reclamar sí necesita un
paso adicional porque exige capturar el motivo, y ese paso ya cumple el
requisito de confirmación explícita del Principio IX sin necesitar un
diálogo de confirmación separado antes o después.

**Alternativas consideradas**:
- *Pedir confirmación también para "Todo bien"*: descartado — no hay
  ningún efecto no obvio ni irreversible que justificarle al cliente antes
  de una acción que, además, SC-002 mide explícitamente en 1 clic.
