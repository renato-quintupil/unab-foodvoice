import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ChangeRoleSchema,
  ChangeStatusSchema,
  CreateUserSchema,
  ListUsersQuerySchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  type ChangeRoleInput,
  type ChangeStatusInput,
  type CreateUserInput,
  type ListUsersQuery,
  type Paginated,
  type ResetPasswordInput,
  type UpdateUserInput,
  type UserDto,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

/**
 * Gestión del padrón (HU-09).
 *
 * `@Roles(ADMINISTRADOR)` a nivel de clase, de modo que **ningún endpoint pueda
 * quedarse sin autorización por descuido**: no hay que recordar añadirlo, hay
 * que quitarlo deliberadamente para que falte, y eso se ve en revisión (D-007).
 *
 * **Por qué `PATCH` en uno y `PUT` en dos**: `PATCH` recibe un subconjunto
 * elegido por quien llama y modifica solo lo presente; los dos `PUT` reciben el
 * valor completo de un único atributo, y enviar el mismo cuerpo dos veces deja
 * el mismo estado. Cada uno es endpoint propio, y no un campo más de `PATCH`,
 * porque son acciones de impacto que exigen confirmación previa (FR-035) y
 * desencadenan la revocación de sesiones (FR-024): mezclarlas obligaría a mirar
 * el cuerpo para saber si la petición necesitaba confirmación.
 */
@Controller('admin/users')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.ADMINISTRADOR)
export class UsersController {
  constructor(private readonly usuarios: UsersService) {}

  /** `GET /api/v1/admin/users` (FR-015, FR-018). */
  @Get()
  listar(
    @Query(new ZodValidationPipe(ListUsersQuerySchema)) consulta: ListUsersQuery,
  ): Promise<Paginated<UserDto>> {
    return this.usuarios.listar(consulta);
  }

  /** `POST /api/v1/admin/users` (FR-009, FR-014, FR-017, FR-032, FR-034). */
  @Post()
  @HttpCode(201)
  crear(
    @Body(new ZodValidationPipe(CreateUserSchema)) datos: CreateUserInput,
    @Req() peticion: PeticionConSesion,
  ): Promise<UserDto> {
    return this.usuarios.crear(datos, peticion.sesion.userId);
  }

  /** `PATCH /api/v1/admin/users/:id` (FR-010, FR-014, FR-017, FR-027, FR-034). */
  @Patch(':id')
  editar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) datos: UpdateUserInput,
    @Req() peticion: PeticionConSesion,
  ): Promise<UserDto> {
    // Un administrador **sí** puede editar sus propios datos de contacto: la
    // autoprotección de FR-027 alcanza al estado y al rol, no al contacto.
    return this.usuarios.editar(id, datos, peticion.sesion.userId);
  }

  /** `PUT /api/v1/admin/users/:id/role` (FR-011, FR-024, FR-027, FR-034). */
  @Put(':id/role')
  cambiarRol(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeRoleSchema)) datos: ChangeRoleInput,
    @Req() peticion: PeticionConSesion,
  ): Promise<UserDto> {
    return this.usuarios.cambiarRol(id, datos.role, peticion.sesion.userId);
  }

  /** `PUT /api/v1/admin/users/:id/status` (FR-012, FR-013, FR-024, FR-027, FR-034). */
  @Put(':id/status')
  cambiarEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeStatusSchema)) datos: ChangeStatusInput,
    @Req() peticion: PeticionConSesion,
  ): Promise<UserDto> {
    return this.usuarios.cambiarEstado(id, datos.status, peticion.sesion.userId);
  }

  /** `POST /api/v1/admin/users/:id/password-reset` (FR-024, FR-026, FR-032, FR-034). */
  @Post(':id/password-reset')
  @HttpCode(204)
  restablecer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) datos: ResetPasswordInput,
    @Req() peticion: PeticionConSesion,
  ): Promise<void> {
    return this.usuarios.restablecerContrasena(id, datos.password, peticion.sesion.userId);
  }
}
