/**
 * Los cinco estados del pedido del Principio XII (FR-023, D-012).
 *
 * E1 **solo consume** estos nombres, para los filtros y las métricas de HU-10.
 * No define la entidad `Pedido` ni persiste nada: eso pertenece a E4/E2
 * (Principio III). No hay estado de cancelación ni de rechazo, porque el
 * principio no los contempla y FR-023 prohíbe definir estados propios.
 */
export const OrderStatus = {
  CREADO: 'creado',
  EN_PREPARACION: 'en_preparacion',
  ASIGNADO_REPARTIDOR: 'asignado_repartidor',
  ENTREGADO: 'entregado',
  CERRADO: 'cerrado',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
