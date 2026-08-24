# Contrato de `packages/shared`: búsqueda por voz (E6)

Amplía la superficie pública descrita en
[`../../002-administracion-menu-productos/contracts/shared.md`](../../002-administracion-menu-productos/contracts/shared.md)
(catálogo, `PriceTier`, `ProductDto`) y en
[`../../003-gestion-pedidos/contracts/shared.md`](../../003-gestion-pedidos/contracts/shared.md)
(carrito). E6 agrega dos enums nuevos, un esquema Zod de entrada, tres tipos de salida y dos
mensajes fijos. `ProductDto` gana un campo.

## Enums nuevos · `packages/shared/src/enums/search.ts`

Siguiendo la convención de `enums/dimension.ts` (objetos `as const`, no `enum` de TypeScript):

```ts
export const SearchChannel = {
  TEXT: 'TEXT',
  VOICE: 'VOICE',
} as const;

export type SearchChannel = (typeof SearchChannel)[keyof typeof SearchChannel];

export const SearchIntent = {
  SEARCH: 'SEARCH',
  ADD: 'ADD',
} as const;

export type SearchIntent = (typeof SearchIntent)[keyof typeof SearchIntent];
```

`SearchOutcome` (`RESULTS | CLARIFICATION | NO_RESULTS | RESOLVED | NOT_FOUND | ERROR`) **no** se
expone en `packages/shared`: es un detalle de `search_log` (telemetría interna), no algo que el
cliente HTTP necesite construir o leer. La forma pública de la respuesta ya lo comunica a través
de `status` en `SemanticSearchResponse`/`AddResolutionResponse` (ver más abajo).

## Esquema de entrada · `packages/shared/src/schemas/search.ts`

```ts
export const SearchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, MSG_BUSQUEDA_VACIA)
    .max(300, MSG_BUSQUEDA_MUY_LARGA),
  channel: z.enum([SearchChannel.TEXT, SearchChannel.VOICE]),
  intent: z.enum([SearchIntent.SEARCH, SearchIntent.ADD]).default(SearchIntent.SEARCH),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;
```

Es la **única** puerta de entrada de una búsqueda (Convención del proyecto: validación una sola
vez, en `packages/shared`). El backend no vuelve a comprobar el largo de `query` por su cuenta.

## Tipos de salida · `packages/shared/src/types/api.ts`

No son esquemas Zod: son la forma de una respuesta ya validada por el servidor, igual criterio que
`MenuResponse` y `OrderDetailDto` de épicas anteriores.

### `SearchInterpretation`

Lo que el proveedor entendió de la frase, **nunca** productos completos (FR-004).

```ts
export type SearchInterpretation = {
  priceTier: PriceTier | null;
  foodTypeCategoryId: string | null;
  healthProfileCategoryId: string | null;
  vegan: boolean | null;
  productTerms: string[];
  openRecommendation: boolean;
};
```

`vegan: true` significa que la frase pedía explícitamente aptitud vegana; `null` significa que la
frase no mencionó ninguna aptitud dietaria — nunca `false` (no hay negación útil de "vegano" en
este contrato, coherente con FR-013).

### `SemanticSearchResponse` (intent = `SEARCH`)

```ts
export type SemanticSearchResponse =
  | { status: 'RESULTS'; interpretation: SearchInterpretation; items: ProductDto[] }
  | { status: 'CLARIFICATION'; question: string; options: string[] }
  | { status: 'NO_RESULTS'; interpretation: SearchInterpretation };
```

`items` son `ProductDto` reales, construidos por `MenuService`/`products.service.ts` — nunca la
forma que devolvió el proveedor (FR-004, FR-005, FR-006).

### `AddResolutionResponse` (intent = `ADD`)

```ts
export type AddResolutionResponse =
  | { status: 'RESOLVED'; item: ProductDto; quantity: number }
  | { status: 'CLARIFICATION'; question: string; options: string[] }
  | { status: 'NOT_FOUND' };
```

`quantity` es siempre ≥ 1 (FR-024: una frase sin cantidad explícita asume 1). Cuando
`status: 'RESOLVED'`, `item` ya pasó la reconsulta de disponibilidad (FR-021); igual así, la
confirmación en pantalla y el `POST /cart/lines` posterior vuelven a revalidar (FR-022,
D-063) — este tipo no es una promesa de que el producto siga disponible al confirmar.

## `ProductDto` · campo nuevo

```ts
export type ProductDto = {
  // … campos existentes de E3, sin cambios …
  /** Nombres de las aptitudes dietéticas marcadas por el negocio. `[]` si no tiene ninguna. */
  dietaryTags: string[];
};
```

Aditivo: ningún consumidor existente de `ProductDto` (menú manual de E3, carrito de E2) se ve
afectado por un campo nuevo.

## Mensajes fijos nuevos · `packages/shared/src/messages/es.ts`

```ts
/** FR-015. */
export const MSG_BUSQUEDA_VACIA = 'Escribe o dicta lo que quieres comer para poder buscarlo.';

/** FR-015. */
export const MSG_BUSQUEDA_MUY_LARGA =
  'Tu búsqueda es demasiado larga. Prueba con una frase más corta.';

/** FR-014. */
export const MSG_LIMITE_BUSQUEDAS =
  'Hiciste demasiadas búsquedas seguidas. Espera unos minutos e inténtalo de nuevo.';

/** FR-016. */
export const MSG_BUSQUEDA_NO_DISPONIBLE =
  'No pudimos interpretar tu búsqueda en este momento. Mientras tanto, puedes usar los filtros del menú.';
```

## Qué no cambia

- `PriceTier`, `Dimension`, `ProductStatus`, `CategoryDto`, `CategoryRef` — sin modificar.
- `MenuQuery`, `MenuResponse`, `MenuService.consultar()` (E3) — sin cambios; la búsqueda por voz
  usa un método nuevo del lado del servidor (`candidatosParaBusqueda()`, ver `data-model.md`
  D-061), no estos tipos.
- `AddCartLineSchema`, `CartDto` (E2) — sin cambios; HU-13 los reutiliza tal cual desde el
  frontend (D-063), no agrega ningún esquema de carrito nuevo.
