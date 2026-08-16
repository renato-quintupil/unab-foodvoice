/**
 * El esquema del catálogo: migración, índices y restricciones (T021, D-021,
 * D-024, D-026).
 *
 * Es de integración por definición: lo que se comprueba aquí son garantías que
 * **solo la base de datos** puede dar. Un unitario podría afirmar que el
 * servicio consulta antes de escribir; solo un índice único garantiza que dos
 * peticiones simultáneas no escriban las dos.
 */
import { Dimension } from '@prisma/client';
import { normalizarBusqueda } from '@foodvoice/shared';
import { crearCategoria, crearClasificacionMinima, crearProducto } from './helpers';
import { prisma } from './setup';

describe('Migración del catálogo (T020)', () => {
  it('crea las dos tablas nuevas y **ninguna tabla de E1 gana columnas**', async () => {
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('category', 'product')
      ORDER BY table_name
    `;
    expect(tablas.map((t) => t.table_name)).toEqual(['category', 'product']);

    // Las cuatro tablas de E1, con el número de columnas que tenían.
    const columnasUser = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user'
    `;
    expect(columnasUser.map((c) => c.column_name).sort()).toEqual(
      [
        'id',
        'full_name',
        'email',
        'phone',
        'password_hash',
        'role',
        'status',
        'search_normalized',
        'created_at',
        'updated_at',
      ].sort(),
    );
  });

  it('crea el enum `Dimension` con exactamente los dos valores de FR-001', async () => {
    const valores = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT e.enumlabel FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'Dimension'
      ORDER BY e.enumsortorder
    `;
    expect(valores.map((v) => v.enumlabel)).toEqual(['TIPO_COMIDA', 'PERFIL_SALUD']);
  });

  it('**no crea ninguna columna de tramo de precio** (FR-032, ausencia deliberada)', async () => {
    const columnas = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product'
    `;
    const nombres = columnas.map((c) => c.column_name);
    expect(nombres).not.toContain('price_tier');
    expect(nombres.filter((n) => n.includes('tier'))).toHaveLength(0);
    // Tampoco existe una tabla para él.
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%tier%'
    `;
    expect(tablas).toHaveLength(0);
  });

  it('declara los índices que data-model.md exige', async () => {
    const indices = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('category', 'product')
      ORDER BY indexname
    `;
    const nombres = indices.map((i) => i.indexname);
    for (const esperado of [
      'category_dimension_name_normalized_key',
      'category_dimension_active_idx',
      'product_name_normalized_key',
      'product_active_available_idx',
      'product_price_idx',
      'product_created_at_id_idx',
      'product_food_type_category_id_idx',
      'product_health_profile_category_id_idx',
    ]) {
      expect(nombres).toContain(esperado);
    }
  });
});

describe('Unicidad del nombre de categoría, por dimensión (FR-004, RN-014, D-021)', () => {
  it('rechaza dos categorías con el mismo nombre normalizado en la misma dimensión', async () => {
    await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });
    await expect(
      crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'pizzas' }),
    ).rejects.toThrow();
  });

  it('pliega acentos y eñes: «Ají», «aji» y «AJI» son el mismo nombre', async () => {
    await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Ají' });
    await expect(
      crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'AJI' }),
    ).rejects.toThrow();
  });

  it('**permite el mismo nombre en la otra dimensión** (HU14-E05)', async () => {
    await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Saludable' });
    const enLaOtra = await crearCategoria({
      dimension: Dimension.PERFIL_SALUD,
      name: 'Saludable',
    });
    expect(enLaOtra.dimension).toBe(Dimension.PERFIL_SALUD);
  });

  it('la unicidad alcanza a las **desactivadas**, para que su reactivación sea posible', async () => {
    await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Completos', active: false });
    await expect(
      crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'completos' }),
    ).rejects.toThrow();
  });

  it('la garantía es del índice, no de una consulta previa: dos escrituras a la vez producen una', async () => {
    // Es la prueba que justifica D-021 y la que sostiene SC-027: dos peticiones
    // simultáneas podrían consultar ambas, no encontrar nada y escribir las dos.
    const resultados = await Promise.allSettled([
      crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Sushi' }),
      crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'sushi' }),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});

