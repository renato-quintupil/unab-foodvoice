import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';

/**
 * Monolito con módulos internos (plan § Estructura).
 *
 * Los tres módulos de E3 siguen el patrón de `users`. La consulta del menú vive
 * en su propio módulo y no dentro de `products` porque su control de acceso es el
 * opuesto: `products` y `categories` son exclusivos del rol negocio, y `menu` está
 * abierto a los cuatro roles autenticados. Fundirlos obligaría a decidir el rol
 * endpoint por endpoint dentro de un mismo controlador, que es exactamente cómo
 * se cuela un agujero de autorización.
 */
@Module({
  imports: [
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    UsersModule,
    DashboardModule,
    CategoriesModule,
    ProductsModule,
  ],
})
export class AppModule {}
