import { Prisma } from '@prisma/client';
import { PriceTier } from '@foodvoice/shared';

/**
 * Derivación de los tramos de precio (FR-032, RN-016, D-023).
 *
 * **No hay columna, ni tabla, ni índice de tramo**: se calcula en cada consulta a
 * partir de la distribución de precios de los productos **activos**. Un tramo
 * persistido envejece con la inflación y obliga a recalcular todo el catálogo
 * cada vez que cambia un precio.
 *
 * **Por qué vive en `products/` y no en `menu/`**: el plan lo situaba en
 * `menu.service.ts`, pero `ProductDto` lleva `priceTier` y es la única forma en
 * que un producto sale de la API —también desde el listado de administración—.
 * Si la derivación viviera en `menu`, o `products` tendría que importar `menu`
 * —invirtiendo la dependencia natural— o el listado de administración
 * devolvería `priceTier: null`, que **significa otra cosa**: que no hay tramos.
 * Aquí la usan los dos módulos y hay una sola implementación, que es
 * exactamente lo que `contracts/shared.md` busca al hacer que el tramo viaje
 * calculado desde el servidor.
 */

/**
 * Los dos precios de corte vigentes, o `null` cuando **no hay tramos**.
 *
 * `null` no es «no se pudo calcular»: es que el catálogo tiene menos de tres
 * productos activos o todos valen lo mismo, y entonces cada producto pertenece a
 * los tres tramos y una intención de precio no descarta ninguno (RN-016).
 */
export type Cortes = { c1: number; c2: number } | null;

/**
 * Calcula los cortes sobre **todos los productos activos, incluidos los
 * agotados** (supuesto 2).
 *
 * Contar solo los disponibles haría que el tramo de un producto cambiara cuando
 * **otro** se agota: un efecto que el negocio no entendería y que convertiría un
 * dato ya relativo en uno además volátil.
 *
 * Los cortes se obtienen con dos consultas `OFFSET … LIMIT 1` sobre el precio
 * ordenado, y no con `percentile_cont`: las funciones de ventana **interpolan**
 * entre valores y devolverían un corte que no es el precio de ningún producto, lo
 * que rompería el empate en el borde que la spec exige resolver de forma estable.
 */
export async function calcularCortes(tx: Prisma.TransactionClient): Promise<Cortes> {
  const n = await tx.product.count({ where: { active: true } });
  if (n < 3) return null;

  const posicion = async (indiceDesdeUno: number): Promise<number> => {
    const [fila] = await tx.product.findMany({
      where: { active: true },
      select: { price: true },
      // El desempate por `id` hace el orden total: sin él, dos productos con el
      // mismo precio podrían intercambiarse entre las dos consultas y devolver
      // cortes incoherentes entre sí.
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      skip: indiceDesdeUno - 1,
      take: 1,
    });
    // No puede faltar: `indiceDesdeUno` nunca supera `n`, que se acaba de contar
    // dentro de la misma transacción.
    return fila!.price;
  };

  const c1 = await posicion(Math.ceil(n / 3));
  const c2 = await posicion(Math.ceil((2 * n) / 3));

  // Todos los precios iguales: los tercios colapsan y **no hay tramos**. Se
  // detecta comparando los dos cortes con el máximo, y no contando precios
  // distintos, porque es la misma condición que la spec declara.
  if (c1 === c2) {
    const [maximo] = await tx.product.findMany({
      where: { active: true },
      select: { price: true },
      orderBy: { price: 'desc' },
      take: 1,
    });
    if (maximo!.price === c1) return null;
  }

  return { c1, c2 };
}

/**
 * A qué tramo pertenece un precio, dados los cortes.
 *
 * La clasificación depende **solo del valor del precio**, nunca de la posición
 * del producto en una lista: es lo que garantiza que dos productos con el mismo
 * precio caigan siempre en el mismo tramo, sin importar el orden en que se listen
 * (§ Casos Límite, empate en el borde del tercio).
 */
export function tramoDe(precio: number, cortes: Cortes): PriceTier | null {
  if (!cortes) return null;
  if (precio <= cortes.c1) return PriceTier.ECONOMICO;
  if (precio <= cortes.c2) return PriceTier.MEDIO;
  return PriceTier.CARO;
}

/**
 * Condición SQL del filtro por tramo, para aplicarlo **en la consulta** y no
 * filtrando en memoria lo que ya se trajo.
 *
 * Con `cortes` a `null` devuelve `{}`: no hay tramos, de modo que una intención
 * de precio **no descarta ningún producto** (RN-016, HU14-E14, SC-017). Devolver
 * una condición imposible sería el error contrario y dejaría el menú vacío.
 */
export function filtroDeTramo(
  tramo: PriceTier | undefined,
  cortes: Cortes,
): Prisma.ProductWhereInput {
  if (!tramo || !cortes) return {};

  if (tramo === PriceTier.ECONOMICO) return { price: { lte: cortes.c1 } };
  if (tramo === PriceTier.MEDIO) return { price: { gt: cortes.c1, lte: cortes.c2 } };
  return { price: { gt: cortes.c2 } };
}
