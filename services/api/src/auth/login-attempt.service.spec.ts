/**
 * Control de intentos fallidos (T051, FR-033, security CHK016, data CHK024).
 *
 * Con `ClockService` sustituido: las reglas de tiempo se prueban sin esperarlas
 * de verdad (D-009).
 *
 * **Qué cubre este archivo y qué no.** El bloqueo del quinto fallo se decide
 * dentro del `UPSERT`, así que aquí se verifica que la sentencia lleve el
 * `CASE` y los instantes calculados con el reloj inyectado. Que la regla
 * aguante intentos **concurrentes** solo lo demuestra la capa de integración,
 * lanzando los cinco en paralelo contra PostgreSQL — T055.
 */
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FALLOS_PARA_BLOQUEAR,
  LoginAttemptService,
  MINUTOS_DE_BLOQUEO,
} from './login-attempt.service';

const CORREO = 'maria@ejemplo.cl';
const AHORA = new Date('2026-08-15T12:00:00.000Z');

describe('LoginAttemptService', () => {
  let prisma: {
    loginAttemptControl: { findUnique: jest.Mock; deleteMany: jest.Mock };
    $executeRaw: jest.Mock;
  };
  let reloj: { ahora: jest.Mock };
  let servicio: LoginAttemptService;

  beforeEach(() => {
    prisma = {
      loginAttemptControl: { findUnique: jest.fn(), deleteMany: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    reloj = { ahora: jest.fn().mockReturnValue(AHORA) };
    servicio = new LoginAttemptService(
      prisma as unknown as PrismaService,
      reloj as unknown as ClockService,
    );
  });

  describe('estaBloqueado', () => {
    it('no hay bloqueo si no existe la fila', async () => {
      prisma.loginAttemptControl.findUnique.mockResolvedValue(null);
      expect(await servicio.estaBloqueado(CORREO)).toBe(false);
    });

    it('no hay bloqueo si locked_until es nulo', async () => {
      prisma.loginAttemptControl.findUnique.mockResolvedValue({
        email: CORREO,
        failedCount: 3,
        lockedUntil: null,
      });
      expect(await servicio.estaBloqueado(CORREO)).toBe(false);
    });

    it('hay bloqueo si locked_until está en el futuro, medido contra el reloj inyectado', async () => {
      prisma.loginAttemptControl.findUnique.mockResolvedValue({
        email: CORREO,
        failedCount: 0,
        lockedUntil: new Date(AHORA.getTime() + 60_000),
      });
      expect(await servicio.estaBloqueado(CORREO)).toBe(true);
      expect(reloj.ahora).toHaveBeenCalled();
    });

    it('el bloqueo vencido se ignora', async () => {
      prisma.loginAttemptControl.findUnique.mockResolvedValue({
        email: CORREO,
        failedCount: 0,
        lockedUntil: new Date(AHORA.getTime() - 1_000),
      });
      expect(await servicio.estaBloqueado(CORREO)).toBe(false);
    });

    it('una fila con bloqueo vencido y failed_count > 0 es estado normal: no se limpia', async () => {
      // data-model § `locked_until` en el pasado con `failed_count` mayor que
      // cero. Nadie debe escribir código que intente «arreglarlo».
      prisma.loginAttemptControl.findUnique.mockResolvedValue({
        email: CORREO,
        failedCount: 2,
        lockedUntil: new Date(AHORA.getTime() - 60_000),
      });

      expect(await servicio.estaBloqueado(CORREO)).toBe(false);
      expect(prisma.loginAttemptControl.deleteMany).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('registrarFallo', () => {
    it('decide el bloqueo dentro del UPSERT y nunca leyendo el contador antes', async () => {
      await servicio.registrarFallo(CORREO);

      expect(prisma.loginAttemptControl.findUnique).not.toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

      const [plantilla] = prisma.$executeRaw.mock.calls[0] as [string[]];
      const sql = plantilla.join(' ');
      expect(sql).toContain('ON CONFLICT (email) DO UPDATE');
      expect(sql).toContain('CASE WHEN login_attempt_control.failed_count');
    });

    it('pasa el umbral del quinto fallo y el vencimiento a 15 minutos del reloj inyectado', async () => {
      await servicio.registrarFallo(CORREO);

      const parametros = (prisma.$executeRaw.mock.calls[0] as unknown[]).slice(1);
      expect(parametros).toContain(CORREO);
      // El umbral es 4: al cuarto fallo previo, el quinto bloquea.
      expect(parametros).toContain(FALLOS_PARA_BLOQUEAR - 1);

      const hasta = parametros.find(
        (p): p is Date => p instanceof Date && p.getTime() > AHORA.getTime(),
      );
      expect(hasta?.getTime()).toBe(AHORA.getTime() + MINUTOS_DE_BLOQUEO * 60_000);
    });

    it('el bloqueo dura 15 minutos y los fallos para bloquear son 5 (FR-033)', () => {
      expect(MINUTOS_DE_BLOQUEO).toBe(15);
      expect(FALLOS_PARA_BLOQUEAR).toBe(5);
    });
  });

  describe('limpiar', () => {
    it('el acierto elimina la fila', async () => {
      await servicio.limpiar(CORREO);
      expect(prisma.loginAttemptControl.deleteMany).toHaveBeenCalledWith({
        where: { email: CORREO },
      });
    });

    it('usa la transacción que se le pase, para ir junto a la creación de la sesión', async () => {
      const tx = { loginAttemptControl: { deleteMany: jest.fn() } };
      await servicio.limpiar(CORREO, tx as never);

      expect(tx.loginAttemptControl.deleteMany).toHaveBeenCalledWith({
        where: { email: CORREO },
      });
      expect(prisma.loginAttemptControl.deleteMany).not.toHaveBeenCalled();
    });
  });
});
