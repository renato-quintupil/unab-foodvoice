# Contrato HTTP: gestión de pedidos (E2)

Amplía la superficie declarada en
[`../../001-acceso-y-usuarios/contracts/api.md`](../../001-acceso-y-usuarios/contracts/api.md) y
[`../../002-administracion-menu-productos/contracts/api.md`](../../002-administracion-menu-productos/contracts/api.md),
cuyas convenciones —formato de error, límite de cuerpo, versionado, fechas— rigen aquí sin
cambios. Prefijo común: `/api/v1`.

## Quién puede llamar a qué

| Grupo de rutas | Roles admitidos | Guard | Requisito |
|---|---|---|---|
| `/cart/**` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` | RN-001, D-042 |
| `/addresses/**` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` | D-042 |
| `POST /orders`, `GET /orders` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` | FR-025 |
| `/business/orders/**` | **Solo `NEGOCIO`** | `SessionGuard` + `RolesGuard(NEGOCIO)` | FR-031, RN-001 |

Igual que en E3: el rechazo por rol ocurre en el guard del controlador, de modo que llamar a
cualquiera de estas rutas sin pasar por la interfaz recibe el mismo código que un clic bloqueado
(Escenarios HU-01 E10, E11).

## Códigos de error que E2 añade

| HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 409 | `CART_EMPTY` | El carrito no tiene líneas (FR-009), o perdió la carrera de una doble confirmación (D-037) | `POST /orders` |
| 409 | `CART_HAS_UNAVAILABLE_LINES` | Al menos una línea del carrito ya no está `active && available` (FR-002, FR-007, D-045) | `POST /cart/lines`, `POST /orders` |
| 409 | `PRICE_CHANGED` | El precio vigente de al menos un producto no coincide con `expectedLines` (FR-028, D-036) | `POST /orders` |
| 409 | `ADDRESS_REQUIRED` | No se indicó `addressId` ni `addressText` (FR-022) | `POST /orders` |
| 409 | `ADDRESS_LABEL_ALREADY_EXISTS` | Ya existe una dirección con esa etiqueta, activa o desactivada (FR-014) | `POST /addresses`, `PATCH /addresses/:id` |
| 409 | `ADDRESS_NEEDS_NEW_DEFAULT` | Se intenta retirar la predeterminada mientras existen otras direcciones activas (FR-020) | `PUT /addresses/:id/status` |
| 409 | `ADDRESS_IN_USE` | Se intenta `DELETE` una dirección con `usedInOrder = true` (FR-019) | `DELETE /addresses/:id` |
| 409 | `ORDER_NOT_PENDING` | El pedido no está en `creado` — ya se resolvió o perdió la carrera de aceptar/rechazar simultáneos (FR-032, D-038) | `PUT /business/orders/:id/accept`, `PUT /business/orders/:id/reject` |

Los ocho son `409`: describen un conflicto con el estado actual de los datos, nunca un error de
forma del cuerpo — eso sigue siendo `400 VALIDATION_ERROR` de los esquemas Zod (incluida la
longitud del motivo de rechazo y de los campos de dirección).

### `409 PRICE_CHANGED` incluye el carrito actualizado

```json
{
  "error": {
    "code": "PRICE_CHANGED",
    "message": "…"
  }
}
```

No lleva el carrito en el cuerpo del error: FR-028 exige que el sistema "actualice el carrito",
y el carrito **ya muestra el precio vigente en cada carga** (FR-006) — no hay nada que congelar
ni que devolver aquí que un `GET /cart` posterior no muestre ya. La interfaz reacciona a este
código volviendo a pedir `GET /cart` y mostrando el aviso, sin necesitar el precio nuevo en la
respuesta del error mismo.

### `409 ADDRESS_NEEDS_NEW_DEFAULT` solo aparece con otras direcciones activas

Retirar la **última** dirección activa nunca produce este error — está permitido y deja al
cliente sin predeterminada (FR-020, Escenario HU11-E12). El código solo se produce cuando existe
al menos otra dirección activa a la que el cliente podría transferir la marca antes de retirar
esta.

---

## Carrito — HU-12

Todas bajo `/cart`, solo rol cliente.

### `GET /api/v1/cart`

Devuelve el carrito del cliente autenticado, con el precio **vigente** de cada línea recalculado
en cada llamada (FR-006). Si el cliente nunca agregó nada, `Cart` no existe como fila (D-046) y
la respuesta es `{ "lines": [] }`, `200` — nunca `404`.

Respuesta `200`: `CartDto`. Cada línea marca `available: false` si su producto dejó de ser
`active && available` desde que se agregó (FR-007); la línea **sigue presente**, no se retira
sola (FR-008).

### `POST /api/v1/cart/lines`

Agrega un producto (FR-002, FR-004). Cuerpo: `{ "productId": string }`. Si la línea ya existe,
suma `1` a su cantidad; si no, la crea con cantidad `1`.

Errores: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (producto inexistente),
`409 CART_HAS_UNAVAILABLE_LINES` (el producto no está `active && available`, FR-002, FR-003 de la
spec — el propio clic de "Agregar" es la confirmación exigida por el Principio IX; no hay un
segundo paso de confirmación que este endpoint deba modelar).

Respuesta `201`: `CartDto` completo.

### `PATCH /api/v1/cart/lines/:productId`

Cambia la cantidad de una línea existente (FR-003, FR-005). Cuerpo: `{ "quantity": number }`,
entero `>= 0`. `quantity: 0` quita la línea (mismo endpoint, no uno separado — FR-003 lo describe
como una sola acción de "bajar la cantidad").

Errores: `400 VALIDATION_ERROR`, `404 NOT_FOUND` (la línea no existe en el carrito de este
cliente).

Respuesta `200`: `CartDto` completo.

### `DELETE /api/v1/cart/lines/:productId`

Quita una línea completa, sin importar su cantidad (FR-005, Escenario HU12-E06).

Respuesta `200`: `CartDto` completo. `404 NOT_FOUND` si la línea no existía.

### `DELETE /api/v1/cart`

Vacía el carrito completo (FR-010, Escenario HU12-E11). Idempotente: sobre un carrito ya vacío
responde `200` igual.

Respuesta `200`: `{ "lines": [] }`.

---

## Direcciones — HU-11

Todas bajo `/addresses`, solo rol cliente.

### `GET /api/v1/addresses`

Lista **todas** las direcciones del cliente, activas y desactivadas (para que la interfaz pueda
ofrecer reactivar una desactivada, FR-018). Sin paginación: ningún requisito la pide y el
Supuesto 3 lo declara explícito.

Respuesta `200`: `{ "items": AddressDto[] }`. Orden: `isDefault DESC, createdAt DESC`.

### `POST /api/v1/addresses`

Registra una dirección (FR-012). Cuerpo: `CreateAddressSchema` — `label`, `text`.

Si es la primera dirección activa del cliente, queda `isDefault: true` automáticamente
(FR-015); si ya existe una predeterminada, no cambia.

Errores: `400 VALIDATION_ERROR` (etiqueta o texto vacíos, incluido solo espacios en blanco —
FR-013), `409 ADDRESS_LABEL_ALREADY_EXISTS`.

Respuesta `201`: `AddressDto`.

### `PATCH /api/v1/addresses/:id`

Edita `label` y/o `text` (FR-016). No toca `isDefault`, `active` ni `usedInOrder`. Editar una
dirección **usada en un pedido anterior no altera ese pedido** — su texto ya vive copiado en
`order.address_text` (RN-006, D-039).

Errores: `400`, `404 NOT_FOUND`, `409 ADDRESS_LABEL_ALREADY_EXISTS`.

Respuesta `200`: `AddressDto`.

### `PUT /api/v1/addresses/:id/default`

Marca esta dirección como predeterminada y quita la marca a cualquier otra, en una transacción
(FR-015, Escenario HU11-E05). Solo aplica a direcciones activas: marcar una desactivada como
predeterminada responde `409` con el mismo código que reactivarla exigiría primero.

Respuesta `200`: `AddressDto`.

### `PUT /api/v1/addresses/:id/status`

Desactiva o reactiva (FR-018). Cuerpo: `{ "active": boolean }`.

- Al **desactivar** la predeterminada mientras existen otras direcciones activas, responde
  `409 ADDRESS_NEEDS_NEW_DEFAULT` sin aplicar nada (FR-020). Al desactivar la **última**
  dirección activa, se permite y el cliente queda sin predeterminada (Escenario HU11-E12).
- Al **reactivar**, queda predeterminada automáticamente si no existe ninguna otra activa
  (Escenario HU11-E13); si ya existe una, no cambia (Escenario HU11-E14).
- Poner el valor que ya tiene es una petición sin efecto, no un error — mismo patrón que
  `cambiarEstado` de E3.

Respuesta `200`: `AddressDto`.

### `DELETE /api/v1/addresses/:id`

Borrado físico, **solo si `usedInOrder = false`** (FR-019, D-039). Si la dirección ya fue usada
en algún pedido, responde `409 ADDRESS_IN_USE` — el camino correcto es desactivarla.

Respuesta `204`. `404 NOT_FOUND` si no existe o no pertenece a este cliente.

---

## Pedidos — HU-01

### `POST /api/v1/orders`

Confirma el carrito del cliente autenticado como un pedido (FR-025). Cuerpo:

```json
{
  "addressId": "uuid opcional",
  "addressText": "string opcional, dirección puntual sin guardar (FR-017)",
  "expectedLines": [{ "productId": "uuid", "price": 4990 }]
}
```

Exactamente uno de `addressId`/`addressText` debe llegar con contenido; ninguno de los dos es
`409 ADDRESS_REQUIRED`. `expectedLines` es la lista completa de líneas que el cliente vio en su
última carga del carrito, con el precio que vio (D-036) — se compara contra el carrito real y
contra el precio vigente de cada producto dentro de la transacción.

Orden de validación dentro de la transacción (D-037, D-036, D-045):

1. Bloquea la fila del carrito (`FOR UPDATE`).
2. Si no tiene líneas → `409 CART_EMPTY`.
3. Si no se indicó dirección → `409 ADDRESS_REQUIRED`.
4. Si `expectedLines` no coincide exactamente (mismos productos, mismas cantidades, mismos
   precios) con el carrito y el catálogo vigente → `409 PRICE_CHANGED`, **no crea nada**.
5. Si algún producto del carrito no está `active && available` → `409 CART_HAS_UNAVAILABLE_LINES`,
   **no crea nada**.
6. Crea el `Order` en `creado`, sus `OrderLine` con nombre y precio congelados (FR-027), marca
   `Address.usedInOrder = true` si se usó una guardada, y vacía el carrito (`DELETE` en cascada de
   sus líneas).

Solo el paso 6 es una escritura; los pasos 1 a 5 son de solo lectura y cualquiera de ellos que
falle deja el carrito exactamente como estaba (FR-029).

Errores: `400 VALIDATION_ERROR`, `409 CART_EMPTY`, `409 ADDRESS_REQUIRED`,
`409 PRICE_CHANGED`, `409 CART_HAS_UNAVAILABLE_LINES`.

Respuesta `201`: `OrderSummaryDto`.

### `GET /api/v1/orders`

Los pedidos del cliente autenticado, más reciente primero. Sin paginación (Principio I: ningún
requisito la pide para esta vista, a diferencia de la bandeja del negocio).

Respuesta `200`: `{ "items": OrderSummaryDto[] }`.

### `GET /api/v1/business/orders`

La bandeja del negocio (FR-038, D-043). Parámetros:

| Parámetro | Tipo | Por defecto |
|---|---|---|
| `status` | `creado` \| `en_preparacion` | Sin filtro: ambos combinados |
| `page` | entero `>= 1` | `1` |

Paginado en `PAGE_SIZE` (20), ordenado `created_at ASC, id ASC` — del más antiguo al más
reciente (FR-041, Escenario HU01-E15). Sin resultados, la interfaz muestra el mensaje de
`MSG_SIN_PEDIDOS_PENDIENTES` (FR-040) sobre una lista vacía que igual llega como `200`.

Respuesta `200`: `Paginated<OrderSummaryDto>`.

### `GET /api/v1/business/orders/rejected`

Los pedidos que el negocio rechazó, con su motivo (FR-039). Sin paginación: no es la vista de
trabajo cotidiano, es un registro de consulta ocasional.

Respuesta `200`: `{ "items": OrderSummaryDto[] }`, orden `created_at DESC`.

### `PUT /api/v1/business/orders/:id/accept`

Acepta un pedido en `creado` (FR-031, D-038). Sin cuerpo.

Errores: `404 NOT_FOUND` (no existe), `409 ORDER_NOT_PENDING` (no está en `creado`).

Respuesta `200`: `OrderSummaryDto` con `status: "en_preparacion"`.

### `PUT /api/v1/business/orders/:id/reject`

Rechaza un pedido en `creado` (FR-031, FR-033, D-038). Cuerpo: `{ "reason": string }`, 10–500
caracteres no vacíos tras recortar espacios (Supuesto 2, caso límite de motivo en blanco).

Errores: `400 VALIDATION_ERROR` (motivo vacío o solo espacios — no existe ningún camino que lo
omita, FR-033), `404 NOT_FOUND`, `409 ORDER_NOT_PENDING`.

Respuesta `200`: `OrderSummaryDto` con `status: "rechazado"` y `rejectionReason` poblado.
