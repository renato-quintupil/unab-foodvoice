import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ConfirmOrderSchema,
  type ConfirmOrderInput,
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
}
