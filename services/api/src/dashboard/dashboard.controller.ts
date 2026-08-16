import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  OrdersQuerySchema,
  type OrderDto,
  type OrdersQuery,
  type Paginated,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DashboardService, type Metricas } from './dashboard.service';

/**
 * Panel del administrador (HU-10, FR-018, FR-021, RN-004).
 *
 * **Solo verbos `GET`.** La ausencia de cualquier otro no es un olvido: es la
 * forma en que FR-021 y RN-004 se cumplen, y lo que hace que el inventario de
 * vistas de T115 pueda comprobarse contra una lista cerrada.
 */
@Controller('admin/dashboard')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** `GET /api/v1/admin/dashboard/metrics` (FR-018, FR-019). */
  @Get('metrics')
  metricas(): Promise<Metricas> {
    return this.dashboard.metricas();
  }

  /** `GET /api/v1/admin/dashboard/orders` (FR-018, FR-020, FR-023). */
  @Get('orders')
  pedidos(
    @Query(new ZodValidationPipe(OrdersQuerySchema)) consulta: OrdersQuery,
  ): Promise<Paginated<OrderDto>> {
    return this.dashboard.pedidos(consulta);
  }
}
