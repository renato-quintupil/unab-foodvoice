import Link from 'next/link';
import { CerrarSesion } from '@/components/cerrar-sesion';

/**
 * Navegación del administrador (T103, spec § Navegación disponible por rol,
 * ux CHK012).
 *
 * **Dos destinos y ninguno más**: Panel y Usuarios, más «Cerrar sesión».
 * Visible desde cualquier vista administrativa. Los otros tres roles no llevan
 * navegación en v1, porque no tienen a dónde ir (Principio III).
 */
export function NavegacionAdmin() {
  return (
    <header className="border-b border-[var(--color-borde)]">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3"
      >
        <span className="font-semibold">FoodVoice</span>
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Panel
        </Link>
        <Link href="/admin/usuarios" className="text-sm underline underline-offset-4">
          Usuarios
        </Link>
        <div className="ml-auto">
          <CerrarSesion />
        </div>
      </nav>
    </header>
  );
}
