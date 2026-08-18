import { Injectable } from '@nestjs/common';
import { Order, OrderLine, OrderStatus, Prisma, Role } from '@prisma/client';
import {
  OrderStatus as OrderStatusCompartido,
  PAGE_SIZE,
  type BusinessOrdersQuery,
  type ConfirmOrderInput,
  type OrderLineDto,
  type OrderSummaryDto,
  type Paginated,
} from '@foodvoice/shared';
import {
  carritoConLineasNoDisponibles,
  carritoDesactualizado,
  carritoVacio,
  direccionRequerida,
  noEncontrado,
  pedidoNoPendiente,
  precioCambio,
} from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const CON_LINEAS = { lines: true } as const;
type OrdenConLineas = Order & { lines: OrderLine[] };

/**
 * `OrderStatus` de Prisma usa identificadores en mayúscula (`CREADO`) porque
 * así los genera `prisma-client-js`; el enum compartido de `packages/shared`
 * usa los valores en minúscula que viajan por la API (`creado`), fijados
 * desde E1. `@map` en el esquema traduce entre las dos formas solo dentro de
 * PostgreSQL — el cliente de Prisma sigue exponiendo la clave en mayúscula en
 * JavaScript—, así que el servicio traduce explícitamente en ambos sentidos.
 */
const A_PRISMA: Record<string, OrderStatus> = {
  [OrderStatusCompartido.CREADO]: OrderStatus.CREADO,
  [OrderStatusCompartido.EN_PREPARACION]: OrderStatus.EN_PREPARACION,
  [OrderStatusCompartido.ASIGNADO_REPARTIDOR]: OrderStatus.ASIGNADO_REPARTIDOR,
  [OrderStatusCompartido.ENTREGADO]: OrderStatus.ENTREGADO,
  [OrderStatusCompartido.CERRADO]: OrderStatus.CERRADO,
  [OrderStatusCompartido.RECHAZADO]: OrderStatus.RECHAZADO,
};

const A_COMPARTIDO: Record<OrderStatus, OrderStatusCompartido> = {
  [OrderStatus.CREADO]: OrderStatusCompartido.CREADO,
  [OrderStatus.EN_PREPARACION]: OrderStatusCompartido.EN_PREPARACION,
  [OrderStatus.ASIGNADO_REPARTIDOR]: OrderStatusCompartido.ASIGNADO_REPARTIDOR,
  [OrderStatus.ENTREGADO]: OrderStatusCompartido.ENTREGADO,
  [OrderStatus.CERRADO]: OrderStatusCompartido.CERRADO,
  [OrderStatus.RECHAZADO]: OrderStatusCompartido.RECHAZADO,
};

