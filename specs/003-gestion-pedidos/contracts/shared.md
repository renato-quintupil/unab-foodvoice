# Contrato de `packages/shared` (E2)

Amplía la superficie pública ya declarada en
[`../../001-acceso-y-usuarios/contracts/shared.md`](../../001-acceso-y-usuarios/contracts/shared.md)
y [`../../002-administracion-menu-productos/contracts/shared.md`](../../002-administracion-menu-productos/contracts/shared.md).

## Enum ampliado

```ts
// enums/order-status.ts — MODIFICADO
export const OrderStatus = {
  CREADO: 'creado',
  EN_PREPARACION: 'en_preparacion',
  ASIGNADO_REPARTIDOR: 'asignado_repartidor',
  ENTREGADO: 'entregado',
  CERRADO: 'cerrado',
  RECHAZADO: 'rechazado', // NUEVO (D-035, Principio XII enmienda 2.0.0)
} as const;
```

`order-state/machine.ts` gana la rama `CREADO → RECHAZADO` en `SIGUIENTE`, sin tocar ninguna de
las cinco transiciones existentes.

## Esquemas nuevos

```ts
// schemas/cart.ts
export const AddCartLineSchema = z.object({
  productId: z.string().uuid(),
});

export const UpdateCartLineQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(0),
});

export type AddCartLineInput = z.infer<typeof AddCartLineSchema>;
export type UpdateCartLineQuantityInput = z.infer<typeof UpdateCartLineQuantitySchema>;
```

```ts
// schemas/address.ts
const EtiquetaDireccionSchema = z.string().trim().min(2).max(60);
const TextoDireccionSchema = z.string().trim().min(10).max(500);

export const CreateAddressSchema = z.object({
  label: EtiquetaDireccionSchema,
  text: TextoDireccionSchema,
});

export const UpdateAddressSchema = CreateAddressSchema;

export const ChangeAddressStatusSchema = z.object({ active: z.boolean() });

export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
export type ChangeAddressStatusInput = z.infer<typeof ChangeAddressStatusSchema>;
```

`.trim()` antes de `.min()` es lo que hace que un texto compuesto solo de espacios en blanco se
rechace igual que uno vacío (FR-013, caso límite de dirección con solo espacios) — mismo patrón
que E1/E3 usan en todos sus campos de texto obligatorio.

```ts
// schemas/order.ts
const LineaEsperadaSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  price: z.number().int().min(0),
});

export const ConfirmOrderSchema = z
  .object({
    addressId: z.string().uuid().optional(),
    addressText: z.string().trim().min(10).max(500).optional(),
    expectedLines: z.array(LineaEsperadaSchema).min(1),
  })
  .refine((datos) => Boolean(datos.addressId) !== Boolean(datos.addressText), {
    message: MSG_DIRECCION_REQUERIDA,
    path: ['addressId'],
  });

export const RejectOrderSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export type ConfirmOrderInput = z.infer<typeof ConfirmOrderSchema>;
export type RejectOrderInput = z.infer<typeof RejectOrderSchema>;
```

Se exige **exactamente uno** de los dos: `addressId` o `addressText`. Enviar ninguno o
ambos es inválido. La exclusión evita una precedencia implícita y coincide con el contrato HTTP:
una dirección guardada identifica cuál marcar `usedInOrder`; una puntual nunca lo hace.

## Extensión de `schemas/query.ts`

```ts
export const BusinessOrdersQuerySchema = z.object({
  status: z.enum([OrderStatus.CREADO, OrderStatus.EN_PREPARACION]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type BusinessOrdersQuery = z.infer<typeof BusinessOrdersQuerySchema>;
```

## Mensajes nuevos (`messages/es.ts`)

