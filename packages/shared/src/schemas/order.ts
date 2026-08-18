import { z } from 'zod';
import {
  MSG_DIRECCION_REQUERIDA,
  MSG_DIRECCION_TEXTO_VACIO,
  MSG_MOTIVO_RECHAZO_REQUERIDO,
} from '../messages/es';

/**
 * Confirmación y transiciones del pedido (HU-01, FR-022, FR-025–FR-033).
 */
const LineaEsperadaSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  price: z.number().int().min(0),
});

/**
 * `expectedLines` es la lista completa de líneas que el cliente vio en su
 * última carga del carrito, con la cantidad y el precio que vio (D-036) — el
 * servicio la compara contra la composición real del carrito (`productId` y
 * `quantity`) y, si coincide, contra el precio vigente de cada producto
 * dentro de la transacción que crea el pedido (FR-028, contracts/api.md
 * § `POST /orders`).
 *
 * Exactamente uno de `addressId`/`addressText` debe llegar con contenido
 * (FR-022, FR-017): una dirección guardada identifica cuál marcar
 * `usedInOrder`; una puntual nunca lo hace.
 */
export const ConfirmOrderSchema = z
  .object({
    addressId: z.string().uuid().optional(),
    addressText: z
      .string()
      .trim()
      .min(10, MSG_DIRECCION_TEXTO_VACIO)
      .max(500, 'El texto de la dirección es demasiado largo.')
      .optional(),
    expectedLines: z.array(LineaEsperadaSchema).min(1),
  })
  .refine((datos) => Boolean(datos.addressId) !== Boolean(datos.addressText), {
    message: MSG_DIRECCION_REQUERIDA,
    path: ['addressId'],
  });

/**
 * Rechazo de un pedido (FR-033, RN-007). El motivo es texto libre, no una
 * lista cerrada de causas: un texto solo de espacios se rechaza igual que uno
 * vacío, mismo patrón que el resto de los campos obligatorios de E2/E3.
 */
export const RejectOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_RECHAZO_REQUERIDO).max(500),
});

export type ConfirmOrderInput = z.infer<typeof ConfirmOrderSchema>;
export type RejectOrderInput = z.infer<typeof RejectOrderSchema>;
