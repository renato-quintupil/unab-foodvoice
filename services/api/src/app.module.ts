import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Monolito con módulos internos (plan § Estructura). `users`, `dashboard` y
 * `audit` se incorporan en sus fases respectivas.
 */
@Module({
  imports: [CommonModule, PrismaModule, HealthModule, AuthModule],
})
export class AppModule {}
