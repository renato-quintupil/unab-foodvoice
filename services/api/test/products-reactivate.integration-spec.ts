/**
 * Reactivación bloqueada por categoría desactivada (T042, HU02-E15, FR-021,
 * SC-010).
 *
 * Es el caso límite que cierra el triángulo de reglas: FR-007 impide desactivar
 * una categoría de la que dependa un producto **activo**, de modo que este estado
 * solo se alcanza con productos **dados de baja**. Sin FR-021, reactivarlo
 * produciría un producto activo con categoría inactiva: invisible para los filtros
 * del cliente y en contra de RN-011.
 */
import { crearClasificacionMinima, crearEntorno, sesionNegocio, type Entorno } from './helpers';
import { crearCategoria } from './helpers';
import { Dimension } from '@prisma/client';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('Reactivar un producto con categoría desactivada (HU02-E15, FR-021)', () => {
  let entorno: Entorno;
  let negocio: string;
  let clasificacion: Awaited<ReturnType<typeof crearClasificacionMinima>>;
  let productoId: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    clasificacion = await crearClasificacionMinima();

    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(201);
    productoId = creado.body.id;

    // El escenario de HU02-E15: se da de baja el producto y **entretanto** se
    // desactiva su categoría. En ese orden, porque FR-007 no lo permitiría al
    // revés.
    await entorno
      .http()
      .put(`${RUTA}/${productoId}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);
  });

  const reactivar = () =>
    entorno.http().put(`${RUTA}/${productoId}/status`).set('Cookie', negocio).send({ active: true });

  it('**impide la reactivación** y nombra la dimensión afectada (SC-010)', async () => {
    await entorno
      .http()
      .put(`/api/v1/business/categories/${clasificacion.foodType.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    const respuesta = await reactivar().expect(409);

    expect(respuesta.body.error.code).toBe('CATEGORY_INACTIVE');
    expect(respuesta.body.error.message).toContain('Tipo de comida');
    expect(respuesta.body.error.fields).toHaveProperty('foodTypeCategoryId');

    // **No aplica nada**: el producto sigue dado de baja.
    const guardado = await prisma.product.findUnique({ where: { id: productoId } });
    expect(guardado?.active).toBe(false);
  });

  it('nombra la **otra** dimensión cuando es esa la desactivada', async () => {
    await entorno
      .http()
      .put(`/api/v1/business/categories/${clasificacion.healthProfile.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    const respuesta = await reactivar().expect(409);
    expect(respuesta.body.error.message).toContain('Perfil de salud');
  });

  it('**reclasificarlo lo desbloquea**: es la salida que FR-021 ofrece', async () => {
    await entorno
      .http()
      .put(`/api/v1/business/categories/${clasificacion.foodType.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    const ensaladas = await crearCategoria({
      dimension: Dimension.TIPO_COMIDA,
      name: 'Ensaladas',
    });

    // Editar un producto dado de baja **sí** se puede: es lo que permite
    // arreglarlo antes de devolverlo al menú.
    await entorno
      .http()
      .patch(`${RUTA}/${productoId}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: ensaladas.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(200);

    const reactivado = await reactivar().expect(200);
    expect(reactivado.body.active).toBe(true);
    expect(reactivado.body.status).toBe('DISPONIBLE');
  });

  it('reactivar una categoría también lo desbloquea, sin tocar el producto', async () => {
    const rutaCategoria = `/api/v1/business/categories/${clasificacion.foodType.id}/status`;
    await entorno.http().put(rutaCategoria).set('Cookie', negocio).send({ active: false }).expect(200);
    await reactivar().expect(409);

    await entorno.http().put(rutaCategoria).set('Cookie', negocio).send({ active: true }).expect(200);
    await reactivar().expect(200);
  });

  it('con las dos categorías activas, la reactivación funciona sin más', async () => {
    const respuesta = await reactivar().expect(200);
    expect(respuesta.body.active).toBe(true);
  });

  it('**la desactivación de la categoría no reclasificó el producto** (RN-009, FR-011)', async () => {
    await entorno
      .http()
      .put(`/api/v1/business/categories/${clasificacion.foodType.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    const guardado = await prisma.product.findUnique({ where: { id: productoId } });
    expect(guardado?.foodTypeCategoryId).toBe(clasificacion.foodType.id);
  });
});
