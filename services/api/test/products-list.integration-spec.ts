/**
 * Listado de administración (T043, HU02-E14, FR-023, SC-024, D-022).
 *
 * Cuatro garantías: paginación de 20 con el total, **orden estable**, filtros
 * combinables y búsqueda parcial insensible a acentos y mayúsculas. El orden es
 * lo que hace determinista la paginación: sin él, un producto puede aparecer en
 * dos páginas o en ninguna.
 */
import { Dimension } from '@prisma/client';
import { PAGE_SIZE } from '@foodvoice/shared';
import {
  crearCategoria,
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';

describe('Paginación y orden (FR-023, SC-024, supuesto 14)', () => {
  let entorno: Entorno;
  let negocio: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima();

    // 25 productos, todos con la **misma** marca de tiempo si el motor va
    // rápido: es el caso que hace imprescindible el desempate por `id`.
    for (let i = 1; i <= 25; i += 1) {
      await crearProducto({
        name: `Producto ${String(i).padStart(2, '0')}`,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
        price: 1000 * i,
      });
    }
  });

  it('devuelve 20 por página con el total de resultados (HU02-E14, SC-024)', async () => {
    const respuesta = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);

    expect(respuesta.body.items).toHaveLength(PAGE_SIZE);
    expect(respuesta.body.total).toBe(25);
    expect(respuesta.body.page).toBe(1);
    expect(respuesta.body.pageSize).toBe(PAGE_SIZE);
    expect(respuesta.body.totalPages).toBe(2);
  });

  it('la segunda página trae el resto', async () => {
    const respuesta = await entorno.http().get(`${RUTA}?page=2`).set('Cookie', negocio).expect(200);
    expect(respuesta.body.items).toHaveLength(5);
  });

  it('**ningún producto aparece en dos páginas ni falta de ninguna**', async () => {
    const primera = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    const segunda = await entorno.http().get(`${RUTA}?page=2`).set('Cookie', negocio).expect(200);

    const ids = [...primera.body.items, ...segunda.body.items].map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(25);
  });

  it('el orden es **estable entre consultas idénticas**', async () => {
    const una = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    const otra = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);

    expect(una.body.items.map((p: { id: string }) => p.id)).toEqual(
      otra.body.items.map((p: { id: string }) => p.id),
    );
  });

  it('ordena del alta más reciente a la más antigua (FR-023)', async () => {
    const respuesta = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    const fechas = respuesta.body.items.map((p: { createdAt: string }) => p.createdAt);
    const descendente = [...fechas].sort().reverse();
    expect(fechas).toEqual(descendente);
  });

  it('una página fuera de rango devuelve 200 con la lista vacía y los valores reales', async () => {
    const respuesta = await entorno.http().get(`${RUTA}?page=9`).set('Cookie', negocio).expect(200);
    expect(respuesta.body.items).toHaveLength(0);
    expect(respuesta.body.total).toBe(25);
    expect(respuesta.body.totalPages).toBe(2);
  });

  it('rechaza una página menor que 1', async () => {
    await entorno.http().get(`${RUTA}?page=0`).set('Cookie', negocio).expect(400);
  });

  it('**no admite `pageSize`**: el tamaño de página no es elegible', async () => {
    const respuesta = await entorno
      .http()
      .get(`${RUTA}?pageSize=100`)
      .set('Cookie', negocio)
      .expect(200);
    expect(respuesta.body.items).toHaveLength(PAGE_SIZE);
  });
});

