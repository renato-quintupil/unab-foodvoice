import type { Dimension, PriceTier, SearchInterpretation } from '@foodvoice/shared';

/**
 * Interfaz entre el dominio de búsqueda y el proveedor de modelos de lenguaje
 * (D-057). `menu-search.service.ts` solo conoce esta forma; el adaptador
 * concreto (`AnthropicSemanticIntentProvider`) es la única pieza que importa
 * el SDK real. Cambiar de proveedor o de modelo no toca el servicio.
 */

/** Categoría activa tal como la ve el proveedor — sin más que lo necesario. */
export type CategoriaPermitida = {
  id: string;
  name: string;
  description: string;
  dimension: Dimension;
};

/** Producto candidato (`active && available`) tal como lo ve el proveedor. */
export type ProductoPermitido = {
  id: string;
  name: string;
  description: string;
  ingredients: string | null;
  foodTypeCategoryId: string;
  healthProfileCategoryId: string;
  priceTier: PriceTier | null;
  dietaryTags: string[];
};

/**
 * Lo que el servidor le envía al proveedor en cada solicitud. Es la
 * **proyección completa y la única fuente de IDs permitidos** (D-062): la
 * respuesta del proveedor se filtra contra los IDs de `categories`/`products`
 * de este mismo contexto, nunca contra una consulta posterior.
 */
export type ContextoBusqueda = {
  query: string;
  categories: CategoriaPermitida[];
  products: ProductoPermitido[];
};

/** Resultado crudo de interpretar una búsqueda (`intent: 'SEARCH'`). */
export type ResultadoInterpretacionBusqueda = {
  /** `null` cuando la llamada falló antes de recibir una respuesta medible. */
  tokensUsed: number | null;
} & (
  | { kind: 'RESULTS'; interpretation: SearchInterpretation; productIds: string[] }
  | { kind: 'CLARIFICATION'; question: string; options: string[] }
  | { kind: 'NO_RESULTS'; interpretation: SearchInterpretation }
);

/** Resultado crudo de resolver un agregado por voz (`intent: 'ADD'`). */
export type ResultadoInterpretacionAgregado = {
  tokensUsed: number | null;
} & (
  | { kind: 'RESOLVED'; productId: string; quantity: number }
  | { kind: 'CLARIFICATION'; question: string; options: string[] }
  | { kind: 'NOT_FOUND' }
);

/**
 * El proveedor **nunca** recibe sesión, usuario, dirección, carrito, pedido,
 * historial ni credenciales de ningún tipo (RN-07 de HU-06) — solo lo que
 * `ContextoBusqueda` declara. No tiene ninguna capacidad con efectos
 * laterales: solo puede devolver la estructura pactada.
 */
export interface SemanticIntentProvider {
  /** Identificador exacto del modelo usado, para `search_log.model` (D-057). */
  readonly nombreModelo: string;
  interpretarBusqueda(contexto: ContextoBusqueda): Promise<ResultadoInterpretacionBusqueda>;
  interpretarAgregado(contexto: ContextoBusqueda): Promise<ResultadoInterpretacionAgregado>;
}

/** Token de inyección: NestJS no puede inyectar por interfaz (borrada en runtime). */
export const SEMANTIC_INTENT_PROVIDER = Symbol('SEMANTIC_INTENT_PROVIDER');
