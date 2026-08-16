import { OrderStatus } from '../enums/order-status';
import { Role, UserStatus } from '../enums/role';

/**
 * Forma en que un usuario cruza la frontera de la API.
 *
 * **Ningún tipo de este paquete contiene la contraseña ni su hash** (FR-007,
 * FR-016). `UserDto` es la única forma en que un usuario sale de la API, lo que
 * hace la omisión **estructural** en lugar de depender de recordar excluir el
 * campo en cada respuesta. Tampoco expone `updatedAt`, que es un metadato
 * operativo sin superficie funcional.
 *
 * `createdAt` es una cadena ISO 8601 en UTC con sufijo `Z` y milisegundos: la
 * API no formatea fechas para leerlas ni aplica husos horarios.
 */
export type UserDto = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
};

/**
 * Usuario de la sesión actual.
 *
 * `role` proviene de la **sesión**, no de la fila del usuario: el cambio de rol
 * rige desde el próximo inicio de sesión (FR-011, D-007).
 */
export type SessionUser = Pick<UserDto, 'id' | 'fullName' | 'email' | 'role'>;

/**
 * La **única** forma paginada del producto (FR-016, api CHK018).
 *
 * El listado de usuarios y el reporte de pedidos la comparten sin campos
 * propios, de modo que la interfaz no necesite dos componentes de paginación
 * distintos.
 */
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Pedido tal como lo devuelve el reporte de HU-10.
 *
 * En E1 la lista es **siempre vacía por construcción** (D-012): no existe la
 * entidad `Pedido`, que pertenece a E4/E2. El tipo describe la forma de la
 * superficie preparada, no una tabla.
 */
export type OrderDto = {
  id: string;
  status: OrderStatus;
  createdAt: string;
};

/** Formato único de respuesta de error de la API (`contracts/api.md`). */
export type ApiError = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};
