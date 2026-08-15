/**
 * Bloqueo temporal por intentos fallidos (T055, FR-033, SC-017, SC-018,
 * api CHK010, data CHK010).
 */
import { MSG_CUENTA_BLOQUEADA } from '@foodvoice/shared';
import { CONTRASENA, crearEntorno, crearUsuario, type Entorno } from './helpers';
import { prisma } from './setup';

const CORREO = 'maria.perez@ejemplo.cl';
const INEXISTENTE = 'nadie@ejemplo.cl';

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

function intentar(email: string, password = 'incorrecta1') {
  return entorno.http().post('/api/v1/auth/login').send({ email, password });
}

describe('Cinco fallos bloquean (FR-033)', () => {
  it('el quinto fallo bloquea y el sexto intento se rechaza con 423', async () => {
    await crearUsuario({ email: CORREO });

    for (let i = 0; i < 4; i += 1) {
      await intentar(CORREO).expect(401);
    }

    const quinto = await intentar(CORREO);
    expect(quinto.status).toBe(401);

    const sexto = await intentar(CORREO);
    expect(sexto.status).toBe(423);
    expect(sexto.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(sexto.body.error.message).toBe(MSG_CUENTA_BLOQUEADA);
  });

  it('el bloqueo rechaza incluso la contraseña CORRECTA (SC-017)', async () => {
    await crearUsuario({ email: CORREO });
    for (let i = 0; i < 5; i += 1) await intentar(CORREO);

    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA });

    expect(respuesta.status).toBe(423);
    expect(await prisma.session.count()).toBe(0);
  });

  it('el mensaje es idéntico para correo registrado e inexistente (SC-018)', async () => {
    await crearUsuario({ email: CORREO });

    for (let i = 0; i < 5; i += 1) await intentar(CORREO);
    for (let i = 0; i < 5; i += 1) await intentar(INEXISTENTE);

    const registrado = await intentar(CORREO);
    const inexistente = await intentar(INEXISTENTE);

    expect(registrado.status).toBe(inexistente.status);
    // Palabra por palabra: es la misma constante de `packages/shared`.
    expect(JSON.stringify(registrado.body)).toBe(JSON.stringify(inexistente.body));
  });

  it('la respuesta NO contiene el tiempo restante, ni en el cuerpo ni en Retry-After', async () => {
    // SC-018 exige que el mensaje sea idéntico entre dos intentos, y un tiempo
    // restante lo haría distinto en cada uno (api CHK010).
    await crearUsuario({ email: CORREO });
    for (let i = 0; i < 5; i += 1) await intentar(CORREO);

    const respuesta = await intentar(CORREO);

    expect(respuesta.headers['retry-after']).toBeUndefined();
    expect(Object.keys(respuesta.body.error).sort()).toEqual(['code', 'message']);
    expect(JSON.stringify(respuesta.body)).not.toMatch(/\d+\s*(segundo|minuto|ms)/i);
  });
});

describe('Vencimiento del bloqueo (FR-033, SC-017, security CHK016)', () => {
  it('pasados 15 minutos se ignora y el usuario entra con normalidad', async () => {
    await crearUsuario({ email: CORREO });
    for (let i = 0; i < 5; i += 1) await intentar(CORREO);
    await intentar(CORREO).expect(423);

    entorno.reloj.avanzarMinutos(16);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA })
      .expect(200);
  });

  it('tras el bloqueo el contador queda en cero: un fallo posterior no vuelve a bloquear', async () => {
    await crearUsuario({ email: CORREO });
    for (let i = 0; i < 5; i += 1) await intentar(CORREO);

    const fila = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: CORREO },
    });
    expect(fila.failedCount).toBe(0);
    expect(fila.lockedUntil).not.toBeNull();

    entorno.reloj.avanzarMinutos(16);
    await intentar(CORREO).expect(401);

    // Un único fallo tras el vencimiento no puede volver a bloquear.
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA })
      .expect(200);
  });

  it('una fila con locked_until vencido y failed_count > 0 es estado normal y no se limpia', async () => {
    await crearUsuario({ email: CORREO });
    for (let i = 0; i < 5; i += 1) await intentar(CORREO);

    entorno.reloj.avanzarMinutos(16);
    await intentar(CORREO).expect(401);
    await intentar(CORREO).expect(401);

    const fila = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: CORREO },
    });
    expect(fila.failedCount).toBe(2);
    // El valor vencido no se anula: simplemente deja de mirarse.
    expect(fila.lockedUntil).not.toBeNull();
    expect(fila.lockedUntil!.getTime()).toBeLessThan(entorno.reloj.ahora().getTime());
  });
});

describe('Intentos concurrentes (data CHK010)', () => {
  it('cinco intentos EN PARALELO bloquean exactamente una vez', async () => {
    // Es el único caso que delata si la decisión del quinto fallo se tomó
    // leyendo el contador en el servicio en lugar de dentro del UPSERT: cinco
    // peticiones que leyeran `failed_count = 4` concluirían todas que aún no
    // toca bloquear.
    await crearUsuario({ email: CORREO });

    await Promise.all(Array.from({ length: 5 }, () => intentar(CORREO)));

    const fila = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: CORREO },
    });
    expect(fila.failedCount).toBe(0);
    expect(fila.lockedUntil).not.toBeNull();

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: CORREO, password: CONTRASENA })
      .expect(423);
  });

  it('ninguna petición concurrente «gasta» el mismo intento que otra', async () => {
    await crearUsuario({ email: CORREO });

    await Promise.all(Array.from({ length: 3 }, () => intentar(CORREO)));

    const fila = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: CORREO },
    });
    expect(fila.failedCount).toBe(3);
    expect(fila.lockedUntil).toBeNull();
  });
});

describe('El contador es por correo y solo por correo (D-003)', () => {
  it('bloquear un correo no afecta a otro', async () => {
    await crearUsuario({ email: CORREO });
    await crearUsuario({ email: 'otro@ejemplo.cl' });

    for (let i = 0; i < 5; i += 1) await intentar(CORREO);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'otro@ejemplo.cl', password: CONTRASENA })
      .expect(200);
  });

  it('cuenta intentos sobre correos que no corresponden a ninguna cuenta', async () => {
    for (let i = 0; i < 5; i += 1) await intentar(INEXISTENTE);

    const fila = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: INEXISTENTE },
    });
    expect(fila.lockedUntil).not.toBeNull();
  });
});