describe('Filtros y búsqueda (FR-023, D-022, supuesto 20)', () => {
  let entorno: Entorno;
  let negocio: string;
  let pizzas: string;
  let ensaladas: string;
  let saludable: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima();
    pizzas = foodType.id;
    const otra = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Ensaladas' });
    ensaladas = otra.id;
    const perfil = await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable' });
    saludable = perfil.id;

    await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: pizzas,
      healthProfileCategoryId: healthProfile.id,
      price: 8990,
    });
    await crearProducto({
      name: 'Pizza Ñoña Aji',
      foodTypeCategoryId: pizzas,
      healthProfileCategoryId: healthProfile.id,
      price: 6990,
      available: false,
    });
    await crearProducto({
      name: 'Ensalada César',
      foodTypeCategoryId: ensaladas,
      healthProfileCategoryId: saludable,
      price: 4990,
    });
    await crearProducto({
      name: 'Producto Retirado',
      foodTypeCategoryId: ensaladas,
      healthProfileCategoryId: saludable,
      price: 3990,
      active: false,
    });
  });

  const listar = (consulta = '') =>
    entorno.http().get(`${RUTA}${consulta}`).set('Cookie', negocio);

  it('**sin filtros muestra solo los activos** —disponibles y agotados— (supuesto 20)', async () => {
    const respuesta = await listar().expect(200);

    expect(respuesta.body.total).toBe(3);
    const nombres = respuesta.body.items.map((p: { name: string }) => p.name);
    expect(nombres).not.toContain('Producto Retirado');
    expect(nombres).toContain('Pizza Ñoña Aji');
  });

  it('el filtro de estado **recupera los dados de baja en un clic**', async () => {
    const respuesta = await listar('?status=DADO_DE_BAJA').expect(200);
    expect(respuesta.body.total).toBe(1);
    expect(respuesta.body.items[0].name).toBe('Producto Retirado');
  });

  it('filtra por disponible y por agotado por separado', async () => {
    const disponibles = await listar('?status=DISPONIBLE').expect(200);
    expect(disponibles.body.total).toBe(2);

    const agotados = await listar('?status=AGOTADO').expect(200);
    expect(agotados.body.total).toBe(1);
    expect(agotados.body.items[0].name).toBe('Pizza Ñoña Aji');
  });

  it('filtra por categoría de **cualquiera de las dos dimensiones**', async () => {
    const porTipo = await listar(`?categoryId=${pizzas}`).expect(200);
    expect(porTipo.body.total).toBe(2);

    const porPerfil = await listar(`?categoryId=${saludable}`).expect(200);
    expect(porPerfil.body.total).toBe(1);
    expect(porPerfil.body.items[0].name).toBe('Ensalada César');
  });

  it('busca por **coincidencia parcial**, sin acentos ni mayúsculas (SC-024)', async () => {
    for (const termino of ['napolitana', 'NAPOLITANA', 'napoli', 'Napolitána']) {
      const respuesta = await listar(`?search=${encodeURIComponent(termino)}`).expect(200);
      expect(respuesta.body.total).toBe(1);
      expect(respuesta.body.items[0].name).toBe('Pizza Napolitana');
    }
  });

  it('la búsqueda pliega la eñe, igual que el padrón de E1', async () => {
    const respuesta = await listar('?search=nona').expect(200);
    expect(respuesta.body.total).toBe(1);
    expect(respuesta.body.items[0].name).toBe('Pizza Ñoña Aji');
  });

  it('**un `%` se busca literalmente**, no devuelve el catálogo entero (D-011)', async () => {
    const respuesta = await listar('?search=%25').expect(200);
    expect(respuesta.body.total).toBe(0);
  });

  it('los filtros son **combinables entre sí**', async () => {
    const respuesta = await listar(`?categoryId=${pizzas}&status=AGOTADO`).expect(200);
    expect(respuesta.body.total).toBe(1);
    expect(respuesta.body.items[0].name).toBe('Pizza Ñoña Aji');
  });

  it('una combinación sin resultados devuelve la lista vacía, no un error', async () => {
    const respuesta = await listar(`?categoryId=${ensaladas}&search=napolitana`).expect(200);
    expect(respuesta.body.items).toHaveLength(0);
    expect(respuesta.body.total).toBe(0);
  });

  it('cada producto llega con su estado derivado y su tramo (FR-032)', async () => {
    const respuesta = await listar().expect(200);
    for (const producto of respuesta.body.items) {
      expect(['DISPONIBLE', 'AGOTADO', 'DADO_DE_BAJA']).toContain(producto.status);
      // Con tres activos de precios distintos, los tramos existen.
      expect(['ECONOMICO', 'MEDIO', 'CARO']).toContain(producto.priceTier);
    }
  });

  it('la descripción viaja **completa**: el recorte es solo de la interfaz (D-033)', async () => {
    const larga = `Masa delgada con salsa de tomate y mozzarella. ${'Detalle adicional del plato. '.repeat(10)}`.trim();
    await prisma.product.updateMany({ data: { description: larga } });

    const respuesta = await listar().expect(200);
    expect(respuesta.body.items[0].description).toBe(larga);
    expect(respuesta.body.items[0].description.length).toBeGreaterThan(160);
  });
});
