import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * Catálogo de productos (HU-02).
 *
 * `ProductsService` se exporta porque `MenuService` reutiliza su construcción del
 * `ProductDto` y la derivación de tramos: son la misma regla y no puede haber dos
 * implementaciones.
 */
@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
