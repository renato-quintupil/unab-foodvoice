/**
 * Derivación de los tramos de precio (T058, FR-032, RN-016, D-023, HU14-E12,
 * E13, E14, SC-016, SC-017).
 *
 * **No hay columna de tramo**: los dos cortes se derivan en cada consulta de la
 * distribución de precios de los productos **activos**. Por eso esta batería es de
 * integración y no unitaria: depende del orden y del conteo reales que devuelve
 * PostgreSQL, y con un doble se probaría el doble (D-031).
 *
 * `null` en `priceTiers` **no** es «no se pudo calcular»: es que el catálogo tiene
 * menos de tres productos activos o todos valen lo mismo, y entonces una intención
 * de precio no descarta ningún producto (RN-016).
 */
import {
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const MENU = '/api/v1/menu/products';

describe('Cortes según el tamaño del catálogo (RN-016, HU14-E13)', () => {
  let entorno: Entorno;
  let sesion: string;
  let foodTypeId: string;
  let healthProfileId: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima();
    foodTypeId = foodType.id;
    healthProfileId = healthProfile.id;
  });

  const sembrar = async (precios: number[]) => {
    let n = 0;
    for (const price of precios) {
      await crearProducto({
        name: `Producto ${(n += 1)}`,
        foodTypeCategoryId: foodTypeId,
        healthProfileCategoryId: healthProfileId,
        price,
      });
    }
  };

  const consultar = () => entorno.http().get(MENU).set('Cookie', sesion).expect(200);

  it('con **cero** productos activos no hay tramos', async () => {
    const respuesta = await consultar();
    expect(respuesta.body.items).toHaveLength(0);
    expect(respuesta.body.priceTiers).toBeNull();
  });

  it('con **uno** no hay tramos, y el producto sale con `priceTier: null`', async () => {
    await sembrar([4990]);

    const respuesta = await consultar();
    expect(respuesta.body.priceTiers).toBeNull();
    expect(respuesta.body.items[0].priceTier).toBeNull();
  });

  it('con **dos** tampoco: dos productos no reparten tres tramos (HU14-E13)', async () => {
    await sembrar([1990, 9990]);

    const respuesta = await consultar();
    expect(respuesta.body.priceTiers).toBeNull();
    for (const item of respuesta.body.items) expect(item.priceTier).toBeNull();
  });

  it('con **tres** ya hay tramos, y cae uno en cada uno (SC-016)', async () => {
    await sembrar([1000, 5000, 9000]);

    const respuesta = await consultar();
    expect(respuesta.body.priceTiers).toEqual({ c1: 1000, c2: 5000 });

    const porPrecio = new Map<number, string | null>(
      respuesta.body.items.map((i: { price: number; priceTier: string | null }) => [
        i.price,
        i.priceTier,
      ]),
    );
    expect(porPrecio.get(1000)).toBe('ECONOMICO');
    expect(porPrecio.get(5000)).toBe('MEDIO');
    expect(porPrecio.get(9000)).toBe('CARO');
  });

  it('**todos al mismo precio**: los tercios colapsan y no hay tramos (HU14-E12, SC-017)', async () => {
    await sembrar([4990, 4990, 4990, 4990, 4990]);

    const respuesta = await consultar();
    expect(respuesta.body.priceTiers).toBeNull();
    for (const item of respuesta.body.items) expect(item.priceTier).toBeNull();
  });

  it('los cortes cuentan **también los agotados**: siguen siendo activos (supuesto 2)', async () => {
    await sembrar([1000, 5000, 9000]);
    await prisma.product.updateMany({ where: { price: 9000 }, data: { available: false } });

    const respuesta = await consultar();
    // Si los agotados no contaran, quedarían dos productos y no habría tramos.
    expect(respuesta.body.priceTiers).toEqual({ c1: 1000, c2: 5000 });
  });

  it('los **dados de baja no** cuentan: no están en el catálogo vigente', async () => {
    await sembrar([1000, 5000, 9000]);
    await prisma.product.updateMany({ where: { price: 9000 }, data: { active: false } });

    const respuesta = await consultar();
    expect(respuesta.body.priceTiers).toBeNull();
  });
});

describe('Empate en el borde del tercio (§ Casos Límite)', () => {
  let entorno: Entorno;
  let sesion: string;
  let foodTypeId: string;
  let healthProfileId: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima();
    foodTypeId = foodType.id;
    healthProfileId = healthProfile.id;
  });

  it('dos productos al mismo precio caen **siempre en el mismo tramo**, sin importar el orden', async () => {
    // Dos empatados justo en el corte: la clasificación depende del valor del
    // precio y no de la posición en la lista, de modo que no pueden separarse.
    for (const [i, price] of [1000, 3000, 3000, 8000, 9000].entries()) {
      await crearProducto({
        name: `Producto ${i}`,
        foodTypeCategoryId: foodTypeId,
        healthProfileCategoryId: healthProfileId,
        price,
      });
    }

    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    const empatados = respuesta.body.items.filter((i: { price: number }) => i.price === 3000);

    expect(empatados).toHaveLength(2);
    expect(empatados[0].priceTier).toBe(empatados[1].priceTier);
  });
});

describe('Recálculo automático al cambiar el catálogo (HU14-E14, FR-032)', () => {
  let entorno: Entorno;
  let sesion: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);
  });

  it('abaratar el catálogo mueve los cortes **sin ninguna acción de recálculo**', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const productos = [];
    for (const [i, price] of [3000, 6000, 9000].entries()) {
      productos.push(
        await crearProducto({
          name: `Producto ${i}`,
          foodTypeCategoryId: foodType.id,
          healthProfileCategoryId: healthProfile.id,
          price,
        }),
      );
    }

    const antes = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    expect(antes.body.priceTiers).toEqual({ c1: 3000, c2: 6000 });

    // El más caro baja de precio por la vía normal de la administración.
    await entorno
      .http()
      .put(`/api/v1/business/products/${productos[2]!.id}/availability`)
      .set('Cookie', sesion)
      .send({ available: true })
      .expect(200);
    await prisma.product.update({ where: { id: productos[2]!.id }, data: { price: 4000 } });

    const despues = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    expect(despues.body.priceTiers).toEqual({ c1: 3000, c2: 4000 });
  });

  it('dar de baja un producto recalcula los cortes en la consulta siguiente', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const productos = [];
    for (const [i, price] of [1000, 2000, 3000, 4000].entries()) {
      productos.push(
        await crearProducto({
          name: `Producto ${i}`,
          foodTypeCategoryId: foodType.id,
          healthProfileCategoryId: healthProfile.id,
          price,
        }),
      );
    }

    await entorno
      .http()
      .put(`/api/v1/business/products/${productos[3]!.id}/status`)
      .set('Cookie', sesion)
      .send({ active: false })
      .expect(200);

    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    // Quedan 1000, 2000 y 3000: los cortes son el primero y el segundo.
    expect(respuesta.body.priceTiers).toEqual({ c1: 1000, c2: 2000 });
  });
});
