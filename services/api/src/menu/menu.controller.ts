import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  MenuQuerySchema,
  type CategoryDto,
  type MenuQuery,
  type MenuResponse,
  type ProductDto,
} from '@foodvoice/shared';
import { SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CategoriesService } from '../categories/categories.service';
import { MenuService } from './menu.service';

/**
 * Consulta del menú (T065, FR-011, FR-028, FR-031, FR-034, supuesto 12).
 *
 * **Protegido solo por `SessionGuard`, sin `@Roles`**: los cuatro roles consultan
 * el mismo menú. No es un olvido —la ausencia del decorador es deliberada y esta
 * nota lo deja escrito para la revisión de código—: el catálogo es información del
 * local, no un dato privado de nadie, y un repartidor o un administrador que
 * quieran ver qué se ofrece lo ven igual que el cliente. Lo que sí es exclusivo
 * del negocio es **administrarlo**, y eso vive en `/business/**`.
 */
@Controller('menu')
@UseGuards(SessionGuard)
export class MenuController {
  constructor(
    private readonly menu: MenuService,
    private readonly categorias: CategoriesService,
  ) {}

  /**
   * `GET /api/v1/menu/categories` (FR-011, FR-031).
   *
   * **Solo las activas.** Reutiliza el listado de la administración con el filtro
   * puesto aquí, en lugar de repetir la consulta: una sola implementación evita
   * que las dos superficies discrepen sobre qué es una categoría vigente.
   */
  @Get('categories')
  listarCategorias(): Promise<{ items: CategoryDto[] }> {
    return this.categorias.listar({ active: true });
  }

  /** `GET /api/v1/menu/products` (FR-028, FR-031, FR-032, FR-035). Sin paginación. */
  @Get('products')
  productos(
    @Query(new ZodValidationPipe(MenuQuerySchema)) consulta: MenuQuery,
  ): Promise<MenuResponse> {
    return this.menu.consultar(consulta);
  }

  /** `GET /api/v1/menu/products/:id` (FR-034, D-032). */
  @Get('products/:id')
  ficha(@Param('id') id: string): Promise<ProductDto> {
    return this.menu.ficha(id);
  }
}
