import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // La imagen final no arrastra el árbol completo de node_modules (D-013).
  output: 'standalone',
  // El monorepo vive por encima de apps/web; sin esto el trazado de la salida
  // standalone no encuentra `packages/shared`.
  outputFileTracingRoot: `${__dirname}/../..`,
  reactStrictMode: true,
  transpilePackages: ['@foodvoice/shared'],
};

export default nextConfig;
