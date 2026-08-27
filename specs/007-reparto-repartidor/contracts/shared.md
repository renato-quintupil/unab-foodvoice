# Contrato de `packages/shared`: Reparto (E5)

Amplía la superficie pública descrita en
[`../../003-gestion-pedidos/contracts/shared.md`](../../003-gestion-pedidos/contracts/shared.md)
y [`../../005-trazabilidad-pedido/contracts/shared.md`](../../005-trazabilidad-pedido/contracts/shared.md).

## Tipos nuevos

### `DeliveryOrderDto`

```ts
export type DeliveryOrderDto = OrderSummaryDto & {
  customerPhone: string;
};
```

El pedido en curso del repartidor (ver `data-model.md`, D-070). Extiende `OrderSummaryDto` por
composición — todo lo que ya vale para `OrderSummaryDto` sigue valiendo aquí sin redefinirse.
`customerPhone` **solo** viaja en la respuesta de `GET /delivery/orders/current`; ningún otro
endpoint de la API, incluida la lista de disponibles, lo incluye.

## Mensajes nuevos

```ts
export const MSG_SIN_PEDIDOS_DISPONIBLES = 'No hay pedidos disponibles por ahora.';
export const MSG_PEDIDO_YA_NO_DISPONIBLE = 'Este pedido ya no está disponible.';
export const MSG_REPARTIDOR_YA_TIENE_PEDIDO =
  'Ya tienes un pedido en curso. Complétalo o suéltalo antes de tomar otro.';
export const MSG_PEDIDO_NO_ASIGNADO_A_TI = 'Este pedido ya no está asignado a ti.';
```

Cuatro constantes, cuatro significados distintos, cada una con un único productor en
`services/api/src/common/errors.ts` (ver `contracts/api.md`).

## Máquina de estados (`order-state/machine.ts`) — cambia, sin cambio de contrato de tipos

`OrderStatus` no gana ningún valor nuevo. Lo que cambia es `SIGUIENTE`
(`transicionesValidas`/`esTransicionValida`), que ahora refleja la constitución v3.0.0: agrega
`asignado_repartidor → en_preparacion` como única transición de retroceso del sistema. Ver
`data-model.md` para el `Record` completo.

## Qué no cambia

- `OrderSummaryDto`, `OrderDetailDto`, `OrderStatusEventDto`, `Paginated<T>` — sin modificar.
- `OrderStatus`, `Role` — mismos enums, sin valores nuevos.
- `ETIQUETA_ROL`, `ETIQUETA_ESTADO_PEDIDO` — se reutilizan tal cual; E5 no agrega ningún estado ni
  rol nuevo, solo una transición entre estados ya existentes.
- Ningún esquema Zod nuevo: los cuatro endpoints de E5 no reciben cuerpo (`GET` sin parámetros más
  allá de la sesión, `PUT` sin body) — su único parámetro (`:id`) se valida como UUID por el
  mismo mecanismo que ya usan `PUT /business/orders/:id/accept` y `/reject`.
