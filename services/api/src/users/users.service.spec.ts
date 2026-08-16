/**
 * Autoprotección del administrador (T078, FR-027, RN-006, SC-014).
 *
 * La regla es una y su alcance importa: un administrador **no** puede
 * desactivarse ni cambiarse el rol, pero **sí** puede editar sus datos de
 * contacto. La segunda mitad es la que se olvida al implementar la primera.
 *
 * RN-006 —que nunca queden cero administradores activos— **no necesita un
 * recuento**, y su ausencia es deliberada: quien ejecuta una desactivación o un
 * cambio de rol es siempre un administrador activo y no puede aplicarla sobre
 * sí mismo, luego después de la acción queda al menos él. Un recuento adicional
 * sería código que nunca podría dispararse (Principio III).
 */
import { Role, UserStatus } from '@prisma/client';
import { HashingService } from '../auth/hashing.service';
import { LoginAttemptService } from '../auth/login-attempt.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';

const filaAdmin = {
  id: ADMIN,
  fullName: 'Admin Uno',
  email: 'admin@ejemplo.cl',
  phone: '+56911112222',
  passwordHash: 'hash',
  role: Role.ADMINISTRADOR,
  status: UserStatus.ACTIVO,
  searchNormalized: 'admin uno admin@ejemplo.cl',
  createdAt: new Date('2026-08-15T12:00:00.000Z'),
  updatedAt: new Date('2026-08-15T12:00:00.000Z'),
};

describe('UsersService · autoprotección', () => {
  let tx: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    session: { updateMany: jest.Mock };
    adminAuditLog: { create: jest.Mock };
    loginAttemptControl: { deleteMany: jest.Mock };
  };
  let servicio: UsersService;

  beforeEach(() => {
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(filaAdmin),
        update: jest.fn().mockResolvedValue(filaAdmin),
      },
      session: { updateMany: jest.fn() },
      adminAuditLog: { create: jest.fn() },
      loginAttemptControl: { deleteMany: jest.fn() },
    };

    const prisma = {
      $transaction: (fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
    };

    servicio = new UsersService(
      prisma as unknown as PrismaService,
      { hash: jest.fn().mockResolvedValue('hash-nuevo') } as unknown as HashingService,
      { revocarTodasDe: jest.fn() } as unknown as SessionService,
      { limpiar: jest.fn() } as unknown as LoginAttemptService,
      { registrar: jest.fn() } as unknown as AuditService,
    );
  });

  it('un administrador NO puede desactivarse a sí mismo', async () => {
    await expect(
      servicio.cambiarEstado(ADMIN, UserStatus.DESACTIVADO, ADMIN),
    ).rejects.toMatchObject({ code: 'SELF_PROTECTION' });

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('un administrador NO puede cambiarse el rol a sí mismo', async () => {
    await expect(servicio.cambiarRol(ADMIN, Role.CLIENTE, ADMIN)).rejects.toMatchObject({
      code: 'SELF_PROTECTION',
    });

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('la autoprotección responde 409 SELF_PROTECTION', async () => {
    try {
      await servicio.cambiarRol(ADMIN, Role.CLIENTE, ADMIN);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).getStatus()).toBe(409);
    }
    expect.assertions(2);
  });

  it('SÍ puede editar sus propios datos de contacto (SC-014)', async () => {
    await expect(
      servicio.editar(ADMIN, { phone: '+56999998888' }, ADMIN),
    ).resolves.toMatchObject({ id: ADMIN });

    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('SÍ puede restablecer su propia contraseña: no es una acción sobre el rol ni el estado', async () => {
    await expect(
      servicio.restablecerContrasena(ADMIN, 'contrasena8', ADMIN),
    ).resolves.toBeUndefined();
  });

  it('sí puede desactivar y cambiar el rol de OTRO administrador', async () => {
    tx.user.findUnique.mockResolvedValue({ ...filaAdmin, id: OTRO });
    tx.user.update.mockResolvedValue({
      ...filaAdmin,
      id: OTRO,
      status: UserStatus.DESACTIVADO,
    });

    await expect(
      servicio.cambiarEstado(OTRO, UserStatus.DESACTIVADO, ADMIN),
    ).resolves.toMatchObject({ status: UserStatus.DESACTIVADO });

    // El sistema no puede quedarse sin administradores por esta vía, porque
    // quien actúa sigue siendo uno (RN-006, supuesto 16).
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('la comprobación ocurre DENTRO de la transacción, tras leer el usuario', async () => {
    // Leer fuera y escribir dentro dejaría una ventana en la que el usuario
    // puede cambiar entre la comprobación y la acción.
    await expect(
      servicio.cambiarEstado(ADMIN, UserStatus.DESACTIVADO, ADMIN),
    ).rejects.toBeInstanceOf(AppError);

    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { id: ADMIN } });
  });

  it('un usuario inexistente da 404, no 409', async () => {
    tx.user.findUnique.mockResolvedValue(null);

    await expect(
      servicio.cambiarEstado(OTRO, UserStatus.DESACTIVADO, ADMIN),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('NO existe ningún recuento de administradores activos (Principio III)', () => {
    const fuente = UsersService.prototype.cambiarEstado.toString();
    expect(fuente).not.toMatch(/count\(/);
    expect(UsersService.prototype.cambiarRol.toString()).not.toMatch(/count\(/);
  });
});

describe('UsersService · idempotencia del cambio de estado (api CHK007)', () => {
  it('el estado solicitado igual al actual no escribe, no revoca y no registra', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...filaAdmin, id: OTRO }),
        update: jest.fn(),
      },
      session: { updateMany: jest.fn() },
      adminAuditLog: { create: jest.fn() },
      loginAttemptControl: { deleteMany: jest.fn() },
    };
    const revocarTodasDe = jest.fn();
    const registrar = jest.fn();

    const servicio = new UsersService(
      {
        $transaction: (fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)),
      } as unknown as PrismaService,
      { hash: jest.fn() } as unknown as HashingService,
      { revocarTodasDe } as unknown as SessionService,
      { limpiar: jest.fn() } as unknown as LoginAttemptService,
      { registrar } as unknown as AuditService,
    );

    const resultado = await servicio.cambiarEstado(OTRO, UserStatus.ACTIVO, ADMIN);

    expect(resultado.status).toBe(UserStatus.ACTIVO);
    expect(tx.user.update).not.toHaveBeenCalled();
    // Revocar sesiones aquí sería peor que registrar de más: expulsaría a un
    // usuario activo por una petición que no modificó nada.
    expect(revocarTodasDe).not.toHaveBeenCalled();
    expect(registrar).not.toHaveBeenCalled();
  });
});
