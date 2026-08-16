import { AdminAction } from '../enums/admin-action';
import { Dimension, PriceTier, ProductStatus } from '../enums/dimension';
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

// ---------------------------------------------------------------------------
// E3 · Administración de menú
//
// Estas cuatro tablas son la implementación de § Vocabulario visible del
// catálogo, que **prohíbe expresamente** los sinónimos: «eliminar», «borrar»,
// «sin stock», «no disponible», «suspendido», «archivar», «eje», «faceta».
// Al estar centralizadas, el vocabulario no se improvisa pantalla a pantalla y
// la prohibición es revisable en un solo archivo (SC-029).
// ---------------------------------------------------------------------------

/**
 * Nombre visible de cada dimensión (FR-001).
 *
 * En pantalla se dice **dimensión**, nunca «eje», «faceta» ni «atributo».
 */
export const ETIQUETA_DIMENSION: Record<Dimension, string> = {
  [Dimension.TIPO_COMIDA]: 'Tipo de comida',
  [Dimension.PERFIL_SALUD]: 'Perfil de salud',
};

/** Los tres tramos de precio, tal como se nombran en pantalla (FR-032). */
export const ETIQUETA_TRAMO: Record<PriceTier, string> = {
  [PriceTier.ECONOMICO]: 'Económico',
  [PriceTier.MEDIO]: 'Medio',
  [PriceTier.CARO]: 'Caro',
};

/**
 * Los tres estados visibles del producto, derivados de `active` y `available`.
 *
 * «Agotado», nunca «sin stock», «no disponible» ni «suspendido». «Dado de baja»,
 * nunca «eliminado» ni «borrado».
 */
export const ETIQUETA_ESTADO_PRODUCTO: Record<ProductStatus, string> = {
  [ProductStatus.DISPONIBLE]: 'Disponible',
  [ProductStatus.AGOTADO]: 'Agotado',
  [ProductStatus.DADO_DE_BAJA]: 'Dado de baja',
};

/**
 * Los dos estados visibles de la categoría.
 *
 * La categoría se **desactiva** y el producto se **da de baja**: es una
 * inconsistencia consciente, declarada en el supuesto 4 de la spec. El producto
 * usa un verbo de menú y la categoría uno de configuración, el mismo que E1
 * aplica a los usuarios. Unificarlos obligaría a llamar «desactivado» a un
 * producto retirado del menú, que no es como se habla en un local.
 */
export const ETIQUETA_ESTADO_CATEGORIA: Record<'ACTIVA' | 'DESACTIVADA', string> = {
  ACTIVA: 'Activa',
  DESACTIVADA: 'Desactivada',
};

/**
 * Acciones del catálogo, para nombrarlas igual en el botón que la dispara y en
 * la confirmación de éxito que la sigue (FR-025).
 */
export const CatalogAction = {
  CREAR_CATEGORIA: 'CREAR_CATEGORIA',
  EDITAR_CATEGORIA: 'EDITAR_CATEGORIA',
  DESACTIVAR_CATEGORIA: 'DESACTIVAR_CATEGORIA',
  REACTIVAR_CATEGORIA: 'REACTIVAR_CATEGORIA',
  CREAR_PRODUCTO: 'CREAR_PRODUCTO',
  EDITAR_PRODUCTO: 'EDITAR_PRODUCTO',
  AGOTAR_PRODUCTO: 'AGOTAR_PRODUCTO',
  REPONER_PRODUCTO: 'REPONER_PRODUCTO',
  DAR_DE_BAJA_PRODUCTO: 'DAR_DE_BAJA_PRODUCTO',
  REACTIVAR_PRODUCTO: 'REACTIVAR_PRODUCTO',
} as const;

export type CatalogAction = (typeof CatalogAction)[keyof typeof CatalogAction];

/**
 * Confirmación de éxito tras cada acción del catálogo (FR-025).
 *
 * Cada mensaje **nombra el elemento afectado y la acción realizada**, y usa el
 * verbo del vocabulario visible. Indexado por `CatalogAction` para que añadir
 * una acción sin su mensaje deje de compilar, igual que `MSG_EXITO` con
 * `AdminAction` en E1.
 */
export const MSG_EXITO_CATALOGO: Record<CatalogAction, (nombre: string) => string> = {
  [CatalogAction.CREAR_CATEGORIA]: (n) => `Se creó la categoría ${n}.`,
  [CatalogAction.EDITAR_CATEGORIA]: (n) => `Se guardaron los cambios de la categoría ${n}.`,
  [CatalogAction.DESACTIVAR_CATEGORIA]: (n) => `Se desactivó la categoría ${n}.`,
  [CatalogAction.REACTIVAR_CATEGORIA]: (n) => `Se reactivó la categoría ${n}.`,
  [CatalogAction.CREAR_PRODUCTO]: (n) => `Se creó el producto ${n}.`,
  [CatalogAction.EDITAR_PRODUCTO]: (n) => `Se guardaron los cambios de ${n}.`,
  [CatalogAction.AGOTAR_PRODUCTO]: (n) => `Se marcó ${n} como agotado.`,
  [CatalogAction.REPONER_PRODUCTO]: (n) => `Se repuso ${n}.`,
  [CatalogAction.DAR_DE_BAJA_PRODUCTO]: (n) => `Se dio de baja ${n}.`,
  [CatalogAction.REACTIVAR_PRODUCTO]: (n) => `Se reactivó ${n}.`,
};
