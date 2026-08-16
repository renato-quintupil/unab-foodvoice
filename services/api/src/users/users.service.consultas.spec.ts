/**
 * `UsersService`: listado, alta, edición y restablecimiento.
 *
 * Se separa de `users.service.spec.ts` —que cubre la autoprotección y la
 * idempotencia— porque son dos preguntas distintas: allí, qué reglas de negocio
 * aplica; aquí, qué consulta construye y qué escribe.
 *
 * Lo que estos casos **no** demuestran es que las transacciones sean atómicas
 * ni que la restricción única funcione: eso lo verifica la capa de integración,
 * y un doble probaría el doble, no la regla.
 */
import { Prisma, Role, UserStatus } from '@prisma/client';
import { HashingService } from '../auth/hashing.service';
import { LoginAttemptService } from '../auth/login-attempt.service';
import { SessionService } from '../auth/session.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';

const fila = {
  id: ADMIN,
  fullName: 'Admin Uno',
  email: 'admin@ejemplo.cl',
  phone: '+56911112222',
  passwordHash: '$2b$12$hash',
  role: Role.ADMINISTRADOR,
  status: UserStatus.ACTIVO,
  searchNormalized: 'admin uno admin@ejemplo.cl',
  createdAt: new Date('2026-08-15T12:00:00.000Z'),
  updatedAt: new Date('2026-08-15T12:00:00.000Z'),
};

/** Servicio con dobles enchufables para cada colaborador. */
function crearServicio(opciones: {
  prisma: unknown;
  hash?: jest.Mock;
  revocarTodasDe?: jest.Mock;
  limpiar?: jest.Mock;
  registrar?: jest.Mock;
}) {
  return new UsersService(
    opciones.prisma as PrismaService,
    { hash: opciones.hash ?? jest.fn().mockResolvedValue('hash-nuevo') } as unknown as HashingService,
    { revocarTodasDe: opciones.revocarTodasDe ?? jest.fn() } as unknown as SessionService,
    { limpiar: opciones.limpiar ?? jest.fn() } as unknown as LoginAttemptService,
    { registrar: opciones.registrar ?? jest.fn() } as unknown as AuditService,
  );
}

/** Prisma cuyo `$transaction` con arreglo devuelve el conteo y las filas dadas. */
function prismaDeListado(total: number, filas: unknown[]) {
  const consultas: Record<string, unknown>[] = [];
  return {
    consultas,
    prisma: {
      user: {
        count: jest.fn((argumentos: Record<string, unknown>) => {
          consultas.push(argumentos);
          return total;
        }),
        findMany: jest.fn((argumentos: Record<string, unknown>) => {
          consultas.push(argumentos);
          return filas;
        }),
      },
      $transaction: () => Promise.resolve([total, filas]),
    },
  };
}

