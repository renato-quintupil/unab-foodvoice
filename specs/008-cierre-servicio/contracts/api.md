# Contrato HTTP: Cierre del servicio (E7)

Amplía la superficie declarada en
[`../../003-gestion-pedidos/contracts/api.md`](../../003-gestion-pedidos/contracts/api.md) y
[`../../007-reparto-repartidor/contracts/api.md`](../../007-reparto-repartidor/contracts/api.md),
cuyas convenciones —formato de error, versionado, fechas— rigen aquí sin cambios. Prefijo común:
`/api/v1`.

## Quién puede llamar a qué

| Ruta | Roles admitidos | Guard | Restricción adicional |
|---|---|---|---|
| `PUT /delivery/orders/:id/deliver` | **Solo `REPARTIDOR`** | `SessionGuard` + `RolesGuard(REPARTIDOR)` | Solo el pedido que el repartidor tiene asignado en `asignado_repartidor` |
| `PUT /orders/:id/confirm` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` | Solo pedidos propios, y solo en `entregado` |
| `PUT /orders/:id/complain` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` | Solo pedidos propios, y solo en `entregado` |
| `GET /business/orders/closed` | **Solo `NEGOCIO`** | `SessionGuard` + `RolesGuard(NEGOCIO)` | Ninguna — v1 es mono-local (D-081) |

## Códigos de error que E7 añade

| HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 409 | `ORDER_NOT_DELIVERED` | El pedido no está en `entregado` (incluye uno ya `cerrado`) | `PUT /orders/:id/confirm`, `PUT /orders/:id/complain` |
| 404 | `NOT_FOUND` | El pedido no existe, o existe pero no pertenece al cliente autenticado | `PUT /orders/:id/confirm`, `PUT /orders/:id/complain` |
| 404 | `NOT_FOUND` | El pedido no existe | `PUT /delivery/orders/:id/deliver` |
| 409 | `DELIVERY_ORDER_NOT_YOURS` | El pedido no está asignado al repartidor autenticado en `asignado_repartidor` — **mismo código que ya usa** `PUT /delivery/orders/:id/release` (E5, D-075) | `PUT /delivery/orders/:id/deliver` |

Igual que en E5 (y a diferencia de E4): ningún endpoint de esta épica
necesita ocultar la existencia de un pedido frente al repartidor —ya puede
verlo en su propio pedido en curso—, así que `deliver` responde `404`
franco cuando el pedido no existe. `confirm`/`complain` sí ocultan
existencia frente a pedidos ajenos, mismo criterio que E4 (FR-005) para
todas las rutas de pertenencia del cliente.

---

## `PUT /api/v1/delivery/orders/:id/deliver`

Marca como entregado el pedido que el repartidor tiene en curso (Historia
1, FR-001 a FR-004).

Sin cuerpo de petición.

Respuesta `200`: `OrderSummaryDto` (el pedido, ahora en `entregado`).

Errores: `404 NOT_FOUND` (no existe) · `409 DELIVERY_ORDER_NOT_YOURS` (no
es el pedido en curso de este repartidor).

---

## `PUT /api/v1/orders/:id/confirm`

Cierra un pedido propio en `entregado` sin ningún reclamo (Historia 2,
FR-005, FR-006, FR-009).

Sin cuerpo de petición.

Respuesta `200`: `OrderSummaryDto` (el pedido, ahora en `cerrado`, sin
`complaintReason`).

Errores: `404 NOT_FOUND` (no existe o no es propio) · `409
ORDER_NOT_DELIVERED` (no está en `entregado`).

---

## `PUT /api/v1/orders/:id/complain`

Cierra un pedido propio en `entregado` con un reclamo (Historia 3, FR-005
a FR-008, FR-010, FR-012).

Cuerpo de la petición:

```json
{ "reason": "Llegó frío y sin las papas" }
```

`reason`: 10–500 caracteres, no vacío ni compuesto solo de espacios.

Respuesta `200`: `OrderSummaryDto` (el pedido, ahora en `cerrado`, con
`complaintReason` igual al motivo enviado).

Errores: `400 VALIDATION_ERROR` (motivo ausente o demasiado corto/largo) ·
`404 NOT_FOUND` (no existe o no es propio) · `409 ORDER_NOT_DELIVERED` (no
está en `entregado`).

---

## `GET /api/v1/business/orders/closed`

Pedidos `cerrado`, para que el negocio pueda llegar a su detalle y ver el
motivo del reclamo cuando lo hay (FR-011, D-081 — agregado tras el
hallazgo C1 de `/speckit.analyze`: sin esta lista, ningún enlace del
negocio alcanzaba un pedido `cerrado`).

Respuesta `200`:

```json
{ "items": [ { "id": "…", "status": "cerrado", "addressText": "…", "rejectionReason": null, "complaintReason": "Llegó frío y sin las papas", "lines": [ … ], "createdAt": "…" } ] }
```

`items: []` cuando no hay ninguno — la interfaz muestra
`MSG_SIN_PEDIDOS_CERRADOS`, mismo criterio que
`GET /business/orders/rejected` con `MSG_SIN_PEDIDOS_RECHAZADOS`.

---

## Qué no cambia

- `POST /orders`, `GET /orders`, `GET /orders/:id`, `GET /business/orders*`,
  `PUT /business/orders/:id/accept|reject`, `GET /admin/dashboard/orders*`,
  `GET /delivery/orders/available`, `GET /delivery/orders/current`,
  `PUT /delivery/orders/:id/take|release` — sin cambios de contrato.
- `GET /orders/:id` y `GET /business/orders/:id`/`GET
  /admin/dashboard/orders/:id` (E4) mostrarán las dos entradas de historial
  nuevas (`asignado_repartidor → entregado`, `entregado → cerrado`) y el
  motivo del reclamo cuando exista, sin ningún cambio en su propio
  contrato — es exactamente lo que FR-012 de E4 (D-051) dejó preparado.
