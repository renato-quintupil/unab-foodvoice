/**
 * Superficie pública de `@foodvoice/shared` (D-005).
 *
 * Este paquete no contiene acceso a base de datos, cliente Prisma, lógica de
 * red, componentes de interfaz ni ninguna dependencia con efectos secundarios:
 * todo su código debe poder ejecutarse en el navegador y en Node por igual.
 */

export { Role, UserStatus } from './enums/role';
export { AdminAction } from './enums/admin-action';
export { OrderStatus } from './enums/order-status';
export {
  Dimension,
  PriceTier,
  ProductStatus,
  derivarEstadoProducto,
} from './enums/dimension';

export { PasswordSchema } from './schemas/password';
export { LoginSchema, type LoginInput } from './schemas/auth';
export {
  CreateUserSchema,
  UpdateUserSchema,
  ChangeRoleSchema,
  ChangeStatusSchema,
  ResetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ChangeRoleInput,
  type ChangeStatusInput,
  type ResetPasswordInput,
} from './schemas/user';
export {
  PAGE_SIZE,
  ListUsersQuerySchema,
  OrdersQuerySchema,
  ListCategoriesQuerySchema,
  ListProductsQuerySchema,
  MenuQuerySchema,
  type ListUsersQuery,
  type OrdersQuery,
  type ListCategoriesQuery,
  type ListProductsQuery,
  type MenuQuery,
} from './schemas/query';

export {
  LIMITES_DESCRIPCION_PRODUCTO,
  LIMITES_DESCRIPCION_CATEGORIA,
  aplanarDescripcion,
  validarDescripcion,
  mensajeDescripcion,
  type MotivoDescripcion,
  type LimitesDescripcion,
  type ResultadoDescripcion,
} from './schemas/description';
export {
  CreateCategorySchema,
  UpdateCategorySchema,
  ChangeCategoryStatusSchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type ChangeCategoryStatusInput,
} from './schemas/category';
export {
  CreateProductSchema,
  UpdateProductSchema,
  ChangeAvailabilitySchema,
  ChangeProductStatusSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type ChangeAvailabilityInput,
  type ChangeProductStatusInput,
} from './schemas/product';

export { formatearPrecio, PRECIO_MINIMO, PRECIO_MAXIMO } from './format/precio';
export { recortarDescripcion, MAX_DESCRIPCION_LISTADO } from './format/texto';

export {
  MSG_CREDENCIALES_INVALIDAS,
  MSG_CUENTA_BLOQUEADA,
  MSG_SIN_PERMISO,
  MSG_SESION_EXPIRADA,
  MSG_SIN_RESULTADOS_USUARIOS,
  MSG_SIN_RESULTADOS_PEDIDOS,
  MSG_CORREO_YA_EXISTE,
  MSG_AUTOPROTECCION,
  MSG_ERROR_INESPERADO,
  MSG_CONTRASENA_OLVIDADA,
  MSG_RANGO_FECHAS_INVALIDO,
  MSG_SIN_DATOS_PEDIDOS,
  MSG_CATEGORIA_YA_EXISTE,
  MSG_PRODUCTO_YA_EXISTE,
  MSG_MENU_VACIO,
  MSG_SIN_RESULTADOS_CATALOGO,
  MSG_INGREDIENTES_REFERENCIALES,
  MSG_PRODUCTO_NO_ENCONTRADO,
  MSG_CATEGORIA_EN_USO,
  MSG_CATEGORIA_INACTIVA,
  MSG_DIMENSION_SIN_CATEGORIAS,
  MSG_DESCRIPCION_AUSENTE,
  MSG_DESCRIPCION_DEMASIADO_CORTA,
  MSG_DESCRIPCION_DEMASIADO_LARGA,
  MSG_DESCRIPCION_POCAS_PALABRAS,
  MSG_DESCRIPCION_PALABRAS_REPETIDAS,
  MSG_DESCRIPCION_REPITE_EL_NOMBRE,
  AYUDA_DESCRIPCION_PRODUCTO,
  AYUDA_DESCRIPCION_CATEGORIA,
} from './messages/es';
export {
  ETIQUETA_ROL,
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_PEDIDO,
  MSG_EXITO,
  HUSO_REFERENCIA,
  ETIQUETA_DIMENSION,
  ETIQUETA_TRAMO,
  ETIQUETA_ESTADO_PRODUCTO,
  ETIQUETA_ESTADO_CATEGORIA,
  CatalogAction,
  MSG_EXITO_CATALOGO,
} from './messages/etiquetas';

export { normalizarBusqueda, escaparLike } from './search/normalizar';

export { transicionesValidas, esTransicionValida } from './order-state/machine';

export type {
  UserDto,
  SessionUser,
  Paginated,
  OrderDto,
  ApiError,
  CategoryDto,
  CategoryRef,
  ProductDto,
  MenuResponse,
} from './types/api';
