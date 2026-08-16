import { z } from 'zod';
import { Dimension } from '../enums/dimension';
import {
  LIMITES_DESCRIPCION_CATEGORIA,
  aplanarDescripcion,
  mensajeDescripcion,
  validarDescripcion,
} from './description';

/**
 * Esquemas de la categoría (FR-002, FR-003, FR-006, FR-007, FR-008).
 *
 * Las longitudes son las mismas que declara § Límites de los campos, para que la
 * validación de forma y la restricción de almacenamiento no puedan discrepar.
 * **Ambos extremos son inclusivos**: 2 y 60 caracteres de nombre se aceptan, y
 * 30 y 500 de descripción también.
 *
 * La **unicidad del nombre no se valida aquí** (FR-004): exige consultar la base,
 * así que vive en el servicio de NestJS y la garantiza el índice único —una
 * comprobación previa la sortearían dos peticiones simultáneas (D-021)—.
 */
const CamposCategoria = z.object({
  dimension: z.nativeEnum(Dimension, {
    errorMap: () => ({ message: 'Debes seleccionar una clasificación válida.' }),
  }),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre de la categoría es obligatorio.')
    .max(60, 'El nombre de la categoría es demasiado largo.'),
  /**
   * Se **aplana en el propio campo** (D-033), de modo que lo que sale del
   * esquema es exactamente lo que se persiste: si solo se validara, el servicio
   * podría guardar la cadena original con sus saltos de línea y el texto
   * almacenado dejaría de ser el que pasó la validación.
   */
  description: z.string().transform(aplanarDescripcion),
});

/**
 * Aplica las tres condiciones de sustancia de FR-039 sobre la pareja
 * nombre + descripción.
 *
 * Se valida **a nivel del objeto** y no del campo suelto porque la segunda
 * condición necesita ver también el nombre (D-025).
 */
function conSustancia<T extends z.ZodType<{ name: string; description: string }>>(esquema: T) {
  return esquema.superRefine((datos, ctx) => {
    const r = validarDescripcion(datos.description, datos.name, LIMITES_DESCRIPCION_CATEGORIA);
    if (!r.valida) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        // El error queda **asociado al campo** que falla, no suelto en la
        // página: es lo que exigen FR-003 y el Principio II, y lo que en E1 no
        // se cumplía hasta que la validación funcional lo descubrió (T133).
        path: ['description'],
        message: mensajeDescripcion(r.motivo, LIMITES_DESCRIPCION_CATEGORIA),
      });
    }
  });
}

/** Alta de una categoría (FR-002). Queda activa desde su creación. */
export const CreateCategorySchema = conSustancia(CamposCategoria);

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

/**
 * Edición de una categoría (FR-006).
 *
 * **No incluye `dimension`**, y la omisión es estructural: un campo que el
 * esquema no conoce se descarta en silencio con la regla de E1 sobre campos
 * desconocidos, de modo que la dimensión no se puede cambiar ni enviándola a
 * mano. Cambiarla movería de golpe todos los productos clasificados con ella a
 * otra pregunta distinta, sin que nadie lo hubiera pedido producto a producto.
 *
 * Los dos campos son obligatorios: no es una edición parcial. Se validan con las
 * mismas reglas que el alta, de modo que ninguna edición pueda dejar una
 * categoría en un estado que su creación habría rechazado (§ Límites).
 */
export const UpdateCategorySchema = conSustancia(CamposCategoria.omit({ dimension: true }));

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

/**
 * Desactivación y reactivación de una categoría (FR-007, FR-008).
 *
 * Es un cambio de estado con endpoint propio y no un campo de la edición, porque
 * desactivar puede fallar por una razón que editar no tiene —que haya productos
 * activos que dependan de ella— y su rechazo dice cuántos son.
 */
export const ChangeCategoryStatusSchema = z.object({
  active: z.boolean({
    required_error: 'Debes indicar el estado de la categoría.',
    invalid_type_error: 'Debes indicar el estado de la categoría.',
  }),
});

export type ChangeCategoryStatusInput = z.infer<typeof ChangeCategoryStatusSchema>;
