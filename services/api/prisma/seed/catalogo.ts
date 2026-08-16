/**
 * Semilla del catálogo (T074, T075, FR-036, D-028, SC-026, SC-032).
 *
 * **Idempotente por nombre normalizado**: cada registro se busca por su
 * `nameNormalized` —y por `(dimension, nameNormalized)` en las categorías—; si
 * existe, **no se toca**, y si no, se crea. Reconocer por nombre normalizado y no
 * por identificador es lo que permite reejecutarla sobre una base donde alguien
 * ya cargó el catálogo real sin duplicar «Pizza Napolitana» junto a «pizza
 * napolitana».
 *
 * **No sobrescribe cambios hechos a mano** (supuesto 15): si el negocio editó la
 * descripción de un producto de la semilla, la siguiente ejecución la respeta. La
 * contrapartida está declarada en D-028: si lo **renombra**, la semilla lo vuelve
 * a crear con el nombre original y quedan dos. Se acepta porque la semilla es una
 * herramienta de arranque y de demostración, no de sincronización.
 *
 * **Por qué el contenido importa más que el código de este archivo.** El riesgo
 * real de E3 no está en el esquema sino en la calidad del contenido: sin un
 * catálogo verosímil, E6 no se puede verificar a mano por una persona no técnica
 * y las frases del Principio VII no se pueden probar. Por eso cada descripción
 * cumple dos criterios que ninguna prueba automática comprueba y que se revisaron
 * leyéndolas una a una (SC-032, paso V-49):
 *
 * 1. **Menciona algo que su nombre no dice.** «Pizza Napolitana: pizza
 *    napolitana rica» cumpliría FR-039 y no serviría de nada; lo que hay aquí
 *    dice de qué está hecha, cómo se prepara o a qué sabe.
 * 2. **Cada campo de ingredientes enumera al menos tres componentes
 *    reconocibles**, no adjetivos ni frases: «masa, mozzarella, tomate» cumple;
 *    «ingredientes frescos de primera calidad» no.
 *
 * Los precios están repartidos a propósito para que **los tres tramos existan de
 * verdad** sobre estos doce productos (FR-032, SC-026): con doce activos los
 * cortes caen en el cuarto y el octavo precio, de modo que cada tramo queda con
 * cuatro productos y ningún filtro de precio devuelve el catálogo entero.
 */
import { Dimension, PrismaClient } from '@prisma/client';
import { normalizarBusqueda } from '@foodvoice/shared';

type CategoriaSemilla = {
  dimension: Dimension;
  name: string;
  description: string;
};

type ProductoSemilla = {
  name: string;
  description: string;
  ingredients: string;
  price: number;
  foodType: string;
  healthProfile: string;
};

/** Tres categorías activas por dimensión, el mínimo exigible de FR-036. */
const CATEGORIAS: readonly CategoriaSemilla[] = [
  {
    dimension: Dimension.TIPO_COMIDA,
    name: 'Pizzas',
    description:
      'Masas horneadas a alta temperatura, con base de salsa de tomate y distintas combinaciones de quesos, verduras y carnes.',
  },
  {
    dimension: Dimension.TIPO_COMIDA,
    name: 'Sándwiches',
    description:
      'Preparaciones servidas en pan, con carnes, quesos o verduras salteadas, pensadas para comer con la mano.',
  },
  {
    dimension: Dimension.TIPO_COMIDA,
    name: 'Ensaladas',
    description:
      'Platos fríos de hojas, verduras y legumbres, con aderezos livianos y proteínas opcionales para armar un almuerzo completo.',
  },
  {
    dimension: Dimension.PERFIL_SALUD,
    name: 'Saludable',
    description:
      'Preparaciones bajas en frituras y azúcares añadidos, con predominio de verduras, legumbres y cocciones al vapor o a la plancha.',
  },
  {
    dimension: Dimension.PERFIL_SALUD,
    name: 'Equilibrado',
    description:
      'Platos que combinan proteína, carbohidrato y verdura en porciones moderadas, sin restricciones especiales ni excesos.',
  },
  {
    dimension: Dimension.PERFIL_SALUD,
    name: 'Indulgente',
    description:
      'Preparaciones abundantes, con quesos derretidos, frituras o salsas cremosas, pensadas para darse un gusto.',
  },
];

