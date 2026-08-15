/**
 * Inicio de sesión (T054, FR-001, FR-008, FR-012, SC-002, SC-028,
 * security CHK001).
 */
import { Role, UserStatus } from '@prisma/client';
import { MSG_CREDENCIALES_INVALIDAS } from '@foodvoice/shared';
import {
  CONTRASENA,
  cookieDe,
  crearEntorno,
  crearUsuario,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const CORREO = 'maria.perez@ejemplo.cl';

let entorno: Entorno;

beforeAll(async () => {
  entorno = await crearEntorno();
});

afterAll(async () => {
  await entorno.app.close();
});

describe('Credenciales correctas', () => {
  it('crea la sesión, devuelve la cookie y el destino del rol', async () => {
    const usuario = await crearUsuario({ email: CORREO, role: Role.CLIENTE });

    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA })
      .expect(200);

    expect(respuesta.body.user).toEqual({
      id: usuario.id,
      fullName: usuario.fullName,
      email: CORREO,
      role: Role.CLIENTE,
    });
    expect(respuesta.body.redirectTo).toBe('/cliente');
    expect(respuesta.body.user).not.toHaveProperty('passwordHash');
    expect(cookieDe(respuesta)).toBeDefined();

    const sesiones = await prisma.session.findMany({ where: { userId: usuario.id } });
    expect(sesiones).toHaveLength(1);
    // El rol queda congelado en la sesión (FR-011, D-007).
    expect(sesiones[0]?.role).toBe(Role.CLIENTE);
    expect(sesiones[0]?.revokedAt).toBeNull();
  });

  it('lleva a cada rol a su página de inicio (FR-031)', async () => {
    const destinos: [Role, string][] = [
      [Role.CLIENTE, '/cliente'],
      [Role.NEGOCIO, '/negocio'],
      [Role.REPARTIDOR, '/repartidor'],
      [Role.ADMINISTRADOR, '/admin'],
    ];

    for (const [rol, destino] of destinos) {
      const email = `${rol.toLowerCase()}@ejemplo.cl`;
      await crearUsuario({ email, role: rol });

      const respuesta = await entorno
        .http()
        .post('/api/v1/auth/login')
        .send({ email, password: CONTRASENA })
        .expect(200);

      expect(respuesta.body.redirectTo).toBe(destino);
    }
  });

  it('la cookie es httpOnly y SameSite=Lax', async () => {
    await crearUsuario({ email: CORREO });

    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA })
      .expect(200);

    const cabecera = String(respuesta.headers['set-cookie']);
    expect(cabecera).toMatch(/HttpOnly/i);
    expect(cabecera).toMatch(/SameSite=Lax/i);
  });

  it('el correo en MAYÚSCULAS y con espacios al borde funciona (FR-001, A15)', async () => {
    await crearUsuario({ email: CORREO });

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: `  ${CORREO.toUpperCase()} `, password: CONTRASENA })
      .expect(200);
  });

  it('la contraseña en otra caja NO funciona: distingue mayúsculas', async () => {
    await crearUsuario({ email: CORREO, password: 'Contrasena8' });

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: 'contrasena8' })
      .expect(401);
  });
});

describe('Los tres fallos son indistinguibles (FR-008, FR-012, SC-002, SC-028)', () => {
  it('contraseña incorrecta, usuario inexistente y usuario desactivado dan la misma respuesta', async () => {
    await crearUsuario({ email: CORREO });
    await crearUsuario({ email: 'desactivado@ejemplo.cl', status: UserStatus.DESACTIVADO });

    const casos = [
      { email: CORREO, password: 'otra-cosa-8' },
      { email: 'no-existe@ejemplo.cl', password: CONTRASENA },
      // Credenciales **correctas** de una cuenta desactivada: nada debe
      // indicar que la cuenta existe ni que está desactivada (SC-028).
      { email: 'desactivado@ejemplo.cl', password: CONTRASENA },
    ];

    const respuestas = [];
    for (const caso of casos) {
      const respuesta = await entorno.http().post('/api/v1/auth/login').send(caso);
      respuestas.push({
        status: respuesta.status,
        cuerpo: JSON.stringify(respuesta.body),
      });
    }

    expect(new Set(respuestas.map((r) => `${r.status}·${r.cuerpo}`)).size).toBe(1);
    expect(respuestas[0]?.status).toBe(401);
    expect(respuestas[0]?.cuerpo).toContain(MSG_CREDENCIALES_INVALIDAS);
  });

  it('los tres cuentan como fallo en el contador de intentos', async () => {
    await crearUsuario({ email: CORREO });
    await crearUsuario({ email: 'desactivado@ejemplo.cl', status: UserStatus.DESACTIVADO });

    await entorno.http().post('/api/v1/auth/login').send({ email: CORREO, password: 'mala1234' });
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'no-existe@ejemplo.cl', password: CONTRASENA });
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'desactivado@ejemplo.cl', password: CONTRASENA });

    const filas = await prisma.loginAttemptControl.findMany();
    expect(filas).toHaveLength(3);
    for (const fila of filas) expect(fila.failedCount).toBe(1);
  });

  it('el acierto elimina la fila del contador', async () => {
    await crearUsuario({ email: CORREO });

    await entorno.http().post('/api/v1/auth/login').send({ email: CORREO, password: 'mala1234' });
    expect(await prisma.loginAttemptControl.count({ where: { email: CORREO } })).toBe(1);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA })
      .expect(200);

    expect(await prisma.loginAttemptControl.count({ where: { email: CORREO } })).toBe(0);
  });

  it('un fallo NO crea sesión', async () => {
    await crearUsuario({ email: CORREO });
    await entorno.http().post('/api/v1/auth/login').send({ email: CORREO, password: 'mala1234' });
    expect(await prisma.session.count()).toBe(0);
  });
});

describe('Validación de forma', () => {
  it('un correo con formato inválido produce 400 con mensaje en español', async () => {
    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'no-es-correo', password: CONTRASENA })
      .expect(400);

    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.fields.email).toBe(
      'Debes ingresar un correo electrónico válido.',
    );
  });

  it('NO valida la longitud de la contraseña: eso revelaría una característica de la credencial', async () => {
    await crearUsuario({ email: CORREO });

    // Una contraseña de un carácter debe llegar a la verificación y fallar con
    // el 401 genérico, nunca con un 400 que delate el mínimo (security CHK017).
    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: 'x' })
      .expect(401);

    expect(respuesta.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('un campo desconocido enviado por el cliente no vuelve en `fields` (api CHK014)', async () => {
    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'no-es-correo', password: 'x', '<script>': 'inyectado' })
      .expect(400);

    expect(Object.keys(respuesta.body.error.fields)).toEqual(['email']);
  });
});
