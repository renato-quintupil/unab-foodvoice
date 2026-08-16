/**
 * Validación de las descripciones del catálogo (FR-039, D-025, D-033).
 *
 * **El corazón de la épica**, y la razón por la que esta regla vive en el
 * paquete compartido: el formulario del navegador y el controlador de NestJS
 * ejecutan **el mismo código**, de modo que no puede existir una descripción
 * que la interfaz acepte y la API rechace, ni al revés.
 *
 * El mínimo de caracteres por sí solo no distingue una descripción útil de una
 * inútil —«rica rica rica rica rica rica» cumple los 20 caracteres y no sirve
 * para nada— y E3 es el único momento del proyecto en que se puede exigir lo
 * contrario: una descripción pobre no rompe nada hoy y rompe la búsqueda por
 * voz de E6 mañana, cuando ya no habrá ocasión de exigirla (RN-017).
 *
 * Las tres condiciones son deliberadamente **mecánicas y de mínimos**:
 * descartan la basura evidente sin pretender juzgar la calidad de la prosa, que
 * ningún sistema puede evaluar y que se cuida por otra vía —la ayuda contextual
 * que enseña a escribirla y la revisión humana del contenido de la semilla—.
 */

import {
  MSG_DESCRIPCION_AUSENTE,
  MSG_DESCRIPCION_DEMASIADO_CORTA,
  MSG_DESCRIPCION_DEMASIADO_LARGA,
  MSG_DESCRIPCION_PALABRAS_REPETIDAS,
  MSG_DESCRIPCION_POCAS_PALABRAS,
  MSG_DESCRIPCION_REPITE_EL_NOMBRE,
} from '../messages/es';
import { normalizarBusqueda } from '../search/normalizar';

/**
 * Por qué se rechazó una descripción.
 *
 * Cada motivo tiene su propio mensaje en español, porque FR-039 exige que el
 * rechazo diga **cuál** de las condiciones falló: «tu descripción es demasiado
 * corta» y «tu descripción repite el nombre» piden correcciones distintas, y un
 * mensaje único obligaría a adivinar cuál.
 */
export type MotivoDescripcion =
  | 'AUSENTE'
  | 'DEMASIADO_CORTA'
  | 'DEMASIADO_LARGA'
  | 'POCAS_PALABRAS'
  | 'PALABRAS_REPETIDAS'
  | 'REPITE_EL_NOMBRE';

export type ResultadoDescripcion =
  | { valida: true; valor: string }
  | { valida: false; motivo: MotivoDescripcion };

/** Límites de longitud de una descripción. **Ambos extremos son inclusivos.** */
export type LimitesDescripcion = { minimo: number; maximo: number };

/** Producto: 20–1.000 caracteres (§ Límites de los campos). */
export const LIMITES_DESCRIPCION_PRODUCTO: LimitesDescripcion = { minimo: 20, maximo: 1000 };

/** Categoría: 30–500 caracteres. El mínimo es mayor porque describe un conjunto. */
export const LIMITES_DESCRIPCION_CATEGORIA: LimitesDescripcion = { minimo: 30, maximo: 500 };

/** Palabras de dos o más caracteres exigidas, distintas entre sí (FR-039). */
const MINIMO_PALABRAS = 5;

/** Longitud mínima para que una secuencia cuente como palabra (FR-039.1). */
const MINIMO_LARGO_PALABRA = 2;

/**
 * Colapsa a un solo espacio todo espacio en blanco —incluidos saltos de línea y
 * tabulaciones— y recorta los extremos (D-033).
 *
 * **La descripción es párrafo plano**: lo que se guarda es una sola línea de
 * prosa. Se aplica **antes** de medir la longitud y de evaluar las tres
 * condiciones, de modo que un salto de línea separe palabras como cualquier
 * otro espacio y una descripción no pueda alcanzar su mínimo a base de saltos.
 *
 * El campo de ingredientes **no** pasa por aquí: es texto libre y conserva los
 * saltos que el negocio escriba (FR-017).
 */
