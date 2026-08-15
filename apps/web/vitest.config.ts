import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/components/ui/**', 'src/app/**/layout.tsx', 'src/app/globals.css'],
      reporter: ['text', 'lcov'],
      // quickstart § Comprobaciones automáticas: 70 % en `apps/web`. La
      // validación de interfaz la cubre la sección funcional de la guía; la
      // cobertura es un piso, no un objetivo (T117).
      thresholds: { lines: 70 },
    },
  },
});
