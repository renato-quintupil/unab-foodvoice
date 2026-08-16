import { Suspense } from 'react';
import { FormularioLogin } from './formulario-login';

export const metadata = { title: 'Iniciar sesión · FoodVoice' };

/** Pantalla de inicio de sesión (FR-001). */
export default function PaginaLogin() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">FoodVoice</h1>
        <p className="text-sm text-[var(--color-tenue)]">
          Ingresa con tu correo electrónico y tu contraseña.
        </p>
      </header>

      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
