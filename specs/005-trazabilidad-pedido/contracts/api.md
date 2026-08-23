# Contrato HTTP: trazabilidad del pedido (E4)

Amplía la superficie declarada en
[`../../003-gestion-pedidos/contracts/api.md`](../../003-gestion-pedidos/contracts/api.md),
cuyas convenciones —formato de error, versionado, fechas— rigen aquí sin cambios. Prefijo común:
`/api/v1`. Los tres endpoints son **`GET`**, de solo lectura: ninguno escribe en
`order_status_event` ni en `order`.

## Quién puede llamar a qué

| Ruta | Roles admitidos | Guard | Restricción adicional |
|---|---|---|---|
| `GET /orders/:id` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` | Solo pedidos propios (FR-003) |
| `GET /business/orders/:id` | **Solo `NEGOCIO`** | `SessionGuard` + `RolesGuard(NEGOCIO)` | Ninguna — v1 es mono-local (D-053, FR-004) |
| `GET /admin/dashboard/orders/:id` | **Solo `ADMINISTRADOR`** | `SessionGuard` + `RolesGuard(ADMINISTRADOR)` | Ninguna (FR-006) |

## Códigos de error que E4 añade

| HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 404 | `NOT_FOUND` | El pedido no existe, **o** existe pero no pertenece al cliente autenticado (FR-005) | `GET /orders/:id` |
| 404 | `NOT_FOUND` | El pedido no existe | `GET /business/orders/:id`, `GET /admin/dashboard/orders/:id` |

No se agrega ningún código `409`: E4 no muta estado, así que no hay conflicto posible con el
estado actual de los datos. El `404` de `GET /orders/:id` es **intencionalmente el mismo** para
"no existe" y "no es tuyo" — es el requisito de FR-005, no una limitación técnica. Reutiliza el
helper `noEncontrado()` que `orders.service.ts` ya usa para el mismo propósito en `POST /orders`
(dirección ajena) y en `PUT /business/orders/:id/accept|reject` (pedido inexistente).

---

## `GET /api/v1/orders/:id`

Detalle de un pedido propio del cliente, con su historial completo de estados (Historia 1,
FR-001–FR-003, FR-005, FR-007, FR-010, FR-011).

Respuesta `200`: `OrderDetailDto` (ver `contracts/shared.md`).

```json
{
  "id": "…",
  "status": "en_preparacion",
  "addressText": "…",
  "rejectionReason": null,
  "lines": [ { "productId": "…", "productName": "…", "price": 4990, "quantity": 2 } ],
  "createdAt": "2026-08-23T14:00:00.000Z",
  "history": [
    {
      "previousStatus": null,
      "resultingStatus": "creado",
      "actorName": "María Pérez",
      "actorRole": "CLIENTE",
      "occurredAt": "2026-08-23T14:00:00.000Z"
    },
    {
      "previousStatus": "creado",
      "resultingStatus": "en_preparacion",
      "actorName": "Panadería Don José",
      "actorRole": "NEGOCIO",
      "occurredAt": "2026-08-23T14:05:00.000Z"
    }
  ]
}
```

Errores: `404 NOT_FOUND` (no existe, o pertenece a otro cliente — FR-005).

---

## `GET /api/v1/business/orders/:id`

Detalle de cualquier pedido, con su historial completo (Historia 2, FR-004, FR-008). Misma
forma de respuesta que `GET /orders/:id`; la única diferencia entre ambos endpoints es la
autorización (D-051, D-053).

Respuesta `200`: `OrderDetailDto`.

Errores: `404 NOT_FOUND` (el pedido no existe — sin restricción adicional, D-053).

---

## `GET /api/v1/admin/dashboard/orders/:id`

Detalle de cualquier pedido del sistema, sin restricción de pertenencia (Historia 3, FR-006,
FR-009). Extiende el reporte existente de HU-10 (`GET /admin/dashboard/orders`): la fila de la
tabla enlaza aquí, cumpliendo SC-004 (detalle en no más de dos acciones desde el reporte).

Respuesta `200`: `OrderDetailDto`.

Errores: `404 NOT_FOUND` (el pedido no existe).

---

## Qué no cambia

- `POST /orders`, `GET /orders`, `GET /business/orders`, `GET /business/orders/rejected`,
  `PUT /business/orders/:id/accept`, `PUT /business/orders/:id/reject` — sin cambios de
  contrato; siguen devolviendo `OrderSummaryDto`, no `OrderDetailDto` (E4 no infla las listas
  con el historial completo de cada fila, D-051).
- `GET /admin/dashboard/orders` — sin cambios; sigue devolviendo `Paginated<OrderDto>`.
- `GET /admin/dashboard/metrics` — sin cambios.
