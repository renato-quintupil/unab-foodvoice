import { z } from 'zod';
import { PRECIO_MAXIMO, PRECIO_MINIMO } from '../format/precio';
import {
  LIMITES_DESCRIPCION_PRODUCTO,
  aplanarDescripcion,
  comprobarSustancia,
} from './description';

/**
 * Esquemas del producto (FR-012 a FR-020).
 *
 * Como en la categoría, la unicidad del nombre **no** se valida aquí (FR-014):
 * la garantiza el índice único de la base, no una consulta previa que dos
 * peticiones simultáneas podrían sortear (D-021).
 */

/**
 * Precio: **entero en pesos chilenos mayor que cero, sin decimales** (FR-015,
 * RN-006, D-026).
 *
 * `z.coerce.number()` convierte la cadena que llega de un formulario o de una
 * cadena de consulta, y `.int()` **rechaza** los decimales en lugar de
 * redondearlos: FR-015 lo prohíbe expresamente —«el sistema NO DEBE redondear ni
 * truncar en silencio un precio con decimales: lo rechaza y el negocio lo
 * sabe»—. Cada condición lleva su propio mensaje, porque el requisito exige
 * indicar **cuál** se incumplió.
 */
const PrecioSchema = z.coerce
  .number({
    required_error: 'El precio es obligatorio.',
    invalid_type_error: 'El precio debe ser un número.',
  })
  .refine((v) => Number.isFinite(v), 'El precio debe ser un número.')
  .refine((v) => Number.isInteger(v), 'El precio no puede tener decimales.')
  .refine((v) => v >= PRECIO_MINIMO, 'El precio debe ser mayor que cero.')
  .refine((v) => v <= PRECIO_MAXIMO, 'El precio es demasiado alto.');

const CamposProducto = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del producto es obligatorio.')
    .max(120, 'El nombre del producto es demasiado largo.'),
  /** Se aplana en el propio campo (D-033): la descripción es párrafo plano. */
  description: z.string().transform(aplanarDescripcion),
  /**
   * **Opcional** (FR-017). Un campo que solo contenga espacios se trata como
   * ausente, y ausente se guarda como `null`: la ausencia del dato **nunca se
   * lee como ausencia del ingrediente** (RN-019, § Qué se guarda).
   *
   * Es texto libre y **conserva los saltos de línea** que el negocio escriba, a
   * diferencia de la descripción: aquí una lista por líneas es legítima.
   */
  ingredients: z
    .string()
    .trim()
    .max(500, 'Los ingredientes son demasiado largos.')
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v.length === 0 ? null : v)),
  price: PrecioSchema,
  /**
   * Exactamente **una categoría activa por cada dimensión obligatoria**
   * (FR-012, RN-011). Que sean dos campos y no una lista hace irrepresentable
   * el estado que la regla prohíbe: ninguna categoría, o dos de la misma
   * dimensión (D-024).
   *
   * Que cada una sea de **su** dimensión y esté **activa** no se puede
   * comprobar aquí —exige consultar la base— y lo hace el servicio dentro de la
   * transacción que escribe.
   */
  foodTypeCategoryId: z
    .string()
    .uuid('Debes seleccionar un tipo de comida.')
    .describe('Categoría de dimensión TIPO_COMIDA'),
  healthProfileCategoryId: z
    .string()
    .uuid('Debes seleccionar un perfil de salud.')
    .describe('Categoría de dimensión PERFIL_SALUD'),
});

/**
 * Las tres condiciones de FR-039 sobre nombre + descripción (D-025).
 *
 * La comprobación vive en `description.ts`; aquí solo se enchufa con los límites
 * del producto. El alta y la edición la comparten, de modo que ninguna edición
 * pueda dejar un producto en un estado que su alta habría rechazado.
 */
function sustanciaDeProducto(
  datos: { name: string; description: string },
  ctx: Parameters<Parameters<typeof CamposProducto.superRefine>[0]>[1],
): void {
  comprobarSustancia(datos, ctx, LIMITES_DESCRIPCION_PRODUCTO);
}

/**
 * Alta de un producto (FR-012).
 *
 * **No admite `active` ni `available`**: al guardarse, el producto queda activo y
 * disponible sin ninguna acción adicional (RN-007), y ambos interruptores tienen
 * su propio endpoint. Tampoco admite tramo de precio, que no existe como dato
 * (FR-032).
 */
export const CreateProductSchema = CamposProducto.superRefine(sustanciaDeProducto);

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/**
 * Edición de un producto (FR-018, FR-022).
 *
 * Mismos campos y mismas reglas que el alta: la reclasificación es un cambio de
 * las dos claves de categoría, no una acción aparte. Los interruptores siguen
 * fuera, con endpoints propios, porque agotar sin confirmación (FR-019) y dar de
 * baja con confirmación (FR-020) son acciones de naturaleza distinta a editar.
 */
export const UpdateProductSchema = CamposProducto.superRefine(sustanciaDeProducto);

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * Agotar y reponer (FR-019).
 *
 * La única acción del catálogo **exenta de confirmación**: ocurre varias veces al
 * día en medio del servicio, es inmediatamente reversible con la acción
 * contraria y no destruye ningún dato. Exigir confirmación haría imposible el
 * criterio de dos clics de SC-002.
 */
export const ChangeAvailabilitySchema = z.object({
  available: z.boolean({
    required_error: 'Debes indicar la disponibilidad del producto.',
    invalid_type_error: 'Debes indicar la disponibilidad del producto.',
  }),
});

export type ChangeAvailabilityInput = z.infer<typeof ChangeAvailabilitySchema>;

/** Dar de baja y reactivar (FR-020). Ambas piden confirmación explícita. */
export const ChangeProductStatusSchema = z.object({
  active: z.boolean({
    required_error: 'Debes indicar el estado del producto.',
    invalid_type_error: 'Debes indicar el estado del producto.',
  }),
});

export type ChangeProductStatusInput = z.infer<typeof ChangeProductStatusSchema>;
