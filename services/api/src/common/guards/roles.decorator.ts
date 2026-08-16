import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const CLAVE_ROLES = 'roles';

/**
 * Autorización declarativa (D-007).
 *
 * Se elige un decorador y no una comprobación dentro de cada método para que su
 * **ausencia sea visible** en la revisión de código: un endpoint bajo `/admin`
 * sin `@Roles(...)` se nota de un vistazo, mientras que un `if` que falta no se
 * nota nunca. FR-003, FR-018 y SC-003/SC-008 exigen bloqueo del 100 %.
 */
export const Roles = (...roles: Role[]) => SetMetadata(CLAVE_ROLES, roles);
