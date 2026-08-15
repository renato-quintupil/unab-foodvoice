/**
 * Alta y reactivación (T087, FR-009, FR-013, FR-014, SC-004, SC-005, SC-033).
 *
 * Es la única batería que cruza deliberadamente a US1, porque **SC-004 mide
 * precisamente esa costura**: que un usuario recién creado pueda iniciar sesión
 * de inmediato con el rol asignado. Comprobar el alta y el inicio de sesión por
 * separado dejaría sin verificar justo lo que el criterio exige.
 */
import { Role, UserStatus } from '@prisma/client';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
import { prisma } from './setup';

const PASSWORD = 'contrasena8';

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

function alta(datos: Record<string, unknown>) {
  return entorno
    .http()
    .post('/api/v1/admin/users')
    .set('Cookie', conSesion(sesionAdmin))
    .send(datos);
}

describe('Alta con cada rol y su inicio de sesión inmediato (SC-004)', () => {
  it.each(Object.values(Role))('rol %s', async (rol) => {
    const email = `nuevo.${rol.toLowerCase()}@ejemplo.cl`;

    const creado = await alta({
      fullName: 'Persona Nueva',
      email,
      phone: '+56911112222',
      password: PASSWORD,
      role: rol,
    }).expect(201);

    expect(creado.body.status).toBe(UserStatus.ACTIVO);
    expect(creado.body).not.toHaveProperty('password');
    expect(creado.body).not.toHaveProperty('passwordHash');

    // En la misma prueba: puede entrar de inmediato, con el rol asignado.
    const respuesta = await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    expect(respuesta.body.user.role).toBe(rol);
  });
});

describe('Campos obligatorios (FR-014, SC-005)', () => {
  const completo = {
    fullName: 'Persona Nueva',
    email: 'nueva@ejemplo.cl',
    phone: '+56911112222',
    password: PASSWORD,
    role: Role.CLIENTE,
  };

  it.each(['fullName', 'email', 'phone', 'password', 'role'])(
    'omitir %s da 400 con mensaje en español y no crea el usuario',
    async (campo) => {
      const parcial: Record<string, unknown> = { ...completo };
      delete parcial[campo];

      const respuesta = await alta(parcial).expect(400);

      expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
      expect(respuesta.body.error.fields[campo]).toBeTruthy();
      expect(await prisma.user.count({ where: { email: completo.email } })).toBe(0);
    },
  );

  it('una contraseña de 7 caracteres se rechaza indicando el mínimo (FR-032, SC-016)', async () => {
    const respuesta = await alta({ ...completo, password: '1234567' }).expect(400);
    expect(respuesta.body.error.fields.password).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });

  it('el correo se normaliza al guardarse (D-015)', async () => {
    await alta({ ...completo, email: '  NUEVA@Ejemplo.CL ' }).expect(201);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { email: 'nueva@ejemplo.cl' },
    });
    expect(usuario.email).toBe('nueva@ejemplo.cl');
  });

  it('registra CREAR en la misma transacción (FR-034)', async () => {
    const creado = await alta(completo).expect(201);

    const entradas = await prisma.adminAuditLog.findMany();
    expect(entradas).toHaveLength(1);
    expect(entradas[0]?.action).toBe('CREAR');
    expect(entradas[0]?.targetUserId).toBe(creado.body.id);
  });
});

describe('Reactivación (FR-013, SC-033)', () => {
  it('un usuario reactivado vuelve a entrar con sus credenciales previas', async () => {
    // Sin restablecimiento: la reactivación conserva las credenciales.
    const usuario = await crearUsuario({
      email: 'maria@ejemplo.cl',
      password: PASSWORD,
      status: UserStatus.DESACTIVADO,
    });

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'maria@ejemplo.cl', password: PASSWORD })
      .expect(401);

    await entorno
      .http()
      .put(`/api/v1/admin/users/${usuario.id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.ACTIVO })
      .expect(200);

    await entorno
      .http()
      .post('/api/v1/auth/login')
      .send({ email: 'maria@ejemplo.cl', password: PASSWORD })
      .expect(200);
  });

  it('la reactivación conserva el rol previo y registra REACTIVAR', async () => {
    const usuario = await crearUsuario({
      email: 'maria@ejemplo.cl',
      role: Role.REPARTIDOR,
      status: UserStatus.DESACTIVADO,
    });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/admin/users/${usuario.id}/status`)
      .set('Cookie', conSesion(sesionAdmin))
      .send({ status: UserStatus.ACTIVO })
      .expect(200);

    expect(respuesta.body.role).toBe(Role.REPARTIDOR);
    const entradas = await prisma.adminAuditLog.findMany();
    expect(entradas.map((e) => e.action)).toEqual(['REACTIVAR']);
  });
});
