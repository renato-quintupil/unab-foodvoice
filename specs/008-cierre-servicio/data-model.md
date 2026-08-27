# Fase 1 · Modelo de Datos: E7 · Cierre del servicio

## `Order` — una columna nueva (migración requerida)

```text
services/api/prisma/schema.prisma (modelo Order, línea ~376)
```

| Columna | Tipo | Uso |
|---|---|---|
| `complaint_reason` | `text?` | El motivo que el cliente escribió al reclamar. `NULL` salvo cuando el pedido se cerró por reclamo — misma invariante aplicada por el servicio, no por `CHECK`, que ya usa `rejection_reason` (E2). |

```prisma
model Order {
  // … columnas existentes (E2, E5) …
  complaintReason String? @map("complaint_reason")
}
```

**Migración** (`services/api/prisma/migrations/<timestamp>_cierre_servicio/migration.sql`):

```sql
ALTER TABLE "order" ADD COLUMN "complaint_reason" TEXT;
```

Sin índice: ninguna consulta de esta épica filtra por `complaint_reason` —
a diferencia de `delivery_user_id` (E5), que sí servía la lista de pedidos
disponibles.

## Tipos modificados · `packages/shared/src/types/api.ts`

### `OrderSummaryDto` — un campo nuevo

```ts
export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  addressText: string;
  rejectionReason: string | null;
  complaintReason: string | null; // ← nuevo (E7). NULL salvo `status === 'cerrado'` por reclamo.
  lines: OrderLineDto[];
  createdAt: string;
};
```

`OrderDetailDto` (E4) lo hereda automáticamente por composición
(`OrderSummaryDto & { history }`, D-051) — sin cambio de contrato propio.

## Esquema nuevo · `packages/shared/src/schemas/order.ts`

### `ComplainOrderSchema`

Mismo molde exacto que `RejectOrderSchema` (E2):

```ts
export const ComplainOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_RECLAMO_REQUERIDO).max(500),
});

export type ComplainOrderInput = z.infer<typeof ComplainOrderSchema>;
```

## Mensajes nuevos · `packages/shared/src/messages/es.ts`

| Constante | Texto | Productor |
|---|---|---|
| `MSG_MOTIVO_RECLAMO_REQUERIDO` | "Cuéntanos qué pasó para poder registrar tu reclamo." | Validación de `ComplainOrderSchema` (400, motivo vacío o muy corto) |
| `MSG_PEDIDO_NO_ENTREGADO` | "Este pedido no está entregado. Actualiza la página para ver su estado actual." | `PUT /orders/:id/confirm`, `PUT /orders/:id/complain` (409, D-076) |
| `MSG_SIN_PEDIDOS_CERRADOS` | "Todavía no tienes pedidos cerrados." | `GET /business/orders/closed` (lista vacía, D-081, hallazgo C1 de `/speckit.analyze`) |

## Diagrama de flujo de escritura

```text
PUT /delivery/orders/:id/deliver → OrdersService.entregar(id, repartidorId)        (repartidor)
PUT /orders/:id/confirm          → OrdersService.cerrar(id, clienteId, null)       (cliente)
PUT /orders/:id/complain         → OrdersService.cerrar(id, clienteId, motivo)     (cliente)
```

Las tres comparten la misma forma que `tomar()`/`soltar()` de E5 y
`transicionar()` de E2 (D-074): una escritura condicionada
(`updateMany` con `WHERE status = …`) dentro de una transacción, seguida de
`registrarEvento`. No se introduce un cuarto patrón de escritura.

### `entregar(id, repartidorId)`

```text
updateMany({
  where: { id, status: 'asignado_repartidor', deliveryUserId: repartidorId },
  data: { status: 'entregado' },
})
```

Si `count === 0`: releer para distinguir `noEncontrado()` (no existe) de
`pedidoNoAsignadoATi()` (existe, pero no es el pedido en curso de este
repartidor — D-075). `deliveryUserId` **no se limpia**: queda como registro
de quién entregó, a diferencia de `soltar()` (E5), que sí lo limpia porque
libera el pedido para otro repartidor.

### `cerrar(id, clienteId, complaintReason)`

```text
updateMany({
  where: { id, status: 'entregado', userId: clienteId },
  data: { status: 'cerrado', complaintReason },
})
```

Si `count === 0`: releer. Si no existe, o existe pero `userId !==
clienteId`: `noEncontrado()` — mismo criterio de FR-005 de E4 (no
distinguir "no existe" de "no es tuyo" en una ruta de pertenencia del
cliente). Si existe y es suyo pero no está en `entregado`:
`pedidoNoEntregado()` (D-076).

### `cerradosDelNegocio()` (D-081, hallazgo C1 de `/speckit.analyze`)

```text
findMany({ where: { status: 'cerrado' }, orderBy: { createdAt: 'desc' } })
```

Sin escritura: es la lista que le falta al negocio para llegar al detalle
de un pedido cerrado (y su reclamo, si lo hay) — mismo molde exacto que
`rechazadosDelNegocio()` (E2). Sin ella, FR-011/SC-004 no eran
verificables: la bandeja del negocio (`creado`/`en_preparacion`) y
"rechazados" (`RECHAZADO`) no dejaban ningún camino hacia un pedido
`cerrado`.

## Qué no cambia

- `OrderStatus`, `Role`, `packages/shared/src/order-state/machine.ts` — sin
  cambios. `SIGUIENTE[ASIGNADO_REPARTIDOR]` y `SIGUIENTE[ENTREGADO]` ya
  incluían `ENTREGADO`/`CERRADO` desde antes de E5.
- `ETIQUETA_ESTADO_PEDIDO` — sin cambios; `Entregado` y `Cerrado` ya
  existían como etiquetas desde E1.
- `OrderStatusEventDto`, `OrderDetailDto` (E4) — sin cambio de forma;
  `OrderDetailDto` hereda `complaintReason` por composición.
- `DeliveryOrderDto` (E5) — sin cambios; el pedido en curso del repartidor
  deja de existir en cuanto se marca entregado (ya no aparece en
  `GET /delivery/orders/current`), así que no necesita mostrar el reclamo.
