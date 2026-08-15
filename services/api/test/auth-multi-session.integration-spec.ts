/**
 * Sesiones simultáneas (T058, FR-006, FR-024, SC-029, security CHK004).
 *
 * La tabla `session` **no** tiene restricción de unicidad sobre `user_id`, y
 * esa ausencia es lo que estos casos ejercen: un mismo usuario puede tener
 * varias filas vivas a la vez, cada una con su propio `last_activity_at`.
 */
import { Role, UserStatus } from '@prisma/client';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
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

describe('Dos sesiones del mismo usuario conviven', () => {
  it('ambas funcionan a la vez', async () => {
    await crearUsuario({ email: CORREO });

    const navegadorA = await iniciarSesion(entorno, CORREO);
    const navegadorB = await iniciarSesion(entorno, CORREO);

    expect(navegadorA).not.toBe(navegadorB);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorA)).expect(200);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorB)).expect(200);

    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(2);
  });

  it('expiran por separado: usar una no mantiene viva la otra', async () => {
    await crearUsuario({ email: CORREO });
    const navegadorA = await iniciarSesion(entorno, CORREO);
    const navegadorB = await iniciarSesion(entorno, CORREO);

    entorno.reloj.avanzarMinutos(20);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorA)).expect(200);

    entorno.reloj.avanzarMinutos(20);
    // A sigue viva porque se usó hace 20 minutos; B lleva 40 sin actividad.
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorA)).expect(200);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorB)).expect(401);
  });

  it('cerrar sesión en uno NO cierra el otro (FR-006, A12)', async () => {
    await crearUsuario({ email: CORREO });
    const navegadorA = await iniciarSesion(entorno, CORREO);
    const navegadorB = await iniciarSesion(entorno, CORREO);

    await entorno
      .http()
      .post('/api/v1/auth/logout')
      .set('Cookie', conSesion(navegadorA))
      .expect(204);

    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorA)).expect(401);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorB)).expect(200);
  });
});

describe('Una acción de impacto termina AMBAS (FR-024, SC-029, A13)', () => {
  it('la desactivación revoca todas las sesiones vivas del afectado', async () => {
    const usuario = await crearUsuario({ email: CORREO });
    const navegadorA = await iniciarSesion(entorno, CORREO);
    const navegadorB = await iniciarSesion(entorno, CORREO);

    const admin = await crearUsuario({
      email: 'admin@ejemplo.cl',
      role: Role.ADMINISTRADOR,
    });
    const sesionAdmin = await iniciarSesion(entorno, 'admin@ejemplo.cl');

    await entorno
      .http()
      .put(`/api/v1/admin/users/${usuario.id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(200);

    // Ambas, no solo la última.
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorA)).expect(401);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorB)).expect(401);

    // Y la del administrador que actuó queda intacta: el WHERE es por el
    // `user_id` del afectado, así que no hace falta ninguna excepción escrita
    // para él.
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionAdmin)).expect(200);
    expect(
      await prisma.session.count({ where: { userId: admin.id, revokedAt: null } }),
    ).toBe(1);
  });
});
