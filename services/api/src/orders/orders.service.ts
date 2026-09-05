import { Injectable } from '@nestjs/common';
import { Order, OrderLine, OrderStatus, Prisma, Role } from '@prisma/client';
import {
  OrderStatus as OrderStatusCompartido,
  PAGE_SIZE,
  puedeCerrarseAdministrativamente,
  transicionesForzablesPorAdmin,
  type BusinessOrdersQuery,
  type ConfirmOrderInput,
  type DeliveryOrderDto,
  type OrderDetailDto,
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
  pedidoNoAsignadoATi,
  pedidoNoEntregado,
  pedidoNoPendiente,
  pedidoYaEsTerminal,
  pedidoYaNoDisponible,
  precioCambio,
  repartidorYaTienePedido,
  servicioPausado,
  transicionAdministrativaInvalida,
} from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const CON_LINEAS = { lines: true } as const;
type OrdenConLineas = Order & { lines: OrderLine[] };

const CON_DETALLE = {
  lines: true,
  statusEvents: {
    include: { actor: { select: { fullName: true } } },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.OrderInclude;
type OrdenConDetalle = Prisma.OrderGetPayload<{ include: typeof CON_DETALLE }>;

/** Código de PostgreSQL para violación de restricción única (E5, D-069). */
const VIOLACION_DE_UNICIDAD = 'P2002';

/** E5 · Reparto. El pedido en curso del repartidor, con el teléfono del cliente (D-070). */
const CON_TELEFONO_CLIENTE = {
  lines: true,
  user: { select: { phone: true } },
} satisfies Prisma.OrderInclude;
type OrdenConTelefonoCliente = Prisma.OrderGetPayload<{ include: typeof CON_TELEFONO_CLIENTE }>;

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
      // 0. El servicio no debe estar pausado (E8, FR-010, FR-011, D-088):
      // primer chequeo, antes de tocar el carrito.
      const servicio = await tx.serviceStatus.findUnique({ where: { id: 'singleton' } });
      if (servicio?.paused) throw servicioPausado();

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

  /** `GET /orders/:id` (E4, FR-001–FR-003, FR-005). */
  async detalleParaCliente(id: string, userId: string): Promise<OrderDetailDto> {
    const pedido = await this.prisma.order.findUnique({
      where: { id },
      include: CON_DETALLE,
    });
    if (!pedido || pedido.userId !== userId) throw noEncontrado();
    return aDetalleDto(pedido);
  }

  /** `GET /business/orders/:id` (E4, FR-004, D-053). */
  async detalleParaNegocio(id: string): Promise<OrderDetailDto> {
    const pedido = await this.prisma.order.findUnique({
      where: { id },
      include: CON_DETALLE,
    });
    if (!pedido) throw noEncontrado();
    return aDetalleDto(pedido);
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

  // -------------------------------------------------------------------------
  // E5 · Reparto (HU-04, FR-001–FR-013)
  // -------------------------------------------------------------------------

  /** `GET /delivery/orders/available` (FR-001, FR-006). */
  async disponiblesParaRepartidor(): Promise<{ items: OrderSummaryDto[] }> {
    const filas = await this.prisma.order.findMany({
      where: { status: OrderStatus.EN_PREPARACION, deliveryUserId: null },
      include: CON_LINEAS,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { items: filas.map(aDto) };
  }

  /**
   * `GET /delivery/orders/current` (FR-007). Siempre `200`, con `{ order: null }`
   * cuando el repartidor no tiene ninguno en curso — mismo criterio que `GET
   * /cart` (D-046): no es un error no tener nada que mostrar.
   */
  async enCursoDelRepartidor(repartidorId: string): Promise<{ order: DeliveryOrderDto | null }> {
    const pedido = await this.prisma.order.findFirst({
      where: { deliveryUserId: repartidorId, status: OrderStatus.ASIGNADO_REPARTIDOR },
      include: CON_TELEFONO_CLIENTE,
    });
    return { order: pedido ? aDeliveryDto(pedido) : null };
  }

  /**
   * `PUT /delivery/orders/:id/take` (FR-002–FR-005, FR-012). Autoservicio: el
   * repartidor toma cualquier pedido disponible, sin que el negocio
   * intervenga. Un repartidor con un pedido en curso no puede tomar otro
   * (FR-004) — comprobado antes de la escritura y respaldado por el índice
   * único parcial `order_one_active_delivery_per_user_key` (D-069), que es
   * quien realmente cierra la ventana de carrera entre dos pedidos distintos.
   */
  async tomar(id: string, repartidorId: string): Promise<OrderSummaryDto> {
    const yaTieneUno = await this.prisma.order.findFirst({
      where: { deliveryUserId: repartidorId, status: OrderStatus.ASIGNADO_REPARTIDOR },
      select: { id: true },
    });
    if (yaTieneUno) throw repartidorYaTienePedido();

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id, status: OrderStatus.EN_PREPARACION, deliveryUserId: null },
          data: {
            status: OrderStatus.ASIGNADO_REPARTIDOR,
            deliveryUserId: repartidorId,
            assignedAt: new Date(),
          },
        });
        if (count === 0) {
          // Igual criterio que `transicionar()`: `updateMany` no distingue
          // "no existe" de "ya no disponible" — ambos dan count 0—, así que se
          // relee para dar el código correcto (404 vs 409, contracts/api.md).
          const existe = await tx.order.findUnique({ where: { id } });
          if (!existe) throw noEncontrado();
          throw pedidoYaNoDisponible();
        }

        await registrarEvento(tx, {
          orderId: id,
          previousStatus: OrderStatus.EN_PREPARACION,
          resultingStatus: OrderStatus.ASIGNADO_REPARTIDOR,
          actorUserId: repartidorId,
          actorRole: Role.REPARTIDOR,
        });

        return tx.order.findUniqueOrThrow({ where: { id }, include: CON_LINEAS });
      });

      return aDto(resultado);
    } catch (error) {
      // Respaldo del índice único parcial (D-069): si el `SELECT` previo no
      // alcanzó a ver un segundo pedido tomado por el mismo repartidor casi
      // al mismo tiempo, la base de datos rechaza esta escritura igual.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === VIOLACION_DE_UNICIDAD) {
        throw repartidorYaTienePedido();
      }
      throw error;
    }
  }

  /**
   * `PUT /delivery/orders/:id/release` (FR-008, FR-009, FR-012). Dispara la
   * transición de retroceso habilitada por la enmienda constitucional 3.0.0.
   * El pedido vuelve a `en_preparacion` sin repartidor, indistinguible de uno
   * que nunca fue tomado (FR-009) — puede volver a tomarlo cualquiera,
   * incluido quien lo soltó.
   */
  async soltar(id: string, repartidorId: string): Promise<OrderSummaryDto> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: OrderStatus.ASIGNADO_REPARTIDOR, deliveryUserId: repartidorId },
        data: { status: OrderStatus.EN_PREPARACION, deliveryUserId: null, assignedAt: null },
      });
      if (count === 0) {
        const existe = await tx.order.findUnique({ where: { id } });
        if (!existe) throw noEncontrado();
        throw pedidoNoAsignadoATi();
      }

      await registrarEvento(tx, {
        orderId: id,
        previousStatus: OrderStatus.ASIGNADO_REPARTIDOR,
        resultingStatus: OrderStatus.EN_PREPARACION,
        actorUserId: repartidorId,
        actorRole: Role.REPARTIDOR,
      });

      return tx.order.findUniqueOrThrow({ where: { id }, include: CON_LINEAS });
    });

    return aDto(resultado);
  }

  // -------------------------------------------------------------------------
  // E7 · Cierre del servicio (HU-05, FR-001–FR-014)
  // -------------------------------------------------------------------------

  /**
   * `PUT /delivery/orders/:id/deliver` (FR-001–FR-004, FR-012). El repartidor
   * marca como entregado el pedido que tiene en curso. `deliveryUserId`
   * **no se limpia** (D-074): a diferencia de `soltar()`, aquí queda como
   * registro de quién entregó, no como liberación del pedido.
   */
  async entregar(id: string, repartidorId: string): Promise<OrderSummaryDto> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: OrderStatus.ASIGNADO_REPARTIDOR, deliveryUserId: repartidorId },
        data: { status: OrderStatus.ENTREGADO },
      });
      if (count === 0) {
        const existe = await tx.order.findUnique({ where: { id } });
        if (!existe) throw noEncontrado();
        // Mismo error que `soltar()` (D-075): idéntico significado — el
        // pedido no está en el estado y con el repartidor que la acción
        // esperaba — sin necesitar un código de error nuevo.
        throw pedidoNoAsignadoATi();
      }

      await registrarEvento(tx, {
        orderId: id,
        previousStatus: OrderStatus.ASIGNADO_REPARTIDOR,
        resultingStatus: OrderStatus.ENTREGADO,
        actorUserId: repartidorId,
        actorRole: Role.REPARTIDOR,
      });

      return tx.order.findUniqueOrThrow({ where: { id }, include: CON_LINEAS });
    });

    return aDto(resultado);
  }

  /**
   * `PUT /orders/:id/confirm` y `PUT /orders/:id/complain` (FR-005, FR-006,
   * FR-008, FR-009, FR-012, D-077). Un solo método para las dos acciones del
   * cliente: `complaintReason` es `null` al confirmar, el motivo ya validado
   * al reclamar.
   */
  async cerrar(
    id: string,
    clienteId: string,
    complaintReason: string | null,
  ): Promise<OrderSummaryDto> {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: OrderStatus.ENTREGADO, userId: clienteId },
        data: { status: OrderStatus.CERRADO, complaintReason },
      });
      if (count === 0) {
        // Mismo criterio de FR-005 de E4: "no existe" y "no es tuyo" dan la
        // misma respuesta en una ruta de pertenencia del cliente.
        const existe = await tx.order.findUnique({ where: { id } });
        if (!existe || existe.userId !== clienteId) throw noEncontrado();
        throw pedidoNoEntregado();
      }

      await registrarEvento(tx, {
        orderId: id,
        previousStatus: OrderStatus.ENTREGADO,
        resultingStatus: OrderStatus.CERRADO,
        actorUserId: clienteId,
        actorRole: Role.CLIENTE,
      });

      return tx.order.findUniqueOrThrow({ where: { id }, include: CON_LINEAS });
    });

    return aDto(resultado);
  }

  /** `GET /business/orders/closed` (FR-011, D-081, hallazgo C1 de `/speckit.analyze`). */
  async cerradosDelNegocio(): Promise<{ items: OrderSummaryDto[] }> {
    const filas = await this.prisma.order.findMany({
      where: { status: OrderStatus.CERRADO },
      include: CON_LINEAS,
      orderBy: { createdAt: 'desc' },
    });
    return { items: filas.map(aDto) };
  }

  /**
   * `GET /business/orders/in-progress`. Corrección post-verificación: sin
   * este endpoint, `bandejaDelNegocio` (`creado`/`en_preparacion`) y
   * `rechazadosDelNegocio`/`cerradosDelNegocio` dejaban un hueco — un pedido
   * en `asignado_repartidor` o `entregado` (ya en reparto, todavía sin que
   * el cliente lo confirme o reclame) no aparecía en ninguna pantalla del
   * negocio. Mismo tipo de hallazgo que D-081, un estado más adelante.
   */
  async enCursoDelNegocio(): Promise<{ items: OrderSummaryDto[] }> {
    const filas = await this.prisma.order.findMany({
      where: { status: { in: [OrderStatus.ASIGNADO_REPARTIDOR, OrderStatus.ENTREGADO] } },
      include: CON_LINEAS,
      orderBy: { createdAt: 'desc' },
    });
    return { items: filas.map(aDto) };
  }

  // -------------------------------------------------------------------------
  // E8 · Controles y administración (HU-07, FR-001–FR-008)
  // -------------------------------------------------------------------------

  /**
   * `PUT /admin/orders/:id/force-transition` (Historia 1, FR-001, FR-002,
   * FR-005 a FR-008). Fuerza la transición normal siguiente en nombre del rol
   * que correspondería dispararla — excluye la retroceso de E5, reservada al
   * repartidor dueño del pedido (`transicionesForzablesPorAdmin`, D-083).
   */
  async forzarTransicion(
    id: string,
    adminId: string,
    hacia: OrderStatusCompartido,
    reason: string,
  ): Promise<OrderSummaryDto> {
    const pedidoActual = await this.prisma.order.findUnique({ where: { id } });
    if (!pedidoActual) throw noEncontrado();

    if (!transicionesForzablesPorAdmin(A_COMPARTIDO[pedidoActual.status]).includes(hacia)) {
      throw transicionAdministrativaInvalida();
    }

    // `A_PRISMA` cubre los seis valores de `OrderStatusCompartido`: nunca es
    // `undefined` para un `hacia` que ya validó `transicionesForzablesPorAdmin`.
    const haciaPrisma = A_PRISMA[hacia]!;
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: pedidoActual.status },
        data: { status: haciaPrisma },
      });
      if (count === 0) {
        // Igual criterio que el resto del servicio: `updateMany` no distingue
        // "no existe" de "cambió de estado entre la lectura y la escritura"
        // (carrera perdida, FR-016) — ambos dan count 0.
        const existe = await tx.order.findUnique({ where: { id } });
        if (!existe) throw noEncontrado();
        throw transicionAdministrativaInvalida();
      }

      await registrarEvento(tx, {
        orderId: id,
        previousStatus: pedidoActual.status,
        resultingStatus: haciaPrisma,
        actorUserId: adminId,
        actorRole: Role.ADMINISTRADOR,
        reason,
      });

      return tx.order.findUniqueOrThrow({ where: { id }, include: CON_LINEAS });
    });

    return aDto(resultado);
  }

  /**
   * `PUT /admin/orders/:id/close` (Historia 2, FR-003, FR-004, FR-006 a
   * FR-008). Cierra administrativamente un pedido en cualquier estado no
   * terminal, fuera del camino normal — la séptima transición de la enmienda
   * constitucional 4.0.0 (`puedeCerrarseAdministrativamente`, D-083).
   */
  async cerrarAdministrativamente(
    id: string,
    adminId: string,
    reason: string,
  ): Promise<OrderSummaryDto> {
    const pedidoActual = await this.prisma.order.findUnique({ where: { id } });
    if (!pedidoActual) throw noEncontrado();

    if (!puedeCerrarseAdministrativamente(A_COMPARTIDO[pedidoActual.status])) {
      throw pedidoYaEsTerminal();
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id, status: pedidoActual.status },
        data: { status: OrderStatus.CERRADO },
      });
      if (count === 0) {
        const existe = await tx.order.findUnique({ where: { id } });
        if (!existe) throw noEncontrado();
        throw pedidoYaEsTerminal();
      }

      await registrarEvento(tx, {
        orderId: id,
        previousStatus: pedidoActual.status,
        resultingStatus: OrderStatus.CERRADO,
        actorUserId: adminId,
        actorRole: Role.ADMINISTRADOR,
        reason,
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
 *
 * `actorRole` ya era genérico desde que se escribió (D-071, E5): E2 solo lo
 * llamaba con `Role.NEGOCIO`, pero la firma nunca lo restringió. `tomar` y
 * `soltar` (E5) son su tercer y cuarto llamador, con `Role.REPARTIDOR`, sin
 * necesitar ningún cambio aquí.
 */
async function registrarEvento(
  tx: Prisma.TransactionClient,
  datos: {
    orderId: string;
    previousStatus: OrderStatus | null;
    resultingStatus: OrderStatus;
    actorUserId: string;
    actorRole: Role;
    /** Solo presente en una intervención administrativa (E8, HU-07, D-082). */
    reason?: string | null;
  },
): Promise<void> {
  await tx.orderStatusEvent.create({
    data: {
      orderId: datos.orderId,
      previousStatus: datos.previousStatus,
      resultingStatus: datos.resultingStatus,
      actorUserId: datos.actorUserId,
      actorRole: datos.actorRole,
      reason: datos.reason ?? null,
    },
  });
}

function aDto(pedido: OrdenConLineas): OrderSummaryDto {
  return {
    id: pedido.id,
    status: A_COMPARTIDO[pedido.status],
    addressText: pedido.addressText,
    rejectionReason: pedido.rejectionReason,
    complaintReason: pedido.complaintReason,
    lines: pedido.lines.map(aLineaDto),
    createdAt: pedido.createdAt.toISOString(),
  };
}

function aDetalleDto(pedido: OrdenConDetalle): OrderDetailDto {
  return {
    ...aDto(pedido),
    history: pedido.statusEvents.map((evento) => ({
      previousStatus: evento.previousStatus ? A_COMPARTIDO[evento.previousStatus] : null,
      resultingStatus: A_COMPARTIDO[evento.resultingStatus],
      actorName: evento.actor.fullName,
      actorRole: evento.actorRole,
      reason: evento.reason,
      occurredAt: evento.occurredAt.toISOString(),
    })),
  };
}

function aDeliveryDto(pedido: OrdenConTelefonoCliente): DeliveryOrderDto {
  return {
    ...aDto(pedido),
    customerPhone: pedido.user.phone,
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
