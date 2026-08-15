import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import {
  HUSO_REFERENCIA,
  OrderStatus,
  PAGE_SIZE,
  type OrderDto,
  type OrdersQuery,
  type Paginated,
} from '@foodvoice/shared';
import { PrismaService } from '../prisma/prisma.service';

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
    const agrupado = await this.prisma.user.groupBy({
      by: ['role'],
      where: { status: UserStatus.ACTIVO },
      _count: { _all: true },
    });

    const activeUsersByRole = Object.fromEntries(
      Object.values(Role).map((rol) => [rol, 0]),
    ) as Record<Role, number>;

    for (const fila of agrupado) {
      activeUsersByRole[fila.role] = fila._count._all;
    }

    // Los cinco estados son **los de la máquina compartida, sin definir ninguno
    // propio** (FR-023). En E1 están todos en cero por definición: no existe la
    // entidad `Pedido`, que pertenece a E4/E2 (D-012). No es un defecto
    // pendiente sino el comportamiento correcto y esperado.
    const ordersByStatus = Object.fromEntries(
      Object.values(OrderStatus).map((estado) => [estado, 0]),
    ) as Record<OrderStatus, number>;

    return { activeUsersByRole, ordersByStatus };
  }

  /**
   * Reporte de pedidos (T112, FR-020, api CHK004, api CHK018, ux CHK026).
   *
   * Devuelve `Paginated<OrderDto>` con **la misma forma exacta** que el listado
   * de usuarios y el mismo `PAGE_SIZE`, de modo que la interfaz no necesite dos
   * componentes de paginación distintos.
   *
   * En E1 devuelve siempre la lista vacía, por construcción. El intervalo se
   * calcula igualmente —y se prueba— porque la conversión de días a instantes
   * es la parte del contrato que no puede quedar sin definir: cuando E4/E2
   * aporten pedidos, la regla ya estará fijada y verificada.
   */
  async pedidos(consulta: OrdersQuery): Promise<Paginated<OrderDto>> {
    // Se calcula aunque no se use todavía: es lo que fija la semántica del
    // filtro y lo que sus pruebas ejercen.
    intervaloDeConsulta(consulta.from, consulta.to);

    return {
      items: [],
      total: 0,
      page: consulta.page,
      pageSize: PAGE_SIZE,
      totalPages: 1,
    };
  }
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
  const desplazamiento = desplazamientoDelHuso(comoUtc);
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
