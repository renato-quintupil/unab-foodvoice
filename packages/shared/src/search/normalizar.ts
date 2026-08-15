/**
 * Normalización de búsqueda (FR-015, D-011).
 *
 * ⚠️ **Esta función alimenta una columna persistida** (`user.search_normalized`).
 * Cambiarla no rompe ninguna compilación, pero deja los datos ya guardados
 * calculados con la versión anterior, y unos usuarios se encontrarán y otros no
 * sin patrón visible. Por eso **toda modificación de esta función exige una
 * migración que repueble la columna entera** (api CHK030, `shared.md`
 * § Compatibilidad).
 *
 * Vive aquí, y no en el backend, porque es la misma función la que construye
 * `search_normalized` al guardar un usuario y la que prepara el término que el
 * administrador escribe. Si fueran dos implementaciones, bastaría con que uno
 * de los dos lados cambiara para que un texto presente en la base dejara de
 * encontrarse — un fallo silencioso, sin error ni excepción.
 */

/**
 * Aplica, en este orden: descomposición NFD, eliminación de marcas combinantes,
 * minúsculas, colapso de espacios y recorte.
 *
 * `á → a`, `ü → u`, **`ñ → n`**. La eñe se pliega deliberadamente, en línea con
 * el objetivo de FR-015 de que el administrador dé con la persona sin acertar
 * la ortografía exacta: «Nuñez» y «Nunez» se encuentran mutuamente.
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Neutraliza los caracteres con significado en `LIKE` (`\`, `%` y `_`) para que
 * el término se busque literalmente. Se aplica **después** de normalizar.
 *
 * Sin este paso, un `%` escrito por el administrador devolvería el padrón
 * completo en lugar de las filas que contienen ese carácter.
 */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}
