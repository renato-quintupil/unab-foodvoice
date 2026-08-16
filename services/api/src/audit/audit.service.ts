import { Injectable } from '@nestjs/common';
import { AdminAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Bitácora de acciones administrativas (T088, FR-034, Principio X).
 *
 * **Solo expone la operación de inserción.** No hay método de actualización ni
 * de borrado, y tampoco de consulta: en v1 no existe vista de la bitácora
 * (spec § Fuera de Alcance). La inmutabilidad no depende de esta ausencia sino
 * de un disparador del motor, que rechaza `UPDATE` y `DELETE` sobre la tabla:
 * una regla que solo viviera en la disciplina de quien programa se rompe con
 * un `deleteMany()` escrito de buena fe en un test o en un script.
 *
 * **Los usuarios se registran por referencia, nunca copiando sus datos
 * personales**: las dos columnas de usuario son claves foráneas y no hay
 * ninguna con nombre, correo, teléfono ni valores anteriores o posteriores del
 * campo modificado. La consecuencia asumida es que la bitácora dice que hubo
 * una edición, pero no qué cambió.
 *
 * **No registra eventos de autenticación**: los inicios de sesión, los fallos,
 * los bloqueos, los cierres y las expiraciones no dejan entrada. `AdminAction`
 * tiene exactamente seis valores y ninguno los cubre, lo que hace la exclusión
 * estructural y no una omisión del código (supuesto 27).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una acción. Recibe la transacción de quien actúa: la entrada va
   * **dentro de la misma transacción** que la acción que registra, de modo que
   * si la acción se revierte, la entrada tampoco quede (FR-035).
   *
   * Nunca recibe ni escribe la contraseña, ni en claro ni con hash.
   */
  async registrar(
    datos: { actorUserId: string; targetUserId: string; action: AdminAction },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const cliente = tx ?? this.prisma;
    await cliente.adminAuditLog.create({
      data: {
        actorUserId: datos.actorUserId,
        targetUserId: datos.targetUserId,
        action: datos.action,
      },
    });
  }
}
