/**
 * Pruebas unitarias de la API (D-009).
 *
 * Los `*.integration-spec.ts` de `test/` quedan fuera a propósito: exigen una
 * PostgreSQL real y corren con su propia configuración.
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'src/.*\.spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage',
};
