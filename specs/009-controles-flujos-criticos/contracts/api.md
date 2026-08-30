# Contrato HTTP: Controles y administración (E8)

Amplía la superficie declarada en
[`../../003-gestion-pedidos/contracts/api.md`](../../003-gestion-pedidos/contracts/api.md),
[`../../005-trazabilidad-pedido/contracts/api.md`](../../005-trazabilidad-pedido/contracts/api.md) y
[`../../008-cierre-servicio/contracts/api.md`](../../008-cierre-servicio/contracts/api.md),
cuyas convenciones —formato de error, versionado, fechas— rigen aquí sin cambios. Prefijo común:
`/api/v1`.

## Quién puede llamar a qué

| Ruta | Roles admitidos | Guard | Restricción adicional |
|---|---|---|---|
| `PUT /admin/orders/:id/force-transition` | **Solo `ADMINISTRADOR`** | `SessionGuard` + `RolesGuard(ADMINISTRADOR)` | El pedido debe tener una transición forzable desde su estado actual (Historia 1) |
| `PUT /admin/orders/:id/close` | **Solo `ADMINISTRADOR`** | `SessionGuard` + `RolesGuard(ADMINISTRADOR)` | El pedido no debe estar ya en un estado terminal (Historia 2) |
| `GET /admin/service/status` | **Solo `ADMINISTRADOR`** | `SessionGuard` + `RolesGuard(ADMINISTRADOR)` | Ninguna |
| `PUT /admin/service/pause` | **Solo `ADMINISTRADOR`** | `SessionGuard` + `RolesGuard(ADMINISTRADOR)` | Ninguna (Historia 3) |
| `PUT /admin/service/resume` | **Solo `ADMINISTRADOR`** | `SessionGuard` + `RolesGuard(ADMINISTRADOR)` | Ninguna (Historia 3) |

`POST /orders` (E2) no cambia de ruta ni de forma; gana un nuevo caso de
error (ver abajo) cuando el servicio está pausado.

## Códigos de error que E8 añade

| HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Motivo ausente, solo espacios, o fuera de 10–500 caracteres | `force-transition`, `close`, `pause` |
| 404 | `NOT_FOUND` | El pedido no existe | `force-transition`, `close` |
| 409 | `FORCE_TRANSITION_INVALID` | El estado destino no es una transición forzable desde el estado actual del pedido (incluye pedidos ya terminales), o la carrera se perdió | `force-transition` |
| 409 | `ORDER_ALREADY_TERMINAL` | El pedido ya está en `cerrado` o `rechazado`, o perdió la carrera | `close` |
| 409 | `SERVICE_PAUSED` | El servicio está pausado; no se admite confirmar pedidos nuevos | `POST /orders` |

`force-transition` y `close` responden `404` franco (sin ocultar
existencia): a diferencia de las rutas de pertenencia del cliente (E4,
FR-005), aquí no hay ninguna razón de negocio para esconder si un pedido
existe frente a un administrador, que ya puede ver cualquier pedido desde
el panel (HU-10).

---

## `PUT /api/v1/admin/orders/:id/force-transition`

Fuerza la transición normal siguiente sobre un pedido, en nombre del rol
que correspondería dispararla (Historia 1, FR-001 a FR-004, FR-007, FR-008).

Cuerpo de la petición:

```json
{ "targetStatus": "en_preparacion", "reason": "El negocio no respondió en más de una hora." }
```

`targetStatus`: uno de los valores de `OrderStatus`. `reason`: 10–500
caracteres, no vacío ni compuesto solo de espacios.

Respuesta `200`: `OrderSummaryDto` (el pedido, ya en `targetStatus`).

Errores: `400 VALIDATION_ERROR` · `404 NOT_FOUND` · `409
FORCE_TRANSITION_INVALID`.

**No admite** `targetStatus: 'en_preparacion'` cuando el pedido está en
`asignado_repartidor` — esa es la única transición de retroceso del
sistema (enmienda 3.0.0) y sigue reservada al repartidor dueño del pedido
(`PUT /delivery/orders/:id/release`, E5); intentarlo responde `409
FORCE_TRANSITION_INVALID`, igual que cualquier otro destino no forzable.

---

## `PUT /api/v1/admin/orders/:id/close`

Cierra administrativamente un pedido en cualquier estado no terminal,
fuera del camino normal (Historia 2, FR-003, FR-004, FR-006 a FR-008).

Cuerpo de la petición:

```json
{ "reason": "Local cerrado por emergencia, pedido no se puede completar." }
```

Respuesta `200`: `OrderSummaryDto` (el pedido, ahora en `cerrado`).

Errores: `400 VALIDATION_ERROR` · `404 NOT_FOUND` · `409
ORDER_ALREADY_TERMINAL`.

---

## `GET /api/v1/admin/service/status`

Estado actual del servicio, para que la pantalla de operaciones sepa qué
botón mostrar (FR-009 a FR-013).

Respuesta `200`:

```json
{ "paused": true, "reason": "Corte de luz en el local", "pausedAt": "2026-08-30T15:04:00.000Z" }
```

`reason` y `pausedAt` son `null` cuando `paused: false`.

---

## `PUT /api/v1/admin/service/pause`

Pausa el servicio completo, impidiendo `POST /orders` desde ese momento
(Historia 3, FR-009, FR-010).

Cuerpo de la petición:

```json
{ "reason": "Corte de luz en el local" }
```

Respuesta `200`: `ServiceStatusDto` (`paused: true`).

Errores: `400 VALIDATION_ERROR`.

---

## `PUT /api/v1/admin/service/resume`

Reanuda el servicio pausado (Historia 3, FR-012). Sin cuerpo de petición.

Respuesta `200`: `ServiceStatusDto` (`paused: false`).

Sin errores propios más allá de sesión/rol.

---

## `POST /api/v1/orders` — un caso de error nuevo

Sin cambio de forma. Cuando `ServiceStatus.paused = true`, responde `409
SERVICE_PAUSED` **antes** de tocar el carrito (FR-010, FR-011): el carrito
del cliente no se ve afectado y sigue pudiendo editarse con normalidad.

---

## Qué no cambia

- `GET /orders/:id`, `GET /business/orders/:id`, `GET
  /admin/dashboard/orders/:id` (E4) mostrarán, cuando exista, el motivo de
  una intervención administrativa dentro de la entrada de historial
  correspondiente (`OrderStatusEventDto.reason`), sin ningún cambio de
  contrato propio — es exactamente lo que la composición de D-051 (E4) deja
  preparado.
- El resto de rutas de E2/E3/E5/E7 — sin cambios.
