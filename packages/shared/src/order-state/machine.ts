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

/**
 * La única transición de retroceso del sistema (enmienda 3.0.0), reservada al
 * repartidor dueño del pedido — un administrador no puede dispararla (E8,
 * HU-07, D-083).
 */
const RETROCESO_RESERVADA_AL_REPARTIDOR = {
  desde: OrderStatus.ASIGNADO_REPARTIDOR,
  hacia: OrderStatus.EN_PREPARACION,
} as const;

/**
 * Historia 1 de HU-07 (E8): transiciones que un administrador puede forzar en
 * nombre del rol que correspondería dispararlas. Reutiliza `SIGUIENTE` sin
 * modificarlo (D-083) y excluye la única transición de retroceso, que sigue
 * siendo exclusiva del repartidor.
 */
export function transicionesForzablesPorAdmin(desde: OrderStatus): readonly OrderStatus[] {
  return transicionesValidas(desde).filter(
    (hacia) =>
      !(
        desde === RETROCESO_RESERVADA_AL_REPARTIDOR.desde &&
        hacia === RETROCESO_RESERVADA_AL_REPARTIDOR.hacia
      ),
  );
}

/**
 * Historia 2 de HU-07 (E8, enmienda constitucional 4.0.0): un pedido puede
 * cerrarse administrativamente desde cualquier estado sin transiciones
 * salientes propias — es decir, cualquier estado no terminal. `cerrado` y
 * `rechazado` (los únicos con `SIGUIENTE` vacío) quedan excluidos: ya son
 * terminales, no hace falta cerrarlos de nuevo.
 */
export function puedeCerrarseAdministrativamente(desde: OrderStatus): boolean {
  return transicionesValidas(desde).length > 0;
}
