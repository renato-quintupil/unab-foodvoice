/**
 * Mínimo de administradores activos (T086, FR-027, RN-006, SC-022).
 *
 * **No hay ningún recuento de administradores en el código**, y su ausencia es
 * deliberada: RN-006 queda garantizado por la autoprotección de FR-027. Quien
 * ejecuta una desactivación o un cambio de rol es siempre un administrador
 * activo y no puede aplicarla sobre sí mismo, luego después de la acción queda
 * al menos él. Un recuento sería código que nunca podría dispararse
 * (Principio III).
 *
 * Estos casos ejercen esa afirmación en lugar de darla por buena: recorren una
 * secuencia de desactivaciones y cambios de rol entre varios administradores y
 * comprueban que el conteo **nunca** llega a cero.
 */
import { Role, UserStatus } from '@prisma/client';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
import { prisma } from './setup';

let entorno: Entorno;

beforeAll(async () => {
  entorno = await crearEntorno();
});

afterAll(async () => {
  await entorno.app.close();
});

async function administradoresActivos(): Promise<number> {
  return prisma.user.count({
    where: { role: Role.ADMINISTRADOR, status: UserStatus.ACTIVO },
  });
}

describe('El último administrador no puede retirarse a sí mismo', () => {
  it('no puede desactivarse', async () => {
    const admin = await crearUsuario({ email: 'admin@ejemplo.cl', role: Role.ADMINISTRADOR });
    const sesion = await iniciarSesion(entorno, 'admin@ejemplo.cl');

    const respuesta = await entorno
      .http()
      .put(`/api/v1/admin/users/${admin.id}/status`)
      .set('Cookie', conSesion(sesion))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(409);

    expect(respuesta.body.error.code).toBe('SELF_PROTECTION');
    expect(await administradoresActivos()).toBe(1);
  });

  it('no puede cambiarse el rol', async () => {
    const admin = await crearUsuario({ email: 'admin@ejemplo.cl', role: Role.ADMINISTRADOR });
    const sesion = await iniciarSesion(entorno, 'admin@ejemplo.cl');

    await entorno
      .http()
      .put(`/api/v1/admin/users/${admin.id}/role`)
      .set('Cookie', conSesion(sesion))
      .send({ role: Role.CLIENTE })
      .expect(409);

    expect(await administradoresActivos()).toBe(1);
  });
});

describe('Secuencia entre varios administradores (SC-022)', () => {
  it('el conteo de administradores activos NUNCA llega a cero', async () => {
    const a = await crearUsuario({ email: 'admin.a@ejemplo.cl', role: Role.ADMINISTRADOR });
    const b = await crearUsuario({ email: 'admin.b@ejemplo.cl', role: Role.ADMINISTRADOR });
    const c = await crearUsuario({ email: 'admin.c@ejemplo.cl', role: Role.ADMINISTRADOR });

    const sesionA = await iniciarSesion(entorno, 'admin.a@ejemplo.cl');
    expect(await administradoresActivos()).toBe(3);

    // A desactiva a B.
    await entorno
      .http()
      .put(`/api/v1/admin/users/${b.id}/status`)
      .set('Cookie', conSesion(sesionA))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(200);
    expect(await administradoresActivos()).toBe(2);

    // A degrada a C.
    await entorno
      .http()
      .put(`/api/v1/admin/users/${c.id}/role`)
      .set('Cookie', conSesion(sesionA))
      .send({ role: Role.CLIENTE })
      .expect(200);
    expect(await administradoresActivos()).toBe(1);

    // Y A no puede retirarse: es lo que impide llegar a cero.
    await entorno
      .http()
      .put(`/api/v1/admin/users/${a.id}/status`)
      .set('Cookie', conSesion(sesionA))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(409);
    await entorno
      .http()
      .put(`/api/v1/admin/users/${a.id}/role`)
      .set('Cookie', conSesion(sesionA))
      .send({ role: Role.CLIENTE })
      .expect(409);

    expect(await administradoresActivos()).toBe(1);
  });

  it('un administrador desactivado por otro no recibe trato especial (RN-003, supuesto 16)', async () => {
    const a = await crearUsuario({ email: 'admin.a@ejemplo.cl', role: Role.ADMINISTRADOR });
    const b = await crearUsuario({ email: 'admin.b@ejemplo.cl', role: Role.ADMINISTRADOR });

    const sesionA = await iniciarSesion(entorno, 'admin.a@ejemplo.cl');
    const sesionB = await iniciarSesion(entorno, 'admin.b@ejemplo.cl');

    await entorno
      .http()
      .put(`/api/v1/admin/users/${b.id}/status`)
      .set('Cookie', conSesion(sesionA))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(200);

    // Solo termina la sesión del afectado.
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionB)).expect(401);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionA)).expect(200);
    expect(await prisma.session.count({ where: { userId: a.id, revokedAt: null } })).toBe(1);
  });

  it('crear un segundo administrador es el camino para poder retirar al primero', async () => {
    // Sin él, el sistema quedaría atado para siempre al administrador semilla
    // (FR-009, RN-003).
    const primero = await crearUsuario({
      email: 'admin@ejemplo.cl',
      role: Role.ADMINISTRADOR,
    });
    const sesion = await iniciarSesion(entorno, 'admin@ejemplo.cl');

    const segundo = await entorno
      .http()
      .post('/api/v1/admin/users')
      .set('Cookie', conSesion(sesion))
      .send({
        fullName: 'Admin Dos',
        email: 'admin.dos@ejemplo.cl',
        phone: '+56911112222',
        password: 'contrasena8',
        role: Role.ADMINISTRADOR,
      })
      .expect(201);

    const sesionSegundo = await iniciarSesion(entorno, 'admin.dos@ejemplo.cl');

    await entorno
      .http()
      .put(`/api/v1/admin/users/${primero.id}/status`)
      .set('Cookie', conSesion(sesionSegundo))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(200);

    expect(await administradoresActivos()).toBe(1);
    expect(segundo.body.role).toBe(Role.ADMINISTRADOR);
  });
});
