import { z } from 'zod';
import { Dimension, PriceTier, ProductStatus } from '../enums/dimension';
import { OrderStatus } from '../enums/order-status';
import { Role, UserStatus } from '../enums/role';
import { MSG_RANGO_FECHAS_INVALIDO } from '../messages/es';

/**
 * Tamaño de página, fijo (FR-015, decisión de clarificación de la spec).
 *
 * Esta constante es su **única fuente**: ni los contratos, ni la interfaz, ni la
 * API repiten el número 20 como literal. Las dos superficies paginadas del
 * producto —listado de usuarios y reporte de pedidos— la comparten.
 */
export const PAGE_SIZE = 20;

/**
 * Listado del padrón (FR-015).
 *
 * No expone `pageSize`: el tamaño de página es `PAGE_SIZE`. Tampoco expone
 * parámetros de ordenamiento: el orden es fijo, `created_at DESC, id DESC`, y
 * no es elegible por el usuario (D-016).
 */
export const ListUsersQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

/**
 * Comprueba que el día del calendario exista, ida y vuelta.
 *
 * `contracts/shared.md` proponía `!Number.isNaN(Date.parse(...))`, que **no
 * cumple lo que el propio contrato exige**: V8 desborda `2026-02-30` a
 * `2026-03-02` en lugar de devolver `NaN`, de modo que el día inexistente que
 * FR-020 manda rechazar pasaba la validación. Se compara la fecha reconstruida
 * con los tres números escritos: si el motor desbordó, no coinciden.
 */
function esDiaExistente(anio: number, mes: number, dia: number): boolean {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/**
 * Fecha del reporte: `AAAA-MM-DD`, **solo fecha, sin hora ni huso** (FR-020).
 *
 * Rechaza los días que no existen —`2026-02-30`—. No comprueba que la fecha sea
 * pasada ni acota la amplitud del rango: un rango de cincuenta años o
 * enteramente futuro es válido y devuelve el conjunto vacío.
 */
const FechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Debes ingresar una fecha con el formato AAAA-MM-DD.')
  .refine((v) => {
    const [anio, mes, dia] = v.split('-').map(Number) as [number, number, number];
    return mes >= 1 && mes <= 12 && dia >= 1 && esDiaExistente(anio, mes, dia);
  }, 'Esa fecha no existe.');

/**
 * Reporte de pedidos (FR-020). Los filtros son combinables.
 *
 * La comparación `from <= to` funciona sobre las cadenas porque el formato
 * `AAAA-MM-DD` ordena igual como texto que como fecha —una propiedad del
 * formato ISO que evita convertir a `Date` solo para compararlas—.
 *
 * Los dos extremos son inclusivos y se interpretan como días del calendario en
 * `HUSO_REFERENCIA`. **La conversión a un intervalo de instantes ocurre en el
 * servicio, no aquí**: este paquete valida la forma de la fecha y nada más.
 */
export const OrdersQuerySchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    from: FechaSchema.optional(),
    to: FechaSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: MSG_RANGO_FECHAS_INVALIDO,
    path: ['from'],
  });

export type OrdersQuery = z.infer<typeof OrdersQuerySchema>;

// ---------------------------------------------------------------------------
// E3 · Administración de menú
// ---------------------------------------------------------------------------

/**
 * Listado de categorías de la administración (FR-010).
 *
 * **No se pagina**: las categorías de un catálogo mono-local son unas pocas
 * decenas como mucho, y el requisito pide agruparlas o filtrarlas por dimensión,
 * no recorrerlas por páginas. Añadir paginación aquí sería un mecanismo sin
 * requisito que lo pida (Principio III).
 */
export const ListCategoriesQuerySchema = z.object({
  dimension: z.nativeEnum(Dimension).optional(),
  /**
   * Sin este filtro se devuelven **todas**, activas y desactivadas: en la
   * administración las desactivadas siguen siendo visibles (FR-010), a
   * diferencia del menú del cliente, donde no se ofrecen (FR-011).
   */
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;

/**
 * Listado de productos de la administración (FR-023).
 *
 * Reutiliza el `PAGE_SIZE` compartido y **no expone `pageSize` ni parámetros de
 * orden**, igual que `ListUsersQuery`: el orden es fijo —`created_at DESC,
 * id DESC`— para que un mismo conjunto de criterios devuelva siempre los mismos
 * productos en la misma página (supuesto 14).
 *
 * **Sin `status`, el listado muestra solo los productos activos** —disponibles y
 * agotados—; los dados de baja se recuperan eligiendo ese estado. El trabajo
 * cotidiano del negocio es sobre el menú vigente y una baja es la excepción
 * (supuesto 20). Que el valor por omisión viva en el servicio y no aquí es
 * deliberado: este esquema describe lo que el usuario pidió, y «no pidió nada»
 * es distinto de «pidió los activos».
 */
export const ListProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

/**
 * Consulta del menú, para los cuatro roles autenticados (FR-031, FR-032, D-029).
 *
 * **No tiene `page`**: el menú no se pagina, se muestra completo en una sola
 * pantalla desplazable. Los tramos de precio se calculan siempre sobre el
 * catálogo activo completo y nunca sobre lo que se está mostrando, de modo que
 * la ausencia de paginación no altera FR-032.
 *
 * Los tres filtros son **combinables entre sí**, y la combinación es conjuntiva:
 * devuelve solo lo que cumple todas las condiciones, y **nunca** sustituye el
 * resultado por productos que cumplan solo parte (FR-035).
 */
export const MenuQuerySchema = z.object({
  foodTypeCategoryId: z.string().uuid().optional(),
  healthProfileCategoryId: z.string().uuid().optional(),
  priceTier: z.nativeEnum(PriceTier).optional(),
});

export type MenuQuery = z.infer<typeof MenuQuerySchema>;