describe('Listado (FR-015, D-011, D-016)', () => {
  it('aplica el orden total `created_at DESC, id DESC`', async () => {
    const { prisma, consultas } = prismaDeListado(0, []);
    await crearServicio({ prisma }).listar({ page: 1 });

    const consulta = consultas.find((c) => 'orderBy' in c);
    // El desempate por `id` es obligatorio: sin él, dos altas con la misma
    // marca de tiempo pueden intercambiarse entre consultas.
    expect(consulta?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('normaliza y escapa el término de búsqueda', async () => {
    const { prisma, consultas } = prismaDeListado(0, []);
    await crearServicio({ prisma }).listar({ page: 1, search: '  MARÍA 100% ' });

    const where = consultas[0]?.where as { searchNormalized?: { contains: string } };
    // Sin tilde, en minúsculas, recortado, y con el `%` escapado — que sin
    // escapar devolvería el padrón completo.
    expect(where.searchNormalized?.contains).toBe('maria 100\\%');
  });

  it('un término vacío o de solo espacios no añade filtro de búsqueda', async () => {
    const { prisma, consultas } = prismaDeListado(0, []);
    await crearServicio({ prisma }).listar({ page: 1, search: '   ' });
    expect(consultas[0]?.where).toEqual({});
  });

  it('los filtros de rol y estado son combinables entre sí', async () => {
    const { prisma, consultas } = prismaDeListado(0, []);
    await crearServicio({ prisma }).listar({
      page: 1,
      role: Role.CLIENTE,
      status: UserStatus.ACTIVO,
      search: 'maria',
    });

    expect(consultas[0]?.where).toMatchObject({
      role: Role.CLIENTE,
      status: UserStatus.ACTIVO,
      searchNormalized: { contains: 'maria' },
    });
  });

  it('salta la página anterior con el tamaño de página compartido', async () => {
    const { prisma, consultas } = prismaDeListado(0, []);
    await crearServicio({ prisma }).listar({ page: 3 });

    const consulta = consultas.find((c) => 'skip' in c);
    expect(consulta?.skip).toBe(40);
    expect(consulta?.take).toBe(20);
  });

  it('devuelve la forma paginada compartida y nunca el hash', async () => {
    const { prisma } = prismaDeListado(1, [fila]);
    const pagina = await crearServicio({ prisma }).listar({ page: 1 });

    expect(Object.keys(pagina).sort()).toEqual(
      ['items', 'total', 'page', 'pageSize', 'totalPages'].sort(),
    );
    expect(pagina.pageSize).toBe(20);
    expect(JSON.stringify(pagina)).not.toContain('passwordHash');
    expect(JSON.stringify(pagina)).not.toContain('searchNormalized');
    expect(Object.keys(pagina.items[0] ?? {}).sort()).toEqual(
      ['id', 'fullName', 'email', 'phone', 'role', 'status', 'createdAt'].sort(),
    );
    expect(pagina.items[0]?.createdAt).toBe('2026-08-15T12:00:00.000Z');
  });

  it('`totalPages` es al menos 1 aunque no haya resultados', async () => {
    const { prisma } = prismaDeListado(0, []);
    const pagina = await crearServicio({ prisma }).listar({ page: 3 });

    // Devolver 0 obligaría a la interfaz a tratar «sin resultados» como un
    // estado distinto de «una página fuera de rango».
    expect(pagina.totalPages).toBe(1);
    expect(pagina.page).toBe(3);
    expect(pagina.items).toEqual([]);
  });

  it('calcula `totalPages` redondeando hacia arriba', async () => {
    const { prisma } = prismaDeListado(41, []);
    expect((await crearServicio({ prisma }).listar({ page: 1 })).totalPages).toBe(3);
  });
});

describe('Alta (FR-009, FR-017, FR-034)', () => {
  const datos = {
    fullName: 'María Pérez',
    email: 'maria.perez@ejemplo.cl',
    phone: '+56911112222',
    password: 'contrasena8',
    role: Role.CLIENTE,
  };

  function prismaConTx(tx: Record<string, unknown>) {
    return { $transaction: (fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)) };
  }

  it('hashea la contraseña, calcula search_normalized y nace ACTIVO', async () => {
    const create = jest.fn().mockResolvedValue(fila);
    const registrar = jest.fn();
    const servicio = crearServicio({
      prisma: prismaConTx({ user: { create } }),
      registrar,
    });

    await servicio.crear(datos, ADMIN);

    const escrito = create.mock.calls[0][0].data;
    expect(escrito.passwordHash).toBe('hash-nuevo');
    expect(escrito.password).toBeUndefined();
    expect(escrito.searchNormalized).toBe('maria perez maria.perez@ejemplo.cl');
    expect(escrito.status).toBe(UserStatus.ACTIVO);
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREAR', actorUserId: ADMIN }),
      expect.anything(),
    );
  });

  it('traduce la violación de unicidad a 409 y NUNCA la deja escapar como 500', async () => {
    const violacion = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6',
    });
    const servicio = crearServicio({
      prisma: prismaConTx({ user: { create: jest.fn().mockRejectedValue(violacion) } }),
    });

    await expect(servicio.crear(datos, ADMIN)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
    });
  });

  it('un error que NO es de unicidad se propaga tal cual', async () => {
    const otro = new Error('la base de datos no responde');
    const servicio = crearServicio({
      prisma: prismaConTx({ user: { create: jest.fn().mockRejectedValue(otro) } }),
    });

    await expect(servicio.crear(datos, ADMIN)).rejects.toBe(otro);
  });
});

