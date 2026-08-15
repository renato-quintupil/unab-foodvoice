/**
 * Pruebas de integración contra PostgreSQL efímera (D-009).
 *
 * Cubren lo que un doble de prueba no puede verificar: la restricción única
 * (FR-017), la atomicidad de las transacciones (FR-024, FR-030) y la del
 * contador de intentos (FR-033). Corren **en serie** sobre una única base.
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'test/.*\.integration-spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
};
