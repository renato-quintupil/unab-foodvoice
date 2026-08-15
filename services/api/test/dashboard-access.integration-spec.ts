/**
 * Control de acceso al panel (T108, FR-018, FR-021, RN-004, SC-008).
 */
import { Role } from '@prisma/client';
import { MSG_SIN_PERMISO } from '@foodvoice/shared';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';

let entorno: Entorno;

beforeAll(async () => {
  entorno = await crearEntorno();
});

afterAll(async () => {
  await entorno.app.close();
});

const ENDPOINTS = [
  '/api/v1/admin/dashboard/metrics',
  '/api/v1/admin/dashboard/orders',
] as const;

const NO_ADMINISTRADORES = [Role.CLIENTE, Role.NEGOCIO, Role.REPARTIDOR];

describe('Los tres roles no administradores reciben 403 (SC-008)', () => {
  it.each(NO_ADMINISTRADORES)('%s en todos los endpoints del panel', async (rol) => {
    const email = `${rol.toLowerCase()}@ejemplo.cl`;
    await crearUsuario({ email, role: rol });
    const cookie = await iniciarSesion(entorno, email);

    for (const ruta of ENDPOINTS) {
      const respuesta = await entorno.http().get(ruta).set('Cookie', conSesion(cookie));

      expect([ruta, respuesta.status]).toEqual([ruta, 403]);
      expect(respuesta.body.error.code).toBe('FORBIDDEN');
      expect(respuesta.body.error.message).toBe(MSG_SIN_PERMISO);
    }
  });

  it('el bloqueo ocurre invocando la ruta directamente, sin pasar por la interfaz', async () => {
    await crearUsuario({ email: 'repartidor@ejemplo.cl', role: Role.REPARTIDOR });
    const cookie = await iniciarSesion(entorno, 'repartidor@ejemplo.cl');

    const respuesta = await entorno
      .http()
      .get('/api/v1/admin/dashboard/metrics')
      .set('Cookie', conSesion(cookie))
      .expect(403);

    // Y la respuesta no filtra ningún dato del panel.
    expect(respuesta.body).not.toHaveProperty('activeUsersByRole');
  });

  it('sin sesión la respuesta es 401: primero identidad, luego permiso', async () => {
    for (const ruta of ENDPOINTS) {
      const respuesta = await entorno.http().get(ruta).expect(401);
      expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});

describe('El administrador sí accede', () => {
  it('alcanza los dos endpoints', async () => {
    await crearUsuario({ email: 'admin@ejemplo.cl', role: Role.ADMINISTRADOR });
    const cookie = await iniciarSesion(entorno, 'admin@ejemplo.cl');

    for (const ruta of ENDPOINTS) {
      await entorno.http().get(ruta).set('Cookie', conSesion(cookie)).expect(200);
    }
  });
});

describe('El panel no expone ningún verbo de escritura (FR-021, RN-004)', () => {
  it.each(['post', 'put', 'patch', 'delete'] as const)(
    '%s sobre los endpoints del panel no existe',
    async (verbo) => {
      await crearUsuario({ email: 'admin@ejemplo.cl', role: Role.ADMINISTRADOR });
      const cookie = await iniciarSesion(entorno, 'admin@ejemplo.cl');

      for (const ruta of ENDPOINTS) {
        const respuesta = await entorno
          .http()
          [verbo](ruta)
          .set('Cookie', conSesion(cookie))
          .send({});

        // Se cumple por lo que **no** existe: la ruta no está declarada, así
        // que el framework responde 404 y no una acción a medias.
        expect([verbo, ruta, respuesta.status]).toEqual([verbo, ruta, 404]);
      }
    },
  );
});
