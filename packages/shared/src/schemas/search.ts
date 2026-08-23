import { z } from 'zod';
import { SearchChannel, SearchIntent } from '../enums/search';
import { MSG_BUSQUEDA_VACIA, MSG_BUSQUEDA_MUY_LARGA } from '../messages/es';

/**
 * Entrada de `POST /menu/search` (E6, D-056). Única puerta de validación,
 * en frontend y backend (Convención del proyecto).
 *
 * `intent` distingue las dos historias que comparten este endpoint: `SEARCH`
 * (HU-06, lista de resultados) y `ADD` (HU-13, un único candidato a agregar
 * al carrito). Por omisión `SEARCH`, porque es el caso de uso más frecuente.
 */
export const SearchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, MSG_BUSQUEDA_VACIA)
    .max(300, MSG_BUSQUEDA_MUY_LARGA),
  channel: z.nativeEnum(SearchChannel),
  intent: z.nativeEnum(SearchIntent).default(SearchIntent.SEARCH),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
