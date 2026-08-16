/**
 * Unicidad del nombre de producto (T038, HU02-E02, RN-005, SC-014, SC-027).
 *
 * La unicidad es **global** —no por categoría— y alcanza a los **dados de baja**,
 * cuyo nombre queda reservado para que su reactivación sea siempre posible, con
 * el mismo criterio con que E1 reserva el correo de un usuario desactivado.
 */
import { crearClasificacionMinima, crearEntorno, sesionNegocio, type Entorno } from './helpers';
import { crearCategoria } from './helpers';
import { Dimension } from '@prisma/client';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('Unicidad del nombre de producto (FR-014, RN-005, SC-014)', () => {
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

  const crear = (name: string, extra: object = {}) =>
    entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name,
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
        ...extra,
      });

  it('rechaza un duplicado con `409 PRODUCT_NAME_ALREADY_EXISTS` (HU02-E02)', async () => {
    await crear('Pizza Napolitana').expect(201);
    const respuesta = await crear('Pizza Napolitana').expect(409);

    expect(respuesta.body.error.code).toBe('PRODUCT_NAME_ALREADY_EXISTS');
    expect(await prisma.product.count()).toBe(1);
  });

  it('asocia el rechazo **al campo del nombre** (HU02-E02)', async () => {
    await crear('Pizza Napolitana').expect(201);
    const respuesta = await crear('pizza napolitana').expect(409);
    expect(respuesta.body.error.fields).toHaveProperty('name');
  });

  it('pliega mayúsculas, acentos y eñes (SC-014)', async () => {
    await crear('Ají Relleno').expect(201);
    await crear('aji relleno').expect(409);
    await crear('AJÍ RELLENO').expect(409);
    expect(await prisma.product.count()).toBe(1);
  });

  it('pliega espacios repetidos y de los extremos', async () => {
    await crear('Pizza Napolitana').expect(201);
    await crear('  Pizza   Napolitana  ').expect(409);
  });

  it('**el nombre de un producto dado de baja sigue reservado** (RN-005)', async () => {
    const creado = await crear('Pizza Napolitana').expect(201);
    await entorno
      .http()
      .put(`${RUTA}/${creado.body.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    // Es lo que garantiza que la reactivación siempre sea posible.
    await crear('pizza napolitana').expect(409);
    expect(await prisma.product.count()).toBe(1);
  });

  it('la unicidad es **global**, no por categoría', async () => {
    const otroTipo = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Ensaladas' });
    await crear('Especial De La Casa').expect(201);
    await crear('especial de la casa', { foodTypeCategoryId: otroTipo.id }).expect(409);
  });

  it('al **editar** tampoco se puede colisionar con otro producto', async () => {
    await crear('Pizza Napolitana').expect(201);
    const otro = await crear('Pizza Margarita').expect(201);

    const respuesta = await entorno
      .http()
      .patch(`${RUTA}/${otro.body.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'pizza napolitana',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(409);

    expect(respuesta.body.error.code).toBe('PRODUCT_NAME_ALREADY_EXISTS');
    const sinCambios = await prisma.product.findUnique({ where: { id: otro.body.id } });
    expect(sinCambios?.name).toBe('Pizza Margarita');
  });

  it('al editar **sí** se puede conservar el propio nombre', async () => {
    const creado = await crear('Pizza Napolitana').expect(201);
    await entorno
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
      .expect(200);
  });

  it('**dos altas simultáneas del mismo nombre producen una sola** (SC-027, FR-026)', async () => {
    const respuestas = await Promise.all([crear('Pizza Doble'), crear('Pizza Doble')]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.product.count()).toBe(1);
  });

  it('el rechazo no filtra detalles del motor', async () => {
    await crear('Pizza Napolitana').expect(201);
    const respuesta = await crear('Pizza Napolitana').expect(409);

    const cuerpo = JSON.stringify(respuesta.body);
    expect(cuerpo).not.toContain('name_normalized');
    expect(cuerpo).not.toContain('P2002');
    expect(cuerpo).not.toContain('Unique constraint');
  });
});
