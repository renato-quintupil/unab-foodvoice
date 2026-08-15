/**
 * Semilla del administrador (T038, FR-028, D-010, ops CHK017).
 *
 * Dos ejecuciones seguidas dejan el mismo estado, y la segunda **no altera la
 * contraseña**: esa es la parte que un test de «no falla dos veces» dejaría
 * pasar, porque un script que rehashea en cada arranque también termina sin
 * error y aun así rompe la idempotencia que FR-028 exige.
 */
import { execFileSync } from 'node:child_process';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from './setup';

const CORREO = 'admin.semilla@ejemplo.cl';
const PASSWORD = 'semilla-8caracteres';

function ejecutarSemilla(extra: Record<string, string> = {}, argumentos: string[] = []): void {
  execFileSync('npx', ['tsx', 'prisma/seed.ts', ...argumentos], {
    cwd: `${__dirname}/..`,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ADMIN_SEED_EMAIL: CORREO,
      ADMIN_SEED_PASSWORD: PASSWORD,
      ...extra,
    },
  });
}

describe('Semilla del administrador (FR-028)', () => {
  it('crea el administrador con rol ADMINISTRADOR y estado ACTIVO', async () => {
    ejecutarSemilla();

    const usuario = await prisma.user.findUnique({ where: { email: CORREO } });
    expect(usuario).not.toBeNull();
    expect(usuario?.role).toBe(Role.ADMINISTRADOR);
    expect(usuario?.status).toBe(UserStatus.ACTIVO);
    expect(usuario?.passwordHash).not.toContain(PASSWORD);
  });

  it('es idempotente: dos ejecuciones dejan el mismo estado y no rehashean', async () => {
    ejecutarSemilla();
    const primero = await prisma.user.findUniqueOrThrow({ where: { email: CORREO } });

    ejecutarSemilla();
    const segundo = await prisma.user.findUniqueOrThrow({ where: { email: CORREO } });

    expect(segundo.id).toBe(primero.id);
    expect(segundo.passwordHash).toBe(primero.passwordHash);
    expect(await prisma.user.count()).toBe(1);
  });

  it('normaliza el correo: mayúsculas y espacios no crean un segundo administrador', async () => {
    ejecutarSemilla();
    ejecutarSemilla({ ADMIN_SEED_EMAIL: `  ${CORREO.toUpperCase()} ` });

    expect(await prisma.user.count()).toBe(1);
  });

  it('falla si el correo existe con otro rol, en vez de promoverlo en silencio', async () => {
    await prisma.user.create({
      data: {
        fullName: 'Cliente Cualquiera',
        email: CORREO,
        phone: '123456',
        passwordHash: 'hash-cualquiera',
        role: Role.CLIENTE,
        status: UserStatus.ACTIVO,
        searchNormalized: `cliente cualquiera ${CORREO}`,
      },
    });

    expect(() => ejecutarSemilla()).toThrow();

    const usuario = await prisma.user.findUniqueOrThrow({ where: { email: CORREO } });
    expect(usuario.role).toBe(Role.CLIENTE);
  });

  it('falla si el correo existe desactivado', async () => {
    await prisma.user.create({
      data: {
        fullName: 'Admin Retirado',
        email: CORREO,
        phone: '123456',
        passwordHash: 'hash-cualquiera',
        role: Role.ADMINISTRADOR,
        status: UserStatus.DESACTIVADO,
        searchNormalized: `admin retirado ${CORREO}`,
      },
    });

    expect(() => ejecutarSemilla()).toThrow();
    const usuario = await prisma.user.findUniqueOrThrow({ where: { email: CORREO } });
    expect(usuario.status).toBe(UserStatus.DESACTIVADO);
  });

  it('falla nombrando la variable si falta ADMIN_SEED_PASSWORD', () => {
    expect(() => ejecutarSemilla({ ADMIN_SEED_PASSWORD: '' })).toThrow();
  });
});

describe('Modo de recuperación (FR-036, D-010)', () => {
  it('fuerza la cuenta a administrador activo, revoca sesiones y deja constancia', async () => {
    const usuario = await prisma.user.create({
      data: {
        fullName: 'Admin Retirado',
        email: CORREO,
        phone: '123456',
        passwordHash: 'hash-antiguo',
        role: Role.CLIENTE,
        status: UserStatus.DESACTIVADO,
        searchNormalized: `admin retirado ${CORREO}`,
      },
    });
    await prisma.session.create({
      data: { userId: usuario.id, role: Role.CLIENTE },
    });

    ejecutarSemilla({}, ['--recuperar']);

    const recuperado = await prisma.user.findUniqueOrThrow({ where: { email: CORREO } });
    expect(recuperado.role).toBe(Role.ADMINISTRADOR);
    expect(recuperado.status).toBe(UserStatus.ACTIVO);
    expect(recuperado.passwordHash).not.toBe('hash-antiguo');

    const sesionesVivas = await prisma.session.count({
      where: { userId: usuario.id, revokedAt: null },
    });
    expect(sesionesVivas).toBe(0);

    const entradas = await prisma.adminAuditLog.findMany();
    expect(entradas).toHaveLength(1);
    // Actor igual al afectado: la marca inequívoca de una recuperación
    // operativa, imposible desde la aplicación porque FR-027 lo prohíbe.
    expect(entradas[0]?.actorUserId).toBe(entradas[0]?.targetUserId);
    expect(entradas[0]?.action).toBe('RESTABLECER_PASSWORD');
  });

  it('levanta el bloqueo temporal vigente sobre ese correo', async () => {
    await prisma.loginAttemptControl.create({
      data: {
        email: CORREO,
        failedCount: 0,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    ejecutarSemilla({}, ['--recuperar']);

    expect(await prisma.loginAttemptControl.count({ where: { email: CORREO } })).toBe(0);
  });
});
