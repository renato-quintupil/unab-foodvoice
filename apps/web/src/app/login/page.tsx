import { Suspense } from 'react';
import { claseBricolage } from '@/lib/fuentes';
import { FormularioLogin } from './formulario-login';

export const metadata = { title: 'Iniciar sesión · FoodVoice' };

/** Pantalla de inicio de sesión (FR-001). */
export default function PaginaLogin() {
  return (
    <main
      className={`tema-voz ${claseBricolage} flex min-h-screen items-center justify-center px-4 py-8`}
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--color-borde)] bg-[var(--color-fondo)] shadow-xl md:grid-cols-[0.9fr_1.1fr]">
        <section
          data-testid="panel-marca"
          className="relative isolate flex min-h-64 flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,var(--color-primario),var(--color-coral))] p-8 text-white md:min-h-[34rem] md:p-12"
        >
          <Marca />
          <div className="relative z-10 max-w-xs">
            <p className="text-3xl font-semibold leading-tight md:text-5xl">
              Solo dilo.
              <br />
              Nosotros lo pedimos.
            </p>
            <p className="mt-4 text-sm text-white/80">
              Tu pedido empieza con tu voz y sigue siempre bajo tu control.
            </p>
          </div>
          <OndaDeVoz />
        </section>

        <section className="flex flex-col justify-center gap-7 p-7 sm:p-10 md:p-14">
          <header className="flex flex-col gap-2">
            <p className="text-sm font-medium text-[var(--color-primario)]">
              Te damos la bienvenida
            </p>
            <h1 className="text-3xl font-semibold">Inicia sesión</h1>
            <p className="text-sm text-[var(--color-tenue)]">
              Ingresa con tu correo electrónico y tu contraseña.
            </p>
          </header>

          <Suspense fallback={null}>
            <FormularioLogin />
          </Suspense>
        </section>
      </div>
    </main>
  );
}

function Marca() {
  return (
    <div className="relative z-10 flex items-center gap-3 font-semibold">
      <span className="flex size-9 items-center justify-center rounded-full border border-white/50">
        FV
      </span>
      <span className="text-lg">FoodVoice</span>
    </div>
  );
}

function OndaDeVoz() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 500 260"
      fill="none"
      className="absolute -bottom-8 -right-20 w-[150%] text-white/20"
    >
      <path
        d="M0 125c45 0 45-75 90-75s45 150 90 150 45-150 90-150 45 150 90 150 45-75 90-75h50"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M0 150c45 0 45-45 90-45s45 90 90 90 45-90 90-90 45 90 90 90 45-45 90-45h50"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
