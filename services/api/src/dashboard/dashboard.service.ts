import { Injectable } from '@nestjs/common';
import {
  OrderLine,
  OrderStatus as PrismaOrderStatus,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import {
  HUSO_REFERENCIA,
  OrderStatus,
  PAGE_SIZE,
  type OrderDetailDto,
  type OrderDto,
  type OrderLineDto,
  type OrdersQuery,
  type Paginated,
} from '@foodvoice/shared';
import { noEncontrado } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const CON_DETALLE = {
  lines: true,
  statusEvents: {
    include: { actor: { select: { fullName: true } } },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.OrderInclude;
type OrdenConDetalle = Prisma.OrderGetPayload<{ include: typeof CON_DETALLE }>;

const ESTADO_A_COMPARTIDO: Record<PrismaOrderStatus, OrderStatus> = {
  [PrismaOrderStatus.CREADO]: OrderStatus.CREADO,
  [PrismaOrderStatus.EN_PREPARACION]: OrderStatus.EN_PREPARACION,
  [PrismaOrderStatus.ASIGNADO_REPARTIDOR]: OrderStatus.ASIGNADO_REPARTIDOR,
  [PrismaOrderStatus.ENTREGADO]: OrderStatus.ENTREGADO,
  [PrismaOrderStatus.CERRADO]: OrderStatus.CERRADO,
  [PrismaOrderStatus.RECHAZADO]: OrderStatus.RECHAZADO,
};

const ESTADO_A_PRISMA: Record<OrderStatus, PrismaOrderStatus> = {
  [OrderStatus.CREADO]: PrismaOrderStatus.CREADO,
  [OrderStatus.EN_PREPARACION]: PrismaOrderStatus.EN_PREPARACION,
  [OrderStatus.ASIGNADO_REPARTIDOR]: PrismaOrderStatus.ASIGNADO_REPARTIDOR,
  [OrderStatus.ENTREGADO]: PrismaOrderStatus.ENTREGADO,
  [OrderStatus.CERRADO]: PrismaOrderStatus.CERRADO,
  [OrderStatus.RECHAZADO]: PrismaOrderStatus.RECHAZADO,
};

export type Metricas = {
  activeUsersByRole: Record<Role, number>;
  ordersByStatus: Record<OrderStatus, number>;
};

/**
 * Panel del administrador (T110, HU-10).
 *
 * **Expone solo lecturas.** Ningún método de este servicio modifica datos, y su
 * módulo solo declara verbos `GET`: RN-004 y FR-021 se cumplen por lo que **no**
 * existe, no por una comprobación (Principio III).
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Métricas del estado operativo (T111, FR-019, FR-023, D-012, data CHK030).
   *
   * **Completa el resultado del `GROUP BY` con los cuatro roles y los cinco
   * estados.** El motor omite las filas de un rol sin ningún usuario activo, y
   * una clave ausente obligaría a la interfaz a distinguir «cero usuarios con
   * este rol» de «este rol no vino en la respuesta» —dos situaciones que ningún
   * requisito diferencia y que en la práctica se resolverían mostrando un hueco
   * en el panel donde debería haber un cero—.
   *
   * Con la forma completa garantizada, el panel siempre presenta las mismas
   * nueve cifras y su lectura no depende del estado del padrón. Es además lo
   * que hace comprobable el paso C2 de la guía, que contrasta las cifras del
   * panel con el listado filtrado: no se puede contrastar una cifra ausente.
   */
  async metricas(): Promise<Metricas> {
    const [usuariosAgrupados, pedidosAgrupados] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { status: UserStatus.ACTIVO },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const activeUsersByRole = Object.fromEntries(
      Object.values(Role).map((rol) => [rol, 0]),
    ) as Record<Role, number>;

    for (const fila of usuariosAgrupados) {
      activeUsersByRole[fila.role] = fila._count._all;
    }

    // Los estados son **los de la máquina compartida, sin definir ninguno
    // propio** (FR-023). Se completan los ausentes con cero porque `GROUP BY`
    // omite estados sin pedidos.
    const ordersByStatus = Object.fromEntries(
      Object.values(OrderStatus).map((estado) => [estado, 0]),
    ) as Record<OrderStatus, number>;

    for (const fila of pedidosAgrupados) {
      ordersByStatus[ESTADO_A_COMPARTIDO[fila.status]] = fila._count._all;
    }

    return { activeUsersByRole, ordersByStatus };
  }

  /**
   * Reporte de pedidos (T112, FR-020, api CHK004, api CHK018, ux CHK026).
   *
   * Devuelve `Paginated<OrderDto>` con **la misma forma exacta** que el listado
   * de usuarios y el mismo `PAGE_SIZE`, de modo que la interfaz no necesite dos
   * componentes de paginación distintos.
   *
   * Desde E2/E4 consulta los pedidos reales; conserva el contrato y la
   * semántica de fechas que HU-10 dejó preparados en E1.
   */
  async pedidos(consulta: OrdersQuery): Promise<Paginated<OrderDto>> {
    const { desde, hasta } = intervaloDeConsulta(consulta.from, consulta.to);
    const where: Prisma.OrderWhereInput = {
      status: consulta.status ? ESTADO_A_PRISMA[consulta.status] : undefined,
      createdAt:
        desde || hasta
          ? {
              gte: desde ?? undefined,
              lte: hasta ?? undefined,
            }
          : undefined,
    };

    const [total, filas] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (consulta.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, status: true, createdAt: true },
      }),
    ]);

    return {
      items: filas.map((pedido) => ({
        id: pedido.id,
        status: ESTADO_A_COMPARTIDO[pedido.status],
        createdAt: pedido.createdAt.toISOString(),
      })),
      total,
      page: consulta.page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** `GET /admin/dashboard/orders/:id` (E4, FR-006, FR-009). */
  async detalle(id: string): Promise<OrderDetailDto> {
    const pedido = await this.prisma.order.findUnique({
      where: { id },
      include: CON_DETALLE,
    });
    if (!pedido) throw noEncontrado();
    return pedidoADetalleDto(pedido);
  }
}

