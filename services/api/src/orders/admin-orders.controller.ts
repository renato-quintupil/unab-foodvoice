import { Body, Controller, Param, Put, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  AdminCloseOrderSchema,
  ForceOrderTransitionSchema,
  type AdminCloseOrderInput,
  type ForceOrderTransitionInput,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OrdersService } from './orders.service';

/**
 * Controles de flujos críticos sobre pedidos (E8, HU-07). Cuarto controlador
 * de `OrdersModule` (D-087), mismo criterio que `DeliveryOrdersController`
 * en E5: dos acciones administrativas más sobre `OrdersService`, no un
 * dominio nuevo.
 */
@Controller('admin/orders')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
export class AdminOrdersController {
  constructor(private readonly pedidos: OrdersService) {}

  /** `PUT /api/v1/admin/orders/:id/force-transition` (Historia 1, FR-001, FR-002). */
  @Put(':id/force-transition')
  forzarTransicion(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ForceOrderTransitionSchema)) datos: ForceOrderTransitionInput,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.forzarTransicion(id, peticion.sesion.userId, datos.targetStatus, datos.reason);
  }

  /** `PUT /api/v1/admin/orders/:id/close` (Historia 2, FR-003, FR-004). */
  @Put(':id/close')
  cerrarAdministrativamente(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AdminCloseOrderSchema)) datos: AdminCloseOrderInput,
  ): Promise<OrderSummaryDto> {
    return this.pedidos.cerrarAdministrativamente(id, peticion.sesion.userId, datos.reason);
  }
}
