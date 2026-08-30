/**
 * `AuditService` (T077, FR-034, Principio X).
 */
import { AdminAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const AFECTADO = '22222222-2222-4222-8222-222222222222';

describe('AuditService', () => {
  let prisma: { adminAuditLog: { create: jest.Mock } };
  let servicio: AuditService;

  beforeEach(() => {
    prisma = { adminAuditLog: { create: jest.fn() } };
    servicio = new AuditService(prisma as unknown as PrismaService);
  });

  it('solo expone la operación de inserción', () => {
    const metodos = Object.getOwnPropertyNames(AuditService.prototype).filter(
      (n) => n !== 'constructor',
    );
    expect(metodos).toEqual(['registrar']);
  });

  it('registra actor, afectado y acción, y nada más', async () => {
    await servicio.registrar({
      actorUserId: ACTOR,
      targetUserId: AFECTADO,
      action: AdminAction.DESACTIVAR,
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: ACTOR,
        targetUserId: AFECTADO,
        action: AdminAction.DESACTIVAR,
        reason: null,
      },
    });
  });

  it('registra targetUserId nulo y un motivo cuando la acción es sobre el servicio, no un usuario (E8, D-084)', async () => {
    await servicio.registrar({
      actorUserId: ACTOR,
      targetUserId: null,
      action: AdminAction.PAUSAR_SERVICIO,
      reason: 'Corte de luz en el local',
    });

    expect(prisma.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: ACTOR,
        targetUserId: null,
        action: AdminAction.PAUSAR_SERVICIO,
        reason: 'Corte de luz en el local',
      },
    });
  });

  it('registra los usuarios POR REFERENCIA: nunca nombre, correo ni teléfono', async () => {
    await servicio.registrar({
      actorUserId: ACTOR,
      targetUserId: AFECTADO,
      action: AdminAction.EDITAR,
    });

    const escrito = JSON.stringify(prisma.adminAuditLog.create.mock.calls[0]);
    for (const prohibido of ['fullName', 'email', 'phone', 'password', 'passwordHash']) {
      expect(escrito).not.toContain(prohibido);
    }
  });

  it('nunca escribe una contraseña aunque se la pasen de más', async () => {
    await servicio.registrar({
      actorUserId: ACTOR,
      targetUserId: AFECTADO,
      action: AdminAction.RESTABLECER_PASSWORD,
      // El tipo lo prohíbe; se fuerza para comprobar que tampoco pasaría por
      // descuido si alguien ampliara la llamada.
      ...({ password: 'secreta-en-claro' } as object),
    });

    expect(JSON.stringify(prisma.adminAuditLog.create.mock.calls[0])).not.toContain(
      'secreta-en-claro',
    );
  });

  it('la entrada va en la transacción de la acción que registra', async () => {
    const tx = { adminAuditLog: { create: jest.fn() } };

    await servicio.registrar(
      { actorUserId: ACTOR, targetUserId: AFECTADO, action: AdminAction.CREAR },
      tx as never,
    );

    // Si la acción se revierte, la entrada tampoco queda (FR-035).
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('acepta las seis acciones de FR-034 más las dos de E8 (D-084), y ninguna más', () => {
    expect(Object.values(AdminAction)).toHaveLength(8);
    expect(Object.values(AdminAction)).toContain('PAUSAR_SERVICIO');
    expect(Object.values(AdminAction)).toContain('REANUDAR_SERVICIO');
    expect(Object.values(AdminAction)).not.toContain('INICIAR_SESION');
    expect(Object.values(AdminAction)).not.toContain('CERRAR_SESION');
  });
});
