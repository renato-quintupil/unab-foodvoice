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
  type ListUsersQuery,
  type OrdersQuery,
} from './schemas/query';

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
} from './messages/es';
export {
  ETIQUETA_ROL,
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_PEDIDO,
  MSG_EXITO,
  HUSO_REFERENCIA,
} from './messages/etiquetas';

export { normalizarBusqueda, escaparLike } from './search/normalizar';

export type {
  UserDto,
  SessionUser,
  Paginated,
  OrderDto,
  ApiError,
} from './types/api';
