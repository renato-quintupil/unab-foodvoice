import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

/**
 * Consulta del menú (T066).
 *
 * Importa `AuthModule` porque `SessionGuard` necesita `SessionService`, y
 * `CategoriesModule` para reutilizar su listado en `GET /menu/categories` con el
 * filtro de activas puesto: **una sola implementación** de qué es una categoría
 * vigente, en lugar de dos consultas que puedan discrepar.
 *
 * **No importa `ProductsModule`**: de él usa dos funciones sueltas —la derivación
 * de tramos y la construcción del `ProductDto`—, no el servicio de
 * administración. Importarlo entero acoplaría la consulta del cliente a la
 * escritura del negocio sin necesidad.
 */
@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
