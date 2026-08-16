/**
 * El **efecto** de desactivar una categoría (T025, FR-011, RN-009, HU14-E08).
 *
 * `categories-status` comprueba que la desactivación se aplique; esta batería
 * comprueba **qué cambia** cuando se aplica, que es donde vive la regla de
 * negocio: la categoría desaparece de donde se ofrece para elegir —el menú del
 * cliente y el alta de productos— y **no toca ningún producto** que ya la tuviera
 * (RN-009).
 *
 * Son dos efectos opuestos y hay que verificar los dos: si la desactivación
 * reclasificara o retirara productos, el negocio perdería datos por una acción
 * reversible; si la categoría siguiera ofreciéndose, se podrían dar de alta
 * productos nuevos en una clasificación que el negocio acaba de retirar.
 */
import { Dimension, Role } from '@prisma/client';
import {
  crearCategoria,
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionDeRol,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const ADMINISTRACION = '/api/v1/business/categories';
const MENU = '/api/v1/menu/categories';

describe('Una categoría desactivada no se ofrece para elegir (FR-011)', () => {
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
  });

  it('desaparece de `GET /menu/categories`, que solo devuelve las activas', async () => {
    const vigente = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });
    const retirada = await crearCategoria({
      dimension: Dimension.TIPO_COMIDA,
      name: 'Sopas',
      active: false,
    });

    const respuesta = await entorno.http().get(MENU).set('Cookie', negocio).expect(200);
    const ids = respuesta.body.items.map((c: { id: string }) => c.id);

    expect(ids).toContain(vigente.id);
    expect(ids).not.toContain(retirada.id);
  });

  it('tampoco aparece para el **cliente**, que es quien construye los filtros', async () => {
    await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable', active: false });
    const cliente = await sesionDeRol(entorno, Role.CLIENTE);

    const respuesta = await entorno.http().get(MENU).set('Cookie', cliente).expect(200);
    expect(respuesta.body.items).toHaveLength(0);
  });

  it('desaparece de las que ofrece el **alta de productos** (`?active=true`)', async () => {
    const { foodType } = await crearClasificacionMinima();
    await prisma.category.update({ where: { id: foodType.id }, data: { active: false } });

    const respuesta = await entorno
      .http()
      .get(`${ADMINISTRACION}?active=true`)
      .set('Cookie', negocio)
      .expect(200);

    const ids = respuesta.body.items.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(foodType.id);
  });

  it('**sigue en la administración** sin filtro de estado: retirar no es borrar (FR-010)', async () => {
    const retirada = await crearCategoria({
      dimension: Dimension.TIPO_COMIDA,
      name: 'Sopas',
      active: false,
    });

    const respuesta = await entorno.http().get(ADMINISTRACION).set('Cookie', negocio).expect(200);
    const ids = respuesta.body.items.map((c: { id: string }) => c.id);

    expect(ids).toContain(retirada.id);
  });

  it('no se puede clasificar un producto nuevo en ella (FR-012)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await prisma.category.update({ where: { id: foodType.id }, data: { active: false } });

    const respuesta = await entorno
      .http()
      .post('/api/v1/business/products')
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Nueva',
        description:
          'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca recién cortadas.',
        ingredients: 'Masa, tomate, mozzarella',
        price: 8990,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      })
      .expect(409);

    expect(respuesta.body.error.code).toBe('CATEGORY_INACTIVE');
  });
});

describe('Los productos que ya la tenían **la conservan** (RN-009, HU14-E08)', () => {
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
  });

  it('un producto dado de baja conserva su categoría desactivada, sin reclasificarse', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    await entorno
      .http()
      .put(`${ADMINISTRACION}/${foodType.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    const despues = await prisma.product.findUniqueOrThrow({ where: { id: producto.id } });
    // Ni reclasificado, ni con la clave a `null`, ni tocado.
    expect(despues.foodTypeCategoryId).toBe(foodType.id);
    expect(despues.healthProfileCategoryId).toBe(healthProfile.id);
    expect(despues.active).toBe(false);
  });

  it('la categoría vuelve a ofrecerse al reactivarla, con sus productos intactos (FR-008)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    const ruta = `${ADMINISTRACION}/${foodType.id}/status`;
    await entorno.http().put(ruta).set('Cookie', negocio).send({ active: false }).expect(200);
    await entorno.http().put(ruta).set('Cookie', negocio).send({ active: true }).expect(200);

    const respuesta = await entorno.http().get(MENU).set('Cookie', negocio).expect(200);
    const ids = respuesta.body.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(foodType.id);

    const despues = await prisma.product.findUniqueOrThrow({ where: { id: producto.id } });
    expect(despues.foodTypeCategoryId).toBe(foodType.id);
  });
});
