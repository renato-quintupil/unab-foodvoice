# Contrato de `packages/shared`: catálogo (E3)

Amplía la superficie pública declarada en
[`../../001-acceso-y-usuarios/contracts/shared.md`](../../001-acceso-y-usuarios/contracts/shared.md).
Se mantiene la regla que define el paquete: **ningún acceso a base de datos, cliente Prisma,
lógica de red ni componente de interfaz**. Todo su código debe poder ejecutarse igual en el
navegador y en Node.

## Enums

```ts
export enum Dimension {
  TIPO_COMIDA = 'TIPO_COMIDA',
  PERFIL_SALUD = 'PERFIL_SALUD',
}

/** Derivado en cada consulta; nunca se persiste (FR-032, D-023). */
export enum PriceTier {
  ECONOMICO = 'ECONOMICO',
  MEDIO = 'MEDIO',
  CARO = 'CARO',
}

/** Estado visible del producto, derivado de `active` y `available`. */
export enum ProductStatus {
  DISPONIBLE = 'DISPONIBLE',
  AGOTADO = 'AGOTADO',
  DADO_DE_BAJA = 'DADO_DE_BAJA',
}
```

`ProductStatus` **no es una columna** (ver [`../data-model.md`](../data-model.md)): es la
proyección de los dos booleanos, definida aquí para que la interfaz y el filtro del listado de
administración usen los mismos tres valores y nadie los derive dos veces con criterios
distintos.

## Validación de la descripción (FR-039)

El corazón de la épica, y la razón por la que esta regla vive en el paquete compartido: el
formulario del navegador y el controlador de NestJS ejecutan **el mismo código**, de modo que no
puede existir una descripción que la interfaz acepte y la API rechace.

```ts
/**
 * Valida una descripción: mínimo y máximo de caracteres más las tres
 * condiciones de sustancia de FR-039. Se aplica al objeto y no al campo
 * suelto, porque la tercera condición necesita ver también el nombre.
 */
export function validarDescripcion(
  descripcion: string,
  nombre: string,
  limites: { minimo: number; maximo: number },
): { valida: true } | { valida: false; motivo: MotivoDescripcion };

export type MotivoDescripcion =
  | 'AUSENTE'          // vacía o solo espacios
  | 'DEMASIADO_CORTA'
  | 'DEMASIADO_LARGA'
  | 'POCAS_PALABRAS'   // menos de 5 palabras de 2+ caracteres
  | 'PALABRAS_REPETIDAS' // menos de 5 palabras distintas entre sí
  | 'REPITE_EL_NOMBRE';  // igual al nombre, o lo contiene sin añadir nada
```

Cada motivo tiene su propio mensaje en español, porque FR-039 exige que el rechazo diga **cuál
de las condiciones falló**. La comparación con el nombre usa `normalizarBusqueda`, de modo que
«Pizza Napolitana» y «pizza napolitana» son el mismo texto a estos efectos.

Los límites se pasan como parámetro y no se codifican dentro: producto es 20–1.000 y categoría
30–500, y una sola implementación sirve a las dos.

## Esquemas Zod

```ts
export const CreateCategorySchema: ZodType<CreateCategoryInput>;
export const UpdateCategorySchema: ZodType<UpdateCategoryInput>; // sin `dimension`
export const CreateProductSchema:  ZodType<CreateProductInput>;
export const UpdateProductSchema:  ZodType<UpdateProductInput>;
export const ChangeAvailabilitySchema: ZodType<{ available: boolean }>;
export const ChangeProductStatusSchema: ZodType<{ active: boolean }>;
export const ChangeCategoryStatusSchema: ZodType<{ active: boolean }>;
```

Reglas que los esquemas aplican, todas remitidas a § Límites de los campos de la spec:

| Campo | Regla |
|---|---|
| `name` (producto) | 2–120, recortado |
| `name` (categoría) | 2–60, recortado |
| `description` | Los límites de su entidad, más `validarDescripcion` |
| `ingredients` | Opcional, hasta 500. Solo espacios se trata como ausente |
| `price` | Entero, 1–10.000.000. **Rechaza decimales, no los redondea** (FR-015) |
| `foodTypeCategoryId`, `healthProfileCategoryId` | UUID, obligatorios |
| `dimension` | Solo en el alta; `UpdateCategorySchema` **no la incluye** (FR-006) |

`UpdateCategorySchema` omite `dimension` en lugar de aceptarla y rechazarla: un campo que el
esquema no conoce se descarta en silencio, con la regla de E1 sobre campos desconocidos, y así
la imposibilidad de cambiar la dimensión es estructural.

## Consultas

```ts
export const ListProductsQuerySchema: ZodType<ListProductsQuery>;
export const ListCategoriesQuerySchema: ZodType<ListCategoriesQuery>;
export const MenuQuerySchema: ZodType<MenuQuery>;
```

`ListProductsQuery` reutiliza el `PAGE_SIZE` compartido de E1 y **no expone `pageSize` ni
parámetros de orden**, igual que `ListUsersQuery`. `MenuQuery` **no tiene `page`**: el menú no
se pagina (D-029, FR-031).

## Formato del precio

```ts
/** Devuelve "$4.990": punto de miles, sin decimales (§ Presentación del precio). */
export function formatearPrecio(valor: number): string;
```

Única fuente del formato. Ninguna pantalla lo compone a mano, con el mismo criterio con que E1
centralizó el formato de fechas. **Es solo presentación**: el dato viaja y se guarda como
entero desnudo, y el campo de entrada del formulario no aplica el formato mientras se escribe.

