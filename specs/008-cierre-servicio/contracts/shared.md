# Contrato de `packages/shared`: Cierre del servicio (E7)

Amplía la superficie pública descrita en
[`../../003-gestion-pedidos/contracts/shared.md`](../../003-gestion-pedidos/contracts/shared.md)
y [`../../007-reparto-repartidor/contracts/shared.md`](../../007-reparto-repartidor/contracts/shared.md).

## Tipos modificados

### `OrderSummaryDto` — un campo nuevo

```ts
export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  addressText: string;
  rejectionReason: string | null;
  complaintReason: string | null; // ← nuevo
  lines: OrderLineDto[];
  createdAt: string;
};
```

`complaintReason` **solo** es distinto de `null` cuando `status ===
'cerrado'` y el cliente cerró reclamando. `OrderDetailDto` (E4) lo hereda
sin cambio propio, por composición.

## Esquema nuevo

### `ComplainOrderSchema`

```ts
export const ComplainOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_RECLAMO_REQUERIDO).max(500),
});

export type ComplainOrderInput = z.infer<typeof ComplainOrderSchema>;
```

Mismo molde que `RejectOrderSchema` (E2) — mismo rango de longitud, mismo
criterio de rechazar un texto compuesto solo de espacios en blanco.

## Mensajes nuevos

```ts
export const MSG_MOTIVO_RECLAMO_REQUERIDO =
  'Cuéntanos qué pasó para poder registrar tu reclamo.';
export const MSG_PEDIDO_NO_ENTREGADO =
  'Este pedido no está entregado. Actualiza la página para ver su estado actual.';
export const MSG_SIN_PEDIDOS_CERRADOS = 'Todavía no tienes pedidos cerrados.';
```

`MSG_SIN_PEDIDOS_CERRADOS` se agregó tras el hallazgo C1 de
`/speckit.analyze`, junto con `GET /business/orders/closed` (D-081).

## Qué no cambia

- `OrderStatus`, `Role` — mismos enums, sin valores nuevos.
- `packages/shared/src/order-state/machine.ts` — sin cambios;
  `asignado_repartidor → entregado` y `entregado → cerrado` ya estaban
  declaradas desde antes de E5.
- `ETIQUETA_ESTADO_PEDIDO`, `ETIQUETA_ROL` — se reutilizan tal cual.
- `OrderStatusEventDto`, `OrderDetailDto`, `DeliveryOrderDto` — sin cambio
  de forma propio; `OrderDetailDto` hereda `complaintReason` por
  composición desde `OrderSummaryDto`.
- `RejectOrderSchema` — sin cambios; `ComplainOrderSchema` es un tipo
  nuevo e independiente, no una variante del existente.
