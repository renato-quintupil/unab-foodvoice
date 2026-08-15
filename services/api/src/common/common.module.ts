import { Global, Module } from '@nestjs/common';
import { ClockService } from './clock.service';

/**
 * Global porque el reloj es infraestructura transversal (D-009): que cada
 * módulo tuviera que importarlo invitaría a llamar a `new Date()` para
 * ahorrarse el trámite, que es justo lo que la decisión evita.
 */
@Global()
@Module({
  providers: [ClockService],
  exports: [ClockService],
})
export class CommonModule {}
