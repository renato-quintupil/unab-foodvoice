import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ChangeAvailabilitySchema,
  ChangeProductStatusSchema,
  CreateProductSchema,
  ListProductsQuerySchema,
  UpdateProductSchema,
  type ChangeAvailabilityInput,
  type ChangeProductStatusInput,
  type CreateProductInput,
  type ListProductsQuery,
  type Paginated,
  type ProductDto,
  type UpdateProductInput,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ProductsService } from './products.service';

/**
 * Administración del catálogo (HU-02).
 *
 * `@Roles(NEGOCIO)` a nivel de **clase**, como en `categories`: su ausencia tiene
 * que ser deliberada para que ocurra, y entonces se ve en revisión de código
 * (D-007, FR-027). **No existe ningún `DELETE`** (FR-009, RN-004).
 *
 * **Dos endpoints distintos para los dos interruptores**, y no un campo más de la
 * edición. No es simetría decorativa: agotar ocurre varias veces al día, sin
 * confirmación y en dos clics (FR-019, SC-002); dar de baja cambia lo que el
 * cliente ve en el menú y exige confirmación explícita (FR-020). Mezclarlos
 * obligaría a mirar el cuerpo de la petición para saber si necesitaba
 * confirmación, y a comprobar las categorías también al agotar.
 */
@Controller('business/products')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.NEGOCIO)
export class ProductsController {
  constructor(private readonly productos: ProductsService) {}

  /** `GET /api/v1/business/products` (FR-023). Paginado de 20 en 20. */
  @Get()
  listar(
    @Query(new ZodValidationPipe(ListProductsQuerySchema)) consulta: ListProductsQuery,
  ): Promise<Paginated<ProductDto>> {
    return this.productos.listar(consulta);
  }

  /** `POST /api/v1/business/products` (FR-012, FR-013, FR-014, FR-039). */
  @Post()
  @HttpCode(201)
  crear(
    @Body(new ZodValidationPipe(CreateProductSchema)) datos: CreateProductInput,
  ): Promise<ProductDto> {
    return this.productos.crear(datos);
  }

  /** `PATCH /api/v1/business/products/:id` (FR-018, FR-022, FR-024). */
  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) datos: UpdateProductInput,
  ): Promise<ProductDto> {
    return this.productos.editar(id, datos);
  }

  /** `PUT /api/v1/business/products/:id/availability` (FR-019). Agotar y reponer. */
  @Put(':id/availability')
  cambiarDisponibilidad(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeAvailabilitySchema)) datos: ChangeAvailabilityInput,
  ): Promise<ProductDto> {
    return this.productos.cambiarDisponibilidad(id, datos.available);
  }

  /** `PUT /api/v1/business/products/:id/status` (FR-020, FR-021). Baja y reactivación. */
  @Put(':id/status')
  cambiarEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeProductStatusSchema)) datos: ChangeProductStatusInput,
  ): Promise<ProductDto> {
    return this.productos.cambiarEstado(id, datos.active);
  }
}
