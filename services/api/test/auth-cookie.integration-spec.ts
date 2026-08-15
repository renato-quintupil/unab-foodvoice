/**
 * Resolución de la cookie de sesión (T057, api CHK027).
 *
 * **Los seis casos producen exactamente la misma respuesta**, y ninguno es
 * distinguible de otro. Distinguir «esta sesión no existe» de «esta sesión
 * expiró» le diría a quien pruebe identificadores al azar cuándo ha acertado
 * uno, y no le sirve de nada al cliente legítimo.
 */
import { UserStatus } from '@prisma/client';
import { MSG_SESION_EXPIRADA } from '@foodvoice/shared';
import { COOKIE_SESION, conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
import { prisma } from './setup';

const CORREO = 'maria.perez@ejemplo.cl';
const UUID_INEXISTENTE = '99999999-9999-4999-8999-999999999999';

let entorno: Entorno;

beforeAll(async () => {
  entorno = await crearEntorno();
});

afterEach(() => {
  entorno.reloj.liberar();
});

afterAll(async () => {
  await entorno.app.close();
});

/** Prepara cada uno de los seis casos y devuelve la cabecera de cookie a usar. */
const CASOS: { nombre: string; preparar: () => Promise<string | null> }[] = [
  {
    nombre: 'cookie ausente',
    preparar: async () => null,
  },
  {
    nombre: 'valor sin forma de UUID',
    preparar: async () => conSesion('no-es-un-uuid'),
  },
  {
    nombre: 'UUID válido inexistente',
    preparar: async () => conSesion(UUID_INEXISTENTE),
  },
  {
    nombre: 'sesión revocada',
    preparar: async () => {
      await crearUsuario({ email: CORREO });
      const cookie = await iniciarSesion(entorno, CORREO);
      await prisma.session.update({
        where: { id: cookie },
        data: { revokedAt: new Date() },
      });
      return conSesion(cookie);
    },
  },
  {
    nombre: 'sesión expirada por inactividad',
    preparar: async () => {
      await crearUsuario({ email: CORREO });
      const cookie = await iniciarSesion(entorno, CORREO);
      entorno.reloj.avanzarMinutos(31);
      return conSesion(cookie);
    },
  },
  {
    nombre: 'sesión de un usuario desactivado',
    preparar: async () => {
      const usuario = await crearUsuario({ email: CORREO });
      const cookie = await iniciarSesion(entorno, CORREO);
      await prisma.user.update({
        where: { id: usuario.id },
        data: { status: UserStatus.DESACTIVADO },
      });
      return conSesion(cookie);
    },
  },
];

describe('Los seis casos de cookie inválida', () => {
  it.each(CASOS)('$nombre → 401 UNAUTHENTICATED con MSG_SESION_EXPIRADA', async ({ preparar }) => {
    const cookie = await preparar();

    const peticion = entorno.http().get('/api/v1/auth/me');
    if (cookie) peticion.set('Cookie', cookie);

    const respuesta = await peticion.expect(401);
    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(respuesta.body.error.message).toBe(MSG_SESION_EXPIRADA);
  });

  it('ninguno es distinguible de otro: mismo estado, mismo cuerpo', async () => {
    const respuestas: string[] = [];

    for (const { preparar } of CASOS) {
      await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE admin_audit_log, session, login_attempt_control, "user" RESTART IDENTITY CASCADE;',
      );
      entorno.reloj.liberar();

      const cookie = await preparar();
      const peticion = entorno.http().get('/api/v1/auth/me');
      if (cookie) peticion.set('Cookie', cookie);

      const respuesta = await peticion;
      respuestas.push(`${respuesta.status}·${JSON.stringify(respuesta.body)}`);
    }

    expect(respuestas).toHaveLength(6);
    expect(new Set(respuestas).size).toBe(1);
  });

  it('instruye borrar la cookie para que el navegador deje de enviarla', async () => {
    const respuesta = await entorno
      .http()
      .get('/api/v1/auth/me')
      .set('Cookie', conSesion(UUID_INEXISTENTE))
      .expect(401);

    const cabecera = String(respuesta.headers['set-cookie'] ?? '');
    expect(cabecera).toContain(`${COOKIE_SESION}=`);
    // Un valor vacío o una fecha pasada: en ambos casos el navegador la olvida.
    expect(cabecera).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0|fv_session=;/i);
  });

  it('un valor de cookie con forma de inyección no produce 500 sino el mismo 401', async () => {
    const respuesta = await entorno
      .http()
      .get('/api/v1/auth/me')
      .set('Cookie', conSesion("'; DROP TABLE session; --"))
      .expect(401);

    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    // Y la tabla sigue ahí.
    expect(await prisma.session.count()).toBe(0);
  });
});
