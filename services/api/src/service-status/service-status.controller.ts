import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PauseServiceSchema, type PauseServiceInput, type ServiceStatusDto } from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ServiceStatusService } from './service-status.service';

/** Pausar y reanudar el servicio (E8, HU-07 Historia 3). */
@Controller('admin/service')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
export class ServiceStatusController {
  constructor(private readonly servicio: ServiceStatusService) {}

  /** `GET /api/v1/admin/service/status`. */
  @Get('status')
  estado(): Promise<ServiceStatusDto> {
    return this.servicio.estado();
  }

  /** `PUT /api/v1/admin/service/pause` (FR-009). */
  @Put('pause')
  pausar(
    @Req() peticion: PeticionConSesion,
    @Body(new ZodValidationPipe(PauseServiceSchema)) datos: PauseServiceInput,
  ): Promise<ServiceStatusDto> {
    return this.servicio.pausar(peticion.sesion.userId, datos.reason);
  }

  /** `PUT /api/v1/admin/service/resume` (FR-012). Sin cuerpo. */
  @Put('resume')
  reanudar(@Req() peticion: PeticionConSesion): Promise<ServiceStatusDto> {
    return this.servicio.reanudar(peticion.sesion.userId);
  }
}
