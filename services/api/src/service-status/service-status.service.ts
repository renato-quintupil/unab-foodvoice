import { Injectable } from '@nestjs/common';
import { AdminAction } from '@prisma/client';
import type { ServiceStatusDto } from '@foodvoice/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const SINGLETON_ID = 'singleton';

/**
 * Estado operativo del servicio completo (E8, HU-07 Historia 3, D-085).
 *
 * `ServiceStatus` es una fila única (`id = 'singleton'`, sembrada por la
 * migración) — v1 es mono-local, no hay "el negocio pausado" por usuario.
 * Cada escritura registra también su propia entrada en `AdminAuditLog`
 * (D-084): a diferencia de forzar transición/cerrar administrativamente
 * (que usan el historial del pedido), pausar/reanudar no tienen ningún
 * pedido al que asociarse.
 */
@Injectable()
export class ServiceStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** `GET /admin/service/status`. */
  async estado(): Promise<ServiceStatusDto> {
    const fila = await this.prisma.serviceStatus.findUniqueOrThrow({
      where: { id: SINGLETON_ID },
    });
    return {
      paused: fila.paused,
      reason: fila.pauseReason,
      pausedAt: fila.pausedAt?.toISOString() ?? null,
    };
  }

  /** `PUT /admin/service/pause` (FR-009). Motivo obligatorio. */
  async pausar(adminId: string, reason: string): Promise<ServiceStatusDto> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.serviceStatus.update({
        where: { id: SINGLETON_ID },
        data: { paused: true, pauseReason: reason, pausedAt: new Date(), pausedByUserId: adminId },
      });
      await this.audit.registrar(
        { actorUserId: adminId, targetUserId: null, action: AdminAction.PAUSAR_SERVICIO, reason },
        tx,
      );
      return actualizada;
    });

    return { paused: fila.paused, reason: fila.pauseReason, pausedAt: fila.pausedAt?.toISOString() ?? null };
  }

  /** `PUT /admin/service/resume` (FR-012). Sin motivo. */
  async reanudar(adminId: string): Promise<ServiceStatusDto> {
    const fila = await this.prisma.$transaction(async (tx) => {
      const actualizada = await tx.serviceStatus.update({
        where: { id: SINGLETON_ID },
        data: { paused: false, pauseReason: null, pausedAt: null, pausedByUserId: null },
      });
      await this.audit.registrar(
        { actorUserId: adminId, targetUserId: null, action: AdminAction.REANUDAR_SERVICIO },
        tx,
      );
      return actualizada;
    });

    return { paused: fila.paused, reason: fila.pauseReason, pausedAt: fila.pausedAt?.toISOString() ?? null };
  }
}
