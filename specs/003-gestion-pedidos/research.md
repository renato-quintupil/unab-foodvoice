# Fase 0 · Investigación: E2 · Gestión de pedidos

Continúa la numeración de decisiones de E1 (`D-001`–`D-019`) y E3 (`D-020`–`D-033`).
Ninguna decisión de las dos épicas anteriores se revierte aquí.

## D-034 · Tres tablas nuevas, no JSON embebido

**Decisión**: `Cart`, `CartLine`, `Address`, `Order` y `OrderLine` son tablas relacionales
propias, no columnas JSON sobre `user`.

**Razón**: FR-014 exige unicidad de etiqueta por cliente, FR-004 exige sumar cantidades a la
línea existente y FR-036 exige atomicidad transaccional. Las tres son invariantes que PostgreSQL
garantiza de forma nativa con índices únicos y transacciones sobre filas, y que un blob JSON
solo podría replicar con validación de aplicación — exactamente el patrón que E1 y E3 evitaron
con `search_normalized` y `name_normalized`.

**Alternativas consideradas**: carrito en `localStorage` del navegador — descartada explícitamente
por la spec (FR-011, FR-001: "persistido en el servidor", "conserva… al cerrar sesión").

## D-035 · La ampliación del contrato de estados ya está resuelta

`OrderStatus` gana `RECHAZADO` porque la constitución ya se enmendó (2.0.0, 2026-08-17,
Principio XII) antes de este plan, tal como exige el Supuesto 1 de la spec. Este plan **no**
vuelve a decidirlo: solo lo traduce a `packages/shared/src/enums/order-status.ts`,
`order-state/machine.ts` y al enum de Prisma.

## D-036 · La revalidación de precio compara contra lo que el cliente vio, no contra un reloj

**Decisión**: `POST /orders` recibe `expectedLines: { productId, price }[]` — los precios que el
carrito le mostró al cliente en su última carga — y el servicio los compara contra el precio
vigente de cada producto **dentro de la misma transacción** que crea el pedido. Si algún precio
no coincide, la petición completa falla con `409 PRICE_CHANGED` y no se crea nada (FR-028).

**Razón**: es la única señal que existe de "lo último que el cliente revisó" (Escenario HU-01
E16). Guardar un timestamp de "última carga del carrito" en el servidor sería más estado que
mantener y no resolvería nada que el eco de los precios no resuelva ya — el cliente ya tiene esos
precios en la pantalla que está mirando.

**Alternativas consideradas**: bloqueo optimista con columna `version` en `CartLine` —
descartada: exigiría que el cliente conociera y devolviera un número de versión sin ningún
significado visible, mientras que devolver el precio que vio es exactamente el dato que FR-028
menciona.

## D-037 · La doble confirmación se resuelve con `SELECT … FOR UPDATE` sobre el carrito

**Decisión**: `POST /orders` abre una transacción que primero bloquea la fila del carrito
(`SELECT id FROM cart WHERE id = $1 FOR UPDATE`) antes de leer sus líneas. Una segunda
confirmación concurrente del mismo carrito espera a que la primera transacción termine; cuando
por fin puede leer, el carrito ya está vacío y falla con el mismo `409 CART_EMPTY` de un carrito
vacío corriente (FR-009, FR-036, caso límite "dos confirmaciones… solo una produce un pedido").

**Razón**: no hace falta un código de error nuevo para la carrera — el resultado observable para
la petición perdedora es indistinguible de intentar confirmar un carrito vacío, y tratarlo así
cumple el Principio I. `Serializable` a nivel de transacción se descartó por ser más mecanismo
(reintentos, manejo de `40001`) para el mismo resultado que un bloqueo de fila explícito ya da.

## D-038 · Aceptar/rechazar se resuelve con una escritura condicionada, sin bloqueo explícito

**Decisión**: aceptar y rechazar ejecutan `UPDATE order SET status = $1 WHERE id = $2 AND status
= 'creado'` (vía `prisma.order.updateMany`) y comprueban `count`. Si es `0`, se lanza
`409 ORDER_NOT_PENDING` — el mismo código sirve para "el pedido ya no está en `creado`" (FR-032)
y para "otra petición ganó la carrera" (FR-036): desde el punto de vista de quien pierde, ambas
situaciones son la misma cosa observada un instante distinto.

**Razón**: es una escritura atómica por construcción — PostgreSQL nunca deja que dos
`UPDATE … WHERE status = 'creado'` concurrentes actualicen la misma fila dos veces —, sin
necesitar bloqueo de fila explícito como D-037. Es más simple porque aceptar/rechazar no
necesitan leer nada más que la condición misma.

## D-039 · `Address.usedInOrder` existe porque el pedido no referencia la dirección

**Decisión**: `Address` lleva un booleano `usedInOrder`, puesto a `true` la primera vez que un
pedido se confirma usando esa dirección guardada, y nunca vuelve a `false`.

**Razón**: RN-006 obliga a que el pedido guarde el texto de la dirección como una copia, no como
una referencia — igual que el precio del producto (D-036 de E3) —, precisamente para que editar
la dirección después no altere pedidos ya confirmados (FR-016). Pero esa misma decisión deja al
sistema sin ninguna forma de saber, mirando solo `Order`, si una dirección "fue usada alguna vez"
— el dato que FR-018/FR-019 necesitan para decidir entre desactivar (conserva) y eliminar (sin
dejar rastro). La bandera es la forma más simple de conservar esa sola pregunta sin reintroducir
la referencia que RN-006 prohíbe.

