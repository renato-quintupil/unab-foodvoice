/**
 * Formato del precio (§ Presentación del precio, D-030).
 *
 * **Única fuente del formato.** Ninguna pantalla lo compone a mano, con el mismo
 * criterio con que E1 centralizó el huso horario de referencia: un precio
 * escrito de dos formas en dos pantallas del mismo producto es un defecto
 * visible, y la inconsistencia se heredaría en los totales de E2.
 */

/** Cota superior del precio (§ Límites de los campos, supuesto 6, D-026). */
export const PRECIO_MAXIMO = 10_000_000;

/** Cota inferior: el precio es un entero **mayor que cero** (RN-006, FR-015). */
export const PRECIO_MINIMO = 1;

/**
 * Devuelve `"$4.990"`: símbolo de peso, **punto como separador de miles** y
 * **sin decimales**, según la convención chilena.
 *
 * Se usa `Intl.NumberFormat` con configuración regional de Chile en lugar de
 * construir la cadena con expresiones regulares, para no reimplementar una
 * agrupación de miles que la plataforma ya resuelve.
 *
 * **Es solo presentación**: el dato se guarda y se ingresa como un entero sin
 * separadores (FR-015), y el campo de entrada del formulario no aplica el
 * formato mientras se escribe.
 */
export function formatearPrecio(valor: number): string {
  const entero = Math.trunc(valor);
  const agrupado = new Intl.NumberFormat('es-CL', {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(Math.abs(entero));
  // El signo se antepone al símbolo —«-$4.990»— y no entre ambos, que es como
  // se lee un descuento en español. En el catálogo no hay precios negativos
  // (FR-015 los rechaza), pero la función no puede devolver «$-4.990» si un
  // llamador futuro le pasa uno.
  return `${entero < 0 ? '-' : ''}$${agrupado}`;
}
