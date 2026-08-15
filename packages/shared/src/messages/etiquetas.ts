import { AdminAction } from '../enums/admin-action';
import { OrderStatus } from '../enums/order-status';
import { Role, UserStatus } from '../enums/role';

/**
 * Etiquetas visibles de los enums y textos de éxito (FR-037, ux CHK006,
 * ux CHK007, ux CHK026).
 *
 * `ETIQUETA_ROL` y `ETIQUETA_ESTADO` son la razón por la que los identificadores
 * internos en mayúsculas **nunca** llegan a la pantalla: la interfaz no tiene
 * ninguna otra forma de nombrar un rol, y no puede caer en mostrar
 * `ADMINISTRADOR` por descuido.
 */

export const ETIQUETA_ROL: Record<Role, string> = {
  [Role.CLIENTE]: 'Cliente',
  [Role.NEGOCIO]: 'Negocio',
  [Role.REPARTIDOR]: 'Repartidor',
  [Role.ADMINISTRADOR]: 'Administrador',
};

export const ETIQUETA_ESTADO: Record<UserStatus, string> = {
  [UserStatus.ACTIVO]: 'Activo',
  [UserStatus.DESACTIVADO]: 'Desactivado',
};

export const ETIQUETA_ESTADO_PEDIDO: Record<OrderStatus, string> = {
  [OrderStatus.CREADO]: 'Creado',
  [OrderStatus.EN_PREPARACION]: 'En preparación',
  [OrderStatus.ASIGNADO_REPARTIDOR]: 'Asignado a repartidor',
  [OrderStatus.ENTREGADO]: 'Entregado',
  [OrderStatus.CERRADO]: 'Cerrado',
};

/**
 * Confirmación de éxito tras cada acción administrativa (FR-037, SC-037).
 *
 * Indexado por `AdminAction`, de modo que las seis acciones registrables y los
 * seis mensajes de éxito no puedan desalinearse: añadir una acción sin su
 * mensaje deja de compilar.
 */
export const MSG_EXITO: Record<AdminAction, (nombre: string) => string> = {
  [AdminAction.CREAR]: (n) => `Se creó el usuario ${n}.`,
  [AdminAction.EDITAR]: (n) => `Se guardaron los datos de ${n}.`,
  [AdminAction.CAMBIAR_ROL]: (n) => `Se cambió el rol de ${n}.`,
  [AdminAction.DESACTIVAR]: (n) => `Se desactivó a ${n}.`,
  [AdminAction.REACTIVAR]: (n) => `Se reactivó a ${n}.`,
  [AdminAction.RESTABLECER_PASSWORD]: (n) => `Se restableció la contraseña de ${n}.`,
};

/**
 * Huso horario de referencia del producto (spec § Convenciones de interfaz).
 *
 * Vive aquí, y no en el servicio, porque la interfaz lo necesita para
 * **mostrar** las fechas y el servidor para **interpretarlas**: si cada lado
 * tuviera el suyo, un reporte mostraría un día distinto del que se consultó.
 * Es una constante, no un ajuste por usuario — v1 no ofrece selección de huso.
 */
export const HUSO_REFERENCIA = 'America/Santiago';
