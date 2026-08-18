import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ChangeAddressStatusSchema,
  CreateAddressSchema,
  UpdateAddressSchema,
  type AddressDto,
  type ChangeAddressStatusInput,
  type CreateAddressInput,
  type UpdateAddressInput,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AddressesService } from './addresses.service';

/** Direcciones de entrega del cliente (HU-11, D-042). */
@Controller('addresses')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.CLIENTE)
export class AddressesController {
  constructor(private readonly direcciones: AddressesService) {}

  /** `GET /api/v1/addresses` (FR-018). */
  @Get()
  listar(@Req() peticion: PeticionConSesion): Promise<{ items: AddressDto[] }> {
    return this.direcciones.listar(peticion.sesion.userId);
  }

  /** `POST /api/v1/addresses` (FR-012, FR-013, FR-015). */
  @Post()
  @HttpCode(201)
  crear(
    @Req() peticion: PeticionConSesion,
    @Body(new ZodValidationPipe(CreateAddressSchema)) datos: CreateAddressInput,
  ): Promise<AddressDto> {
    return this.direcciones.crear(peticion.sesion.userId, datos);
  }

  /** `PATCH /api/v1/addresses/:id` (FR-016). */
  @Patch(':id')
  editar(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAddressSchema)) datos: UpdateAddressInput,
  ): Promise<AddressDto> {
    return this.direcciones.editar(peticion.sesion.userId, id, datos);
  }

  /** `PUT /api/v1/addresses/:id/default` (FR-015, FR-024). */
  @Put(':id/default')
  cambiarPredeterminada(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
  ): Promise<AddressDto> {
    return this.direcciones.cambiarPredeterminada(peticion.sesion.userId, id);
  }

  /** `PUT /api/v1/addresses/:id/status` (FR-018, FR-020). */
  @Put(':id/status')
  cambiarEstado(
    @Req() peticion: PeticionConSesion,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeAddressStatusSchema)) datos: ChangeAddressStatusInput,
  ): Promise<AddressDto> {
    return this.direcciones.cambiarEstado(peticion.sesion.userId, id, datos.active);
  }

  /** `DELETE /api/v1/addresses/:id` (FR-019). */
  @Delete(':id')
  @HttpCode(204)
  eliminar(@Req() peticion: PeticionConSesion, @Param('id') id: string): Promise<void> {
    return this.direcciones.eliminar(peticion.sesion.userId, id);
  }
}