export function aplanarDescripcion(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * Extrae las palabras que cuentan para FR-039: las de dos o más caracteres,
 * sobre el texto ya normalizado.
 *
 * Se normaliza con `normalizarBusqueda` —la misma función de FR-004 y FR-014—
 * para que «Rica» y «rica» sean la misma palabra al comprobar la tercera
 * condición: si se compararan en crudo, alternar mayúsculas bastaría para
 * sortearla.
 *
 * Los signos de puntuación se descartan como separadores, de modo que
 * «rica,rica,rica» no cuente como una sola palabra larga.
 */
function extraerPalabras(texto: string): string[] {
  return normalizarBusqueda(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((palabra) => palabra.length >= MINIMO_LARGO_PALABRA);
}

/**
 * Valida una descripción: longitud más las tres condiciones de sustancia.
 *
 * Recibe también el **nombre** del registro, porque la segunda condición no se
 * puede evaluar viendo solo el campo: hay que compararlo con el nombre. Por eso
 * la validación se aplica al objeto y no al campo suelto (D-025).
 *
 * Devuelve el texto ya aplanado cuando es válida, para que quien la use persista
 * exactamente lo que se validó y no la cadena original con sus saltos.
 */
export function validarDescripcion(
  descripcion: string,
  nombre: string,
  limites: LimitesDescripcion,
): ResultadoDescripcion {
  const valor = aplanarDescripcion(descripcion);

  // Un campo que solo contenga espacios se considera ausente, no corto: la
  // corrección que pide es escribir algo, no escribir más (§ Límites).
  if (valor.length === 0) return { valida: false, motivo: 'AUSENTE' };

  if (valor.length < limites.minimo) return { valida: false, motivo: 'DEMASIADO_CORTA' };
  if (valor.length > limites.maximo) return { valida: false, motivo: 'DEMASIADO_LARGA' };

  const palabras = extraerPalabras(valor);

  // FR-039.1 · al menos cinco palabras de dos o más caracteres.
  if (palabras.length < MINIMO_PALABRAS) return { valida: false, motivo: 'POCAS_PALABRAS' };

  // FR-039.3 · al menos cinco palabras **distintas** entre sí. Se comprueba
  // antes que la repetición del nombre porque «rica rica rica rica rica rica»
  // falla por esto y no por parecerse al nombre.
  if (new Set(palabras).size < MINIMO_PALABRAS) {
    return { valida: false, motivo: 'PALABRAS_REPETIDAS' };
  }

  // FR-039.2 · no es una repetición del nombre. Falla si es igual al nombre o
  // si se limita a contenerlo sin añadir ninguna palabra propia: «Pizza
  // Napolitana Pizza Napolitana Pizza» no describe nada.
  const nombreNormalizado = normalizarBusqueda(nombre);
  if (nombreNormalizado.length > 0) {
    const valorNormalizado = normalizarBusqueda(valor);
    if (valorNormalizado === nombreNormalizado) {
      return { valida: false, motivo: 'REPITE_EL_NOMBRE' };
    }
    const palabrasDelNombre = new Set(extraerPalabras(nombre));
    const aportePropio = new Set(palabras.filter((p) => !palabrasDelNombre.has(p)));
    if (aportePropio.size === 0) {
      return { valida: false, motivo: 'REPITE_EL_NOMBRE' };
    }
  }

  return { valida: true, valor };
}

/**
 * Comprobación lista para usar dentro de un `superRefine` de Zod (D-025).
 *
 * Aplica `validarDescripcion` y, si falla, añade el problema **asociado al campo
 * `description`** con el mensaje de la condición incumplida. Se expone así, y no
 * como un envoltorio de esquema, porque un envoltorio genérico colapsa el tipo
 * inferido: TypeScript fija la salida en el objeto mínimo de la restricción y
 * los demás campos del esquema desaparecen. Aquí cada esquema conserva su tipo y
 * la regla sigue viviendo en un solo sitio.
 */
export function comprobarSustancia(
  datos: { name: string; description: string },
  ctx: { addIssue: (problema: { code: 'custom'; path: string[]; message: string }) => void },
  limites: LimitesDescripcion,
): void {
  const r = validarDescripcion(datos.description, datos.name, limites);
  if (r.valida) return;

  ctx.addIssue({
    code: 'custom',
    // El error queda **asociado al campo** que falla, no suelto en la página: es
    // lo que exigen FR-003, FR-013 y el Principio II, y lo que en E1 no se
    // cumplía hasta que la validación funcional lo descubrió (T133).
    path: ['description'],
    message: mensajeDescripcion(r.motivo, limites),
  });
}

/**
 * Traduce un motivo de rechazo a su mensaje en español (FR-039, SC-031).
 *
 * Se indexa con un `Record` sobre `MotivoDescripcion` y no con un `switch` con
 * caso por omisión: añadir un motivo sin su mensaje **deja de compilar**, que es
 * la misma técnica con la que E1 alineó `MSG_EXITO` con `AdminAction`.
 *
 * Los límites llegan como parámetro porque dos de los seis mensajes los
 * nombran, y son distintos en producto y en categoría.
 */
export function mensajeDescripcion(
  motivo: MotivoDescripcion,
  limites: LimitesDescripcion,
): string {
  const mensajes: Record<MotivoDescripcion, string> = {
    AUSENTE: MSG_DESCRIPCION_AUSENTE,
    DEMASIADO_CORTA: MSG_DESCRIPCION_DEMASIADO_CORTA(limites.minimo),
    DEMASIADO_LARGA: MSG_DESCRIPCION_DEMASIADO_LARGA(limites.maximo),
    POCAS_PALABRAS: MSG_DESCRIPCION_POCAS_PALABRAS,
    PALABRAS_REPETIDAS: MSG_DESCRIPCION_PALABRAS_REPETIDAS,
    REPITE_EL_NOMBRE: MSG_DESCRIPCION_REPITE_EL_NOMBRE,
  };
  return mensajes[motivo];
}
