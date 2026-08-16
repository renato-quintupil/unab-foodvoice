/**
 * Desactivación y reactivación de categorías (T024, HU14-E08, E09, E18, SC-015,
 * SC-027, FR-007, FR-008, FR-009, D-027).
 *
 * El corazón de esta batería es el **conteo dentro de la transacción**: contar
 * fuera permitiría dar de alta un producto entre el conteo y la escritura, y
 * dejaría una categoría desactivada de la que depende un producto activo, que es
 * el estado que RN-011 y FR-011 existen para evitar.
 */
import { Dimension } from '@prisma/client';
import {
  crearCategoria,
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/categories';

describe('PUT /business/categories/:id/status · desactivar (FR-007, HU14-E08)', () => {
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

  const cambiarEstado = (id: string, active: boolean) =>
    entorno.http().put(`${RUTA}/${id}/status`).set('Cookie', negocio).send({ active });

  it('desactiva una categoría sin productos y **la conserva** en la administración', async () => {
    const categoria = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });

    const respuesta = await cambiarEstado(categoria.id, false).expect(200);
    expect(respuesta.body.active).toBe(false);

    // Sigue existiendo: la retirada es lógica y reversible (RN-004).
    const guardada = await prisma.category.findUnique({ where: { id: categoria.id } });
    expect(guardada).not.toBeNull();
    expect(guardada?.name).toBe('Pizzas');
    expect(guardada?.description).toBe(categoria.description);
  });

  it('desactiva una categoría cuyos únicos productos están **dados de baja**', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    await cambiarEstado(foodType.id, false).expect(200);
  });

  it('**impide desactivar una categoría de la que dependa un producto activo** (HU14-E09)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Activa',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    const respuesta = await cambiarEstado(foodType.id, false).expect(409);
    expect(respuesta.body.error.code).toBe('CATEGORY_IN_USE');

    // **No aplica nada**: la categoría sigue activa.
    const guardada = await prisma.category.findUnique({ where: { id: foodType.id } });
    expect(guardada?.active).toBe(true);
  });

  it('el rechazo dice **cuántos** productos lo bloquean, en el cuerpo y en el mensaje (SC-015)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    for (const nombre of ['Pizza Una', 'Pizza Dos', 'Pizza Tres']) {
      await crearProducto({
        name: nombre,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      });
    }

    const respuesta = await cambiarEstado(foodType.id, false).expect(409);
    // `blockingProducts` va aparte para que la interfaz no analice el texto.
    expect(respuesta.body.error.blockingProducts).toBe(3);
    expect(respuesta.body.error.message).toContain('3 productos activos');
  });

  it('concuerda en singular con un solo producto bloqueando', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Sola',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    const respuesta = await cambiarEstado(foodType.id, false).expect(409);
    expect(respuesta.body.error.blockingProducts).toBe(1);
    expect(respuesta.body.error.message).toContain('1 producto activo');
  });

  it('cuenta **también los agotados**: siguen siendo productos activos (FR-007)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Agotada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      available: false,
    });

    const respuesta = await cambiarEstado(foodType.id, false).expect(409);
    expect(respuesta.body.error.blockingProducts).toBe(1);
  });

  it('cuenta los productos que la usan **en su propia dimensión**, no en la otra', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await crearProducto({
      name: 'Pizza Indulgente',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    // Desactivar la de perfil de salud también está bloqueada, por su lado.
    const respuesta = await cambiarEstado(healthProfile.id, false).expect(409);
    expect(respuesta.body.error.blockingProducts).toBe(1);
  });

  it('desactivar **no modifica ningún producto** (RN-009, FR-011)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    await cambiarEstado(foodType.id, false).expect(200);

    const despues = await prisma.product.findUnique({ where: { id: producto.id } });
    expect(despues?.foodTypeCategoryId).toBe(foodType.id);
    expect(despues?.updatedAt.getTime()).toBe(producto.updatedAt.getTime());
  });
});

describe('PUT /business/categories/:id/status · reactivar (FR-008, HU14-E18)', () => {
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

  const cambiarEstado = (id: string, active: boolean) =>
    entorno.http().put(`${RUTA}/${id}/status`).set('Cookie', negocio).send({ active });

  it('reactiva conservando nombre, descripción y dimensión (HU14-E18)', async () => {
    const categoria = await crearCategoria({
      dimension: Dimension.PERFIL_SALUD,
      name: 'Saludable',
      active: false,
    });

    const respuesta = await cambiarEstado(categoria.id, true).expect(200);
    expect(respuesta.body).toMatchObject({
      name: 'Saludable',
      description: categoria.description,
      dimension: Dimension.PERFIL_SALUD,
      active: true,
    });
  });

  it('reactivar **nunca** está bloqueado por productos: solo desactivar lo comprueba', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    await prisma.category.update({ where: { id: foodType.id }, data: { active: false } });
    await crearProducto({
      name: 'Pizza Cualquiera',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    await cambiarEstado(foodType.id, true).expect(200);
  });
});

describe('Idempotencia y doble disparo (FR-026, SC-027)', () => {
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

  const cambiarEstado = (id: string, active: boolean) =>
    entorno.http().put(`${RUTA}/${id}/status`).set('Cookie', negocio).send({ active });

  it('poner el estado que ya tiene es una petición **sin efecto**, no un error', async () => {
    const categoria = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });

    const respuesta = await cambiarEstado(categoria.id, true).expect(200);
    expect(respuesta.body.active).toBe(true);
  });

  it('dos desactivaciones simultáneas dejan la categoría desactivada, sin error', async () => {
    const categoria = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });

    const respuestas = await Promise.all([
      cambiarEstado(categoria.id, false),
      cambiarEstado(categoria.id, false),
    ]);
    for (const r of respuestas) expect(r.status).toBe(200);

    const guardada = await prisma.category.findUnique({ where: { id: categoria.id } });
    expect(guardada?.active).toBe(false);
  });

  it('devuelve 404 para una categoría inexistente', async () => {
    await cambiarEstado('99999999-9999-4999-8999-999999999999', false).expect(404);
  });

  it('rechaza un cuerpo sin `active`', async () => {
    const categoria = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });
    await entorno
      .http()
      .put(`${RUTA}/${categoria.id}/status`)
      .set('Cookie', negocio)
      .send({})
      .expect(400);
  });
});

describe('No existe ninguna acción de borrado (FR-009, SC-006)', () => {
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

  it('**`DELETE` no existe en ninguna ruta de categorías** (HU14-E10)', async () => {
    const categoria = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });

    // Que el verbo no exista es la forma más directa de cumplir FR-009: no hay
    // punto de entrada que borre, ni siquiera saltándose la interfaz.
    await entorno.http().delete(`${RUTA}/${categoria.id}`).set('Cookie', negocio).expect(404);
    await entorno.http().delete(RUTA).set('Cookie', negocio).expect(404);

    expect(await prisma.category.count()).toBe(1);
  });

  it('toda retirada tiene su acción contraria (SC-006)', async () => {
    const categoria = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });
    const ruta = `${RUTA}/${categoria.id}/status`;

    await entorno.http().put(ruta).set('Cookie', negocio).send({ active: false }).expect(200);
    const vuelta = await entorno
      .http()
      .put(ruta)
      .set('Cookie', negocio)
      .send({ active: true })
      .expect(200);

    expect(vuelta.body.active).toBe(true);
  });
});
