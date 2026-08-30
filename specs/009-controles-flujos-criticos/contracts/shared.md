# Contrato de `packages/shared`: Controles y administración (E8)

Amplía la superficie descrita en
[`../../003-gestion-pedidos/contracts/shared.md`](../../003-gestion-pedidos/contracts/shared.md) y
[`../../005-trazabilidad-pedido/contracts/shared.md`](../../005-trazabilidad-pedido/contracts/shared.md)
(si existe; en su defecto, `types/api.ts` tal como lo dejó E7).

## Tipos modificados

### `OrderStatusEventDto` — un campo nuevo

```ts
export type OrderStatusEventDto = {
  previousStatus: OrderStatus | null;
  resultingStatus: OrderStatus;
  actorName: string;
  actorRole: Role;
  reason: string | null; // ← nuevo (E8)
  occurredAt: string;
};
```

`reason` es distinto de `null` únicamente cuando `actorRole ===
'ADMINISTRADOR'` y la acción fue forzar una transición o cerrar
administrativamente. `OrderDetailDto` lo hereda sin cambio propio.

## Tipo nuevo

### `ServiceStatusDto`

```ts
export type ServiceStatusDto = {
  paused: boolean;
  reason: string | null;
  pausedAt: string | null;
};
```

## Esquemas nuevos

### `ForceOrderTransitionSchema` (`schemas/order.ts`)

```ts
export const ForceOrderTransitionSchema = z.object({
  targetStatus: z.nativeEnum(OrderStatus),
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});
export type ForceOrderTransitionInput = z.infer<typeof ForceOrderTransitionSchema>;
```

### `AdminCloseOrderSchema` (`schemas/order.ts`)

```ts
export const AdminCloseOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});
export type AdminCloseOrderInput = z.infer<typeof AdminCloseOrderSchema>;
```

### `PauseServiceSchema` (`schemas/service-status.ts`, nuevo)

```ts
export const PauseServiceSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});
export type PauseServiceInput = z.infer<typeof PauseServiceSchema>;
```

## Funciones nuevas · `order-state/machine.ts`

```ts
/** Historia 1 de HU-07 (E8). Excluye la retroceso, reservada al repartidor. */
export function transicionesForzablesPorAdmin(desde: OrderStatus): readonly OrderStatus[];

/** Historia 2 de HU-07 (E8). `true` para cualquier estado sin transiciones salientes propias. */
export function puedeCerrarseAdministrativamente(desde: OrderStatus): boolean;
```

`SIGUIENTE` no cambia (D-083): ambas funciones se apoyan en la tabla
existente sin redeclarar ninguna transición.

## Mensajes nuevos

```ts
export const MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO =
  'Escribe el motivo de esta acción administrativa.';
export const MSG_TRANSICION_ADMINISTRATIVA_INVALIDA =
  'Esta transición no es válida para el estado actual del pedido.';
export const MSG_PEDIDO_YA_ES_TERMINAL =
  'Este pedido ya está en un estado final y no admite intervenciones administrativas.';
export const MSG_SERVICIO_PAUSADO =
  'El servicio está temporalmente pausado. Intenta confirmar tu pedido más tarde.';
```

## Qué no cambia

- `OrderStatus`, `Role` — mismos enums, sin valores nuevos.
- `OrderSummaryDto`, `OrderDetailDto` — sin campo propio nuevo (el motivo
  administrativo vive en `OrderStatusEventDto.reason`).
- `RejectOrderSchema`, `ComplainOrderSchema` — sin cambios.
- `ETIQUETA_ESTADO_PEDIDO`, `ETIQUETA_ROL` — se reutilizan tal cual; ningún
  estado ni rol nuevo.
