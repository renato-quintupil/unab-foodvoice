import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

/**
 * Clasificación del catálogo (HU-14).
 *
 * Importa `AuthModule` porque `SessionGuard` necesita `SessionService`, igual que
 * `UsersModule`. **No importa `AuditModule`**: la bitácora de E1 cubre solo las
 * acciones administrativas sobre usuarios y no se amplía en esta épica —el
 * historial de cambios del catálogo está declarado fuera de alcance—.
 *
 * `CategoriesService` se exporta porque `ProductsService` necesita comprobar que
 * las categorías de un producto existen, son de su dimensión y están activas.
 */
@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
