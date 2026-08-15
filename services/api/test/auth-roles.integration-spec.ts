/**
 * Denegación por rol (T059, FR-002, FR-003, SC-003).
 *
 * Las rutas se invocan **directamente, sin pasar por la interfaz**: lo que se
 * verifica es que el bloqueo ocurre en el procesamiento de la petición y no
 * ocultando opciones en pantalla.
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

const NO_ADMINISTRADORES = [Role.CLIENTE, Role.NEGOCIO, Role.REPARTIDOR];

/** Toda la superficie reservada al administrador. */
const RUTAS_RESERVADAS: { verbo: 'get' | 'post' | 'patch' | 'put'; ruta: string; cuerpo?: object }[] =
  [
    { verbo: 'get', ruta: '/api/v1/admin/users' },
    { verbo: 'post', ruta: '/api/v1/admin/users', cuerpo: {} },
    { verbo: 'patch', ruta: '/api/v1/admin/users/11111111-1111-4111-8111-111111111111', cuerpo: {} },
    {
      verbo: 'put',
      ruta: '/api/v1/admin/users/11111111-1111-4111-8111-111111111111/role',
      cuerpo: { role: Role.CLIENTE },
    },
    {
      verbo: 'put',
      ruta: '/api/v1/admin/users/11111111-1111-4111-8111-111111111111/status',
      cuerpo: { status: 'ACTIVO' },
    },
    {
      verbo: 'post',
      ruta: '/api/v1/admin/users/11111111-1111-4111-8111-111111111111/password-reset',
      cuerpo: { password: 'contrasena8' },
    },
    { verbo: 'get', ruta: '/api/v1/admin/dashboard/metrics' },
    { verbo: 'get', ruta: '/api/v1/admin/dashboard/orders' },
  ];

describe('Un rol no administrador recibe 403 en toda la superficie reservada', () => {
  it.each(NO_ADMINISTRADORES)('%s', async (rol) => {
    const email = `${rol.toLowerCase()}@ejemplo.cl`;
    await crearUsuario({ email, role: rol });
    const cookie = await iniciarSesion(entorno, email);

    for (const { verbo, ruta, cuerpo } of RUTAS_RESERVADAS) {
      const respuesta = await entorno
        .http()
        [verbo](ruta)
        .set('Cookie', conSesion(cookie))
        .send(cuerpo ?? {});

      expect([verbo, ruta, respuesta.status]).toEqual([verbo, ruta, 403]);
      expect(respuesta.body.error.code).toBe('FORBIDDEN');
      expect(respuesta.body.error.message).toBe(MSG_SIN_PERMISO);
    }
  });

  it('el administrador sí alcanza esas mismas rutas', async () => {
    await crearUsuario({ email: 'admin@ejemplo.cl', role: Role.ADMINISTRADOR });
    const cookie = await iniciarSesion(entorno, 'admin@ejemplo.cl');

    for (const ruta of ['/api/v1/admin/users', '/api/v1/admin/dashboard/metrics']) {
      await entorno.http().get(ruta).set('Cookie', conSesion(cookie)).expect(200);
    }
  });

  it('sin sesión la respuesta es 401 y no 403: primero identidad, luego permiso', async () => {
    const respuesta = await entorno.http().get('/api/v1/admin/users').expect(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
  });
});