describe('Edición (FR-010)', () => {
  function prismaConTx(tx: Record<string, unknown>) {
    return { $transaction: (fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)) };
  }

  it('recalcula search_normalized con los valores resultantes, no solo con los enviados', async () => {
    const update = jest.fn().mockResolvedValue(fila);
    const servicio = crearServicio({
      prisma: prismaConTx({
        user: { findUnique: jest.fn().mockResolvedValue(fila), update },
      }),
    });

    // Solo cambia el nombre: el correo se toma del valor actual.
    await servicio.editar(ADMIN, { fullName: 'Admin Dos' }, ADMIN);

    const escrito = update.mock.calls[0][0].data;
    expect(escrito.searchNormalized).toBe('admin dos admin@ejemplo.cl');
    expect(escrito.email).toBeUndefined();
    expect(escrito.phone).toBeUndefined();
  });

  it('escribe solo los campos presentes en el cuerpo', async () => {
    const update = jest.fn().mockResolvedValue(fila);
    const servicio = crearServicio({
      prisma: prismaConTx({
        user: { findUnique: jest.fn().mockResolvedValue(fila), update },
      }),
    });

    await servicio.editar(ADMIN, { phone: '+56999998888' }, ADMIN);

    const escrito = update.mock.calls[0][0].data;
    expect(escrito.phone).toBe('+56999998888');
    expect(escrito.fullName).toBeUndefined();
  });

  it('NO revoca sesiones ni toca el control de intentos', async () => {
    // Esa tabla controla correos ingresados, no usuarios (data CHK025).
    const revocarTodasDe = jest.fn();
    const limpiar = jest.fn();
    const servicio = crearServicio({
      prisma: prismaConTx({
        user: {
          findUnique: jest.fn().mockResolvedValue(fila),
          update: jest.fn().mockResolvedValue(fila),
        },
      }),
      revocarTodasDe,
      limpiar,
    });

    await servicio.editar(ADMIN, { email: 'nuevo@ejemplo.cl' }, ADMIN);

    expect(revocarTodasDe).not.toHaveBeenCalled();
    expect(limpiar).not.toHaveBeenCalled();
  });

  it('traduce la unicidad igual que el alta', async () => {
    const violacion = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6',
    });
    const servicio = crearServicio({
      prisma: prismaConTx({
        user: {
          findUnique: jest.fn().mockResolvedValue(fila),
          update: jest.fn().mockRejectedValue(violacion),
        },
      }),
    });

    await expect(
      servicio.editar(ADMIN, { email: 'otro@ejemplo.cl' }, ADMIN),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });

  it('un usuario inexistente da 404', async () => {
    const servicio = crearServicio({
      prisma: prismaConTx({
        user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      }),
    });

    await expect(servicio.editar(OTRO, { phone: '+56999998888' }, ADMIN)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('Cambio de rol (FR-011, FR-024)', () => {
  it('actualiza, revoca TODAS las sesiones del afectado y registra, en ese orden', async () => {
    const orden: string[] = [];
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...fila, id: OTRO }),
        update: jest.fn(() => {
          orden.push('update');
          return { ...fila, id: OTRO, role: Role.NEGOCIO };
        }),
      },
    };

    const servicio = crearServicio({
      prisma: { $transaction: (fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)) },
      revocarTodasDe: jest.fn(() => {
        orden.push('revocar');
      }),
      registrar: jest.fn(() => {
        orden.push('registrar');
      }),
    });

    const resultado = await servicio.cambiarRol(OTRO, Role.NEGOCIO, ADMIN);

    expect(resultado.role).toBe(Role.NEGOCIO);
    expect(orden).toEqual(['update', 'revocar', 'registrar']);
  });

  it('un usuario inexistente da 404', async () => {
    const servicio = crearServicio({
      prisma: {
        $transaction: (fn: (t: unknown) => unknown) =>
          Promise.resolve(fn({ user: { findUnique: jest.fn().mockResolvedValue(null) } })),
      },
    });

    await expect(servicio.cambiarRol(OTRO, Role.NEGOCIO, ADMIN)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('Restablecimiento de contraseña (FR-026, FR-033, FR-034)', () => {
  it('los cuatro efectos ocurren y todos dentro de la misma transacción', async () => {
    const update = jest.fn().mockResolvedValue(fila);
    const revocarTodasDe = jest.fn();
    const limpiar = jest.fn();
    const registrar = jest.fn();
    const tx = { user: { findUnique: jest.fn().mockResolvedValue(fila), update } };

    const servicio = crearServicio({
      prisma: { $transaction: (fn: (t: unknown) => unknown) => Promise.resolve(fn(tx)) },
      revocarTodasDe,
      limpiar,
      registrar,
    });

    await servicio.restablecerContrasena(ADMIN, 'contrasena-nueva', OTRO);

    expect(update.mock.calls[0][0].data).toEqual({ passwordHash: 'hash-nuevo' });
    expect(revocarTodasDe).toHaveBeenCalledWith(ADMIN, tx);
    // El bloqueo se levanta por el **correo** del afectado, no por su id: la
    // tabla se indexa por correo ingresado (D-003).
    expect(limpiar).toHaveBeenCalledWith(fila.email, tx);
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RESTABLECER_PASSWORD' }),
      tx,
    );
    expect(JSON.stringify(registrar.mock.calls)).not.toContain('contrasena-nueva');
  });

  it('un usuario inexistente da 404 sin escribir nada', async () => {
    const update = jest.fn();
    const servicio = crearServicio({
      prisma: {
        $transaction: (fn: (t: unknown) => unknown) =>
          Promise.resolve(fn({ user: { findUnique: jest.fn().mockResolvedValue(null), update } })),
      },
    });

    await expect(
      servicio.restablecerContrasena(OTRO, 'contrasena8', ADMIN),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(update).not.toHaveBeenCalled();
  });
});
