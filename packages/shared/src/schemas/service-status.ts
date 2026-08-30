import { z } from 'zod';
import { MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO } from '../messages/es';

/**
 * Pausar el servicio completo (E8, HU-07 Historia 3, FR-009). Reanudar no
 * tiene esquema propio: no exige motivo (FR-012), así que su endpoint no
 * recibe cuerpo.
 */
export const PauseServiceSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});

export type PauseServiceInput = z.infer<typeof PauseServiceSchema>;
