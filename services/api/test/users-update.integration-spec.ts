/**
 * Edición de datos de contacto y correo
 * (T084, FR-010, SC-032, security CHK008, data CHK025).
 */
import { Role, UserStatus } from '@prisma/client';
import { normalizarBusqueda } from '@foodvoice/shared';
import {
  CONTRASENA,
  conSesion,
  crearEntorno,
  crearUsuario,
  iniciarSesion,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const ANTIGUO = 'maria.perez@ejemplo.cl';
const NUEVO = 'maria.soto@ejemplo.cl';

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

function editar(id: string, datos: Record<string, unknown>) {
  return entorno
    .http()
    .patch(`/api/v1/admin/users/${id}`)
    .set('Cookie', conSesion(sesionAdmin))
    .send(datos);
}

describe('Los cambios se reflejan conservando rol y estado (FR-010)', () => {
  it('edita los tres campos de contacto', async () => {
    const usuario = await crearUsuario({
      fullName: 'María Pérez',
      email: ANTIGUO,
      role: Role.NEGOCIO,
      status: UserStatus.DESACTIVADO,
    });

    const respuesta = await editar(usuario.id, {
      fullName: 'María Soto',
      email: NUEVO,
      phone: '+56999998888',
    }).expect(200);

    expect(respuesta.body).toMatchObject({
      fullName: 'María Soto',
      email: NUEVO,
      phone: '+56999998888',
      // Conserva rol y estado: la edición no es una acción de impacto.
      role: Role.NEGOCIO,
      status: UserStatus.DESACTIVADO,
    });
  });

  it('un cuerpo parcial deja intacto lo que no envía', async () => {
    const usuario = await crearUsuario({ fullName: 'María Pérez', email: ANTIGUO });

    await editar(usuario.id, { phone: '+56999998888' }).expect(200);

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.fullName).toBe('María Pérez');
    expect(despues.email).toBe(ANTIGUO);
    expect(despues.phone).toBe('+56999998888');
  });

  it('recalcula search_normalized al cambiar nombre o correo (D-011)', async () => {
    const usuario = await crearUsuario({ fullName: 'María Pérez', email: ANTIGUO });

    await editar(usuario.id, { fullName: 'María Soto', email: NUEVO }).expect(200);

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.searchNormalized).toBe(normalizarBusqueda(`María Soto ${NUEVO}`));

    // Y por tanto se la encuentra por el dato nuevo, no por el antiguo.
    const buscado = await entorno
      .http()
      .get('/api/v1/admin/users')
      .query({ search: 'Soto' })
      .set('Cookie', conSesion(sesionAdmin))
      .expect(200);
    expect(buscado.body.items).toHaveLength(1);
  });

  it('un cuerpo sin ningún campo se rechaza con 400 en español', async () => {
    const usuario = await crearUsuario({ email: ANTIGUO });

    const respuesta = await editar(usuario.id, {}).expect(400);
    expect(respuesta.body.error.message).toBe('Debes modificar al menos un dato.');
  });

  it('no admite role, status ni password: los descarta en silencio', async () => {
    const usuario = await crearUsuario({ email: ANTIGUO, role: Role.CLIENTE });

    await editar(usuario.id, {
      phone: '+56999998888',
      role: Role.ADMINISTRADOR,
      status: UserStatus.DESACTIVADO,
      password: 'otra-cosa-8',
    }).expect(200);

    const despues = await prisma.user.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(despues.role).toBe(Role.CLIENTE);
    expect(despues.status).toBe(UserStatus.ACTIVO);
  });

  it('un usuario inexistente da 404', async () => {
    await editar('99999999-9999-4999-8999-999999999999', { phone: '+56999998888' }).expect(404);
  });
});

describe('El cambio de correo NO revoca la sesión abierta (SC-032, security CHK008)', () => {
  it('la sesión del usuario sigue viva tras editarle el correo', async () => {
    const usuario = await crearUsuario({ email: ANTIGUO });
    const sesionSuya = await iniciarSesion(entorno, ANTIGUO);

    await editar(usuario.id, { email: NUEVO }).expect(200);

    // Editar el contacto no es una acción de impacto: no hay razón para
    // expulsar a quien no cambió de identidad ni de privilegios.
    await entorno.http().get('/api/v1/auth/me').set('Cookie', conSesion(sesionSuya)).expect(200);
    expect(await prisma.session.count({ where: { userId: usuario.id, revokedAt: null } })).toBe(1);
  });

  it('el siguiente inicio de sesión exige el correo nuevo y el anterior deja de servir', async () => {
    const usuario = await crearUsuario({ email: ANTIGUO });

    await editar(usuario.id, { email: NUEVO }).expect(200);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: NUEVO, password: CONTRASENA })
      .expect(200);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: ANTIGUO, password: CONTRASENA })
      .expect(401);
  });
});

describe('La edición no toca login_attempt_control (data CHK025)', () => {
  it('si el correo NUEVO tiene un bloqueo vigente, la fila no se toca y el usuario queda sujeto a él', async () => {
    // Es la consecuencia correcta de que la tabla controle *correos ingresados*
    // y no *usuarios*: alguien estuvo intentando entrar con ese correo, y el
    // bloqueo debe seguir aplicándose exista o no una cuenta detrás.
    const usuario = await crearUsuario({ email: ANTIGUO });

    for (let i = 0; i < 5; i += 1) {
      await entorno
        .http()
        .post('/api/v1/auth/login')
        .send({ email: NUEVO, password: 'incorrecta1' });
    }
    const bloqueoAntes = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: NUEVO },
    });

    await editar(usuario.id, { email: NUEVO }).expect(200);

    const bloqueoDespues = await prisma.loginAttemptControl.findUniqueOrThrow({
      where: { email: NUEVO },
    });
    expect(bloqueoDespues.lockedUntil?.getTime()).toBe(bloqueoAntes.lockedUntil?.getTime());

    // Y el usuario editado queda bloqueado aunque nunca haya fallado un intento.
    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: NUEVO, password: CONTRASENA })
      .expect(423);
  });

  it('el restablecimiento de contraseña es la salida rápida de ese bloqueo heredado', async () => {
    const usuario = await crearUsuario({ email: ANTIGUO });
    for (let i = 0; i < 5; i += 1) {
      await entorno
        .http()
        .post('/api/v1/auth/login')
        .send({ email: NUEVO, password: 'incorrecta1' });
    }
    await editar(usuario.id, { email: NUEVO }).expect(200);

    await entorno
      .http()
      .post(`/api/v1/admin/users/${usuario.id}/password-reset`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ password: 'contrasena-nueva' })
      .expect(204);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: NUEVO, password: 'contrasena-nueva' })
      .expect(200);
  });

  it('editar el correo DESDE un valor bloqueado no libera esa fila', async () => {
    // El caso inverso es simétrico y también deliberado: la fila sigue
    // protegiendo al correo antiguo de quien estuviera probándolo.
    const usuario = await crearUsuario({ email: ANTIGUO });
    for (let i = 0; i < 5; i += 1) {
      await entorno
        .http()
        .post('/api/v1/auth/login')
        .send({ email: ANTIGUO, password: 'incorrecta1' });
    }

    await editar(usuario.id, { email: NUEVO }).expect(200);

    expect(await prisma.loginAttemptControl.count({ where: { email: ANTIGUO } })).toBe(1);
  });
});
