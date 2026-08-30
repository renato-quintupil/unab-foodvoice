import { z } from 'zod';
import { OrderStatus } from '../enums/order-status';
import {
  MSG_DIRECCION_REQUERIDA,
  MSG_DIRECCION_TEXTO_VACIO,
  MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO,
  MSG_MOTIVO_RECHAZO_REQUERIDO,
  MSG_MOTIVO_RECLAMO_REQUERIDO,
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

/**
 * Reclamo al cerrar un pedido entregado (E7, HU-05, FR-007). Mismo molde
 * exacto que `RejectOrderSchema`: texto libre, un texto solo de espacios se
 * rechaza igual que uno vacío.
 */
export const ComplainOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_RECLAMO_REQUERIDO).max(500),
});

/**
 * Forzar la transición normal siguiente de un pedido (E8, HU-07 Historia 1,
 * FR-001, FR-002). `targetStatus` se valida solo como forma — que sea uno de
 * los seis estados—; la regla real (si es forzable desde el estado actual del
 * pedido) la decide `transicionesForzablesPorAdmin()` en tiempo de ejecución,
 * no este esquema.
 */
export const ForceOrderTransitionSchema = z.object({
  targetStatus: z.nativeEnum(OrderStatus),
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});

/**
 * Cierre administrativo de un pedido fuera del camino normal (E8, HU-07
 * Historia 2, FR-003, FR-004). Mismo molde que `RejectOrderSchema`/
 * `ComplainOrderSchema`.
 */
export const AdminCloseOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});

export type ConfirmOrderInput = z.infer<typeof ConfirmOrderSchema>;
export type RejectOrderInput = z.infer<typeof RejectOrderSchema>;
export type ComplainOrderInput = z.infer<typeof ComplainOrderSchema>;
export type ForceOrderTransitionInput = z.infer<typeof ForceOrderTransitionSchema>;
export type AdminCloseOrderInput = z.infer<typeof AdminCloseOrderSchema>;
