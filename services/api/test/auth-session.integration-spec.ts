/**
 * Ciclo de vida de la sesión (T056, FR-004, FR-005, FR-006, FR-030, SC-013,
 * SC-030, SC-031, SC-035).
 */
import { MSG_SESION_EXPIRADA } from '@foodvoice/shared';
import {
  conSesion,
  cookieDe,
  crearEntorno,
  crearUsuario,
  iniciarSesion,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const CORREO = 'maria.perez@ejemplo.cl';

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

describe('Ventana deslizante de 30 minutos (FR-004, FR-005, SC-013, SC-031)', () => {
  it('una sucesión de peticiones mantiene viva la sesión sin reautenticar', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    for (let i = 0; i < 4; i += 1) {
      entorno.reloj.avanzarMinutos(20);
      await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(cookie)).expect(200);
    }

    // Ochenta minutos después del inicio, la sesión sigue viva: no hay
    // duración máxima absoluta (security CHK005).
    entorno.reloj.avanzarMinutos(20);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(cookie)).expect(200);
  });

  it('cada petición refresca last_activity_at', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    const antes = await prisma.session.findUniqueOrThrow({ where: { id: cookie } });

    entorno.reloj.avanzarMinutos(5);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(cookie)).expect(200);

    const despues = await prisma.session.findUniqueOrThrow({ where: { id: cookie } });
    expect(despues.lastActivityAt.getTime()).toBeGreaterThan(antes.lastActivityAt.getTime());
  });

  it('expira a los 30 minutos de inactividad', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    entorno.reloj.avanzarMinutos(31);

    const respuesta = await entorno
      .http()
      .get('/api/v1/auth/me')
      .set('Cookie', conSesion(cookie))
      .expect(401);

    expect(respuesta.body.error.code).toBe('UNAUTHENTICATED');
    expect(respuesta.body.error.message).toBe(MSG_SESION_EXPIRADA);
  });

  it('la expiración es pasiva: la fila no se borra, solo deja de valer', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    entorno.reloj.avanzarMinutos(31);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(cookie)).expect(401);

    const fila = await prisma.session.findUnique({ where: { id: cookie } });
    expect(fila).not.toBeNull();
    // Ni siquiera se marca como revocada: no hay proceso que la toque.
    expect(fila?.revokedAt).toBeNull();
  });

  it('una petición rechazada por expiración NO refresca last_activity_at', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);
    const antes = await prisma.session.findUniqueOrThrow({ where: { id: cookie } });

    entorno.reloj.avanzarMinutos(31);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(cookie)).expect(401);

    const despues = await prisma.session.findUniqueOrThrow({ where: { id: cookie } });
    expect(despues.lastActivityAt.getTime()).toBe(antes.lastActivityAt.getTime());
  });
});

describe('Cierre explícito (FR-006, SC-030)', () => {
  it('devuelve 204, revoca la sesión y borra la cookie', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/logout')
      .set('Cookie', conSesion(cookie))
      .expect(204);

    expect(cookieDe(respuesta)).toBeUndefined();

    const fila = await prisma.session.findUniqueOrThrow({ where: { id: cookie } });
    expect(fila.revokedAt).not.toBeNull();
  });

  it('reutilizar la misma cookie después del cierre se rechaza (SC-030)', async () => {
    // Es lo que en el navegador se percibe como pulsar «atrás» y volver a una
    // vista que parecía cargada. Sin esta aserción, SC-030 quedaría solo en la
    // comprobación manual de A8.
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    await entorno.http().post('/api/v1/auth/logout').set('Cookie', conSesion(cookie)).expect(204);

    const respuesta = await entorno
      .http()
      .get('/api/v1/auth/me')
      .set('Cookie', conSesion(cookie))
      .expect(401);

    expect(respuesta.body.error.message).toBe(MSG_SESION_EXPIRADA);
  });

  it('cerrar sesión dos veces con la misma cookie no rompe nada', async () => {
    await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    await entorno.http().post('/api/v1/auth/logout').set('Cookie', conSesion(cookie)).expect(204);
    // El guard responde antes con 401, que es el comportamiento correcto para
    // una cookie muerta: no hay estado a medias.
    await entorno.http().post('/api/v1/auth/logout').set('Cookie', conSesion(cookie)).expect(401);

    const revocadas = await prisma.session.count({ where: { revokedAt: { not: null } } });
    expect(revocadas).toBe(1);
  });
});

describe('Rechazo íntegro sin cambios parciales (FR-030, SC-035)', () => {
  it('una acción con la sesión expirada no aplica ningún cambio', async () => {
    const usuario = await crearUsuario({ email: CORREO, phone: '+56911112222' });
    const cookie = await iniciarSesion(entorno, CORREO);

    entorno.reloj.avanzarMinutos(31);

    await entorno
      .http()
      .patch(`/api/v1/admin/users/${usuario.id}`)
      .set('Cookie', conSesion(cookie))
      .send({ phone: '+56999999999' })
      .expect(401);

    // Comprobable releyendo el dato: conserva su valor previo.
    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.phone).toBe('+56911112222');
  });

  it('el rechazo ocurre antes de aplicar nada: no queda entrada en la bitácora', async () => {
    const usuario = await crearUsuario({ email: CORREO });
    const cookie = await iniciarSesion(entorno, CORREO);

    entorno.reloj.avanzarMinutos(31);

    await entorno
      .http()
      .patch(`/api/v1/admin/users/${usuario.id}`)
      .set('Cookie', conSesion(cookie))
      .send({ fullName: 'Otro Nombre' })
      .expect(401);

    expect(await prisma.adminAuditLog.count()).toBe(0);
  });
});
