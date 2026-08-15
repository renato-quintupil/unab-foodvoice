import { z } from 'zod';
import { Role, UserStatus } from '../enums/role';
import { PasswordSchema } from './password';

/**
 * Alta de un usuario (FR-009, FR-014).
 *
 * Los cinco campos son obligatorios (SC-005). Las longitudes son las mismas que
 * declara el modelo de datos, para que la validación de forma y la restricción
 * de almacenamiento no puedan discrepar.
 *
 * La **unicidad del correo no se valida aquí** (FR-017): exige consultar el
 * padrón, así que vive en el servicio de NestJS (D-005, frontera de
 * responsabilidad de `shared.md`).
 *
 * El rol `ADMINISTRADOR` **sí** puede asignarse: es lo que FR-009 enumera
 * literalmente, y es el único camino para que exista un segundo administrador.
 */
export const CreateUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre completo es obligatorio.')
    .max(120, 'El nombre completo es demasiado largo.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Debes ingresar un correo electrónico válido.')
    .max(254, 'El correo electrónico es demasiado largo.'),
  phone: z
    .string()
    .trim()
    .min(6, 'El teléfono es obligatorio.')
    .max(20, 'El teléfono es demasiado largo.'),
  password: PasswordSchema,
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Debes seleccionar un rol válido.' }),
  }),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/**
 * Edición de los datos de contacto y el correo (FR-010).
 *
 * Los tres campos son opcionales, con al menos uno presente. Cada campo
 * presente se valida **reutilizando la definición de `CreateUserSchema`**, no
 * repitiéndola: así ninguna edición puede dejar un usuario en un estado que su
 * alta habría rechazado (FR-014, security CHK003).
 *
 * **No** admite `role`, `status` ni `password`: son acciones de impacto con
 * endpoint y confirmación propios (FR-035).
 */
export const UpdateUserSchema = CreateUserSchema.pick({
  fullName: true,
  email: true,
  phone: true,
})
  .partial()
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debes modificar al menos un dato.',
  });

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/** Cambio de rol (FR-011). Acción de impacto: revoca las sesiones del afectado. */
export const ChangeRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Debes seleccionar un rol válido.' }),
  }),
});

export type ChangeRoleInput = z.infer<typeof ChangeRoleSchema>;

/** Desactivación y reactivación (FR-012, FR-013). Acción de impacto. */
export const ChangeStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: 'Debes seleccionar un estado válido.' }),
  }),
});

export type ChangeStatusInput = z.infer<typeof ChangeStatusSchema>;

/**
 * Restablecimiento de contraseña por el administrador (FR-026).
 *
 * Segunda y última ruta por la que una contraseña entra al sistema. Comparte
 * `PasswordSchema` con el alta, de modo que no exista una tercera puerta que
 * pudiera olvidarse de aplicar FR-032.
 */
export const ResetPasswordSchema = z.object({
  password: PasswordSchema,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
