import { z } from 'zod';

/**
 * Carrito (HU-12, FR-001–FR-011).
 *
 * `AddCartLineSchema` solo lleva `productId`: cantidad y precio no se piden
 * porque agregar siempre parte en 1 (FR-004) y el precio viaja congelado en
 * ningún lado hasta que exista un pedido (FR-006).
 */
export const AddCartLineSchema = z.object({
  productId: z.string().uuid(),
});

/**
 * `quantity: 0` quita la línea (FR-003): es el mismo endpoint el que hace las
 * dos cosas, no una acción separada.
 */
export const UpdateCartLineQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(0),
});

export type AddCartLineInput = z.infer<typeof AddCartLineSchema>;
export type UpdateCartLineQuantityInput = z.infer<typeof UpdateCartLineQuantitySchema>;
