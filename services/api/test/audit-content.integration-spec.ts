/**
 * Contenido e inmutabilidad de la bitácora
 * (T082, FR-034, Principio X, security CHK032, security CHK034, data CHK008).
 */
import { AdminAction, Role, UserStatus } from '@prisma/client';
import { CONTRASENA, conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
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

describe('Cada acción deja exactamente una entrada (FR-034)', () => {
  it('las seis acciones registrables, con actor, afectado, acción e instante', async () => {
    const antes = new Date(Date.now() - 1000);

    const creado = await entorno
      .http()
      .post('/api/v1/admin/users')
      .set('Cookie', conSesion(sesionAdmin))
      .send({
        fullName: 'María Pérez',
        email: AFECTADO,
        phone: '+56911112222',
        password: CONTRASENA,
        role: Role.CLIENTE,
      })
      .expect(201);

    const id = creado.body.id as string;

    await entorno
      .http()
      .patch(`/api/v1/admin/users/${id}`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ phone: '+56999998888' })
      .expect(200);

    await entorno
      .http()
      .put(`/api/v1/admin/users/${id}/role`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ role: Role.NEGOCIO })
      .expect(200);

    await entorno
      .http()
      .put(`/api/v1/admin/users/${id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.DESACTIVADO })
      .expect(200);

    await entorno
      .http()
      .put(`/api/v1/admin/users/${id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.ACTIVO })
      .expect(200);

    await entorno
      .http()
      .post(`/api/v1/admin/users/${id}/password-reset`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ password: 'otra-contrasena' })
      .expect(204);

    const entradas = await prisma.adminAuditLog.findMany({ orderBy: { occurredAt: 'asc' } });
    expect(entradas.map((e) => e.action)).toEqual([
      AdminAction.CREAR,
      AdminAction.EDITAR,
      AdminAction.CAMBIAR_ROL,
      AdminAction.DESACTIVAR,
      AdminAction.REACTIVAR,
      AdminAction.RESTABLECER_PASSWORD,
    ]);

    for (const entrada of entradas) {
      expect(entrada.actorUserId).toBe(adminId);
      expect(entrada.targetUserId).toBe(id);
      expect(entrada.occurredAt.getTime()).toBeGreaterThanOrEqual(antes.getTime());
      // Actor y afectado son siempre distintos desde la aplicación: FR-027 lo
      // impone. Su igualdad es la marca de una recuperación operativa (D-010).
      expect(entrada.actorUserId).not.toBe(entrada.targetUserId);
    }
  });
});

describe('Ninguna columna contiene datos personales (Principio X)', () => {
  it('los usuarios se registran por referencia, nunca por copia', async () => {
    const usuario = await crearUsuario({
      fullName: 'María Pérez',
      email: AFECTADO,
      phone: '+56911112222',
    });

    await entorno
      .http()
      .patch(`/api/v1/admin/users/${usuario.id}`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ fullName: 'María Pérez Soto' })
      .expect(200);

    const entradas = await prisma.adminAuditLog.findMany();
    const columnas = Object.keys(entradas[0] ?? {}).sort();

    expect(columnas).toEqual(
      ['id', 'actorUserId', 'targetUserId', 'action', 'occurredAt'].sort(),
    );

    const contenido = JSON.stringify(entradas);
    for (const dato of ['María Pérez', AFECTADO, '+56911112222']) {
      expect(contenido).not.toContain(dato);
    }
  });

  it('el restablecimiento NO guarda la contraseña, ni en claro ni con hash', async () => {
    const usuario = await crearUsuario({ email: AFECTADO });

    await entorno
      .http()
      .post(`/api/v1/admin/users/${usuario.id}/password-reset`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ password: 'secreta-nueva' })
      .expect(204);

    const contenido = JSON.stringify(await prisma.adminAuditLog.findMany());
    expect(contenido).not.toContain('secreta-nueva');
    expect(contenido).not.toContain('$2b$');
  });
});

describe('Los eventos de autenticación NO dejan entrada (supuesto 27, security CHK032)', () => {
  it('inicios de sesión, fallos, bloqueos y cierres no se registran', async () => {
    await crearUsuario({ email: AFECTADO });

    // Un inicio correcto.
    const cookie = await iniciarSesion(entorno, AFECTADO);
    // Cinco fallos, que además producen un bloqueo.
    for (let i = 0; i < 5; i += 1) {
      await entorno
        .http()
        .post('/api/v1/auth/login')
        .send({ email: AFECTADO, password: 'incorrecta1' });
    }
    // Un intento sobre un correo inexistente.
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@ejemplo.cl', password: CONTRASENA });
    // Un cierre explícito.
    await entorno.http().post('/api/v1/auth/logout').set('Cookie', conSesion(cookie)).expect(204);

    // La exclusión es estructural: `AdminAction` no tiene ningún valor que los
    // cubra, así que no depende de que el código recuerde no escribirlos.
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });
});

describe('Inmutabilidad impuesta por el motor (data CHK008, security CHK034)', () => {
  async function unaEntrada(): Promise<string> {
    const usuario = await crearUsuario({ email: AFECTADO });
    await entorno
      .http()
      .patch(`/api/v1/admin/users/${usuario.id}`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ phone: '+56999998888' })
      .expect(200);
    const entrada = await prisma.adminAuditLog.findFirstOrThrow();
    return entrada.id;
  }

  it('un UPDATE directo contra la tabla falla por el disparador', async () => {
    const id = await unaEntrada();

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE admin_audit_log SET action = 'CREAR' WHERE id = '${id}'::uuid`,
      ),
    ).rejects.toThrow(/solo inserción/i);
  });

  it('un DELETE directo contra la tabla falla por el disparador', async () => {
    const id = await unaEntrada();

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM admin_audit_log WHERE id = '${id}'::uuid`),
    ).rejects.toThrow(/solo inserción/i);

    expect(await prisma.adminAuditLog.count()).toBe(1);
  });

  it('un deleteMany del ORM tampoco puede: la regla no vive en la disciplina', async () => {
    // Es exactamente la llamada que alguien escribiría de buena fe en un test o
    // en un script de mantenimiento, y la razón de que el disparador exista.
    await unaEntrada();

    await expect(prisma.adminAuditLog.deleteMany()).rejects.toThrow(/solo inserción/i);
    expect(await prisma.adminAuditLog.count()).toBe(1);
  });

  it('el disparador NO impide insertar', async () => {
    await unaEntrada();
    expect(await prisma.adminAuditLog.count()).toBe(1);
  });
});
