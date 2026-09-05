import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      // quickstart § Comprobaciones automáticas: 100 % en `packages/shared`.
      // Es lógica pura y pequeña; no hay excusa para menos. Su incumplimiento
      // hace fallar `pnpm test` (T117).
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
