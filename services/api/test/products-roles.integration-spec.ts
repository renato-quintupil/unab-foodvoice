/**
 * Autorización de la administración de productos (T044, FR-027, SC-021, RN-001,
 * HU02-E11).
 *
 * **Se comprueba sin usar la interfaz.** SC-021 lo exige literalmente: «que la
 * opción no aparezca en pantalla no cuenta como bloqueo». Los cinco endpoints se
 * invocan con la sesión de cada rol que no es negocio.
 */
import { Role } from '@prisma/client';
import {
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionDeRol,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

const ROLES_SIN_ACCESO = [Role.CLIENTE, Role.REPARTIDOR, Role.ADMINISTRADOR] as const;

describe('Solo el rol negocio administra el catálogo (FR-027, SC-021, HU02-E11)', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  for (const rol of ROLES_SIN_ACCESO) {
    describe(`rol ${rol}`, () => {
      it('recibe 403 en los cinco endpoints, y **nada cambia**', async () => {
        const cookie = await sesionDeRol(entorno, rol);
        const { foodType, healthProfile } = await crearClasificacionMinima();
        const producto = await crearProducto({
          name: 'Pizza Napolitana',
          foodTypeCategoryId: foodType.id,
          healthProfileCategoryId: healthProfile.id,
        });

        const cuerpo = {
          name: 'Otro Nombre',
          description: DESCRIPCION_OK,
          price: 1000,
          foodTypeCategoryId: foodType.id,
          healthProfileCategoryId: healthProfile.id,
        };

        await entorno.http().get(RUTA).set('Cookie', cookie).expect(403);
        await entorno.http().post(RUTA).set('Cookie', cookie).send(cuerpo).expect(403);
        await entorno
          .http()
          .patch(`${RUTA}/${producto.id}`)
          .set('Cookie', cookie)
          .send(cuerpo)
          .expect(403);
        await entorno
          .http()
          .put(`${RUTA}/${producto.id}/availability`)
          .set('Cookie', cookie)
          .send({ available: false })
          .expect(403);
        await entorno
          .http()
          .put(`${RUTA}/${producto.id}/status`)
          .set('Cookie', cookie)
          .send({ active: false })
          .expect(403);

        // Ni un producto nuevo, ni un cambio en el existente.
        expect(await prisma.product.count()).toBe(1);
        const guardado = await prisma.product.findUniqueOrThrow({ where: { id: producto.id } });
        expect(guardado.name).toBe('Pizza Napolitana');
        expect(guardado.price).toBe(8990);
        expect(guardado.active).toBe(true);
        expect(guardado.available).toBe(true);
      });

      it('el rechazo es `FORBIDDEN` con el mensaje en español', async () => {
        const cookie = await sesionDeRol(entorno, rol);
        const respuesta = await entorno.http().get(RUTA).set('Cookie', cookie).expect(403);
        expect(respuesta.body.error.code).toBe('FORBIDDEN');
        expect(respuesta.body.error.message).toBe('No tienes permiso para acceder a esta función.');
      });
    });
  }

  it('**el administrador tampoco edita el catálogo** en v1 (supuesto 13, RN-001)', async () => {
    // Es la consecuencia menos evidente de RN-001: HU-10 es de solo lectura y la
    // acción administrativa sobre flujos críticos es HU-07, en E8.
    const cookie = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().get(RUTA).set('Cookie', cookie).expect(403);
  });

  it('sin sesión responde 401, no 403', async () => {
    const respuesta = await entorno.http().get(RUTA).expect(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('el rol negocio **sí** puede con los cinco endpoints', async () => {
    const negocio = await sesionNegocio(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima();

    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      })
      .expect(201);

    await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    await entorno
      .http()
      .patch(`${RUTA}/${creado.body.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana Grande',
        description: DESCRIPCION_OK,
        price: 9990,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
      })
      .expect(200);
    await entorno
      .http()
      .put(`${RUTA}/${creado.body.id}/availability`)
      .set('Cookie', negocio)
      .send({ available: false })
      .expect(200);
    await entorno
      .http()
      .put(`${RUTA}/${creado.body.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);
  });

  it('**`DELETE` no existe en ninguna ruta de productos** (FR-009, SC-006)', async () => {
    const negocio = await sesionNegocio(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    await entorno.http().delete(`${RUTA}/${producto.id}`).set('Cookie', negocio).expect(404);
    await entorno.http().delete(RUTA).set('Cookie', negocio).expect(404);

    expect(await prisma.product.count()).toBe(1);
  });
});
