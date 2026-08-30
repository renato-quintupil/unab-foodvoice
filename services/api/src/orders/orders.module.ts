import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminOrdersController } from './admin-orders.controller';
import { BusinessOrdersController } from './business-orders.controller';
import { DeliveryOrdersController } from './delivery-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * Pedidos (HU-01, E5, E8). Cuatro controladores en el mismo módulo:
 * `OrdersController` para el cliente, `BusinessOrdersController` para el
 * negocio, `DeliveryOrdersController` para el repartidor (D-067),
 * `AdminOrdersController` para el administrador (D-087). El historial es una
 * relación interna del dominio, no un módulo ni una superficie pública
 * propia (D-050).
 */
@Module({
  imports: [AuthModule],
  controllers: [OrdersController, BusinessOrdersController, DeliveryOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
