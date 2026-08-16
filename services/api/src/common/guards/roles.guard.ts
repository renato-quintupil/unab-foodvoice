import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { sinPermiso } from '../errors';
import { CLAVE_ROLES } from './roles.decorator';
import type { PeticionConSesion } from './session.guard';

/**
 * Comprueba que el rol de la **sesión** permita la acción (FR-002, FR-003,
 * FR-011, FR-018, D-007).
 *
 * **El rol se lee de la sesión, no del usuario.** Es lo que implementa que un
 * cambio de rol rija desde el próximo inicio de sesión, y lo que garantiza que
 * ninguna sesión viva pueda ver mutados sus privilegios.
 *
 * El bloqueo ocurre en el procesamiento de la petición y no ocultando opciones
 * en pantalla: invocar la ruta directamente, sin pasar por la interfaz, recibe
 * igualmente `403 FORBIDDEN` con `MSG_SIN_PERMISO`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const exigidos = this.reflector.getAllAndOverride<Role[] | undefined>(CLAVE_ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);

    if (!exigidos || exigidos.length === 0) return true;

    const peticion = contexto.switchToHttp().getRequest<PeticionConSesion>();
    const rol = peticion.sesion?.role;

    if (!rol || !exigidos.includes(rol)) throw sinPermiso();
    return true;
  }
}
