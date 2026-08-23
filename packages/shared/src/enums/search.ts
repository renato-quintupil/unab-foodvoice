/**
 * E6 · Búsqueda por voz (D-055, contracts/shared.md de 006-busqueda-por-voz).
 *
 * Objetos `as const`, siguiendo la convención de `enums/dimension.ts` — no
 * `enum` de TypeScript.
 */

/**
 * Canal de origen de una solicitud de búsqueda.
 *
 * Solo para telemetría (`search_log.channel`, FR-027): **nunca** cambia el
 * resultado de la búsqueda (FR-009). Voz y texto son la misma solicitud.
 */
export const SearchChannel = {
  TEXT: 'TEXT',
  VOICE: 'VOICE',
} as const;

export type SearchChannel = (typeof SearchChannel)[keyof typeof SearchChannel];

/**
 * Qué debe resolver el servidor con la frase interpretada.
 *
 * `SEARCH` (HU-06): una lista de productos. `ADD` (HU-13): un único producto
 * candidato y una cantidad, para que el cliente confirme antes de agregarlo al
 * carrito. Ambas viven en el mismo endpoint (D-056), no en dos.
 */
export const SearchIntent = {
  SEARCH: 'SEARCH',
  ADD: 'ADD',
} as const;

export type SearchIntent = (typeof SearchIntent)[keyof typeof SearchIntent];
