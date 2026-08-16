/**
 * Clasificación obligatoria del producto (T039, HU14-E06, FR-012, SC-007, SC-010,
 * D-024, RN-011).
 *
 * Tres cosas que la base **no** puede garantizar por sí sola y que el servicio
 * comprueba dentro de la transacción que escribe: que ambas categorías existan,
 * que cada una sea de **su** dimensión y que estén **activas**.
 */
import { Dimension } from '@prisma/client';
import {
  crearCategoria,
  crearClasificacionMinima,
  crearEntorno,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('La clasificación es obligatoria y completa (HU14-E06, SC-007)', () => {
  let entorno: Entorno;
  let negocio: string;
  let clasificacion: Awaited<ReturnType<typeof crearClasificacionMinima>>;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    clasificacion = await crearClasificacionMinima();
  });

  const crear = (extra: object) =>
    entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
        ...extra,
      });

  it('rechaza el alta **sin tipo de comida**, con el error en ese campo (HU14-E06)', async () => {
    const respuesta = await crear({ foodTypeCategoryId: undefined }).expect(400);
    expect(respuesta.body.error.fields).toHaveProperty('foodTypeCategoryId');
    expect(await prisma.product.count()).toBe(0);
  });

  it('rechaza el alta **sin perfil de salud**', async () => {
    const respuesta = await crear({ healthProfileCategoryId: undefined }).expect(400);
    expect(respuesta.body.error.fields).toHaveProperty('healthProfileCategoryId');
    expect(await prisma.product.count()).toBe(0);
  });

  it('rechaza una categoría inexistente con 404', async () => {
    await crear({ foodTypeCategoryId: '99999999-9999-4999-8999-999999999999' }).expect(404);
    expect(await prisma.product.count()).toBe(0);
  });

  it('**rechaza una categoría de la dimensión equivocada** (D-024)', async () => {
    // Cruzadas: el tipo de comida apunta a una de perfil de salud.
    const respuesta = await crear({
      foodTypeCategoryId: clasificacion.healthProfile.id,
      healthProfileCategoryId: clasificacion.foodType.id,
    }).expect(409);

    expect(respuesta.body.error.code).toBe('CATEGORY_INACTIVE');
    expect(respuesta.body.error.fields).toHaveProperty('foodTypeCategoryId');
    expect(await prisma.product.count()).toBe(0);
  });

  it('**rechaza una categoría desactivada**, nombrando la dimensión (FR-012, SC-010)', async () => {
    await prisma.category.update({
      where: { id: clasificacion.foodType.id },
      data: { active: false },
    });

    const respuesta = await crear({}).expect(409);
    expect(respuesta.body.error.code).toBe('CATEGORY_INACTIVE');
    expect(respuesta.body.error.message).toContain('Tipo de comida');
    expect(respuesta.body.error.fields.foodTypeCategoryId).toContain('Tipo de comida');
    expect(await prisma.product.count()).toBe(0);
  });

  it('nombra **la dimensión que falla**, no siempre la primera', async () => {
    await prisma.category.update({
      where: { id: clasificacion.healthProfile.id },
      data: { active: false },
    });

    const respuesta = await crear({}).expect(409);
    expect(respuesta.body.error.message).toContain('Perfil de salud');
    expect(respuesta.body.error.fields).toHaveProperty('healthProfileCategoryId');
  });

  it('acepta el alta con una categoría activa de cada dimensión', async () => {
    await crear({}).expect(201);
  });

  it('la edición aplica **las mismas** comprobaciones (FR-018)', async () => {
    const creado = await crear({}).expect(201);
    await prisma.category.update({
      where: { id: clasificacion.foodType.id },
      data: { active: false },
    });

    const respuesta = await entorno
      .http()
      .patch(`${RUTA}/${creado.body.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 9990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(409);

    expect(respuesta.body.error.code).toBe('CATEGORY_INACTIVE');
    // No se aplicó el cambio de precio, porque la transacción se deshizo entera.
    const guardado = await prisma.product.findUnique({ where: { id: creado.body.id } });
    expect(guardado?.price).toBe(8990);
  });
});

describe('Reclasificar un producto (FR-022, HU14-E11)', () => {
  let entorno: Entorno;
  let negocio: string;
  let clasificacion: Awaited<ReturnType<typeof crearClasificacionMinima>>;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    clasificacion = await crearClasificacionMinima();
  });

  it('cambia las dos categorías y el cambio rige de inmediato', async () => {
    const ensaladas = await crearCategoria({
      dimension: Dimension.TIPO_COMIDA,
      name: 'Ensaladas',
    });
    const saludable = await crearCategoria({
      dimension: Dimension.PERFIL_SALUD,
      name: 'Saludable',
    });

    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Plato Del Dia',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(201);

    const reclasificado = await entorno
      .http()
      .patch(`${RUTA}/${creado.body.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Plato Del Dia',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: ensaladas.id,
        healthProfileCategoryId: saludable.id,
      })
      .expect(200);

    expect(reclasificado.body.foodTypeCategory.name).toBe('Ensaladas');
    expect(reclasificado.body.healthProfileCategory.name).toBe('Saludable');
  });

  it('permite cambiar **una sola** dimensión, dejando la otra igual', async () => {
    const saludable = await crearCategoria({
      dimension: Dimension.PERFIL_SALUD,
      name: 'Saludable',
    });

    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Plato Del Dia',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(201);

    const reclasificado = await entorno
      .http()
      .patch(`${RUTA}/${creado.body.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Plato Del Dia',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: saludable.id,
      })
      .expect(200);

    expect(reclasificado.body.foodTypeCategory.id).toBe(clasificacion.foodType.id);
    expect(reclasificado.body.healthProfileCategory.id).toBe(saludable.id);
  });
});
