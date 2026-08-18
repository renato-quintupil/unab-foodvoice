import { Injectable } from '@nestjs/common';
import { CartLine, Product } from '@prisma/client';
import type { CartDto, CartLineDto } from '@foodvoice/shared';
import { carritoConLineasNoDisponibles, noEncontrado } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Carrito del cliente (HU-12, FR-001–FR-011).
 *
 * **No expone un método «crear»**: `Cart` nace perezosamente en `agregarLinea`
 * (D-046). Un cliente que nunca agregó nada no tiene fila de carrito, y
 * `obtener` lo trata igual que uno vacío (FR-001, D-046).
 *
 * **Ninguna línea congela nombre ni precio** (FR-006): el DTO se construye
 * uniendo contra el `Product` vigente en cada lectura, igual que
 * `MenuService` deriva `priceTier` en cada consulta. Una línea cuyo producto
 * dejó de estar `active && available` **no se quita sola** (FR-008): queda
 * marcada `available: false` y solo el cliente puede quitarla.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /cart` (D-046). Sin fila de carrito, devuelve `{ lines: [] }`. */
  async obtener(userId: string): Promise<CartDto> {
    const carrito = await this.prisma.cart.findUnique({
      where: { userId },
      include: { lines: { include: { product: true } } },
    });

    if (!carrito) return { lines: [] };

    return { lines: carrito.lines.map(aLineaDto) };
  }

  /**
   * `POST /cart/lines` (FR-002, FR-004). Crea el carrito si no existe; si la
   * línea ya existe, suma 1 a su cantidad (`@@unique([cartId, productId])`
   * hace esto una operación de base, no una búsqueda-y-decide de la
   * aplicación).
   */
  async agregarLinea(userId: string, productId: string): Promise<CartDto> {
    const producto = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!producto) throw noEncontrado();
    if (!producto.active || !producto.available) throw carritoConLineasNoDisponibles();

    const carrito = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await this.prisma.cartLine.upsert({
      where: { cartId_productId: { cartId: carrito.id, productId } },
      create: { cartId: carrito.id, productId, quantity: 1 },
      update: { quantity: { increment: 1 } },
    });

    return this.obtener(userId);
  }

  /**
   * `PATCH /cart/lines/:productId` (FR-003, FR-005). `quantity: 0` quita la
   * línea — es la misma acción descrita como «bajar la cantidad», no una
   * separada.
   */
  async cambiarCantidad(userId: string, productId: string, quantity: number): Promise<CartDto> {
    const carrito = await this.prisma.cart.findUnique({ where: { userId } });
    const linea = carrito
      ? await this.prisma.cartLine.findUnique({
          where: { cartId_productId: { cartId: carrito.id, productId } },
        })
      : null;
    if (!linea) throw noEncontrado();

    if (quantity === 0) {
      await this.prisma.cartLine.delete({ where: { id: linea.id } });
    } else {
      await this.prisma.cartLine.update({ where: { id: linea.id }, data: { quantity } });
    }

    return this.obtener(userId);
  }

  /** `DELETE /cart/lines/:productId` (FR-005, HU12-E06). Quita sin importar la cantidad. */
  async quitarLinea(userId: string, productId: string): Promise<CartDto> {
    const carrito = await this.prisma.cart.findUnique({ where: { userId } });
    const linea = carrito
      ? await this.prisma.cartLine.findUnique({
          where: { cartId_productId: { cartId: carrito.id, productId } },
        })
      : null;
    if (!linea) throw noEncontrado();

    await this.prisma.cartLine.delete({ where: { id: linea.id } });
    return this.obtener(userId);
  }

  /** `DELETE /cart` (FR-010, HU12-E11). Idempotente sobre un carrito ya vacío o inexistente. */
  async vaciar(userId: string): Promise<CartDto> {
    const carrito = await this.prisma.cart.findUnique({ where: { userId } });
    if (carrito) {
      await this.prisma.cartLine.deleteMany({ where: { cartId: carrito.id } });
    }
    return { lines: [] };
  }
}

type LineaConProducto = CartLine & { product: Product };

function aLineaDto(linea: LineaConProducto): CartLineDto {
  return {
    productId: linea.productId,
    productName: linea.product.name,
    price: linea.product.price,
    quantity: linea.quantity,
    available: linea.product.active && linea.product.available,
  };
}
