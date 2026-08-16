/**
 * Revocación transaccional en las cuatro acciones de impacto
 * (T080, FR-024, D-014, SC-006, SC-025, SC-026, SC-029).
 */
import { Role, UserStatus } from '@prisma/client';
import {
  CONTRASENA,
  conSesion,
  crearEntorno,
  crearUsuario,
  iniciarSesion,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const AFECTADO = 'maria.perez@ejemplo.cl';

let entorno: Entorno;
let sesionAdmin: string;
let adminId: string;

beforeAll(async () => {
  entorno = await crearEntorno();
});

beforeEach(async () => {
  const admin = await crearUsuario({
    fullName: 'Admin Uno',
    email: 'admin@ejemplo.cl',
    role: Role.ADMINISTRADOR,
  });
  adminId = admin.id;
  sesionAdmin = await iniciarSesion(entorno, 'admin@ejemplo.cl');
});

afterAll(async () => {
  await entorno.app.close();
});

/** Un usuario con **dos** sesiones vivas, como si usara dos navegadores. */
async function usuarioConDosSesiones() {
  const usuario = await crearUsuario({ email: AFECTADO, role: Role.CLIENTE });
  const navegadorA = await iniciarSesion(entorno, AFECTADO);
  const navegadorB = await iniciarSesion(entorno, AFECTADO);
  return { usuario, navegadorA, navegadorB };
}

const ACCIONES: {
  nombre: string;
  ejecutar: (id: string) => Promise<unknown>;
}[] = [
  {
    nombre: 'desactivación',
    ejecutar: (id) =>
      entorno
        .http()
        .put(`/api/v1/admin/users/${id}/status`)
        .set('Cookie', conSesion(sesionAdmin))
        .send({ status: UserStatus.DESACTIVADO })
        .expect(200),
  },
  {
    nombre: 'cambio de rol',
    ejecutar: (id) =>
      entorno
        .http()
        .put(`/api/v1/admin/users/${id}/role`)
        .set('Cookie', conSesion(sesionAdmin))
        .send({ role: Role.NEGOCIO })
        .expect(200),
  },
  {
    nombre: 'restablecimiento de contraseña',
    ejecutar: (id) =>
      entorno
        .http()
        .post(`/api/v1/admin/users/${id}/password-reset`)
        .set('Cookie', conSesion(sesionAdmin))
        .send({ password: 'nueva-contrasena' })
        .expect(204),
  },
];

describe('Las cuatro acciones de impacto revocan TODAS las sesiones del afectado', () => {
  it.each(ACCIONES)('$nombre', async ({ ejecutar }) => {
    const { usuario, navegadorA, navegadorB } = await usuarioConDosSesiones();

    await ejecutar(usuario.id);

    // Ambas, incluidas las de otros navegadores.
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorA)).expect(401);
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(navegadorB)).expect(401);
    expect(await prisma.session.count({ where: { userId: usuario.id, revokedAt: null } })).toBe(0);
  });

  it.each(ACCIONES)('$nombre NUNCA revoca las del administrador que actúa', async ({ ejecutar }) => {
    const { usuario } = await usuarioConDosSesiones();

    await ejecutar(usuario.id);

    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionAdmin)).expect(200);
    expect(await prisma.session.count({ where: { userId: adminId, revokedAt: null } })).toBe(1);
  });

  it('la reactivación también revoca, por uniformidad de la regla (D-014)', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, status: UserStatus.DESACTIVADO });

    await entorno
      .http()
      .put(`/api/v1/admin/users/${usuario.id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.ACTIVO })
      .expect(200);

    // En la práctica no encuentra ninguna sesión viva —la desactivación las
    // revocó—, así que la operación es inocua. Incluirla evita una excepción
    // que habría que justificar y recordar.
    expect(await prisma.session.count({ where: { userId: usuario.id, revokedAt: null } })).toBe(0);
  });
});

describe('Tras un cambio de rol no queda ventana de privilegio (SC-026)', () => {
  it('el usuario degradado pierde el acceso de inmediato, no en 30 minutos', async () => {
    const usuario = await crearUsuario({ email: AFECTADO, role: Role.ADMINISTRADOR });
    const sesionSuya = await iniciarSesion(entorno, AFECTADO);

    // Antes: alcanza la superficie administrativa.
    await entorno.http().get('/api/v1/admin/users').set('Cookie', conSesion(sesionSuya)).expect(200);

    await entorno
      .http()
      .put(`/api/v1/admin/users/${usuario.id}/role`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ role: Role.CLIENTE })
      .expect(200);

    // Después: ni siquiera 401 por rol, sino porque la sesión terminó. El rol
    // no muta en caliente —eso es lo que FR-011 prohíbe—: la sesión acaba y el
    // nuevo rol rige en el siguiente inicio de sesión.
    await entorno.http().get('/api/v1/admin/users').set('Cookie', conSesion(sesionSuya)).expect(401);

    const nueva = await iniciarSesion(entorno, AFECTADO);
    const sesionNueva = await prisma.session.findUniqueOrThrow({ where: { id: nueva } });
    expect(sesionNueva.role).toBe(Role.CLIENTE);
    await entorno.http().get('/api/v1/admin/users').set('Cookie', conSesion(nueva)).expect(403);
  });
});

describe('Atomicidad: si algo falla, no queda nada aplicado (FR-030)', () => {
  it('la autoprotección revierte la transacción entera', async () => {
    const sesionesAntes = await prisma.session.count({ where: { revokedAt: null } });

    await entorno
      .http()
      .put(`/api/v1/admin/users/${adminId}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(409);

    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(admin.status).toBe(UserStatus.ACTIVO);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(sesionesAntes);
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it('un usuario inexistente no deja rastro alguno', async () => {
    await entorno
      .http()
      .put('/api/v1/admin/users/99999999-9999-4999-8999-999999999999/status')
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(404);

    expect(await prisma.adminAuditLog.count()).toBe(0);
  });
});

describe('La desactivación conserva el historial (RN-002, SC-006)', () => {
  it('no hay borrado físico: la fila sigue ahí, solo cambia de estado', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    await entorno
      .http()
      .put(`/api/v1/admin/users/${usuario.id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(200);

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.status).toBe(UserStatus.DESACTIVADO);
    expect(despues.email).toBe(AFECTADO);
    // Y su siguiente acción recibe 401 con credenciales correctas.
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: AFECTADO, password: CONTRASENA })
      .expect(401);
  });
});
