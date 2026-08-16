import { z } from 'zod';

/**
 * Límite impuesto por bcrypt, que trunca su entrada a 72 **bytes** (D-002).
 * Sin este máximo, dos contraseñas que compartan sus primeros 72 bytes serían
 * equivalentes para el sistema sin que nadie lo advirtiera.
 */
const MAX_PASSWORD_BYTES = 72;

/**
 * Contraseña: entre 8 caracteres y 72 bytes UTF-8, **sin otras exigencias de
 * composición** (FR-032, D-002).
 *
 * La medición del máximo es en bytes y no en caracteres porque el truncamiento
 * de bcrypt ocurre en bytes: una contraseña de 72 caracteres acentuados supera
 * el límite real. El mensaje al usuario habla de caracteres porque es lo que la
 * persona percibe; la validación es exacta.
 *
 * Se reutiliza en `CreateUserSchema` y en `ResetPasswordSchema`: las dos únicas
 * rutas por las que una contraseña entra al sistema (FR-009, FR-026, SC-016).
 */
export const PasswordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .refine(
    (v) => new TextEncoder().encode(v).length <= MAX_PASSWORD_BYTES,
    'La contraseña no puede superar los 72 caracteres.',
  );
