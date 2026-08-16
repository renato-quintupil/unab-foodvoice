/**
 * Filtros del menú y su combinación (T059, FR-031, FR-033, FR-035, HU14-E17,
 * SC-018, SC-025, D-029).
 *
 * Lo que esta batería protege es que la combinación sea **conjuntiva**: pedir
 * «pizza saludable y económica» devuelve solo lo que cumple las tres condiciones,
 * y **nunca** sustituye el resultado por productos que cumplan solo una parte. Es
 * la diferencia entre no encontrar nada y encontrar algo equivocado, y en E6 la
 * misma consulta se alcanzará por voz: si la sustitución fuera posible aquí, el
 * cliente pediría una cosa y recibiría otra sin enterarse.
 */
import { Dimension } from '@prisma/client';
import { crearCategoria, crearEntorno, crearProducto, sesionNegocio, type Entorno } from './helpers';

const MENU = '/api/v1/menu/products';

describe('Los tres filtros, solos y combinados (FR-031, FR-035)', () => {
  let entorno: Entorno;
  let sesion: string;
  let pizzas: string;
  let sopas: string;
  let saludable: string;
  let indulgente: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);

    pizzas = (await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' })).id;
    sopas = (await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Sopas' })).id;
    saludable = (await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable' })).id;
    indulgente = (await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Indulgente' }))
      .id;

    // Catálogo de seis, con los tres tramos poblados: los cortes caen en 2000 y
    // 4000, de modo que 1000/2000 son económicos, 3000/4000 medios y el resto
    // caros.
    const catalogo = [
      { name: 'Pizza Barata', tipo: pizzas, salud: saludable, price: 1000 },
      { name: 'Pizza Media', tipo: pizzas, salud: indulgente, price: 2000 },
      { name: 'Pizza Cara', tipo: pizzas, salud: saludable, price: 3000 },
      { name: 'Sopa Barata', tipo: sopas, salud: saludable, price: 4000 },
      { name: 'Sopa Media', tipo: sopas, salud: indulgente, price: 5000 },
      { name: 'Sopa Cara', tipo: sopas, salud: indulgente, price: 6000 },
    ];
    for (const p of catalogo) {
      await crearProducto({
        name: p.name,
        foodTypeCategoryId: p.tipo,
        healthProfileCategoryId: p.salud,
        price: p.price,
      });
    }
  });

  const consultar = async (consulta = ''): Promise<string[]> => {
    const respuesta = await entorno
      .http()
      .get(`${MENU}${consulta}`)
      .set('Cookie', sesion)
      .expect(200);
    return respuesta.body.items.map((i: { name: string }) => i.name);
  };

  it('sin filtros devuelve el catálogo activo entero, **sin paginar** (D-029)', async () => {
    const nombres = await consultar();
    expect(nombres).toHaveLength(6);
    // Ni `page`, ni `totalPages`: el menú no se pagina.
    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    expect(respuesta.body).not.toHaveProperty('page');
    expect(respuesta.body).not.toHaveProperty('totalPages');
  });

  it('filtra por tipo de comida', async () => {
    expect((await consultar(`?foodTypeCategoryId=${pizzas}`)).sort()).toEqual([
      'Pizza Barata',
      'Pizza Cara',
      'Pizza Media',
    ]);
  });

  it('filtra por perfil de salud', async () => {
    expect((await consultar(`?healthProfileCategoryId=${saludable}`)).sort()).toEqual([
      'Pizza Barata',
      'Pizza Cara',
      'Sopa Barata',
    ]);
  });

  it('filtra por tramo de precio (FR-033)', async () => {
    expect((await consultar('?priceTier=ECONOMICO')).sort()).toEqual([
      'Pizza Barata',
      'Pizza Media',
    ]);
  });

  it('las **dos dimensiones a la vez** son conjuntivas (HU14-E17)', async () => {
    expect(await consultar(`?foodTypeCategoryId=${pizzas}&healthProfileCategoryId=${indulgente}`)) //
      .toEqual(['Pizza Media']);
  });

  it('los **tres filtros a la vez** son conjuntivos (SC-018, SC-025)', async () => {
    const nombres = await consultar(
      `?foodTypeCategoryId=${pizzas}&healthProfileCategoryId=${saludable}&priceTier=ECONOMICO`,
    );
    expect(nombres).toEqual(['Pizza Barata']);
  });

  it('una combinación sin resultados devuelve **lista vacía**, no un sustituto (FR-035, SC-018)', async () => {
    // Existen sopas y existen productos económicos, pero **ninguna sopa
    // económica**: la respuesta correcta es ninguna, no «lo más parecido».
    const nombres = await consultar(`?foodTypeCategoryId=${sopas}&priceTier=ECONOMICO`);
    expect(nombres).toEqual([]);
  });

  it('los cortes que devuelve **no dependen de los filtros aplicados**', async () => {
    const sinFiltrar = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    const filtrado = await entorno
      .http()
      .get(`${MENU}?foodTypeCategoryId=${pizzas}`)
      .set('Cookie', sesion)
      .expect(200);

    // Si se calcularan sobre el resultado, un filtro estrecho movería los tramos
    // y el mismo producto cambiaría de tramo según qué más se estuviera mirando.
    expect(filtrado.body.priceTiers).toEqual(sinFiltrar.body.priceTiers);
  });

  it('un identificador de categoría que no existe devuelve vacío, no el catálogo entero', async () => {
    const nombres = await consultar('?foodTypeCategoryId=99999999-9999-4999-8999-999999999999');
    expect(nombres).toEqual([]);
  });

  it('rechaza un identificador de categoría mal formado con `400`', async () => {
    await entorno.http().get(`${MENU}?foodTypeCategoryId=no-es-uuid`).set('Cookie', sesion).expect(400);
  });

  it('rechaza un tramo que no está en el vocabulario con `400`', async () => {
    await entorno.http().get(`${MENU}?priceTier=BARATISIMO`).set('Cookie', sesion).expect(400);
  });

  it('la categoría de una dimensión **no** filtra por la otra', async () => {
    // `saludable` es de perfil de salud: pasarla como tipo de comida no devuelve
    // los productos saludables, sino ninguno.
    expect(await consultar(`?foodTypeCategoryId=${saludable}`)).toEqual([]);
  });
});