| Constante | Texto | Requisito |
|---|---|---|
| `MSG_PRODUCTO_NO_DISPONIBLE` | "Este producto no está disponible en este momento." | FR-002 |
| `MSG_CARRITO_VACIO` | "Tu carrito está vacío. Agrega productos para armar tu pedido." | FR-009, escenario HU12-E08 |
| `MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES` | "Hay productos en tu carrito que ya no están disponibles. Quítalos para poder confirmar." | FR-007 |
| `MSG_PRECIO_CAMBIO` | "El precio de uno o más productos cambió. Revisa tu carrito y confirma nuevamente." | FR-028 |
| `MSG_CARRITO_DESACTUALIZADO` | "Tu carrito cambió mientras revisabas el pedido. Actualiza la página y vuelve a confirmar." | D-036, `expectedLines` desalineado |
| `MSG_DIRECCION_ETIQUETA_VACIA` | "La etiqueta de la dirección no puede estar vacía." | FR-013 |
| `MSG_DIRECCION_TEXTO_VACIO` | "El texto de la dirección no puede estar vacío." | FR-013 |
| `MSG_DIRECCION_ETIQUETA_DUPLICADA` | "Ya tienes una dirección guardada con esa etiqueta." | FR-014 |
| `MSG_DIRECCION_REQUERIDA` | "Indica una dirección de entrega para confirmar tu pedido." | FR-022 |
| `MSG_DIRECCION_ELIGE_NUEVA_PREDETERMINADA` | "Elige otra dirección como predeterminada antes de desactivar esta." | FR-020 |
| `MSG_DIRECCION_EN_USO` | "Esta dirección ya se usó en un pedido y no se puede eliminar. Puedes desactivarla." | FR-019 |
| `MSG_MOTIVO_RECHAZO_REQUERIDO` | "Escribe el motivo del rechazo." | FR-033 |
| `MSG_PEDIDO_NO_PENDIENTE` | "Este pedido ya no está pendiente. Actualiza la página para ver su estado actual." | FR-032, D-038 |
| `MSG_SIN_PEDIDOS_PENDIENTES` | "No tienes pedidos pendientes por ahora." | FR-040 |
| `MSG_SIN_PEDIDOS_RECHAZADOS` | "Todavía no has rechazado ningún pedido." | FR-039 |

**`ETIQUETA_ESTADO_PEDIDO[OrderStatus.CREADO]`** cambia de `'Creado'` a `'Pendiente'` y se añade
`[OrderStatus.RECHAZADO]: 'Rechazado'` en `messages/etiquetas.ts` (D-041) — no es una constante
nueva, es una modificación de la existente.

## Extensión de `types/api.ts`

Ver `data-model.md` § Tipos de `packages/shared/src/types/api.ts` — `CartLineDto`, `CartDto`,
`AddressDto`, `OrderLineDto`, `OrderSummaryDto`. `OrderDto` (E1) no cambia.

`OrderStatusEvent` es una entidad interna de persistencia en E2. No se publica
`OrderStatusEventDto`, esquema ni export: E4 añadirá el contrato cuando exista una consulta.

## Superficie pública añadida a `index.ts`

```ts
export {
  AddCartLineSchema,
  UpdateCartLineQuantitySchema,
  type AddCartLineInput,
  type UpdateCartLineQuantityInput,
} from './schemas/cart';
export {
  CreateAddressSchema,
  UpdateAddressSchema,
  ChangeAddressStatusSchema,
  type CreateAddressInput,
  type UpdateAddressInput,
  type ChangeAddressStatusInput,
} from './schemas/address';
export {
  ConfirmOrderSchema,
  RejectOrderSchema,
  type ConfirmOrderInput,
  type RejectOrderInput,
} from './schemas/order';
export { BusinessOrdersQuerySchema, type BusinessOrdersQuery } from './schemas/query';
export {
  MSG_PRODUCTO_NO_DISPONIBLE,
  MSG_CARRITO_VACIO,
  MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES,
  MSG_PRECIO_CAMBIO,
  MSG_DIRECCION_ETIQUETA_VACIA,
  MSG_DIRECCION_TEXTO_VACIO,
  MSG_DIRECCION_ETIQUETA_DUPLICADA,
  MSG_DIRECCION_REQUERIDA,
  MSG_DIRECCION_ELIGE_NUEVA_PREDETERMINADA,
  MSG_DIRECCION_EN_USO,
  MSG_MOTIVO_RECHAZO_REQUERIDO,
  MSG_PEDIDO_NO_PENDIENTE,
  MSG_SIN_PEDIDOS_PENDIENTES,
  MSG_SIN_PEDIDOS_RECHAZADOS,
} from './messages/es';
export type {
  CartLineDto,
  CartDto,
  AddressDto,
  OrderLineDto,
  OrderSummaryDto,
} from './types/api';
```

## Compatibilidad

- `OrderStatus` gana un valor: cualquier `switch` o mapa **exhaustivo** existente sobre él en
  `apps/web` o `services/api` deja de compilar hasta cubrir `RECHAZADO` — es la señal en tiempo
  de compilación que hace imposible olvidar un lugar donde el estado nuevo debía manejarse.
- `ETIQUETA_ESTADO_PEDIDO` cambia un valor existente (D-041): cualquier prueba que fije el texto
  literal `'Creado'` falla hasta actualizarse a `'Pendiente'`.
- Ninguna función ni tipo existente de E1/E3 se elimina ni cambia de firma.
- FR-042–FR-044 refuerzan la atomicidad interna sin cambiar respuestas ni consumidores web o de
  voz; el historial no forma parte de la superficie pública de E2 (D-050).