/**
 * Doce productos activos, cuatro por cada categoría de tipo de comida y cuatro
 * por cada perfil de salud, de modo que **ninguna categoría de la semilla quede
 * sin productos** y un filtro combinado siempre devuelva algo.
 */
const PRODUCTOS: readonly ProductoSemilla[] = [
  // --- Tramo económico: los cuatro precios más bajos del catálogo ---
  {
    name: 'Sándwich Chacarero',
    description:
      'Lomo de vacuno a la plancha con porotos verdes cocidos, tomate en rodajas y un toque de ají verde, servido en pan frica.',
    ingredients: 'Pan frica, lomo de vacuno, porotos verdes, tomate, ají verde',
    price: 3490,
    foodType: 'Sándwiches',
    healthProfile: 'Indulgente',
  },
  {
    name: 'Sándwich Vegetariano de Berenjena',
    description:
      'Rodajas de berenjena asadas al horno con pimentón, hummus casero y hojas de rúcula sobre pan integral.',
    ingredients: 'Pan integral, berenjena, pimentón asado, hummus de garbanzos, rúcula',
    price: 3990,
    foodType: 'Sándwiches',
    healthProfile: 'Saludable',
  },
  {
    name: 'Sándwich de Pollo Grillado',
    description:
      'Pechuga marinada en limón y orégano, cocida a la plancha, con lechuga crespa y mayonesa de yogur.',
    ingredients: 'Pan de molde, pechuga de pollo, lechuga, tomate, mayonesa de yogur',
    price: 4290,
    foodType: 'Sándwiches',
    healthProfile: 'Equilibrado',
  },
  {
    name: 'Ensalada Caprese',
    description:
      'Tomates de estación en rodajas gruesas alternados con mozzarella fresca, albahaca y un hilo de aceite de oliva.',
    ingredients: 'Tomate, mozzarella fresca, albahaca, aceite de oliva, sal de mar',
    price: 4590,
    foodType: 'Ensaladas',
    healthProfile: 'Equilibrado',
  },

  // --- Tramo medio ---
  {
    name: 'Ensalada Mediterránea',
    description:
      'Mezcla de hojas verdes con aceitunas negras, pepino, cebolla morada y queso feta desmenuzado, aliñada con limón.',
    ingredients: 'Hojas verdes, aceitunas negras, pepino, cebolla morada, queso feta',
    price: 5490,
    foodType: 'Ensaladas',
    healthProfile: 'Saludable',
  },
  {
    name: 'Ensalada César con Pollo',
    description:
      'Lechuga romana crujiente con láminas de parmesano, croutones tostados al horno y pollo a la plancha en tiras.',
    ingredients: 'Lechuga romana, pollo, queso parmesano, croutones, aderezo césar',
    price: 5990,
    foodType: 'Ensaladas',
    healthProfile: 'Equilibrado',
  },
  {
    name: 'Ensalada de Quinoa y Palta',
    description:
      'Quinoa cocida y fría mezclada con palta en cubos, choclo, cilantro fresco y jugo de limón de Pica.',
    ingredients: 'Quinoa, palta, choclo, cilantro, limón',
    price: 6490,
    foodType: 'Ensaladas',
    healthProfile: 'Saludable',
  },
  {
    name: 'Sándwich Barros Luco',
    description:
      'Lomo de vacuno caliente cubierto con queso mantecoso derretido sobre el pan, sin verduras que interrumpan.',
    ingredients: 'Pan frica, lomo de vacuno, queso mantecoso, mantequilla',
    price: 6990,
    foodType: 'Sándwiches',
    healthProfile: 'Indulgente',
  },

  // --- Tramo caro: los cuatro precios más altos ---
  {
    name: 'Pizza de Verduras Asadas',
    description:
      'Base de tomate con zapallo italiano, pimentón y cebolla morada asados previamente al horno para concentrar su dulzor.',
    ingredients: 'Masa, salsa de tomate, mozzarella, zapallo italiano, pimentón, cebolla morada',
    price: 7990,
    foodType: 'Pizzas',
    healthProfile: 'Equilibrado',
  },
  {
    name: 'Pizza de Champiñones y Rúcula',
    description:
      'Champiñones salteados con ajo sobre base blanca, terminada con hojas de rúcula fresca agregadas recién salida del horno.',
    ingredients: 'Masa, mozzarella, champiñones, ajo, rúcula, aceite de oliva',
    price: 8490,
    foodType: 'Pizzas',
    healthProfile: 'Saludable',
  },
  {
    name: 'Pizza Napolitana',
    description:
      'Masa delgada de fermentación lenta con salsa de tomate San Marzano, mozzarella fresca y hojas de albahaca.',
    ingredients: 'Masa, salsa de tomate, mozzarella fresca, albahaca, aceite de oliva',
    price: 8990,
    foodType: 'Pizzas',
    healthProfile: 'Indulgente',
  },
  {
    name: 'Pizza Cuatro Quesos',
    description:
      'Combinación de mozzarella, gorgonzola, parmesano y queso de cabra fundidos sobre base blanca, sin salsa de tomate.',
    ingredients: 'Masa, mozzarella, gorgonzola, parmesano, queso de cabra',
    price: 10990,
    foodType: 'Pizzas',
    healthProfile: 'Indulgente',
  },
];

