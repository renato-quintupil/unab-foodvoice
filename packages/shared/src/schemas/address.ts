import { z } from 'zod';
import { MSG_DIRECCION_ETIQUETA_VACIA, MSG_DIRECCION_TEXTO_VACIO } from '../messages/es';

/**
 * Direcciones de entrega (HU-11, FR-012–FR-024).
 *
 * `.trim()` antes de `.min()` es lo que hace que un texto compuesto solo de
 * espacios en blanco se rechace igual que uno vacío (FR-013, caso límite de
 * dirección con solo espacios) — mismo patrón que E1/E3 en todo campo de texto
 * obligatorio. Los rangos —2/60 para la etiqueta, 10/500 para el texto— son el
 * Supuesto 2 de la spec.
 */
const EtiquetaDireccionSchema = z
  .string()
  .trim()
  .min(2, MSG_DIRECCION_ETIQUETA_VACIA)
  .max(60, 'La etiqueta de la dirección es demasiado larga.');

const TextoDireccionSchema = z
  .string()
  .trim()
  .min(10, MSG_DIRECCION_TEXTO_VACIO)
  .max(500, 'El texto de la dirección es demasiado largo.');

export const CreateAddressSchema = z.object({
  label: EtiquetaDireccionSchema,
  text: TextoDireccionSchema,
});

/** Editar exige los dos campos completos: no es una edición parcial (FR-016). */
export const UpdateAddressSchema = CreateAddressSchema;

/** Desactivar y reactivar (FR-018). */
export const ChangeAddressStatusSchema = z.object({
  active: z.boolean({
    required_error: 'Debes indicar el estado de la dirección.',
    invalid_type_error: 'Debes indicar el estado de la dirección.',
  }),
});

export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
export type ChangeAddressStatusInput = z.infer<typeof ChangeAddressStatusSchema>;
