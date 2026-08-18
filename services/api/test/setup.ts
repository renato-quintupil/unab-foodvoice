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

/**
 * Tablas en el orden en que se truncan. `CASCADE` resuelve las dependencias.
 *
 * `product` va **antes** que `category` porque la referencia: aunque `CASCADE` lo
 * resolvería en cualquier orden, escribirlo así deja legible qué depende de qué.
 * Omitir aquí una tabla nueva no rompe ninguna prueba de inmediato —las hace
 * fallar más tarde, cuando una batería encuentra el catálogo que dejó otra—, y
 * por eso se enumeran todas y no se filtran por épica.
 */
const TABLAS = [
  'admin_audit_log',
  'session',
  'login_attempt_control',
  // E2 · Gestión de pedidos. `order_status_event` va antes que `order`:
  // aunque `CASCADE` resolvería el orden de todas formas, escribirlo así deja
  // legible qué depende de qué (mismo criterio que el resto de la lista).
  'order_status_event',
  'order_line',
  // `order` es palabra reservada en SQL estándar; requiere comillas dobles,
  // igual que `"user"`.
  '"order"',
  'cart_line',
  'cart',
  'address',
  '"user"',
  'product',
  'category',
] as const;

/**
 * La base de la batería la fija **este archivo**, no el entorno heredado (T132).
 *
 * Antes se leía `DATABASE_URL` del entorno y se abortaba si faltaba. El mensaje
 * era claro, pero dejaba dos problemas. El menor: `pnpm test:integration` no
 * funcionaba sin exportar antes una variable, pese a que `quickstart` lo
 * presentaba como una de cinco órdenes autosuficientes. El mayor, y la razón de
 * fondo del cambio: si alguien tenía `DATABASE_URL` apuntando a su base de
 * desarrollo —lo normal al trabajar en local—, la batería la habría aceptado y
 * el `TRUNCATE` de cada caso le habría **borrado sus datos**.
 *
 * Fijarla aquí hace ambas cosas imposibles: la batería solo puede correr contra
 * la base efímera que `pretest:integration` levanta. `DATABASE_URL_TEST` permite
 * apuntar a otra —un puerto distinto, un servidor de integración continua—, pero
 * exige nombrarla a propósito.
 */
const URL_BASE_EFIMERA = 'postgresql://foodvoice:test@localhost:5433/foodvoice_test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? URL_BASE_EFIMERA;

export const prisma = new PrismaClient();

beforeAll(async () => {
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
