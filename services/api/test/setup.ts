/**
 * Arranque compartido de los tests de integración (T049, ops CHK021, data CHK008).
 *
 * Tres garantías, y las tres importan:
 *
 * 1. **Migraciones aplicadas** antes del primer caso, con `prisma migrate deploy`.
 * 2. **La base queda sin ninguna fila** —ni siquiera el administrador semilla,
 *    que crea cada caso que lo necesite—, de modo que ningún test dependa de un
 *    dato que otro dejó.
 * 3. **Aislamiento con `TRUNCATE ... RESTART IDENTITY CASCADE`, y no con
 *    `DELETE`**: el disparador de inmutabilidad de `admin_audit_log` (T027)
 *    rechaza `DELETE` sobre esa tabla, así que un aislamiento por borrado
 *    fallaría de forma desconcertante en la primera prueba. `TRUNCATE` no
 *    dispara disparadores de fila.
 *
 * Los casos se ejecutan **en serie** (`maxWorkers: 1`) sobre una única base y
 * ninguno depende del orden, comprobable ejecutando la batería en orden
 * aleatorio.
 */
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/** Tablas en el orden en que se truncan. `CASCADE` resuelve las dependencias. */
const TABLAS = ['admin_audit_log', 'session', 'login_attempt_control', '"user"'] as const;

export const prisma = new PrismaClient();

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL no está definida. Los tests de integración necesitan la PostgreSQL ' +
        'efímera de docker-compose.test.yml. Ver quickstart § Comprobaciones automáticas.',
    );
  }

  execSync('npx prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    stdio: 'inherit',
    env: process.env,
  });

  await prisma.$connect();
});

beforeEach(async () => {
  await limpiarBase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Deja la base sin ninguna fila. Expuesta para los casos que la necesiten. */
export async function limpiarBase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLAS.join(', ')} RESTART IDENTITY CASCADE;`,
  );
}