/**
 * Pedidos (HU-01, FR-025–FR-044).
 *
 * **La creación y las dos transiciones son las únicas escrituras posibles
 * sobre `Order`** hasta E5 (RN-009). Cada una agrega exactamente un
 * `OrderStatusEvent` dentro de la misma transacción (D-047, D-048): el
 * historial es una garantía interna, sin endpoint ni DTO propio (D-050).
 */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `POST /orders` (FR-025–FR-029, FR-042). Confirma el carrito del cliente
   * como un pedido, dentro de una única transacción indivisible (D-036,
   * D-037, D-045, D-048): si cualquier paso falla, no queda pedido, línea,
   * evento ni vaciado de carrito parcial (FR-044).
   */
  async confirmar(userId: string, datos: ConfirmOrderInput): Promise<OrderSummaryDto> {
    const creado = await this.prisma.$transaction(async (tx) => {
      // 1–2. Bloquea el carrito y exige al menos una línea (D-037, FR-009).
      const carrito = await tx.cart.findUnique({ where: { userId } });
      if (!carrito) throw carritoVacio();
      await tx.cart.update({ where: { id: carrito.id }, data: { updatedAt: new Date() } });

      const lineasCarrito = await tx.cartLine.findMany({ where: { cartId: carrito.id } });
      if (lineasCarrito.length === 0) throw carritoVacio();

      // 3–4. Dirección: guardada (bloqueando la fila del usuario, D-049) o puntual.
      let addressText: string;
      let direccionGuardadaId: string | null = null;
      if (datos.addressId) {
        await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });
        const direccion = await tx.address.findUnique({ where: { id: datos.addressId } });
        if (!direccion || direccion.userId !== userId) throw noEncontrado();
        addressText = direccion.text;
        direccionGuardadaId = direccion.id;
      } else if (datos.addressText) {
        addressText = datos.addressText;
      } else {
        // Inalcanzable en la práctica: el esquema Zod ya exige XOR.
        throw direccionRequerida();
      }

      // 5. La composición de expectedLines debe coincidir exactamente con el
      // carrito real (mismos productId y quantity) — un error de forma de la
      // petición, no un conflicto de negocio (D-036).
      const composicionReal = new Map(lineasCarrito.map((l) => [l.productId, l.quantity]));
      const composicionEsperada = new Map(
        datos.expectedLines.map((l) => [l.productId, l.quantity]),
      );
      const mismaComposicion =
        composicionReal.size === composicionEsperada.size &&
        [...composicionReal.entries()].every(
          ([productId, quantity]) => composicionEsperada.get(productId) === quantity,
        );
      if (!mismaComposicion) throw carritoDesactualizado();

      // 6–7. Revalida precio y disponibilidad de cada producto (FR-028, D-045).
      const productos = await tx.product.findMany({
        where: { id: { in: [...composicionReal.keys()] } },
      });
      const productoPorId = new Map(productos.map((p) => [p.id, p]));
      const precioEsperadoPorId = new Map(
        datos.expectedLines.map((l) => [l.productId, l.price]),
      );

      for (const producto of productos) {
        if (precioEsperadoPorId.get(producto.id) !== producto.price) throw precioCambio();
      }
      for (const producto of productos) {
        if (!producto.active || !producto.available) throw carritoConLineasNoDisponibles();
      }

      // 8. Crea el pedido, sus líneas congeladas, el evento inicial, marca la
      // dirección usada y vacía el carrito — todo en la misma transacción.
      const pedido = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.CREADO,
          addressText,
          lines: {
            create: lineasCarrito.map((linea) => {
              const producto = productoPorId.get(linea.productId)!;
              return {
                productId: producto.id,
                productName: producto.name,
                productPrice: producto.price,
                quantity: linea.quantity,
              };
            }),
          },
        },
        include: CON_LINEAS,
      });

      await registrarEvento(tx, {
        orderId: pedido.id,
        previousStatus: null,
        resultingStatus: OrderStatus.CREADO,
        actorUserId: userId,
        actorRole: Role.CLIENTE,
      });

      if (direccionGuardadaId) {
        await tx.address.update({
          where: { id: direccionGuardadaId },
          data: { usedInOrder: true },
        });
      }

      await tx.cartLine.deleteMany({ where: { cartId: carrito.id } });

      return pedido;
    });

    return aDto(creado);
  }

  /** `GET /orders` (FR-037). Los del cliente, más reciente primero, sin paginar. */
  async listarDelCliente(userId: string): Promise<{ items: OrderSummaryDto[] }> {
    const filas = await this.prisma.order.findMany({
      where: { userId },
      include: CON_LINEAS,
      orderBy: { createdAt: 'desc' },
    });
    return { items: filas.map(aDto) };
  }

  /**
   * `GET /business/orders` (FR-038, FR-041, D-043). Sin `status`, combina
   * `creado` y `en_preparacion` en una sola paginación de 20, del más
   * antiguo al más reciente.
   */
  async bandejaDelNegocio(consulta: BusinessOrdersQuery): Promise<Paginated<OrderSummaryDto>> {
    const where: Prisma.OrderWhereInput = consulta.status
      ? { status: A_PRISMA[consulta.status] }
      : { status: { in: [OrderStatus.CREADO, OrderStatus.EN_PREPARACION] } };

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: CON_LINEAS,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (consulta.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);

    return {
      items: filas.map(aDto),
      total,
      page: consulta.page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** `GET /business/orders/rejected` (FR-039). Registro propio, sin paginar. */
  async rechazadosDelNegocio(): Promise<{ items: OrderSummaryDto[] }> {
    const filas = await this.prisma.order.findMany({
      where: { status: OrderStatus.RECHAZADO },
      include: CON_LINEAS,
      orderBy: { createdAt: 'desc' },
    });
    return { items: filas.map(aDto) };
  }

  /**
   * `PUT /business/orders/:id/accept` (FR-031, D-038). Escritura condicionada
   * — solo actúa si el pedido sigue en `creado` — sin bloqueo explícito.
   */
  async aceptar(id: string, actorUserId: string): Promise<OrderSummaryDto> {
    return this.transicionar(id, OrderStatus.EN_PREPARACION, actorUserId, {});
  }

  /** `PUT /business/orders/:id/reject` (FR-031, FR-033, D-038). */
  async rechazar(id: string, actorUserId: string, reason: string): Promise<OrderSummaryDto> {
    return this.transicionar(id, OrderStatus.RECHAZADO, actorUserId, { rejectionReason: reason });
  }

  private async transicionar(
    id: string,
    hacia: OrderStatus,
    actorUserId: string,
    datosExtra: Prisma.OrderUpdateManyMutationInput,
  ): Promise<OrderSummaryDto> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: OrderStatus.CREADO },
        data: { status: hacia, ...datosExtra },
      });
      if (count === 0) {
        // `updateMany` no distingue "no existe" de "no está en creado" —
        // ambos dan count 0—, así que se relee para dar el código correcto
        // (404 vs 409, contracts/api.md). No abre una ventana nueva: el
        // resultado de la transición ya quedó decidido por el `updateMany`.
        const existe = await tx.order.findUnique({ where: { id } });
        if (!existe) throw noEncontrado();
        throw pedidoNoPendiente();
      }

      await registrarEvento(tx, {
        orderId: id,
        previousStatus: OrderStatus.CREADO,
        resultingStatus: hacia,
        actorUserId,
        actorRole: Role.NEGOCIO,
      });

      return tx.order.findUniqueOrThrow({ where: { id }, include: CON_LINEAS });
    });

    return aDto(resultado);
  }
}

