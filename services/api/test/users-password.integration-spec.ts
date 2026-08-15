/**
 * Restablecimiento de contraseña (T085, FR-026, FR-033, FR-034, SC-012).
 */
import { Role } from '@prisma/client';
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
const NUEVA = 'contrasena-nueva';

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

function restablecer(id: string, password: string) {
  return entorno
    .http()
    .post(`/api/v1/admin/users/${id}/password-reset`)
    .set('Cookie', conSesion(sesionAdmin))
    .send({ password });
}

describe('Los cuatro efectos de la transacción', () => {
  it('la contraseña anterior deja de servir de inmediato (SC-012)', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    await restablecer(usuario.id, NUEVA).expect(204);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: AFECTADO, password: CONTRASENA })
      .expect(401);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: AFECTADO, password: NUEVA })
      .expect(200);
  });

  it('revoca las sesiones vivas del afectado', async () => {
    // Sin ello, una sesión abierta seguiría operando con la credencial que
    // acaba de invalidarse.
    const usuario = await crearUsuario({ email: AFECTADO });
    const sesionSuya = await iniciarSesion(entorno, AFECTADO);

    await restablecer(usuario.id, NUEVA).expect(204);

    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionSuya)).expect(401);
  });

  it('levanta el bloqueo temporal vigente (FR-026, FR-033)', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });
    for (let i = 0; i < 5; i += 1) {
      await entorno
        .http()
        .post('/api/v1/auth/login')
        .send({ email: AFECTADO, password: 'incorrecta1' });
    }
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: AFECTADO, password: CONTRASENA })
      .expect(423);

    await restablecer(usuario.id, NUEVA).expect(204);

    expect(await prisma.loginAttemptControl.count({ where: { email: AFECTADO } })).toBe(0);
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: AFECTADO, password: NUEVA })
      .expect(200);
  });

  it('registra RESTABLECER_PASSWORD sin la contraseña', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    await restablecer(usuario.id, NUEVA).expect(204);

    const entradas = await prisma.adminAuditLog.findMany();
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.action).toBe('RESTABLECER_PASSWORD');
    expect(JSON.stringify(entradas)).not.toContain(NUEVA);
  });
});

describe('Respuesta y validación', () => {
  it('devuelve 204 sin cuerpo: nada que mostrar, y menos la contraseña', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    const respuesta = await restablecer(usuario.id, NUEVA).expect(204);
    expect(respuesta.body).toEqual({});
  });

  it('aplica PasswordSchema: rechaza 7 caracteres con el mensaje en español', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    const respuesta = await restablecer(usuario.id, '1234567').expect(400);
    expect(respuesta.body.error.fields.password).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });

  it('rechaza una contraseña que supere los 72 bytes UTF-8 (D-002)', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    await restablecer(usuario.id, 'á'.repeat(40)).expect(400);
  });

  it('un usuario inexistente da 404 y no deja rastro', async () => {
    await restablecer('99999999-9999-4999-8999-999999999999', NUEVA).expect(404);
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it('un rechazo de validación no cambia la contraseña', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });
    const antes = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });

    await restablecer(usuario.id, 'corta').expect(400);

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.passwordHash).toBe(antes.passwordHash);
  });
});
