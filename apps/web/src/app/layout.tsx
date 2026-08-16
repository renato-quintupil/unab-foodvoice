import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'FoodVoice',
  description: 'Pide comida por voz o de forma manual.',
};

/**
 * `lang="es"` no es decorativo: FR-039 exige campos con etiqueta asociada y
 * contenido comprensible, y los lectores de pantalla necesitan saber en qué
 * idioma leer para pronunciar el español correctamente.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
