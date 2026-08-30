import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ServiceStatusController } from './service-status.controller';
import { ServiceStatusService } from './service-status.service';

/** Pausar/reanudar el servicio (E8, HU-07 Historia 3). Sin ningún `Order` involucrado, por eso no vive en `OrdersModule` (D-087). */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ServiceStatusController],
  providers: [ServiceStatusService],
})
export class ServiceStatusModule {}
