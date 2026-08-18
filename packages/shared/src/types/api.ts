import { Dimension, PriceTier, ProductStatus } from '../enums/dimension';
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

// ---------------------------------------------------------------------------
// E3 · Administración de menú
// ---------------------------------------------------------------------------

/**
 * Forma en que una categoría cruza la frontera de la API.
 *
 * No expone `nameNormalized` —detalle de almacenamiento (D-021)— ni `updatedAt`,
 * con el mismo criterio que `UserDto`.
 */
export type CategoryDto = {
  id: string;
  dimension: Dimension;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
};

/**
 * Categoría tal como viaja **dentro** de un producto: lo justo para pintar la
 * clasificación y enlazar el filtro, sin arrastrar su descripción, que en un
 * listado de veinte productos serían veinte descripciones de categoría
 * repetidas.
 */
export type CategoryRef = Pick<CategoryDto, 'id' | 'name' | 'dimension'>;

/**
 * La **única** forma en que un producto sale de la API.
 *
 * Por eso RN-018 se sostiene de forma estructural: los productos con
 * `active = false` no se excluyen campo a campo, sencillamente no se construye
 * ningún `ProductDto` para ellos en las rutas de `/menu`.
 *
 * Tres decisiones sobre esta forma:
 *
 * 1. **No expone `nameNormalized`**: es un detalle de almacenamiento (D-021).
 * 2. **No expone `updatedAt`**: metadato operativo sin superficie funcional.
 * 3. **`status` y `priceTier` son derivados y viajan calculados.** Podrían
 *    computarse en el cliente, pero entonces habría dos implementaciones de la
 *    misma regla —una en la interfaz y otra en la API para la futura voz de E6—
 *    y bastaría que una cambiara para que un producto apareciera en distinto
 *    tramo según quién preguntara.
 *
 * `description` viaja **completa**: el recorte de los listados es solo
 * presentación y lo aplica la interfaz con `recortarDescripcion` (D-033).
 */
export type ProductDto = {
  id: string;
  name: string;
  description: string;
  /** `null` cuando no se declararon. **La ausencia no significa que no los contenga** (RN-019). */
  ingredients: string | null;
  /** Entero en pesos chilenos. Se muestra con `formatearPrecio` (§ Presentación del precio). */
  price: number;
  foodTypeCategory: CategoryRef;
  healthProfileCategory: CategoryRef;
  active: boolean;
  available: boolean;
  /** Derivado de los dos interruptores, por conveniencia de la interfaz. */
  status: ProductStatus;
  /**
   * `null` cuando **no hay tramos** —menos de tres productos activos, o todos al
   * mismo precio (RN-016)—, que es distinto de pertenecer a uno.
   */
  priceTier: PriceTier | null;
  createdAt: string;
};

/**
 * Respuesta de `GET /menu/products` (contracts/api.md § Consulta del menú).
 *
 * **No es `Paginated`**: el menú se muestra completo en una sola pantalla
 * desplazable (D-029), de modo que no lleva `page` ni `totalPages` que nadie
 * usaría.
 *
 * `priceTiers` viaja junto a los productos, y no dentro de cada uno, porque es
 * una propiedad del **catálogo**: los dos cortes se calculan sobre todos los
 * productos activos, con independencia de los filtros aplicados. `null` significa
 * que **no hay tramos** —menos de tres productos activos, o todos al mismo
 * precio (RN-016)—, y entonces una intención de precio no descarta ninguno.
 */
export type MenuResponse = {
  items: ProductDto[];
  priceTiers: { c1: number; c2: number } | null;
};

// ---------------------------------------------------------------------------
// E2 · Gestión de pedidos
// ---------------------------------------------------------------------------

/**
 * Línea del carrito tal como cruza la frontera de la API (HU-12).
 *
 * No congela nombre ni precio (FR-006): se construye uniendo contra el
 * `Product` vigente en cada lectura, igual que `MenuService` deriva
 * `priceTier` en cada consulta.
 */
export type CartLineDto = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  /** `false` cuando el producto dejó de estar `active && available` desde que se agregó (FR-007). */
  available: boolean;
};

export type CartDto = {
  lines: CartLineDto[];
};

/**
 * Dirección guardada (HU-11). No expone `usedInOrder`: es un detalle interno
 * que solo el servicio necesita para decidir entre desactivar y eliminar
 * (D-039); la interfaz decide qué acción ofrecer a partir de la respuesta de
 * cada endpoint, no de este campo.
 */
export type AddressDto = {
  id: string;
  label: string;
  text: string;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
};

/**
 * Línea de un pedido ya confirmado (HU-01). `productName` y `price` son
 * **copias inmutables** tomadas al confirmar (FR-027), a diferencia de
 * `CartLineDto`, que siempre refleja el catálogo vigente.
 */
export type OrderLineDto = {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
};

/**
 * Pedido tal como lo ven cliente y negocio (HU-01). No incluye el historial:
 * E2 lo escribe internamente (FR-042–FR-044) pero no lo publica (D-050); E4
 * añadirá su propio tipo cuando exista la consulta.
 */
export type OrderSummaryDto = {
  id: string;
  status: OrderStatus;
  addressText: string;
  /** Solo presente cuando `status === 'rechazado'` (FR-033). */
  rejectionReason: string | null;
  lines: OrderLineDto[];
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
