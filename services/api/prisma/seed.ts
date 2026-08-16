/**
 * Semilla del administrador inicial (FR-028, FR-036, D-010).
 *
 * Modo normal — **idempotente por `ADMIN_SEED_EMAIL` normalizado**: si ya existe
 * una fila con ese correo, no la toca —ni la contraseña, ni el rol, ni el
 * estado— y termina con código 0. Ejecutarla diez veces deja el mismo estado
 * que ejecutarla una vez.
 *
 * Si el correo existe **con otro rol o desactivado**, el script **falla de
 * forma explícita** en lugar de promover en silencio la cuenta: eso sería una
 * escalada de privilegios provocada por una variable de entorno, y el arranque
 * es el peor momento para eso.
 *
 * Modo de recuperación (`--recuperar` o `ADMIN_SEED_RECOVER=true`): fuerza la
 * cuenta al estado de administrador activo, revoca sus sesiones vivas y deja
 * una entrada en la bitácora con **actor igual al afectado** — igualdad
 * imposible desde la aplicación, porque FR-027 prohíbe actuar sobre uno mismo,
 * y por tanto la marca inequívoca de una recuperación operativa.
 *
 * Nunca hay contraseña por defecto: sería una credencial de fábrica publicada
 * en el código (Principio V).
 */
import { AdminAction, PrismaClient, Role, UserStatus } from '@prisma/client';
import { normalizarBusqueda } from '@foodvoice/shared';
import * as bcrypt from 'bcrypt';
import { validarEntornoSemilla } from '../src/config/env.validation';
import { sembrarCatalogo } from './seed/catalogo';

const COSTE_BCRYPT = 12;

const prisma = new PrismaClient();

function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

async function main(): Promise<void> {
  const { email, password, recuperar } = validarEntornoSemilla();
  const correo = normalizarCorreo(email);
  const existente = await prisma.user.findUnique({ where: { email: correo } });

  if (recuperar) {
    // La recuperación de acceso **no** carga el catálogo: es una operación de
    // emergencia sobre una cuenta, y mezclarle la carga de datos de demostración
    // la haría menos predecible justo cuando más falta hace que lo sea.
    await recuperarAcceso(correo, password, existente?.id);
    return;
  }

  // El catálogo de E3 se carga en la **misma** ejecución que el administrador de
  // E1 (T076, FR-036): una sola orden deja el entorno listo, y quien arranca el
  // proyecto no tiene que saber que son dos semillas.
  await sembrarCatalogo(prisma);

  if (existente) {
    if (existente.role !== Role.ADMINISTRADOR || existente.status !== UserStatus.ACTIVO) {
      throw new Error(
        `El correo ${correo} ya está ocupado por un usuario que no es un administrador activo ` +
          `(rol ${existente.role}, estado ${existente.status}). La semilla no lo modifica: ` +
          'resuélvelo con el modo de recuperación, `pnpm --filter api db:seed --recuperar`.',
      );
    }
    console.log(`Semilla: el administrador ${correo} ya existe. No se modificó nada.`);
    return;
  }

  const nombre = 'Administrador';
  await prisma.user.create({
    data: {
      fullName: nombre,
      email: correo,
      phone: '000000',
      passwordHash: await bcrypt.hash(password, COSTE_BCRYPT),
      role: Role.ADMINISTRADOR,
      status: UserStatus.ACTIVO,
      searchNormalized: normalizarBusqueda(`${nombre} ${correo}`),
    },
  });
  console.log(`Semilla: administrador ${correo} creado.`);
}

/** FR-036. Único camino de vuelta cuando ningún administrador conserva acceso. */
async function recuperarAcceso(
  correo: string,
  password: string,
  idExistente: string | undefined,
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, COSTE_BCRYPT);
  const nombre = 'Administrador';

  await prisma.$transaction(async (tx) => {
    const usuario = idExistente
      ? await tx.user.update({
          where: { id: idExistente },
          data: {
            passwordHash,
            role: Role.ADMINISTRADOR,
            status: UserStatus.ACTIVO,
          },
        })
      : await tx.user.create({
          data: {
            fullName: nombre,
            email: correo,
            phone: '000000',
            passwordHash,
            role: Role.ADMINISTRADOR,
            status: UserStatus.ACTIVO,
            searchNormalized: normalizarBusqueda(`${nombre} ${correo}`),
          },
        });

    await tx.session.updateMany({
      where: { userId: usuario.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // El bloqueo temporal del correo se levanta: de otro modo la recuperación
    // podría dejar la cuenta restaurada pero inaccesible durante 15 minutos.
    await tx.loginAttemptControl.deleteMany({ where: { email: correo } });

    await tx.adminAuditLog.create({
      data: {
        actorUserId: usuario.id,
        targetUserId: usuario.id,
        action: AdminAction.RESTABLECER_PASSWORD,
      },
    });
  });

  console.log(
    `Semilla: acceso administrativo recuperado para ${correo}. ` +
      'Sus sesiones fueron revocadas y quedó constancia en la bitácora.',
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    await prisma.$disconnect();
    process.exit(1);
  });
