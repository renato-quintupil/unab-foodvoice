import { Controller, Get, HttpCode, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `GET /api/v1/health` — único endpoint sin autenticación además del inicio de
 * sesión. Lo consume el `healthcheck` de Docker (D-013), no la interfaz.
 *
 * **Es el único endpoint de la API que no se remite a ningún requisito
 * funcional**, y se declara así deliberadamente en lugar de asignarle uno
 * forzado (api CHK020). No revela versiones, rutas, configuración ni ningún
 * dato del padrón: su cuerpo es constante.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async estado(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Si PostgreSQL no responde, 503: el healthcheck marca el contenedor
      // como no sano y `restart: on-failure` actúa (D-019).
      throw new ServiceUnavailableException();
    }
    return { status: 'ok' };
  }
}
