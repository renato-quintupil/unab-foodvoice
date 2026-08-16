/**
 * `SessionGuard` (T052, FR-005, security CHK005, api CHK027).
 *
 * Las tres condiciones de validez se aplican en la sentencia SQL de
 * `SessionService`, así que aquí se prueban el umbral medido contra el reloj
 * inyectado, la ausencia de duración máxima absoluta y la respuesta uniforme
 * del guard. El comportamiento contra PostgreSQL lo cubre T056 y T057.
 */
import { ClockService } from '../clock.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  COOKIE_SESION,
  MINUTOS_DE_INACTIVIDAD,
  SessionService,
} from '../../auth/session.service';
import { AppError } from '../errors';
import { SessionGuard } from './session.guard';

const AHORA = new Date('2026-08-15T12:00:00.000Z');
const UUID_VALIDO = '11111111-1111-4111-8111-111111111111';

function contextoCon(cookies: Record<string, string> | undefined) {
  const peticion: Record<string, unknown> = { cookies };
  const respuesta = { clearCookie: jest.fn() };
  return {
    contexto: {
      switchToHttp: () => ({
        getRequest: () => peticion,
        getResponse: () => respuesta,
      }),
    },
    peticion,
    respuesta,
  };
}

describe('SessionGuard', () => {
  let prisma: { $queryRaw: jest.Mock };
  let reloj: { ahora: jest.Mock };
  let guard: SessionGuard;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    reloj = { ahora: jest.fn().mockReturnValue(AHORA) };
    const sesiones = new SessionService(
      prisma as unknown as PrismaService,
      reloj as unknown as ClockService,
    );
    guard = new SessionGuard(sesiones);
  });

  const filaValida = [
    {
      session_id: UUID_VALIDO,
      user_id: '22222222-2222-4222-8222-222222222222',
      role: 'CLIENTE',
      full_name: 'María Pérez',
      email: 'maria@ejemplo.cl',
    },
  ];

  it('deja pasar una sesión válida y la adjunta a la petición', async () => {
    prisma.$queryRaw.mockResolvedValue(filaValida);
    const { contexto, peticion } = contextoCon({ [COOKIE_SESION]: UUID_VALIDO });

    await expect(guard.canActivate(contexto as never)).resolves.toBe(true);
    expect(peticion.sesion).toMatchObject({ role: 'CLIENTE', fullName: 'María Pérez' });
  });

  it('aplica el umbral de 30 minutos medido contra el reloj inyectado', async () => {
    prisma.$queryRaw.mockResolvedValue(filaValida);
    const { contexto } = contextoCon({ [COOKIE_SESION]: UUID_VALIDO });

    await guard.canActivate(contexto as never);

    const parametros = (prisma.$queryRaw.mock.calls[0] as unknown[]).slice(1);
    const limite = parametros.find(
      (p): p is Date => p instanceof Date && p.getTime() < AHORA.getTime(),
    );
    expect(limite?.getTime()).toBe(AHORA.getTime() - MINUTOS_DE_INACTIVIDAD * 60_000);
    expect(MINUTOS_DE_INACTIVIDAD).toBe(30);
  });

  it('refresca last_activity_at con el reloj inyectado en la misma sentencia', async () => {
    prisma.$queryRaw.mockResolvedValue(filaValida);
    const { contexto } = contextoCon({ [COOKIE_SESION]: UUID_VALIDO });

    await guard.canActivate(contexto as never);

    const [plantilla] = prisma.$queryRaw.mock.calls[0] as [string[]];
    const sql = plantilla.join(' ');
    // Un `UPDATE ... RETURNING` con `JOIN`: leer y luego escribir dejaría una
    // ventana en la que la sesión podría revocarse entre ambas.
    expect(sql).toContain('UPDATE session');
    expect(sql).toContain('RETURNING');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('NO impone ninguna duración máxima absoluta: no consulta created_at', async () => {
    // Una sesión con actividad continuada nunca caduca por antigüedad
    // (security CHK005).
    prisma.$queryRaw.mockResolvedValue(filaValida);
    const { contexto } = contextoCon({ [COOKIE_SESION]: UUID_VALIDO });

    await guard.canActivate(contexto as never);

    const [plantilla] = prisma.$queryRaw.mock.calls[0] as [string[]];
    expect(plantilla.join(' ')).not.toContain('created_at');
  });

  describe('los seis casos de cookie inválida son indistinguibles', () => {
    const casos: { nombre: string; cookies: Record<string, string> | undefined }[] = [
      { nombre: 'cookie ausente', cookies: undefined },
      { nombre: 'cookie vacía', cookies: {} },
      { nombre: 'valor sin forma de UUID', cookies: { [COOKIE_SESION]: 'no-es-uuid' } },
      { nombre: 'UUID inexistente', cookies: { [COOKIE_SESION]: UUID_VALIDO } },
      { nombre: 'sesión revocada', cookies: { [COOKIE_SESION]: UUID_VALIDO } },
      { nombre: 'sesión expirada', cookies: { [COOKIE_SESION]: UUID_VALIDO } },
    ];

    it.each(casos)('$nombre produce 401 UNAUTHENTICATED', async ({ cookies }) => {
      // La sentencia no devuelve fila en ninguno de los tres últimos casos: es
      // el mismo `WHERE` el que los descarta, sin ramas que los distingan.
      prisma.$queryRaw.mockResolvedValue([]);
      const { contexto } = contextoCon(cookies);

      await expect(guard.canActivate(contexto as never)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    });

    it('los seis producen el mismo estado y el mismo mensaje', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const respuestas: { status: number; message: string }[] = [];

      for (const { cookies } of casos) {
        const { contexto } = contextoCon(cookies);
        try {
          await guard.canActivate(contexto as never);
        } catch (error) {
          const app = error as AppError;
          respuestas.push({ status: app.getStatus(), message: app.mensaje });
        }
      }

      expect(respuestas).toHaveLength(6);
      expect(new Set(respuestas.map((r) => `${r.status}·${r.message}`)).size).toBe(1);
    });

    it('instruye borrar la cookie para que el navegador deje de enviarla', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const { contexto, respuesta } = contextoCon({ [COOKIE_SESION]: UUID_VALIDO });

      await expect(guard.canActivate(contexto as never)).rejects.toBeInstanceOf(AppError);
      expect(respuesta.clearCookie).toHaveBeenCalledWith(COOKIE_SESION, { path: '/' });
    });

    it('un valor con forma inválida ni siquiera llega a consultar la base', async () => {
      // Sin esta comprobación, PostgreSQL fallaría al convertir el tipo y el
      // endpoint respondería 500 en lugar del 401 uniforme.
      const { contexto } = contextoCon({ [COOKIE_SESION]: "'; DROP TABLE session; --" });

      await expect(guard.canActivate(contexto as never)).rejects.toBeInstanceOf(AppError);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