/**
 * Carga el catálogo de referencia, respetando lo que ya exista.
 *
 * Recibe el cliente en lugar de crear el suyo para poder encadenarse con la
 * semilla del administrador de E1 en una sola ejecución de `db:seed` (T076).
 */
export async function sembrarCatalogo(prisma: PrismaClient): Promise<void> {
  const categorias = new Map<string, string>();

  for (const categoria of CATEGORIAS) {
    const nameNormalized = normalizarBusqueda(categoria.name);

    // Reconocimiento por `(dimension, nameNormalized)`, que es exactamente la
    // clave del índice único: la semilla no puede chocar con una restricción que
    // ella misma podría haber comprobado.
    const existente = await prisma.category.findFirst({
      where: { dimension: categoria.dimension, nameNormalized },
    });

    const fila =
      existente ??
      (await prisma.category.create({
        data: {
          dimension: categoria.dimension,
          name: categoria.name,
          nameNormalized,
          description: categoria.description,
          active: true,
        },
      }));

    categorias.set(categoria.name, fila.id);
    console.log(
      existente
        ? `Semilla del catálogo: la categoría «${categoria.name}» ya existe. No se modificó nada.`
        : `Semilla del catálogo: categoría «${categoria.name}» creada.`,
    );
  }

  for (const producto of PRODUCTOS) {
    const nameNormalized = normalizarBusqueda(producto.name);

    const existente = await prisma.product.findUnique({ where: { nameNormalized } });
    if (existente) {
      console.log(
        `Semilla del catálogo: el producto «${producto.name}» ya existe. No se modificó nada.`,
      );
      continue;
    }

    const foodTypeCategoryId = categorias.get(producto.foodType);
    const healthProfileCategoryId = categorias.get(producto.healthProfile);
    if (!foodTypeCategoryId || !healthProfileCategoryId) {
      // No puede ocurrir con los datos de este archivo, y si ocurriera sería un
      // error de la semilla y no del entorno: se falla en voz alta en lugar de
      // dejar un catálogo a medias.
      throw new Error(
        `Semilla del catálogo: el producto «${producto.name}» referencia una categoría que no se cargó.`,
      );
    }

    await prisma.product.create({
      data: {
        name: producto.name,
        nameNormalized,
        description: producto.description,
        ingredients: producto.ingredients,
        price: producto.price,
        foodTypeCategoryId,
        healthProfileCategoryId,
        // Activos y disponibles desde el arranque: el catálogo de referencia
        // tiene que ser consultable sin ninguna acción previa (RN-007).
        active: true,
        available: true,
      },
    });
    console.log(`Semilla del catálogo: producto «${producto.name}» creado.`);
  }
}

/** Expuestos para que la batería de integración compruebe los mínimos declarados. */
export const MINIMOS_SEMILLA = {
  categoriasPorDimension: 3,
  productos: PRODUCTOS.length,
} as const;
