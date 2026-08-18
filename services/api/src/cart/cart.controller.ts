import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  AddCartLineSchema,
  UpdateCartLineQuantitySchema,
  type AddCartLineInput,
  type CartDto,
  type UpdateCartLineQuantityInput,
} from '@foodvoice/shared';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PeticionConSesion, SessionGuard } from '../common/guards/session.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CartService } from './cart.service';

/**
 * Carrito del cliente (HU-12, RN-001, D-042).
 *
 * `@Roles(CLIENTE)` a nivel de clase: solo el cliente tiene carrito, ningún
 * otro rol lo necesita (RN-001).
 */
@Controller('cart')
@UseGuards(SessionGuard, RolesGuard)
@Roles(Role.CLIENTE)
export class CartController {
  constructor(private readonly carrito: CartService) {}

  /** `GET /api/v1/cart` (D-046). */
  @Get()
  obtener(@Req() peticion: PeticionConSesion): Promise<CartDto> {
    return this.carrito.obtener(peticion.sesion.userId);
  }

  /** `POST /api/v1/cart/lines` (FR-002, FR-004). */
  @Post('lines')
  agregarLinea(
    @Req() peticion: PeticionConSesion,
    @Body(new ZodValidationPipe(AddCartLineSchema)) datos: AddCartLineInput,
  ): Promise<CartDto> {
    return this.carrito.agregarLinea(peticion.sesion.userId, datos.productId);
  }

  /** `PATCH /api/v1/cart/lines/:productId` (FR-003, FR-005). `quantity: 0` quita la línea. */
  @Patch('lines/:productId')
  cambiarCantidad(
    @Req() peticion: PeticionConSesion,
    @Param('productId') productId: string,
    @Body(new ZodValidationPipe(UpdateCartLineQuantitySchema)) datos: UpdateCartLineQuantityInput,
  ): Promise<CartDto> {
    return this.carrito.cambiarCantidad(peticion.sesion.userId, productId, datos.quantity);
  }

  /** `DELETE /api/v1/cart/lines/:productId` (FR-005, HU12-E06). */
  @Delete('lines/:productId')
  quitarLinea(
    @Req() peticion: PeticionConSesion,
    @Param('productId') productId: string,
  ): Promise<CartDto> {
    return this.carrito.quitarLinea(peticion.sesion.userId, productId);
  }

  /** `DELETE /api/v1/cart` (FR-010, HU12-E11). */
  @Delete()
  vaciar(@Req() peticion: PeticionConSesion): Promise<CartDto> {
    return this.carrito.vaciar(peticion.sesion.userId);
  }
}
