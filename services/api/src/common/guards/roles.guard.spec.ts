/**
 * `RolesGuard` (T053, FR-002, FR-011, D-007).
 *
 * Lo que este archivo demuestra es una sola cosa, y es la que importa: **el rol
 * se lee de la sesión, no del usuario**. Es lo que implementa que un cambio de
 * rol rija desde el próximo inicio de sesión.
 */
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AppError } from '../errors';
import { RolesGuard } from './roles.guard';

function contextoCon(sesion: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ sesion }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  };
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('deja pasar si el endpoint no exige ningún rol', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextoCon({ role: Role.CLIENTE }) as never)).toBe(true);
  });

  it('deja pasar si el rol de la sesión está entre los exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);
    expect(guard.canActivate(contextoCon({ role: Role.ADMINISTRADOR }) as never)).toBe(true);
  });

  it('rechaza con 403 FORBIDDEN a los tres roles no administradores', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

    for (const rol of [Role.CLIENTE, Role.NEGOCIO, Role.REPARTIDOR]) {
      expect(() => guard.canActivate(contextoCon({ role: rol }) as never)).toThrow(AppError);
      try {
        guard.canActivate(contextoCon({ role: rol }) as never);
      } catch (error) {
        expect((error as AppError).code).toBe('FORBIDDEN');
        expect((error as AppError).getStatus()).toBe(403);
      }
    }
  });

  it('lee el rol de la SESIÓN y no del usuario', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

    // El usuario ya es cliente en el padrón, pero su sesión sigue congelada en
    // administrador: hasta que vuelva a iniciar sesión, ese es su rol vigente
    // (FR-011). El guard no debe mirar `usuario.role`.
    const sesion = { role: Role.ADMINISTRADOR, usuario: { role: Role.CLIENTE } };
    expect(guard.canActivate(contextoCon(sesion) as never)).toBe(true);

    // Y a la inversa: un usuario promovido a administrador sigue sin acceso
    // mientras arrastre una sesión de cliente.
    const inverso = { role: Role.CLIENTE, usuario: { role: Role.ADMINISTRADOR } };
    expect(() => guard.canActivate(contextoCon(inverso) as never)).toThrow(AppError);
  });

  it('rechaza si no hay sesión en la petición', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);
    expect(() => guard.canActivate(contextoCon(undefined) as never)).toThrow(AppError);
  });

  it('acepta cualquiera de varios roles exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.NEGOCIO, Role.ADMINISTRADOR]);
    expect(guard.canActivate(contextoCon({ role: Role.NEGOCIO }) as never)).toBe(true);
    expect(() => guard.canActivate(contextoCon({ role: Role.CLIENTE }) as never)).toThrow();
  });
});
