# Contrato HTTP: Reparto (E5)

Amplía la superficie declarada en
[`../../003-gestion-pedidos/contracts/api.md`](../../003-gestion-pedidos/contracts/api.md) y
[`../../005-trazabilidad-pedido/contracts/api.md`](../../005-trazabilidad-pedido/contracts/api.md),
cuyas convenciones —formato de error, versionado, fechas— rigen aquí sin cambios. Prefijo común:
`/api/v1`.

## Quién puede llamar a qué

| Ruta | Roles admitidos | Guard | Restricción adicional |
|---|---|---|---|
| `GET /delivery/orders/available` | **Solo `REPARTIDOR`** | `SessionGuard` + `RolesGuard(REPARTIDOR)` | Ninguna — todos los repartidores ven la misma lista (mono-local) |
| `GET /delivery/orders/current` | **Solo `REPARTIDOR`** | `SessionGuard` + `RolesGuard(REPARTIDOR)` | Solo el pedido propio (el que tiene asignado el repartidor autenticado) |
| `PUT /delivery/orders/:id/take` | **Solo `REPARTIDOR`** | `SessionGuard` + `RolesGuard(REPARTIDOR)` | Ninguna sobre el pedido; sí exige que el repartidor no tenga otro en curso (FR-004) |
| `PUT /delivery/orders/:id/release` | **Solo `REPARTIDOR`** | `SessionGuard` + `RolesGuard(REPARTIDOR)` | Solo el repartidor que lo tiene asignado puede soltarlo |

## Códigos de error que E5 añade

| HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 409 | `DELIVERY_ORDER_ALREADY_ASSIGNED` | El pedido ya no está en `en_preparacion` sin repartidor — otro repartidor lo tomó primero, o ya no existe en ese estado (FR-005) | `PUT /delivery/orders/:id/take` |
| 409 | `DELIVERY_ALREADY_HAS_ORDER` | El repartidor ya tiene un pedido en `asignado_repartidor` sin entregar (FR-004) | `PUT /delivery/orders/:id/take` |
| 409 | `DELIVERY_ORDER_NOT_YOURS` | El pedido no está asignado al repartidor autenticado (ya lo soltó, ya fue entregado, o nunca fue suyo) | `PUT /delivery/orders/:id/release` |
| 404 | `NOT_FOUND` | El pedido no existe | `PUT /delivery/orders/:id/take`, `PUT /delivery/orders/:id/release` |

A diferencia de E4, aquí **no hace falta ocultar la existencia de un pedido**: todo repartidor ya
puede ver cualquier pedido `en_preparacion` en la lista de disponibles, así que un 404 franco (en
vez de un 409 genérico) no revela nada que el repartidor no pudiera ver de otra forma.

---

## `GET /api/v1/delivery/orders/available`

Pedidos en `en_preparacion` sin repartidor asignado (Historia 1, FR-001, FR-006).

Respuesta `200`:

```json
{ "items": [ { "id": "…", "status": "en_preparacion", "addressText": "…", "rejectionReason": null, "lines": [ … ], "createdAt": "…" } ] }
```

`items: []` cuando no hay ninguno — la interfaz muestra `MSG_SIN_PEDIDOS_DISPONIBLES` (FR-006),
igual que `GET /business/orders` ya muestra `MSG_SIN_PEDIDOS_PENDIENTES` cuando está vacía.

---

## `GET /api/v1/delivery/orders/current`

El pedido que el repartidor autenticado tiene actualmente en `asignado_repartidor`, con el
teléfono de contacto del cliente (Historia 2, FR-007).

Respuesta `200`:

```json
{ "order": null }
```

o, con un pedido en curso:

```json
{
  "order": {
    "id": "…",
    "status": "asignado_repartidor",
    "addressText": "Los Aromos 123",
    "rejectionReason": null,
    "lines": [ { "productId": "…", "productName": "Sándwich Vegetariano", "price": 4990, "quantity": 1 } ],
    "createdAt": "2026-08-27T14:00:00.000Z",
    "customerPhone": "+56912345678"
  }
}
```

Mismo criterio que `GET /cart` (E2, D-046): siempre `200`, con una forma vacía-segura (`{ order:
null }`) en vez de `404` cuando no hay nada que mostrar — no es un error que un repartidor no
tenga ningún pedido en curso.

---

## `PUT /api/v1/delivery/orders/:id/take`

Toma un pedido disponible (Historia 1, FR-002, FR-003, FR-012).

Sin cuerpo de petición.

Respuesta `200`: `OrderSummaryDto` (el pedido, ahora en `asignado_repartidor`).

Errores: `404 NOT_FOUND` (no existe) · `409 DELIVERY_ORDER_ALREADY_ASSIGNED` (ya no está
disponible, FR-005) · `409 DELIVERY_ALREADY_HAS_ORDER` (el repartidor ya tiene uno, FR-004).

---

## `PUT /api/v1/delivery/orders/:id/release`

Suelta un pedido tomado, sin haberlo entregado (Historia 3, FR-008, FR-009, FR-012). Dispara la
transición de retroceso `asignado_repartidor → en_preparacion` habilitada por la enmienda
constitucional 3.0.0.

Sin cuerpo de petición.

Respuesta `200`: `OrderSummaryDto` (el pedido, de vuelta en `en_preparacion`, sin repartidor).

Errores: `404 NOT_FOUND` (no existe) · `409 DELIVERY_ORDER_NOT_YOURS` (no está asignado al
repartidor autenticado).

---

## Qué no cambia

- `POST /orders`, `GET /orders`, `GET /orders/:id`, `GET /business/orders*`,
  `PUT /business/orders/:id/accept|reject`, `GET /admin/dashboard/orders*` — sin cambios de
  contrato. `GET /orders/:id` y `GET /business/orders/:id` (E4) mostrarán la nueva entrada de
  historial `en_preparacion → asignado_repartidor` (y, si corresponde,
  `asignado_repartidor → en_preparacion`) sin ningún cambio en su propio contrato — es
  exactamente lo que FR-012 (E4) dejó preparado.
- El negocio sigue sin ninguna acción sobre pedidos en `asignado_repartidor`: `PUT
  /business/orders/:id/accept|reject` solo actúa sobre `creado` (RN-010 de E2), sin cambios.
