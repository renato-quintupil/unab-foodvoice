/**
 * Idempotencia del cambio de estado (T081, FR-034, api CHK007).
 *
 * Pedir el estado que el usuario **ya tiene** devuelve `200` sin cambios, sin
 * revocar sesiones y sin escribir en la bitácora. Repetir la petición _n_ veces
 * deja el mismo estado y el mismo número de entradas que ejecutarla una vez.
 */
import { Role, UserStatus } from '@prisma/client';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
import { prisma } from './setup';

const AFECTADO = 'maria.perez@ejemplo.cl';

let entorno: Entorno;
let sesionAdmin: string;

beforeAll(async () => {
  entorno = await crearEntorno();
});

beforeEach(async () => {
  await crearUsuario({
    fullName: 'Admin Uno',
    email: 'admin@ejemplo.cl',
    role: Role.ADMINISTRADOR,
  });
  sesionAdmin = await iniciarSesion(entorno, 'admin@ejemplo.cl');
});

afterAll(async () => {
  await entorno.app.close();
});

function cambiarEstado(id: string, status: UserStatus) {
  return entorno
    .http()
    .put(`/api/v1/admin/users/${id}/status`)
    .set('Cookie', conSesion(sesionAdmin))
    .send({ status });
}

describe('Estado solicitado igual al actual', () => {
  it('devuelve 200 con el usuario sin cambios', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, status: UserStatus.ACTIVO });

    const respuesta = await cambiarEstado(usuario.id, UserStatus.ACTIVO).expect(200);

    expect(respuesta.body.status).toBe(UserStatus.ACTIVO);
    expect(respuesta.body.id).toBe(usuario.id);
  });

  it('NO revoca sesiones: expulsaría a un usuario activo por una petición que no cambió nada', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, status: UserStatus.ACTIVO });
    const sesionSuya = await iniciarSesion(entorno, AFECTADO);

    await cambiarEstado(usuario.id, UserStatus.ACTIVO).expect(200);

    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionSuya)).expect(200);
    expect(await prisma.session.count({ where: { userId: usuario.id, revokedAt: null } })).toBe(1);
  });

  it('NO escribe en la bitácora: no se aplicó ninguna acción (FR-034)', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, status: UserStatus.ACTIVO });

    await cambiarEstado(usuario.id, UserStatus.ACTIVO).expect(200);

    // Anotarla llenaría la bitácora de entradas que no corresponden a ningún
    // cambio y volvería inútil su lectura.
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it('vale igual para DESACTIVADO sobre un usuario ya desactivado', async () => {
    const usuario = await crearUsuario({
      email: AFECTADO,
      status: UserStatus.DESACTIVADO,
    });

    await cambiarEstado(usuario.id, UserStatus.DESACTIVADO).expect(200);

    expect(await prisma.adminAuditLog.count()).toBe(0);
  });
});

describe('Repetir la petición n veces (idempotencia plena)', () => {
  it('deja el mismo estado y el mismo número de entradas que ejecutarla una vez', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, status: UserStatus.ACTIVO });

    for (let i = 0; i < 5; i += 1) {
      await cambiarEstado(usuario.id, UserStatus.DESACTIVADO).expect(200);
    }

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.status).toBe(UserStatus.DESACTIVADO);

    // Exactamente una: la primera aplicó el cambio, las cuatro siguientes no.
    const entradas = await prisma.adminAuditLog.findMany();
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.action).toBe('DESACTIVAR');
  });

  it('alternar estados sí registra cada cambio real', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, status: UserStatus.ACTIVO });

    await cambiarEstado(usuario.id, UserStatus.DESACTIVADO).expect(200);
    await cambiarEstado(usuario.id, UserStatus.ACTIVO).expect(200);
    await cambiarEstado(usuario.id, UserStatus.DESACTIVADO).expect(200);

    const acciones = (await prisma.adminAuditLog.findMany({ orderBy: { occurredAt: 'asc' } })).map(
      (e) => e.action,
    );
    expect(acciones).toEqual(['DESACTIVAR', 'REACTIVAR', 'DESACTIVAR']);
  });
});