function pedidoADetalleDto(pedido: OrdenConDetalle): OrderDetailDto {
  return {
    id: pedido.id,
    status: ESTADO_A_COMPARTIDO[pedido.status],
    addressText: pedido.addressText,
    rejectionReason: pedido.rejectionReason,
    complaintReason: pedido.complaintReason,
    lines: pedido.lines.map(lineaADto),
    createdAt: pedido.createdAt.toISOString(),
    history: pedido.statusEvents.map((evento) => ({
      previousStatus: evento.previousStatus
        ? ESTADO_A_COMPARTIDO[evento.previousStatus]
        : null,
      resultingStatus: ESTADO_A_COMPARTIDO[evento.resultingStatus],
      actorName: evento.actor.fullName,
      actorRole: evento.actorRole,
      occurredAt: evento.occurredAt.toISOString(),
    })),
  };
}

function lineaADto(linea: OrderLine): OrderLineDto {
  return {
    productId: linea.productId,
    productName: linea.productName,
    price: linea.productPrice,
    quantity: linea.quantity,
  };
}

/**
 * Convierte los extremos escritos por una persona en un intervalo de instantes.
 *
 * Ambos son **inclusivos** y se interpretan como **días del calendario en
 * `HUSO_REFERENCIA`**, no en UTC. La distinción no es teórica: para un producto
 * de un solo local en Chile, interpretar los días en UTC haría que un pedido de
 * las 22:00 apareciera en el reporte del día siguiente, y el administrador
 * vería como «del día 16» algo que ocurrió el 15 a la vista de todos
 * (ux CHK026).
 *
 * La conversión ocurre **aquí y no en el esquema compartido**: este es el único
 * lugar que conoce el huso de referencia como criterio de consulta; el esquema
 * solo valida la forma de la fecha.
 */
export function intervaloDeConsulta(
  from: string | undefined,
  to: string | undefined,
): { desde: Date | null; hasta: Date | null } {
  return {
    desde: from ? instanteEnHuso(from, '00:00:00.000') : null,
    // `to` abarca hasta el último instante de su día: `from = to` devuelve el
    // día completo, que es lo que una persona espera al escribir la misma fecha
    // dos veces. Con extremos exclusivos devolvería cero y parecería un defecto.
    hasta: to ? instanteEnHuso(to, '23:59:59.999') : null,
  };
}

/**
 * Instante UTC correspondiente a una hora local del huso de referencia.
 *
 * Se resuelve consultando el desplazamiento real del huso en esa fecha, en
 * lugar de restar un número fijo de horas: Chile cambia de horario a lo largo
 * del año, y un desplazamiento fijo desplazaría el reporte medio año entero.
 */
function instanteEnHuso(fecha: string, hora: string): Date {
  const comoUtc = new Date(`${fecha}T${hora}Z`);
  // El desplazamiento se calcula sobre el **mediodía** del mismo día, no sobre
  // el instante buscado, por dos razones. La primera es exactitud: el formato
  // de partes no expresa milisegundos, así que calcularlo sobre las 23:59:59.999
  // introducía un error de 999 ms y el intervalo de un día no medía un día
  // exacto. La segunda es que el mediodía pertenece inequívocamente a esa fecha
  // en cualquier huso, lo que evita la ambigüedad de los bordes en los días de
  // cambio de horario. Ambos extremos comparten así el mismo desplazamiento.
  const referencia = new Date(`${fecha}T12:00:00.000Z`);
  const desplazamiento = desplazamientoDelHuso(referencia);
  return new Date(comoUtc.getTime() - desplazamiento);
}

/** Desplazamiento del huso de referencia respecto de UTC, en milisegundos. */
function desplazamientoDelHuso(instante: Date): number {
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: HUSO_REFERENCIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const partes = Object.fromEntries(
    formato.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );

  const local = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second),
  );

  return local - instante.getTime();
}