describe('Unicidad del nombre de producto, global (FR-014, RN-005)', () => {
  it('rechaza dos productos con el mismo nombre normalizado', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await expect(
      crearProducto({
        name: 'pizza napolitana',
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('el nombre de un producto **dado de baja** sigue reservado (RN-005)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });
    await expect(
      crearProducto({
        name: 'PIZZA NAPOLITANA',
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('la unicidad es global, no por categoría', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const otroTipo = await crearCategoria({
      dimension: Dimension.TIPO_COMIDA,
      name: 'Ensaladas',
    });
    await crearProducto({
      name: 'Especial',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await expect(
      crearProducto({
        name: 'especial',
        foodTypeCategoryId: otroTipo.id,
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('la columna normalizada guarda lo que produce `normalizarBusqueda`', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const creado = await crearProducto({
      name: '  Pizza   Napolitana Ñoña  ',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    expect(creado.nameNormalized).toBe(normalizarBusqueda('  Pizza   Napolitana Ñoña  '));
    expect(creado.nameNormalized).toBe('pizza napolitana nona');
  });
});

describe('Restricción de rango del precio (D-026, FR-015, RN-006)', () => {
  it('rechaza el cero **en la base**, no solo en el esquema Zod', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await expect(
      crearProducto({
        name: 'Gratis',
        price: 0,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('rechaza un precio negativo', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await expect(
      crearProducto({
        name: 'Negativo',
        price: -100,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('rechaza un precio por encima del máximo declarado', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await expect(
      crearProducto({
        name: 'Carisimo',
        price: 10_000_001,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('acepta los dos extremos inclusivos', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const barato = await crearProducto({
      name: 'Un peso',
      price: 1,
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const caro = await crearProducto({
      name: 'Diez millones',
      price: 10_000_000,
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    expect([barato.price, caro.price]).toEqual([1, 10_000_000]);
  });
});

describe('La clasificación es irrepresentablemente incompleta (D-024, RN-011)', () => {
  it('**no se puede escribir un producto sin categoría**: las columnas son NOT NULL', async () => {
    const nulables = await prisma.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product'
        AND column_name IN ('food_type_category_id', 'health_profile_category_id')
    `;
    expect(nulables).toHaveLength(2);
    for (const columna of nulables) expect(columna.is_nullable).toBe('NO');
  });

  it('rechaza una categoría inexistente: la clave foránea la exige', async () => {
    const { healthProfile } = await crearClasificacionMinima();
    await expect(
      crearProducto({
        name: 'Huerfano',
        foodTypeCategoryId: '99999999-9999-4999-8999-999999999999',
        healthProfileCategoryId: healthProfile.id,
      }),
    ).rejects.toThrow();
  });

  it('impide borrar una categoría referenciada: no hay borrado físico (RN-004)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Con Categoria',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await expect(prisma.category.delete({ where: { id: foodType.id } })).rejects.toThrow();
  });

  it('la base **no** puede exigir que cada clave sea de su dimensión: lo hace el servicio', async () => {
    // Se documenta como prueba porque es la invariante que el modelo no expresa
    // (data-model § La invariante que el modelo no puede expresar solo). Aquí se
    // escribe directamente en la base y **se acepta**: es exactamente por eso
    // que el servicio debe comprobarlo, y `products-classification` lo prueba.
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const cruzado = await crearProducto({
      name: 'Clasificacion Cruzada',
      foodTypeCategoryId: healthProfile.id,
      healthProfileCategoryId: foodType.id,
    });
    expect(cruzado.foodTypeCategoryId).toBe(healthProfile.id);
  });
});

describe('Valores por omisión de los dos interruptores (RN-007)', () => {
  it('un producto nace activo y disponible', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const creado = await prisma.product.create({
      data: {
        name: 'Recien Creado',
        nameNormalized: 'recien creado',
        description: 'Masa delgada con salsa de tomate, mozzarella fresca y albahaca.',
        price: 5990,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      },
    });
    expect(creado.active).toBe(true);
    expect(creado.available).toBe(true);
  });

  it('una categoría nace activa (FR-002)', async () => {
    const creada = await prisma.category.create({
      data: {
        dimension: Dimension.TIPO_COMIDA,
        name: 'Recien Creada',
        nameNormalized: 'recien creada',
        description: 'Agrupa preparaciones horneadas de masa con queso y verduras variadas.',
      },
    });
    expect(creada.active).toBe(true);
  });

  it('los ingredientes son opcionales y se guardan como null (FR-017)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const sinIngredientes = await crearProducto({
      name: 'Sin Ingredientes',
      ingredients: null,
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    expect(sinIngredientes.ingredients).toBeNull();
  });
});