## D-040 · La etiqueta de dirección se normaliza y compara igual que el nombre de producto

**Decisión**: `Address.labelNormalized` usa `normalizarBusqueda` (el mismo `packages/shared` de
E1/E3) y la unicidad es `@@unique([userId, labelNormalized])`, alcanzando también a las
direcciones desactivadas.

**Razón**: FR-014 lo pide explícitamente ("mismo criterio que `normalizarBusqueda`") y el caso
límite de tildes/mayúsculas/espacios lo confirma. Alcanzar a las desactivadas replica RN-005 de
E3 (`product.nameNormalized` único incluye los dados de baja): si no alcanzara, reactivar una
dirección podría colisionar en silencio con una etiqueta creada mientras estaba desactivada.

## D-041 · `ETIQUETA_ESTADO_PEDIDO[CREADO]` cambia de "Creado" a "Pendiente"

**Decisión**: se modifica la constante existente de E1 en `packages/shared/src/messages/
etiquetas.ts` — no se crea una segunda tabla de etiquetas para el cliente. Se añade
`RECHAZADO: 'Rechazado'`.

**Razón**: FR-037 exige la etiqueta "Pendiente" para `creado`, y el Principio II prohíbe un
segundo lugar donde ese texto pudiera divergir. `ETIQUETA_ESTADO_PEDIDO` ya la consume el panel
de administración de E1 (`apps/web/src/app/admin/pedidos`); el cambio de texto es intencional
también ahí — "Pendiente" describe igual de bien un pedido `creado` visto por el administrador.
Las pruebas existentes que fijan el texto literal (`packages/shared/tests/messages.test.ts`,
`apps/web/tests/panel.test.tsx`) se actualizan durante la implementación, no en este plan.

## D-042 · El carrito y las direcciones se protegen con el mismo guard de rol que el catálogo

**Decisión**: `/cart/**` y `/addresses/**` usan `@Roles(Role.CLIENTE)`, igual patrón que
`/business/**` de E3 usa `@Roles(Role.NEGOCIO)`.

**Razón**: RN-001 lo declara explícito ("Solo el cliente tiene carrito"); no hay nada que
decidir de nuevo, solo aplicar el mecanismo ya construido en `common/guards`.

## D-043 · La bandeja del negocio combina `creado` y `en_preparacion` en una sola paginación

**Decisión**: `GET /business/orders` acepta un filtro opcional `status` (`creado` |
`en_preparacion`); sin filtro, devuelve ambos combinados, ordenados `created_at ASC, id ASC`
—del más antiguo al más reciente, con el desempate por `id` que hace el orden total (FR-041,
mismo criterio que `product_created_at_id_idx` de E3, invertido porque aquí "primero" es "más
antiguo")—, en páginas de `PAGE_SIZE` (20).

**Razón**: FR-038 describe una sola "bandeja" con ambos estados y FR-041 pagina "la bandeja de
pedidos pendientes" en singular; separarlas en dos listas obligaría a la interfaz a fusionar dos
paginaciones para mostrar "lo que tengo por atender", que es exactamente lo que un negocio quiere
ver junto.

## D-044 · Sin endpoint de detalle de pedido separado

**Decisión**: no existe `GET /orders/:id` ni `GET /business/orders/:id`. Los listados (`GET
/orders`, `GET /business/orders`, `GET /business/orders/rejected`) devuelven siempre el `OrderDto`
completo, con sus líneas, dirección y motivo cuando corresponde.

**Razón**: Principio I. Un pedido nunca tiene tantas líneas ni el negocio tantos pedidos
simultáneos como para que separar "resumen" de "detalle" ahorre algo perceptible (Escala/Alcance
§ Contexto Técnico), y ningún escenario de la spec pide navegar a una ficha propia — HU-01 E04
dice "lo ve con sus productos, cantidades, precios y dirección", en la bandeja misma.

## D-045 · La reserva de disponibilidad al confirmar reutiliza `active`/`available` de E3, sin bloqueo nuevo

**Decisión**: dentro de la misma transacción de `POST /orders` (D-036, D-037), después de
bloquear el carrito, se relee cada producto referenciado y se comprueba `active && available`. Si
alguno falla, se responde `409 CART_HAS_UNAVAILABLE_LINES` y no se crea el pedido — el carrito
persiste con la línea marcada, igual que al agregarlo (FR-002, FR-028, caso límite de condición
de carrera).

**Razón**: es la misma comprobación de FR-002 aplicada una segunda vez, en el único instante que
importa según Principio VIII. No hace falta ninguna reserva de stock: v1 no tiene contador de
unidades (constitución, Alcance en v1 del Principio VIII, enmienda 1.1.0), y `available` es un
interruptor, no un contador que pudiera agotarse durante la transacción.

## D-046 · `Cart` se crea perezosamente al primer `POST /cart/lines`

**Decisión**: no hay ninguna acción explícita de "crear carrito"; `POST /cart/lines` hace
`upsert` sobre `Cart` por `userId` antes de escribir la línea.

**Razón**: Principio I y RN-001 — un cliente que nunca agregó nada no necesita una fila de
carrito vacía esperándolo; FR-008 (mostrar mensaje de carrito vacío) se cumple igual devolviendo
una lista vacía cuando no existe fila.
