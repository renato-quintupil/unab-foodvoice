# Fase 1 · Modelo de Datos: E4 · Trazabilidad del pedido

**Ninguna tabla cambia.** E4 no toca `services/api/prisma/schema.prisma` ni agrega una
migración: `OrderStatusEvent` (E2) ya tiene la forma y el índice que esta épica necesita. Lo
único nuevo son dos tipos de solo lectura en `packages/shared`.

## Entidad reutilizada · `OrderStatusEvent` (sin cambios, definida en E2)

```text
services/api/prisma/schema.prisma:386
```

| Columna | Tipo | Uso en E4 |
|---|---|---|
| `id` | `uuid` | No se expone; solo ordena junto a `occurred_at` |
| `order_id` | `uuid` | Filtro de la consulta (`WHERE order_id = :id`) |
| `previous_status` | `OrderStatus?` | → `OrderStatusEventDto.previousStatus` |
| `resulting_status` | `OrderStatus` | → `OrderStatusEventDto.resultingStatus` |
| `actor_user_id` | `uuid` | Se resuelve contra `User` para `actorName` (D-054); no se expone el UUID |
| `actor_role` | `Role` | → `OrderStatusEventDto.actorRole` |
| `occurred_at` | `timestamptz(3)` | → `OrderStatusEventDto.occurredAt`; también el orden de la secuencia |

La consulta usa el índice ya existente `order_status_event_order_id_occurred_at_id_idx`
(`orderId, occurredAt, id`) — el `id` como desempate para dos eventos con el mismo timestamp,
que en la práctica no ocurre porque cada transición pasa por su propia transacción, pero el
índice ya lo contempla.

## Tipos nuevos · `packages/shared/src/types/api.ts`

### `OrderStatusEventDto`

Una entrada de la línea de tiempo de un pedido.

```ts
export type OrderStatusEventDto = {
  previousStatus: OrderStatus | null; // null únicamente en el primer evento
  resultingStatus: OrderStatus;
  actorName: string;   // User.fullName en el momento de la consulta (D-054)
  actorRole: Role;      // congelado desde E2; se traduce con ETIQUETA_ROL
  occurredAt: string;   // ISO 8601
};
```

### `OrderDetailDto`

El pedido más su historial completo. Extiende `OrderSummaryDto` por composición, no lo modifica
(D-051).

```ts
export type OrderDetailDto = OrderSummaryDto & {
  history: OrderStatusEventDto[]; // orden cronológico ascendente, el primero es la creación
};
```

**Invariantes que el servicio debe respetar** (no expresables en el tipo):

- `history` nunca está vacío: todo `Order` tiene al menos el evento de creación, insertado en la
  misma transacción que `OrdersService.confirmar` (E2).
- `history[0].previousStatus` es siempre `null`; ningún otro elemento lo es.
- `history[history.length - 1].resultingStatus === status` del propio `OrderDetailDto` — el
  historial y el estado actual nunca deberían divergir, porque ambos se leen de la misma fila
  en la misma consulta.

## Diagrama de flujo de lectura

```text
GET /orders/:id                  → OrdersService.detalleParaCliente(id, userId)  ──┐
GET /business/orders/:id         → OrdersService.detalleParaNegocio(id)           ├─→ OrderDetailDto
GET /admin/dashboard/orders/:id  → DashboardService.detalle(id)                   ──┘
```

Tres métodos, no uno solo: `detalleParaCliente` y `detalleParaNegocio` comparten la misma
consulta y el mismo mapeo a `OrderDetailDto`, y difieren únicamente en que el primero agrega
`WHERE order.userId = :userId` (RN de FR-003) y el segundo no (D-053) — la diferencia es una
cláusula, no justifica un parámetro `alcance` genérico (Principio I: la opción más simple). El
método del admin no comparte código con `OrdersService` porque vive en un módulo distinto
(`DashboardService`), pero construye el mismo `OrderDetailDto` a partir de la misma consulta.
