/**
 * Autorización de la administración de categorías (T026, FR-027, SC-021, RN-001).
 *
 * **Se comprueba sin usar la interfaz**, invocando los endpoints directamente:
 * SC-021 declara expresamente que «que la opción no aparezca en pantalla no
 * cuenta como bloqueo». El rechazo debe producirse al procesar la acción.
 */
import { Dimension, Role } from '@prisma/client';
import { crearCategoria, crearEntorno, sesionDeRol, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/categories';
const DESCRIPCION_OK =
  'Agrupa preparaciones horneadas de masa con distintas combinaciones de queso y verduras.';

/** Los tres roles que **no** administran el catálogo (RN-001). */
const ROLES_SIN_ACCESO = [Role.CLIENTE, Role.REPARTIDOR, Role.ADMINISTRADOR] as const;

describe('Solo el rol negocio administra las categorías (FR-027, SC-021)', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  for (const rol of ROLES_SIN_ACCESO) {
    describe(`rol ${rol}`, () => {
      it('recibe 403 al listar', async () => {
        const cookie = await sesionDeRol(entorno, rol);
        const respuesta = await entorno.http().get(RUTA).set('Cookie', cookie).expect(403);
        expect(respuesta.body.error.code).toBe('FORBIDDEN');
      });

      it('recibe 403 al crear, y **no se crea nada**', async () => {
        const cookie = await sesionDeRol(entorno, rol);
        await entorno
          .http()
          .post(RUTA)
          .set('Cookie', cookie)
          .send({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas', description: DESCRIPCION_OK })
          .expect(403);

        expect(await prisma.category.count()).toBe(0);
      });

      it('recibe 403 al editar, y no se modifica nada', async () => {
        const cookie = await sesionDeRol(entorno, rol);
        const categoria = await crearCategoria({
          dimension: Dimension.TIPO_COMIDA,
          name: 'Pizzas',
        });

        await entorno
          .http()
          .patch(`${RUTA}/${categoria.id}`)
          .set('Cookie', cookie)
          .send({ name: 'Otro Nombre', description: DESCRIPCION_OK })
          .expect(403);

        const guardada = await prisma.category.findUnique({ where: { id: categoria.id } });
        expect(guardada?.name).toBe('Pizzas');
      });

      it('recibe 403 al cambiar el estado, y el estado no cambia', async () => {
        const cookie = await sesionDeRol(entorno, rol);
        const categoria = await crearCategoria({
          dimension: Dimension.TIPO_COMIDA,
          name: 'Pizzas',
        });

        await entorno
          .http()
          .put(`${RUTA}/${categoria.id}/status`)
          .set('Cookie', cookie)
          .send({ active: false })
          .expect(403);

        const guardada = await prisma.category.findUnique({ where: { id: categoria.id } });
        expect(guardada?.active).toBe(true);
      });
    });
  }

  it('**el rechazo es 403, no 404**: la ruta existe y la sesión es válida', async () => {
    const cookie = await sesionDeRol(entorno, Role.CLIENTE);
    const respuesta = await entorno.http().get(RUTA).set('Cookie', cookie).expect(403);
    expect(respuesta.body.error.code).toBe('FORBIDDEN');
  });

  it('sin sesión responde 401, y no 403: primero se identifica, luego se autoriza', async () => {
    const respuesta = await entorno.http().get(RUTA).expect(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con una cookie inventada responde 401', async () => {
    await entorno
      .http()
      .get(RUTA)
      .set('Cookie', 'fv_session=99999999-9999-4999-8999-999999999999')
      .expect(401);
  });

  it('el rol negocio **sí** puede con los cuatro endpoints', async () => {
    const negocio = await sesionNegocio(entorno);

    const creada = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas', description: DESCRIPCION_OK })
      .expect(201);

    await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    await entorno
      .http()
      .patch(`${RUTA}/${creada.body.id}`)
      .set('Cookie', negocio)
      .send({ name: 'Pizzas Artesanales', description: DESCRIPCION_OK })
      .expect(200);
    await entorno
      .http()
      .put(`${RUTA}/${creada.body.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);
  });

  it('el rechazo por rol **no revela** si el recurso existe', async () => {
    const cookie = await sesionDeRol(entorno, Role.CLIENTE);
    const existente = await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' });

    const conRecurso = await entorno
      .http()
      .patch(`${RUTA}/${existente.id}`)
      .set('Cookie', cookie)
      .send({ name: 'X', description: DESCRIPCION_OK })
      .expect(403);

    const sinRecurso = await entorno
      .http()
      .patch(`${RUTA}/99999999-9999-4999-8999-999999999999`)
      .set('Cookie', cookie)
      .send({ name: 'X', description: DESCRIPCION_OK })
      .expect(403);

    // El mismo cuerpo en los dos casos: el guard actúa antes que el servicio.
    expect(conRecurso.body).toEqual(sinRecurso.body);
  });
});
