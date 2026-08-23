# Contrato de `packages/shared`: trazabilidad del pedido (E4)

Amplía la superficie pública descrita en
[`../../003-gestion-pedidos/contracts/shared.md`](../../003-gestion-pedidos/contracts/shared.md).
E4 **no agrega enums, esquemas Zod ni mensajes nuevos** — solo dos tipos de solo lectura en
`packages/shared/src/types/api.ts`, reexportados desde `index.ts`.

## Tipos nuevos

### `OrderStatusEventDto`

```ts
export type OrderStatusEventDto = {
  previousStatus: OrderStatus | null;
  resultingStatus: OrderStatus;
  actorName: string;
  actorRole: Role;
  occurredAt: string;
};
```

Una entrada de la línea de tiempo de un pedido (ver `data-model.md`, D-054). `actorRole` se
traduce en pantalla con `ETIQUETA_ROL` (ya existe, de E1); `resultingStatus` y `previousStatus`
con `ETIQUETA_ESTADO_PEDIDO` (ya existe, de E2) — ninguno de los dos mapas cambia.

### `OrderDetailDto`

```ts
export type OrderDetailDto = OrderSummaryDto & {
  history: OrderStatusEventDto[];
};
```

Extiende `OrderSummaryDto` (E2) por composición: todo lo que ya vale para `OrderSummaryDto`
—incluido que `rejectionReason` solo aparece cuando `status === 'rechazado'`— sigue valiendo
aquí sin redefinirse.

## Qué no cambia

- `OrderSummaryDto`, `OrderDto`, `Paginated<T>` — sin modificar.
- `OrderStatus`, `Role` — mismos enums de E1/E2, sin nuevos valores.
- `ETIQUETA_ROL`, `ETIQUETA_ESTADO_PEDIDO` — se reutilizan tal cual; E4 no agrega ninguna etiqueta
  nueva porque no introduce ningún estado ni rol nuevo.
- Ningún esquema Zod nuevo: los tres endpoints de E4 son `GET` sin cuerpo y su único parámetro
  (`:id`) ya se valida como UUID por el mismo mecanismo que usan `PUT /business/orders/:id/accept`
  y `/reject` desde E2.
