import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ComplainOrderSchema,
  ConfirmOrderSchema,
  type ComplainOrderInput,
  type ConfirmOrderInput,
  type OrderDetailDto,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OrdersService } from './orders.service';

/** Pedidos del cliente (HU-01, FR-025). */
@Controller('orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.CLIENTE)
export class OrdersController {
  constructor(private readonly pedidos: OrdersService) {}

  /** `POST /api/v1/orders` (FR-025–FR-029). */
  @Post()
  @HttpCode(201)
  confirmar(
    @Req() peticion: PeticionConSesion,
    @Body(new ZodValidationPipe(ConfirmOrderSchema)) datos: ConfirmOrderInput,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.confirmar(peticion.sesion.userId, datos);
  }

  /** `GET /api/v1/orders` (FR-037). */
  @Get()
  listar(@Req() peticion: PeticionConSesion): Promise<{ items: OrderSummaryDto[] }> {
    return this.pedidos.listarDelCliente(peticion.sesion.userId);
  }

  /** `GET /api/v1/orders/:id` (E4, FR-001–FR-003, FR-005). */
  @Get(':id')
  detalle(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
  ): Promise<OrderDetailDto> {
    return this.pedidos.detalleParaCliente(id, peticion.sesion.userId);
  }

  /** `PUT /api/v1/orders/:id/confirm` (E7, FR-005, FR-006, FR-009, D-077). */
  @Put(':id/confirm')
  confirmarCierre(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.cerrar(id, peticion.sesion.userId, null);
  }

  /** `PUT /api/v1/orders/:id/complain` (E7, FR-005 a FR-008, FR-010, D-077). */
  @Put(':id/complain')
  reclamar(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ComplainOrderSchema)) datos: ComplainOrderInput,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.cerrar(id, peticion.sesion.userId, datos.reason);
  }
}
