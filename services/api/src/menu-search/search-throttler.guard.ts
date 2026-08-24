import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import type { PeticionConSesion } from '../common/guards/session.guard';
import { demasiadasBusquedas } from '../common/errors';

/**
 * 20 búsquedas cada 5 minutos, **por sesión** — no por IP (FR-014, D-058).
 *
 * Varias sesiones legítimas pueden compartir una IP (red de un local, NAT);
 * limitar por IP penalizaría a clientes que no abusaron de nada. `SessionGuard`
 * corre antes en la cadena de guards y deja `req.sesion` disponible.
 */
@Injectable()
export class SearchThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: PeticionConSesion): Promise<string> {
    return req.sesion.sessionId;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    _detalle: ThrottlerLimitDetail,
  ): Promise<void> {
    throw demasiadasBusquedas();
  }
}
