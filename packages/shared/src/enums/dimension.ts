/**
 * Dimensiones de clasificación, tramos de precio y estado visible del producto
 * (FR-001, FR-032, D-020, D-024).
 *
 * Se declaran como objetos `as const` y no con `enum` de TypeScript, siguiendo
 * la convención que E1 fijó en `enums/role.ts`: el contrato de
 * `contracts/shared.md` los escribió como `enum` por brevedad, pero el código
 * vigente del paquete no usa esa construcción en ningún sitio y mezclar las dos
 * formas obligaría a recordar cuál se aplica a cada enum.
 */

/**
 * Las dos preguntas fijas que se le hacen a cada producto (FR-001, RN-013).
 *
 * **No son administrables por ningún rol en v1**: no se crean, no se editan, no
 * se desactivan y no se reordenan desde la aplicación. Cada una tiene un
 * desplegable propio en el alta de productos y un filtro propio en el menú, de
 * modo que hacerlas datos obligaría a generar formularios y filtros dinámicos
 * —complejidad anticipada sin requisito que la pida (Principio I, Principio III)—.
 *
 * Añadir una tercera dimensión sería una migración —enum, columna en `product`,
 * desplegable y filtro—, no una fila. Es la contrapartida aceptada de D-024.
 */
export const Dimension = {
  TIPO_COMIDA: 'TIPO_COMIDA',
  PERFIL_SALUD: 'PERFIL_SALUD',
} as const;

export type Dimension = (typeof Dimension)[keyof typeof Dimension];

/**
 * Tramo de precio (FR-032, RN-016, D-023).
 *
 * Existe **solo para nombrar el filtro** de la consulta y sus etiquetas
 * visibles. **No hay columna, ni tabla, ni índice**: el tramo se deriva en cada
 * consulta a partir de la distribución de precios de los productos activos. Un
 * tramo persistido envejece con la inflación y obliga a recalcular todo el
 * catálogo cada vez que cambia un precio.
 *
 * Con menos de tres productos activos, o con todos al mismo precio, **no hay
 * tramos**: cada producto pertenece a los tres y una intención de precio no
 * descarta ninguno.
 */
export const PriceTier = {
  ECONOMICO: 'ECONOMICO',
  MEDIO: 'MEDIO',
  CARO: 'CARO',
} as const;

export type PriceTier = (typeof PriceTier)[keyof typeof PriceTier];

/**
 * Estado visible del producto, derivado de `active` y `available`
 * (§ Vocabulario visible del catálogo, data-model.md § Los dos interruptores).
 *
 * **No es una columna.** Es la proyección de los dos booleanos, declarada aquí
 * para que la interfaz y el filtro del listado de administración usen los mismos
 * tres valores y nadie los derive dos veces con criterios distintos.
 */
export const ProductStatus = {
  DISPONIBLE: 'DISPONIBLE',
  AGOTADO: 'AGOTADO',
  DADO_DE_BAJA: 'DADO_DE_BAJA',
} as const;

export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

/**
 * Deriva el estado visible de los dos interruptores.
 *
 * Vive junto al enum, y no en la API ni en la interfaz, porque es la **única**
 * traducción admitida de la tabla de data-model.md: un producto dado de baja es
 * «Dado de baja» con independencia de su `available`, que conserva tal como
 * estaba para que la reactivación lo devuelva al estado disponible (FR-020).
 */
export function derivarEstadoProducto(producto: {
  active: boolean;
  available: boolean;
}): ProductStatus {
  if (!producto.active) return ProductStatus.DADO_DE_BAJA;
  return producto.available ? ProductStatus.DISPONIBLE : ProductStatus.AGOTADO;
}
