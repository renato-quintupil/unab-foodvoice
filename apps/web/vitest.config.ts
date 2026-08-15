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
      exclude: [
        // Copiados de shadcn/ui: son de terceros y no llevan lógica del producto.
        'src/components/ui/**',
        'src/app/globals.css',
        // **Server Components y sus ayudantes de servidor.** No se ejecutan en
        // jsdom, y su verificación es la sección funcional de la guía —que es
        // exactamente la razón por la que el umbral de `apps/web` es 70 % y no
        // más (quickstart § Comprobaciones automáticas)—. Lo que sí se prueba
        // aquí es todo lo que corre en el navegador: formularios, diálogos,
        // filtros, el cliente de API, el middleware y el proxy.
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/error.tsx',
        'src/lib/api-servidor.ts',
        'src/lib/sesion-servidor.ts',
      ],
      reporter: ['text', 'lcov'],
      // El incumplimiento hace fallar `pnpm test` (T117). La cobertura es un
      // piso, no un objetivo: cumplirla no sustituye a la validación funcional.
      thresholds: { lines: 70 },
    },
  },
});
