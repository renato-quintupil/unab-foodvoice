import { OrderStatus } from '../enums/order-status';

/**
 * Máquina de estados del pedido (D-035, Principio XII versión 3.0.0, FR-030).
 *
 * **Una sola rama** desde `creado`: aceptar (`en_preparacion`) o rechazar
 * (`rechazado`). El resto es lineal, con **una única excepción de
 * retroceso**:
 *
 * - **`rechazado` es terminal**, alcanzable únicamente desde `creado`, sin
 *   transiciones salientes (RN-008, RN-010).
 * - **`asignado_repartidor → en_preparacion` es la única transición de
 *   retroceso de toda la máquina** (enmienda constitucional 3.0.0, E5 · HU-04
 *   Historia 3): el repartidor que tiene el pedido asignado puede soltarlo,
 *   volviéndolo disponible sin repartidor. Ningún otro estado retrocede —
 *   `entregado` sigue sin volver a `en_preparacion`.
 * - **`cerrado` sigue siendo terminal**, coherente con que el principio sitúe
 *   el cierre al final y lo condicione a la entrega.
 *
 * **No se crea la entidad `Pedido`**: pertenece a E2/E4 y construirla aquí
 * violaría el Principio III. E1 solo consume estos nombres para los filtros y
 * las métricas de HU-10; E2 dispara las dos transiciones que salen de
 * `creado`; E5 dispara `en_preparacion → asignado_repartidor` y su retroceso.
 */
const SIGUIENTE: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.CREADO]: [OrderStatus.EN_PREPARACION, OrderStatus.RECHAZADO],
  [OrderStatus.EN_PREPARACION]: [OrderStatus.ASIGNADO_REPARTIDOR],
  [OrderStatus.ASIGNADO_REPARTIDOR]: [OrderStatus.EN_PREPARACION, OrderStatus.ENTREGADO],
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
