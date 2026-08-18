/**
 * Los seis estados del pedido del Principio XII, versión 2.0.0 (FR-030, D-035).
 *
 * `RECHAZADO` se agregó en E2: alcanzable únicamente desde `CREADO`, terminal,
 * sin transiciones salientes. Es la única rama del contrato; el resto de la
 * máquina sigue siendo estrictamente lineal (`order-state/machine.ts`).
 */
export const OrderStatus = {
  CREADO: 'creado',
  EN_PREPARACION: 'en_preparacion',
  ASIGNADO_REPARTIDOR: 'asignado_repartidor',
  ENTREGADO: 'entregado',
  CERRADO: 'cerrado',
  RECHAZADO: 'rechazado',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
