import { z } from 'zod';

/**
 * Inicio de sesión (FR-001).
 *
 * La contraseña **no** se valida contra el mínimo de 8 caracteres ni contra
 * ningún máximo: hacerlo revelaría, por diferencia de mensaje, una
 * característica de la credencial almacenada, que es la cuarta prohibición de
 * FR-008 (security CHK017). En el inicio de sesión, cualquier fallo produce el
 * mismo `MSG_CREDENCIALES_INVALIDAS`.
 *
 * El correo se recorta y se pasa a minúsculas, de modo que iniciar sesión con
 * el correo en mayúsculas o con espacios al borde funcione (FR-001, A15).
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Debes ingresar un correo electrónico válido.'),
  password: z.string().min(1, 'Debes ingresar tu contraseña.'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
