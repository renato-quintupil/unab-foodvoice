import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../prisma/prisma.service';

/** Fallos consecutivos que disparan el bloqueo (FR-033). */
export const FALLOS_PARA_BLOQUEAR = 5;

/** Duración del bloqueo temporal, en minutos (FR-033). */
export const MINUTOS_DE_BLOQUEO = 15;

/**
 * Control de intentos fallidos y bloqueo temporal (FR-033, D-003).
 *
 * La clave es el **correo normalizado**, sin clave foránea a `user` y sin
 * ninguna noción del origen de la petición: el conteo es por correo y solo por
 * correo. Si la tabla apuntara a `user` sería imposible contar intentos sobre
 * correos no registrados, y el sistema respondería distinto para una cuenta
 * existente que para una inexistente — filtrando lo que FR-008 prohíbe.
 */
@Injectable()
export class LoginAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: ClockService,
  ) {}

  /**
   * ¿Hay un bloqueo vigente sobre este correo?
   *
   * Un `locked_until` en el pasado junto a `failed_count > 0` es un estado
   * **normal y esperado**, no una inconsistencia: se alcanza tras un bloqueo
   * vencido seguido de nuevos fallos. El valor vencido **no se limpia ni se
   * anula** —simplemente deja de mirarse—, porque anularlo exigiría una
   * escritura adicional en cada intento sin cambiar ningún comportamiento
   * observable (data-model § `locked_until` en el pasado).
   */
  async estaBloqueado(email: string): Promise<boolean> {
    const fila = await this.prisma.loginAttemptControl.findUnique({ where: { email } });
    if (!fila?.lockedUntil) return false;
    return fila.lockedUntil.getTime() > this.reloj.ahora().getTime();
  }

  /**
   * Registra un intento fallido y decide el bloqueo **dentro de la propia
   * escritura** (data-model § Atomicidad, security CHK015, data CHK010).
   *
   * El incremento y la decisión del quinto fallo van en un único
   * `INSERT ... ON CONFLICT DO UPDATE` con `CASE`, nunca leyendo el contador
   * para decidir después. Ese es el único punto donde la regla puede romperse
   * en silencio: cinco peticiones simultáneas que leyeran `failed_count = 4` y
   * todas concluyeran que aún no toca bloquear. Resuelto así, PostgreSQL toma
   * un bloqueo de fila sobre el conflicto, las peticiones concurrentes sobre el
   * mismo correo se serializan y basta el aislamiento `READ COMMITTED` por
   * defecto — sin `SERIALIZABLE` ni `SELECT ... FOR UPDATE`.
   *
   * Los instantes se pasan como parámetros desde `ClockService` en lugar de usar
   * el `now()` del motor, para que las reglas de tiempo se prueben con un reloj
   * sustituido (D-009). La atomicidad no depende de eso: la da el `CASE` que
   * lee el valor de la fila en conflicto.
   */
  async registrarFallo(email: string): Promise<void> {
    const ahora = this.reloj.ahora();
    const hasta = new Date(ahora.getTime() + MINUTOS_DE_BLOQUEO * 60_000);
    const umbral = FALLOS_PARA_BLOQUEAR - 1;

    await this.prisma.$executeRaw`
      INSERT INTO login_attempt_control (email, failed_count, locked_until, updated_at)
      VALUES (${email}, 1, NULL, ${ahora})
      ON CONFLICT (email) DO UPDATE SET
        failed_count = CASE WHEN login_attempt_control.failed_count >= ${umbral} THEN 0
                            ELSE login_attempt_control.failed_count + 1 END,
        locked_until = CASE WHEN login_attempt_control.failed_count >= ${umbral} THEN ${hasta}::timestamptz
                            ELSE login_attempt_control.locked_until END,
        updated_at   = ${ahora}
    `;
  }

  /**
   * Elimina la fila: el inicio de sesión fue exitoso (FR-033) o el
   * administrador restableció la contraseña (FR-026).
   *
   * Admite una transacción para que el borrado y la creación de la sesión vayan
   * juntos: separarlos permitiría entrar arrastrando fallos previos, o reiniciar
   * el contador sin haber entrado (data CHK013).
   */
  async limpiar(email: string, tx?: Prisma.TransactionClient): Promise<void> {
    const cliente = tx ?? this.prisma;
    await cliente.loginAttemptControl.deleteMany({ where: { email } });
  }
}
