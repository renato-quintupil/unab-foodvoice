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
  /**
   * Nombres de las aptitudes dietéticas marcadas por el negocio (E6). `[]`
   * cuando no tiene ninguna — **nunca** significa "no apto", significa "no
   * declarado" (data-model.md de 006-busqueda-por-voz).
   */
  dietaryTags: string[];
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
 * Pedido tal como lo ven cliente y negocio en los listados (HU-01). No incluye
 * el historial completo para evitar inflar cada fila (D-051).
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

/** Una entrada de solo lectura del historial append-only de un pedido (E4). */
export type OrderStatusEventDto = {
  previousStatus: OrderStatus | null;
  resultingStatus: OrderStatus;
  actorName: string;
  actorRole: Role;
  occurredAt: string;
};

/** El resumen del pedido más su historial cronológico completo (D-051). */
export type OrderDetailDto = OrderSummaryDto & {
  history: OrderStatusEventDto[];
};

// ---------------------------------------------------------------------------
// E6 · Búsqueda por voz (contracts/shared.md de 006-busqueda-por-voz)
// ---------------------------------------------------------------------------

/**
 * Lo que el proveedor de lenguaje entendió de la frase — **nunca** productos
 * completos (FR-004). Las cinco categorías de intención del Principio VII,
 * ni una más.
 *
 * `vegan: true` significa que la frase pidió explícitamente aptitud vegana;
 * `null` significa que la frase no mencionó ninguna aptitud dietética — nunca
 * `false` (FR-013: no hay negación útil de "vegano" en este contrato).
 */
export type SearchInterpretation = {
  priceTier: PriceTier | null;
  foodTypeCategoryId: string | null;
  healthProfileCategoryId: string | null;
  vegan: boolean | null;
  productTerms: string[];
  openRecommendation: boolean;
};

/**
 * Respuesta de `POST /menu/search` con `intent: 'SEARCH'` (Historia 1 y 3 de
 * `spec.md`). `items` son `ProductDto` reales, reconsultados al responder
 * (FR-006, FR-007) — nunca la forma que devolvió el proveedor.
 */
export type SemanticSearchResponse =
  | { status: 'RESULTS'; interpretation: SearchInterpretation; items: ProductDto[] }
  | { status: 'CLARIFICATION'; question: string; options: string[] }
  | { status: 'NO_RESULTS'; interpretation: SearchInterpretation };

/** Un producto resuelto para agregar, con la cantidad que le corresponde. */
export type ItemResuelto = { item: ProductDto; quantity: number };

/**
 * Respuesta de `POST /menu/search` con `intent: 'ADD'` (Historia 2). **Nunca**
 * agrega nada al carrito (FR-008, FR-019–FR-021): es responsabilidad de quien
 * llama, tras la confirmación explícita del cliente, invocar los endpoints de
 * carrito ya existentes de E2 (D-063).
 *
 * `items` puede traer más de un producto: una frase puede nombrar varios
 * ("una napolitana y una cuatro quesos"), y el cliente confirma todos juntos
 * con una sola acción (D-066). Cada `quantity` es siempre ≥ 1 (FR-024).
 * Aunque `status: 'RESOLVED'` ya pasó la reconsulta de disponibilidad
 * (FR-021), no es una promesa de que los productos sigan disponibles al
 * confirmar — el carrito vuelve a validar cada uno (FR-022).
 */
export type AddResolutionResponse =
  | { status: 'RESOLVED'; items: ItemResuelto[] }
  | { status: 'CLARIFICATION'; question: string; options: string[] }
  | { status: 'NOT_FOUND' };

// ---------------------------------------------------------------------------
// E5 · Reparto (contracts/shared.md de 007-reparto-repartidor)
// ---------------------------------------------------------------------------

/**
 * El pedido en curso de un repartidor, con el teléfono de contacto del
 * cliente que `OrderSummaryDto` no lleva (D-070). Extiende `OrderSummaryDto`
 * por composición — solo `GET /delivery/orders/current` lo devuelve; la
 * lista de disponibles sigue usando `OrderSummaryDto[]`, sin teléfono.
 */
export type DeliveryOrderDto = OrderSummaryDto & {
  customerPhone: string;
};

/** Formato único de respuesta de error de la API (`contracts/api.md`). */
export type ApiError = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};
