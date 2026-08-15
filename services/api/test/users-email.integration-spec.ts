/**
 * Unicidad del correo (T079, FR-017, RN-005, SC-011, D-015, api CHK028).
 *
 * La garantía la da la **restricción única del motor**, no una comprobación
 * previa del servicio. Estos casos ejercen exactamente los tres caminos por
 * los que esa garantía podría fallar en silencio.
 */
import { Role, UserStatus } from '@prisma/client';
import { MSG_CORREO_YA_EXISTE } from '@foodvoice/shared';
import {
  CONTRASENA,
  conSesion,
  crearEntorno,
  crearUsuario,
  iniciarSesion,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const CORREO = 'maria.perez@ejemplo.cl';

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

function alta(email: string, extra: Record<string, unknown> = {}) {
  return entorno
    .http()
    .post('/api/v1/admin/users')
    .set('Cookie', conSesion(sesionAdmin))
    .send({
      fullName: 'María Pérez',
      email,
      phone: '+56911112222',
      password: CONTRASENA,
      role: Role.CLIENTE,
      ...extra,
    });
}

describe('Alta con un correo ya usado', () => {
  it('devuelve 409 EMAIL_ALREADY_EXISTS con el mensaje en español', async () => {
    await alta(CORREO).expect(201);

    const respuesta = await alta(CORREO).expect(409);
    expect(respuesta.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(respuesta.body.error.message).toBe(MSG_CORREO_YA_EXISTE);
  });

  it('la respuesta NO filtra el nombre de la restricción, la columna ni el correo', async () => {
    await alta(CORREO).expect(201);
    const respuesta = await alta(CORREO).expect(409);

    const cuerpo = JSON.stringify(respuesta.body);
    expect(cuerpo).not.toContain('user_email_key');
    expect(cuerpo).not.toContain('Unique constraint');
    expect(cuerpo).not.toContain('P2002');
  });

  it('rechaza el alta VARIANDO LAS MAYÚSCULAS (D-015, SC-011)', async () => {
    // Es el caso que se rompería si la normalización se omitiera en algún
    // camino de escritura.
    await alta(CORREO).expect(201);
    await alta(CORREO.toUpperCase()).expect(409);
    await alta(`  ${CORREO.toUpperCase()}  `).expect(409);

    expect(await prisma.user.count({ where: { email: CORREO } })).toBe(1);
  });

  it('rechaza el alta con el correo de un usuario DESACTIVADO (RN-005)', async () => {
    // No hay borrado físico, así que el correo queda reservado y su
    // reactivación siempre es posible.
    await crearUsuario({ email: CORREO, status: UserStatus.DESACTIVADO });

    const respuesta = await alta(CORREO).expect(409);
    expect(respuesta.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('un alta rechazada no deja entrada en la bitácora', async () => {
    await alta(CORREO).expect(201);
    const entradasAntes = await prisma.adminAuditLog.count();

    await alta(CORREO).expect(409);

    expect(await prisma.adminAuditLog.count()).toBe(entradasAntes);
  });
});

describe('Dos altas concurrentes del mismo correo (api CHK028, D-018)', () => {
  it('producen exactamente un usuario y un 409 — nunca un 500', async () => {
    const [una, otra] = await Promise.all([alta(CORREO), alta(CORREO)]);

    const estados = [una.status, otra.status].sort();
    expect(estados).toEqual([201, 409]);

    // Desde fuera, la carrera es indistinguible del caso normal.
    const fallida = una.status === 409 ? una : otra;
    expect(fallida.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(fallida.body.error.message).toBe(MSG_CORREO_YA_EXISTE);

    expect(await prisma.user.count({ where: { email: CORREO } })).toBe(1);
  });

  it('la carrera deja exactamente una entrada CREAR en la bitácora', async () => {
    await Promise.all([alta(CORREO), alta(CORREO)]);

    const entradas = await prisma.adminAuditLog.findMany({ where: { action: 'CREAR' } });
    expect(entradas).toHaveLength(1);
  });
});

describe('Edición hacia un correo ya usado', () => {
  it('devuelve 409 y no aplica ningún cambio', async () => {
    await alta(CORREO).expect(201);
    const otro = await crearUsuario({ email: 'otro@ejemplo.cl', fullName: 'Otro Nombre' });

    await entorno
      .http()
      .patch(`/api/v1/admin/users/${otro.id}`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ email: CORREO, fullName: 'Nombre Nuevo' })
      .expect(409);

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: otro.id } });
    expect(despues.email).toBe('otro@ejemplo.cl');
    expect(despues.fullName).toBe('Otro Nombre');
  });
});
