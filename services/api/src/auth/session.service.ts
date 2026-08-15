import { Injectable } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { ClockService } from '../common/clock.service';
import { PrismaService } from '../prisma/prisma.service';

/** Ventana deslizante de inactividad, en minutos (FR-005). */
export const MINUTOS_DE_INACTIVIDAD = 30;

/** Nombre de la cookie de sesión. Su valor es un UUID v4 opaco (D-001). */
export const COOKIE_SESION = 'fv_session';

/** Lo que el guard necesita saber de una sesión válida. */
export type SesionValida = {
  sessionId: string;
  userId: string;
  role: Role;
  fullName: string;
  email: string;
};

/**
 * Ciclo de vida de la sesión (D-001, FR-004, FR-005, FR-006, FR-024).
 *
 * Una sesión es válida **si y solo si** se cumplen las tres condiciones:
 *
 *   1. `revoked_at IS NULL` — no fue cerrada ni revocada.
 *   2. `now() - last_activity_at < 30 minutos` — no expiró por inactividad.
 *   3. El usuario referenciado sigue `ACTIVO`.
 *
 * **No hay duración máxima absoluta**: una sesión con actividad continuada
 * nunca caduca por antigüedad (security CHK005). La expiración es **pasiva**:
 * la fila no se borra, simplemente deja de considerarse válida, de modo que no
 * haga falta ningún proceso programado (Principio I).
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reloj: ClockService,
  ) {}

  /**
   * Crea la sesión con el **rol congelado** (FR-011, D-007).
   *
   * Leer el rol de la sesión, y no del usuario, implementa directamente la
   * regla de que un cambio de rol rige desde el próximo inicio de sesión, en
   * lugar de simularla con comprobaciones repartidas.
   */
  async crear(
    userId: string,
    role: Role,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string }> {
    const cliente = tx ?? this.prisma;
    const ahora = this.reloj.ahora();
    return cliente.session.create({
      data: { userId, role, createdAt: ahora, lastActivityAt: ahora },
      select: { id: true },
    });
  }

  /**
   * Valida la sesión y refresca `last_activity_at` en **un único
   * `UPDATE ... RETURNING` con `JOIN` a `user`** (data CHK017).
   *
   * Que sea una sola sentencia importa: leer y luego escribir dejaría una
   * ventana en la que la sesión podría revocarse entre ambas y aun así
   * refrescarse. Devuelve `null` para los seis casos de cookie inválida, sin
   * distinguirlos: cookie ausente, valor sin forma de UUID, UUID inexistente,
   * sesión revocada, sesión expirada y sesión de un usuario desactivado.
   */
  async validarYRefrescar(sessionId: string | undefined): Promise<SesionValida | null> {
    if (!sessionId || !esUuid(sessionId)) return null;

    const ahora = this.reloj.ahora();
    const limite = new Date(ahora.getTime() - MINUTOS_DE_INACTIVIDAD * 60_000);

    const filas = await this.prisma.$queryRaw<
      {
        session_id: string;
        user_id: string;
        role: Role;
        full_name: string;
        email: string;
      }[]
    >`
      UPDATE session AS s
         SET last_activity_at = ${ahora}
        FROM "user" AS u
       WHERE s.id = ${sessionId}::uuid
         AND s.user_id = u.id
         AND s.revoked_at IS NULL
         AND s.last_activity_at > ${limite}
         AND u.status = ${UserStatus.ACTIVO}::"UserStatus"
   RETURNING s.id AS session_id, s.user_id, s.role, u.full_name, u.email
    `;

    const fila = filas[0];
    if (!fila) return null;

    return {
      sessionId: fila.session_id,
      userId: fila.user_id,
      role: fila.role,
      fullName: fila.full_name,
      email: fila.email,
    };
  }

  /**
   * Cierre explícito (FR-006): revoca **solo la sesión desde la que se cierra**,
   * dejando intactas las demás del mismo usuario. Es idempotente.
   */
  async revocarUna(sessionId: string): Promise<void> {
    if (!esUuid(sessionId)) return;
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: this.reloj.ahora() },
    });
  }

  /**
   * Revocación por acción de impacto (FR-024, D-014): alcanza a **todas** las
   * sesiones vivas del usuario afectado, incluidas las de otros navegadores.
   *
   * El `WHERE` es por `user_id` del **afectado**, de modo que las sesiones del
   * administrador que ejecuta la acción quedan intactas por construcción y no
   * por una excepción escrita para ellas.
   */
  async revocarTodasDe(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const cliente = tx ?? this.prisma;
    await cliente.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: this.reloj.ahora() },
    });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Comprobar la forma antes de consultar no es una optimización: sin ella, un
 * valor de cookie arbitrario produciría un error de conversión de tipo en
 * PostgreSQL y el endpoint respondería `500` en lugar del `401` uniforme que
 * exige el contrato para los seis casos.
 */
function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
