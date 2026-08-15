/**
 * Listado del padrón (T083, FR-015, SC-021, SC-023, SC-034, D-011, D-016).
 */
import { Role, UserStatus } from '@prisma/client';
import { PAGE_SIZE } from '@foodvoice/shared';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';
import { prisma } from './setup';

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

function listar(consulta: Record<string, string | number> = {}) {
  return entorno
    .http()
    .get('/api/v1/admin/users')
    .query(consulta)
    .set('Cookie', conSesion(sesionAdmin));
}

describe('Forma de la respuesta (FR-015, FR-016)', () => {
  it('devuelve la forma paginada compartida, sin campos propios', async () => {
    const respuesta = await listar().expect(200);

    expect(Object.keys(respuesta.body).sort()).toEqual(
      ['items', 'total', 'page', 'pageSize', 'totalPages'].sort(),
    );
    expect(respuesta.body.pageSize).toBe(PAGE_SIZE);
  });

  it('ningún usuario del listado expone la contraseña ni su hash', async () => {
    await crearUsuario({ email: 'maria@ejemplo.cl' });

    const respuesta = await listar().expect(200);
    const cuerpo = JSON.stringify(respuesta.body);

    expect(cuerpo).not.toContain('passwordHash');
    expect(cuerpo).not.toContain('$2b$');
    expect(cuerpo).not.toContain('searchNormalized');
    expect(Object.keys(respuesta.body.items[0]).sort()).toEqual(
      ['id', 'fullName', 'email', 'phone', 'role', 'status', 'createdAt'].sort(),
    );
  });

  it('las fechas son ISO 8601 en UTC (api CHK002)', async () => {
    const respuesta = await listar().expect(200);
    expect(respuesta.body.items[0].createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

describe('Orden estable entre páginas (SC-023, D-016)', () => {
  it('recorrer 1 → 2 → 1 → 2 devuelve las mismas personas en las mismas páginas', async () => {
    // Creadas en un bucle, es decir compartiendo marca de tiempo: es el caso
    // que `created_at DESC` a secas no ordena de forma total.
    for (let i = 0; i < 25; i += 1) {
      await crearUsuario({ email: `usuario${i}@ejemplo.cl` });
    }
    // Se les fuerza el mismo `created_at` para que el desempate por `id` sea lo
    // único que puede hacer el orden total.
    await prisma.$executeRawUnsafe(
      `UPDATE "user" SET created_at = TIMESTAMPTZ '2026-08-15 12:00:00+00'`,
    );

    const primeraA = await listar({ page: 1 }).expect(200);
    const segundaA = await listar({ page: 2 }).expect(200);
    const primeraB = await listar({ page: 1 }).expect(200);
    const segundaB = await listar({ page: 2 }).expect(200);

    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((i) => i.id);

    expect(ids(primeraB)).toEqual(ids(primeraA));
    expect(ids(segundaB)).toEqual(ids(segundaA));

    // Y ningún usuario aparece en las dos páginas.
    const repetidos = ids(primeraA).filter((id) => ids(segundaA).includes(id));
    expect(repetidos).toEqual([]);
  });

  it('la primera página trae 20 y la segunda el resto', async () => {
    for (let i = 0; i < 25; i += 1) {
      await crearUsuario({ email: `usuario${i}@ejemplo.cl` });
    }

    const primera = await listar({ page: 1 }).expect(200);
    const segunda = await listar({ page: 2 }).expect(200);

    expect(primera.body.items).toHaveLength(20);
    // 25 más el administrador.
    expect(primera.body.total).toBe(26);
    expect(primera.body.totalPages).toBe(2);
    expect(segunda.body.items).toHaveLength(6);
  });
});

describe('Búsqueda (FR-015, SC-021, D-011)', () => {
  beforeEach(async () => {
    await crearUsuario({ fullName: 'María Pérez', email: 'maria.perez@ejemplo.cl' });
    await crearUsuario({ fullName: 'Juan Nuñez', email: 'juan.nunez@ejemplo.cl' });
    await crearUsuario({ fullName: 'Ana Del 100% Club', email: 'ana@ejemplo.cl' });
  });

  it('«MARÍA» encuentra a «María Pérez»: insensible a mayúsculas y acentos', async () => {
    const respuesta = await listar({ search: 'MARÍA' }).expect(200);
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].fullName).toBe('María Pérez');
  });

  it('«maria» sin tilde también la encuentra', async () => {
    const respuesta = await listar({ search: 'maria' }).expect(200);
    expect(respuesta.body.items).toHaveLength(1);
  });

  it('«Nunez» encuentra a «Nuñez» y viceversa', async () => {
    const sinEne = await listar({ search: 'Nunez' }).expect(200);
    const conEne = await listar({ search: 'Nuñez' }).expect(200);

    expect(sinEne.body.items).toHaveLength(1);
    expect(conEne.body.items).toHaveLength(1);
    expect(sinEne.body.items[0].id).toBe(conEne.body.items[0].id);
  });

  it('busca sobre nombre Y correo a la vez', async () => {
    const porCorreo = await listar({ search: 'juan.nunez@' }).expect(200);
    expect(porCorreo.body.items).toHaveLength(1);
  });

  it('un término con % se escapa y busca ese texto literal', async () => {
    // Sin el escape, `%` devolvería el padrón completo (D-011).
    const respuesta = await listar({ search: '100%' }).expect(200);
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].fullName).toBe('Ana Del 100% Club');
  });

  it('un término de solo % no devuelve el padrón completo', async () => {
    const respuesta = await listar({ search: '%' }).expect(200);
    expect(respuesta.body.total).toBeLessThan(4);
  });

  it('sin coincidencias devuelve 200 con lista vacía, no un error', async () => {
    const respuesta = await listar({ search: 'nadie-con-este-nombre' }).expect(200);
    expect(respuesta.body.items).toEqual([]);
    expect(respuesta.body.total).toBe(0);
  });
});

describe('Filtros combinables (FR-015, SC-034)', () => {
  beforeEach(async () => {
    await crearUsuario({
      fullName: 'María Cliente',
      email: 'maria.cliente@ejemplo.cl',
      role: Role.CLIENTE,
    });
    await crearUsuario({
      fullName: 'María Negocio',
      email: 'maria.negocio@ejemplo.cl',
      role: Role.NEGOCIO,
    });
    await crearUsuario({
      fullName: 'María Baja',
      email: 'maria.baja@ejemplo.cl',
      role: Role.CLIENTE,
      status: UserStatus.DESACTIVADO,
    });
  });

  it('los resultados cumplen TODOS los criterios aplicados', async () => {
    const respuesta = await listar({
      search: 'maría',
      role: Role.CLIENTE,
      status: UserStatus.ACTIVO,
    }).expect(200);

    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].fullName).toBe('María Cliente');
  });

  it('`total` es el recuento de los resultados filtrados, no el del padrón', async () => {
    const respuesta = await listar({ role: Role.CLIENTE }).expect(200);
    expect(respuesta.body.total).toBe(2);
  });

  it('el filtro por estado alcanza también a los desactivados', async () => {
    const respuesta = await listar({ status: UserStatus.DESACTIVADO }).expect(200);
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].fullName).toBe('María Baja');
  });
});

describe('`page` fuera de rango (api § GET /admin/users)', () => {
  it('devuelve 200 con items vacío, conservando total, page y totalPages', async () => {
    await crearUsuario({ email: 'maria@ejemplo.cl' });

    const respuesta = await listar({ page: 5 }).expect(200);

    expect(respuesta.body.items).toEqual([]);
    expect(respuesta.body.total).toBe(2);
    expect(respuesta.body.page).toBe(5);
    expect(respuesta.body.totalPages).toBe(1);
  });

  it('`page` menor que 1 sí es un error de validación', async () => {
    const respuesta = await listar({ page: 0 }).expect(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });
});
