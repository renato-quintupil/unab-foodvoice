import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ChangeCategoryStatusSchema,
  CreateCategorySchema,
  ListCategoriesQuerySchema,
  UpdateCategorySchema,
  type CategoryDto,
  type ChangeCategoryStatusInput,
  type CreateCategoryInput,
  type ListCategoriesQuery,
  type UpdateCategoryInput,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CategoriesService } from './categories.service';

/**
 * Administración de la clasificación (HU-14).
 *
 * `@Roles(NEGOCIO)` a nivel de **clase**, de modo que ningún endpoint pueda
 * quedarse sin autorización por descuido: no hay que recordar añadirlo, hay que
 * quitarlo deliberadamente para que falte, y eso se ve en revisión de código
 * (D-007, FR-027). El rechazo se produce **al procesar la acción**: la llamada
 * directa al endpoint sin pasar por la interfaz recibe el mismo `403` (SC-021).
 *
 * **No existe ningún `DELETE`**, en esta ni en ninguna otra ruta de la épica.
 * FR-009 y SC-006 exigen que no haya ninguna acción que elimine definitivamente
 * «en ninguna pantalla ni por ningún punto de entrada»; que el verbo no exista
 * es la forma más directa de cumplirlo.
 *
 * **Por qué `PATCH` en la edición y `PUT` en el estado**: `PATCH` modifica el
 * contenido que el negocio redacta; `PUT` recibe el valor completo de un único
 * atributo, y enviarlo dos veces deja el mismo estado. El estado es endpoint
 * propio, y no un campo más de la edición, porque puede fallar por una razón que
 * editar no tiene —productos activos que dependen de la categoría— y su rechazo
 * lleva el conteo (FR-007).
 */
@Controller('business/categories')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.NEGOCIO)
export class CategoriesController {
  constructor(private readonly categorias: CategoriesService) {}

  /** `GET /api/v1/business/categories` (FR-010). Sin paginación. */
  @Get()
  listar(
    @Query(new ZodValidationPipe(ListCategoriesQuerySchema)) consulta: ListCategoriesQuery,
  ): Promise<{ items: CategoryDto[] }> {
    return this.categorias.listar(consulta);
  }

  /** `POST /api/v1/business/categories` (FR-002, FR-003, FR-004, FR-039). */
  @Post()
  @HttpCode(201)
  crear(
    @Body(new ZodValidationPipe(CreateCategorySchema)) datos: CreateCategoryInput,
  ): Promise<CategoryDto> {
    return this.categorias.crear(datos);
  }

  /** `PATCH /api/v1/business/categories/:id` (FR-006). La dimensión no viaja. */
  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) datos: UpdateCategoryInput,
  ): Promise<CategoryDto> {
    return this.categorias.editar(id, datos);
  }

  /** `PUT /api/v1/business/categories/:id/status` (FR-007, FR-008, FR-011). */
  @Put(':id/status')
  cambiarEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeCategoryStatusSchema)) datos: ChangeCategoryStatusInput,
  ): Promise<CategoryDto> {
    return this.categorias.cambiarEstado(id, datos.active);
  }
}