## Mensajes fijos en español

Se añaden a `messages/es.ts`. Este documento los referencia **por nombre y nunca reproduce su
texto**, por la misma razón que en E1: una copia aquí sería una segunda fuente que podría
divergir sin que ninguna prueba lo notara.

| Situación | Constante | Requisito |
|---|---|---|
| Nombre de categoría duplicado en su dimensión | `MSG_CATEGORIA_YA_EXISTE` | FR-004 |
| Nombre de producto duplicado | `MSG_PRODUCTO_YA_EXISTE` | FR-014 |
| Categoría en uso, con el conteo de bloqueadores | `MSG_CATEGORIA_EN_USO` | FR-007 |
| Categoría desactivada al guardar o reactivar, nombrando la dimensión | `MSG_CATEGORIA_INACTIVA` | FR-012, FR-021 |
| Dimensión sin ninguna categoría activa, en el alta | `MSG_DIMENSION_SIN_CATEGORIAS` | FR-012, HU14-E19 |
| Menú sin ningún producto activo | `MSG_MENU_VACIO` | FR-030 |
| Filtros o búsqueda sin resultados | `MSG_SIN_RESULTADOS_CATALOGO` | FR-035 |
| Advertencia junto a los ingredientes | `MSG_INGREDIENTES_REFERENCIALES` | FR-017, RN-019 |
| Ayuda del campo de descripción (producto y categoría) | `AYUDA_DESCRIPCION_PRODUCTO`, `AYUDA_DESCRIPCION_CATEGORIA` | FR-005, FR-016 |
| Cada motivo de rechazo de la descripción | `MSG_DESCRIPCION_*`, uno por `MotivoDescripcion` | FR-039 |

`MSG_CATEGORIA_EN_USO` y `MSG_CATEGORIA_INACTIVA` son **funciones** y no cadenas, porque su
texto incorpora un dato variable —el número de productos que bloquean, el nombre visible de la
dimensión—. Siguen siendo la única fuente de su redacción.

Las constantes de ayuda contienen el **ejemplo completo y la explicación** que FR-005 y FR-016
exigen mostrar junto al campo. Que vivan aquí y no en cada formulario es lo que garantiza que
las dos pantallas enseñen lo mismo y que SC-019 se pueda comprobar en un solo sitio.

## Etiquetas visibles

Se añaden a `messages/etiquetas.ts`, siguiendo el patrón de `ETIQUETA_ROL` y `ETIQUETA_ESTADO`:

```ts
export const ETIQUETA_DIMENSION: Record<Dimension, string>;      // «Tipo de comida», «Perfil de salud»
export const ETIQUETA_TRAMO: Record<PriceTier, string>;          // «Económico», «Medio», «Caro»
export const ETIQUETA_ESTADO_PRODUCTO: Record<ProductStatus, string>; // «Disponible», «Agotado», «Dado de baja»
export const ETIQUETA_ESTADO_CATEGORIA: Record<'ACTIVA' | 'DESACTIVADA', string>;
```

Estas cuatro tablas son la implementación de § Vocabulario visible del catálogo, que prohíbe
expresamente los sinónimos: «eliminar», «borrar», «sin stock», «no disponible», «suspendido»,
«archivar», «eje», «faceta». Al estar centralizadas, el vocabulario no se improvisa pantalla a
pantalla y la prohibición es revisable en un solo archivo.

## Tipos de transferencia

```ts
export type CategoryDto = {
  id: string;
  dimension: Dimension;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;   // ISO 8601 en UTC
};

export type ProductDto = {
  id: string;
  name: string;
  description: string;
  ingredients: string | null;
  price: number;                 // entero en pesos chilenos
  foodTypeCategory: CategoryRef;
  healthProfileCategory: CategoryRef;
  active: boolean;
  available: boolean;
  status: ProductStatus;         // derivado, por conveniencia de la interfaz
  priceTier: PriceTier | null;   // null cuando no hay tramos (RN-016)
  createdAt: string;
};

export type CategoryRef = Pick<CategoryDto, 'id' | 'name' | 'dimension'>;
```

Tres decisiones sobre esta forma:

1. **No expone `nameNormalized`**: es un detalle de almacenamiento (D-021), no información de
   dominio.
2. **No expone `updatedAt`**: metadato operativo sin superficie funcional, mismo criterio que
   `UserDto` en E1.
3. **`status` y `priceTier` son derivados y viajan calculados.** Podrían computarse en el
   cliente, pero entonces habría dos implementaciones de la misma regla —una en la interfaz y
   otra en la API para la futura voz de E6— y bastaría que una cambiara para que un producto
   apareciera en distinto tramo según quién preguntara. `priceTier` es `null` cuando no hay
   tramos, que es distinto de pertenecer a uno.

`ProductDto` es la **única** forma en que un producto sale de la API, y por eso RN-018 se
sostiene de forma estructural: los productos con `active = false` no se excluyen campo a campo,
sencillamente no se construye ningún `ProductDto` para ellos en las rutas de `/menu`.

## Compatibilidad

`normalizarBusqueda` alimenta ahora **tres** columnas persistidas: `user.search_normalized`,
`category.name_normalized` y `product.name_normalized`. La advertencia que ya lleva la función
se extiende a las dos nuevas: **cambiarla exige una migración que repueble las tres**. Sin ella,
unos nombres colisionarían y otros no, sin error ni excepción que lo delate.
