import { Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { DeliveryOrderDto, OrderSummaryDto } from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { OrdersService } from './orders.service';

/**
 * Reparto (E5, HU-04). Controlador propio, separado de `OrdersController` y
 * `BusinessOrdersController`: el repartidor no tiene carrito ni confirma ni
 * acepta/rechaza pedidos — mezclar sus rutas con las de otro rol obligaría a
 * decidir el rol endpoint por endpoint, lo mismo que ya evitó E2 (D-067).
 */
@Controller('delivery/orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.REPARTIDOR)
export class DeliveryOrdersController {
  constructor(private readonly pedidos: OrdersService) {}

  /** `GET /api/v1/delivery/orders/available` (FR-001, FR-006). */
  @Get('available')
  disponibles(): Promise<{ items: OrderSummaryDto[] }> {
    return this.pedidos.disponiblesParaRepartidor();
  }

  /** `GET /api/v1/delivery/orders/current` (FR-007). */
  @Get('current')
  enCurso(@Req() peticion: PeticionConSesion): Promise<{ order: DeliveryOrderDto | null }> {
    return this.pedidos.enCursoDelRepartidor(peticion.sesion.userId);
  }

  /** `PUT /api/v1/delivery/orders/:id/take` (FR-002–FR-005, FR-012). */
  @Put(':id/take')
  tomar(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.tomar(id, peticion.sesion.userId);
  }

  /** `PUT /api/v1/delivery/orders/:id/release` (FR-008, FR-009, FR-012). */
  @Put(':id/release')
  soltar(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.soltar(id, peticion.sesion.userId);
  }
}
