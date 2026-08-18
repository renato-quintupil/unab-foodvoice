import { OrderStatus } from '../enums/order-status';

/**
 * Máquina de estados del pedido (D-035, Principio XII versión 2.0.0, FR-030).
 *
 * **Una sola rama** desde `creado`: aceptar (`en_preparacion`) o rechazar
 * (`rechazado`). El resto sigue siendo estrictamente lineal:
 *
 * - **`rechazado` es terminal**, alcanzable únicamente desde `creado`, sin
 *   transiciones salientes (RN-008, RN-010).
 * - **No hay transiciones de retroceso** en el resto de la máquina.
 *   `entregado` no vuelve a `en_preparacion`.
 * - **`cerrado` sigue siendo terminal**, coherente con que el principio sitúe
 *   el cierre al final y lo condicione a la entrega.
 *
 * **No se crea la entidad `Pedido`**: pertenece a E2/E4 y construirla aquí
 * violaría el Principio III. E1 solo consume estos nombres para los filtros y
 * las métricas de HU-10; E2 dispara las dos transiciones que salen de
 * `creado`.
 */
const SIGUIENTE: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.CREADO]: [OrderStatus.EN_PREPARACION, OrderStatus.RECHAZADO],
  [OrderStatus.EN_PREPARACION]: [OrderStatus.ASIGNADO_REPARTIDOR],
  [OrderStatus.ASIGNADO_REPARTIDOR]: [OrderStatus.ENTREGADO],
  [OrderStatus.ENTREGADO]: [OrderStatus.CERRADO],
  [OrderStatus.CERRADO]: [],
  [OrderStatus.RECHAZADO]: [],
};

/** Estados alcanzables desde uno dado. Vacío para `cerrado`. */
export function transicionesValidas(desde: OrderStatus): readonly OrderStatus[] {
  return SIGUIENTE[desde];
}

export function esTransicionValida(desde: OrderStatus, hacia: OrderStatus): boolean {
  return transicionesValidas(desde).includes(hacia);
}
