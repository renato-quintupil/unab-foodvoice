/**
 * Pruebas unitarias de la API (D-009).
 *
 * Los `*.integration-spec.ts` de `test/` quedan fuera a propósito: exigen una
 * PostgreSQL real y corren con su propia configuración.
 *
 * **Los umbrales hacen fallar `pnpm test`** (T117, quickstart § Comprobaciones
 * automáticas). Son un piso, no un objetivo: cumplirlos no sustituye a la
 * validación funcional. `auth`, `users` y `audit` van al 90 % porque concentran
 * las reglas de seguridad de la épica; el resto es infraestructura y va al 80 %.
 *
 * Los umbrales cuentan **solo la cobertura unitaria**. Varios archivos quedan
 * fuera del recuento porque lo que hay que verificar en ellos es una garantía
 * del motor —la transacción, la restricción única, la atomicidad del contador—
 * que un doble de prueba no puede demostrar: probaría el doble, no la regla.
 * Su verificación es enteramente de integración, y escribirles tests unitarios
 * solo para llegar a la cifra produciría cobertura sin valor.
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.spec.ts',
    // Verificados enteramente por la capa de integración.
    '!src/auth/auth.service.ts',
    '!src/auth/auth.controller.ts',
    '!src/auth/session.service.ts',
    '!src/users/users.controller.ts',
    // El catálogo de E3, por la misma razón (D-031): la unicidad normalizada, el
    // conteo de bloqueadores, la atomicidad de la desactivación y que un producto
    // no ofrecible nunca salga de una consulta son garantías del motor. Lo que sí
    // es lógica pura —los esquemas, el formato, la clasificación por tramo— tiene
    // sus unitarios en `packages/shared` y en `price-tier.spec.ts`.
    '!src/categories/categories.service.ts',
    '!src/categories/categories.controller.ts',
    '!src/products/products.service.ts',
    '!src/products/products.controller.ts',
    '!src/menu/**',
    // E2 · Gestión de pedidos, mismo criterio (plan.md § Pruebas): la
    // revalidación, la atomicidad de confirmación, las carreras de aceptar/
    // rechazar y de dirección predeterminada, la unicidad normalizada de
    // etiqueta y el append-only del historial son garantías de PostgreSQL,
    // no de este código. Verificadas enteramente por integración.
    '!src/cart/**',
    '!src/addresses/**',
    '!src/orders/**',
    '!src/dashboard/**',
    '!src/health/**',
    '!src/prisma/**',
    '!src/config/**',
    '!src/common/interceptors/**',
    '!src/common/filters/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    './src/auth/': { lines: 90, branches: 90 },
    './src/users/': { lines: 90, branches: 90 },
    './src/audit/': { lines: 90, branches: 90 },
    global: { lines: 80 },
  },
};
