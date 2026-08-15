import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Monolito con módulos internos (plan § Estructura). `auth`, `users`,
 * `dashboard` y `audit` se incorporan en sus fases respectivas.
 */
@Module({
  imports: [CommonModule, PrismaModule, HealthModule],
})
export class AppModule {}
