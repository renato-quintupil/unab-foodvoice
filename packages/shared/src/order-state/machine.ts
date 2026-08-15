import { OrderStatus } from '../enums/order-status';

/**
 * Máquina de estados del pedido (T109, D-012, Principio XII, FR-023).
 *
 * **Estrictamente lineal**, con los cinco estados del Principio XII y ninguno
 * más. Tres precisiones, porque son las tres tentaciones habituales:
 *
 * - **No hay estado de cancelación ni de rechazo.** El principio no lo
 *   contempla y FR-023 prohíbe expresamente definir estados propios. Si el
 *   producto llegara a necesitarlo, corresponde enmendar la constitución y
 *   HU-03, no ampliarlo aquí.
 * - **No hay transiciones de retroceso.** `entregado` no vuelve a
 *   `en_preparacion`. La linealidad estricta es lo que hace que el historial de
 *   trazabilidad sea legible como una secuencia y no como un grafo.
 * - **`cerrado` es terminal**, coherente con que el principio sitúe el cierre
 *   al final y lo condicione a la entrega.
 *
 * **No se crea la entidad `Pedido`**: pertenece a E4/E2 y construirla aquí
 * violaría el Principio III. E1 solo consume estos nombres para los filtros y
 * las métricas de HU-10.
 */
const SIGUIENTE: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.CREADO]: [OrderStatus.EN_PREPARACION],
  [OrderStatus.EN_PREPARACION]: [OrderStatus.ASIGNADO_REPARTIDOR],
  [OrderStatus.ASIGNADO_REPARTIDOR]: [OrderStatus.ENTREGADO],
  [OrderStatus.ENTREGADO]: [OrderStatus.CERRADO],
  [OrderStatus.CERRADO]: [],
};

/** Estados alcanzables desde uno dado. Vacío para `cerrado`. */
export function transicionesValidas(desde: OrderStatus): readonly OrderStatus[] {
  return SIGUIENTE[desde];
}

export function esTransicionValida(desde: OrderStatus, hacia: OrderStatus): boolean {
  return transicionesValidas(desde).includes(hacia);
}