/**
 * Inserta la entrada de historial dentro de la transacción que la produce
 * (D-047, D-048). Helper privado: no hay `HistoryService` ni DTO público
 * (D-050) — E2 no expone ninguna consulta de este historial.
 */
async function registrarEvento(
  tx: Prisma.TransactionClient,
  datos: {
    orderId: string;
    previousStatus: OrderStatus | null;
    resultingStatus: OrderStatus;
    actorUserId: string;
    actorRole: Role;
  },
): Promise<void> {
  await tx.orderStatusEvent.create({
    data: {
      orderId: datos.orderId,
      previousStatus: datos.previousStatus,
      resultingStatus: datos.resultingStatus,
      actorUserId: datos.actorUserId,
      actorRole: datos.actorRole,
    },
  });
}

function aDto(pedido: OrdenConLineas): OrderSummaryDto {
  return {
    id: pedido.id,
    status: A_COMPARTIDO[pedido.status],
    addressText: pedido.addressText,
    rejectionReason: pedido.rejectionReason,
    lines: pedido.lines.map(aLineaDto),
    createdAt: pedido.createdAt.toISOString(),
  };
}

function aLineaDto(linea: OrderLine): OrderLineDto {
  return {
    productId: linea.productId,
    productName: linea.productName,
    price: linea.productPrice,
    quantity: linea.quantity,
  };
}
