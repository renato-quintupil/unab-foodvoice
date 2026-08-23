import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  BusinessOrdersQuerySchema,
  RejectOrderSchema,
  type BusinessOrdersQuery,
  type OrderDetailDto,
  type OrderSummaryDto,
  type Paginated,
  type RejectOrderInput,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OrdersService } from './orders.service';

/**
 * Bandeja y decisiones del negocio (HU-01, FR-031, FR-038–FR-041).
 *
 * Controlador propio, separado de `OrdersController`: el negocio no tiene
 * carrito ni confirma pedidos (RN-001), así que mezclar las dos rutas en un
 * mismo controlador obligaría a decidir el rol endpoint por endpoint.
 */
@Controller('business/orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.NEGOCIO)
export class BusinessOrdersController {
  constructor(private readonly pedidos: OrdersService) {}

  /** `GET /api/v1/business/orders` (FR-038, FR-041, D-043). */
  @Get()
  bandeja(
    @Query(new ZodValidationPipe(BusinessOrdersQuerySchema)) consulta: BusinessOrdersQuery,
  ): Promise<Paginated<OrderSummaryDto>> {
    return this.pedidos.bandejaDelNegocio(consulta);
  }

  /** `GET /api/v1/business/orders/rejected` (FR-039). */
  @Get('rejected')
  rechazados(): Promise<{ items: OrderSummaryDto[] }> {
    return this.pedidos.rechazadosDelNegocio();
  }

  /** `GET /api/v1/business/orders/:id` (E4, FR-004, D-053). */
  @Get(':id')
  detalle(@Param('id') id: string): Promise<OrderDetailDto> {
    return this.pedidos.detalleParaNegocio(id);
  }

  /** `PUT /api/v1/business/orders/:id/accept` (FR-031, D-038). */
  @Put(':id/accept')
  aceptar(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.aceptar(id, peticion.sesion.userId);
  }

  /** `PUT /api/v1/business/orders/:id/reject` (FR-031, FR-033, D-038). */
  @Put(':id/reject')
  rechazar(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectOrderSchema)) datos: RejectOrderInput,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.rechazar(id, peticion.sesion.userId, datos.reason);
  }
}
