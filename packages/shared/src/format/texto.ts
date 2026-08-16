/**
 * Recorte de la descripción en los listados
 * (§ Presentación de la descripción en los listados, D-033).
 *
 * Una descripción puede llegar a 1.000 caracteres, y eso no puede hacer
 * ilegible una pantalla que muestra decenas de productos: el menú del cliente
 * **no se pagina** (FR-031), de modo que doce descripciones largas seguidas
 * dejarían el final del catálogo fuera de alcance con el desplazamiento.
 *
 * Vive aquí, y no en cada listado, por la misma razón que `formatearPrecio`: dos
 * listados que recortan distinto son un defecto visible. **Es solo
 * presentación**: la API devuelve siempre la descripción completa, y el filtro y
 * la búsqueda operan sobre el texto íntegro.
 */

/** Longitud máxima de una descripción dentro de un listado. */
export const MAX_DESCRIPCION_LISTADO = 160;

/** Lo que se añade al recortar, para que el corte sea visible y no una frase truncada a traición. */
const SUFIJO = '…';

/**
 * Recorta en el **último espacio anterior al límite** y añade puntos
 * suspensivos. Nunca parte una palabra por la mitad.
 *
 * Devuelve el texto intacto si ya cabe. Si el límite cae dentro de la primera
 * palabra —un texto sin espacios, como una dirección larga— se corta en el
 * límite: es el único caso en que partir es preferible a devolver la cadena
 * entera, que es lo que el recorte existe para evitar.
 */
export function recortarDescripcion(texto: string, maximo = MAX_DESCRIPCION_LISTADO): string {
  if (texto.length <= maximo) return texto;

  const cortado = texto.slice(0, maximo);

  // Si el carácter que sigue al corte es un espacio, la última palabra cabía
  // entera y se conserva: buscar el espacio anterior la descartaría sin motivo.
  if (/\s/u.test(texto.charAt(maximo))) {
    return `${cortado.replace(/[\s,;:.]+$/u, '')}${SUFIJO}`;
  }

  const ultimoEspacio = cortado.lastIndexOf(' ');
  const base = ultimoEspacio > 0 ? cortado.slice(0, ultimoEspacio) : cortado;

  // Se recortan los signos de puntuación finales para no producir «queso,…».
  return `${base.replace(/[\s,;:.]+$/u, '')}${SUFIJO}`;
}
