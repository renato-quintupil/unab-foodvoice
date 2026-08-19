'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CerrarSesion } from '@/components/cerrar-sesion';

/**
 * Navegación del administrador (T103 de E1, FR-017 de E9).
 *
 * **Dos destinos y ninguno más**: Panel y Usuarios, más «Cerrar sesión» — los
 * mismos de siempre, sin agregar navegación nueva (Principio III). Lo único
 * que cambia con E9/HU-17 es la apariencia: mismo patrón de componente que
 * `NavegacionCliente`/`NavegacionNegocio` (marca, íconos, estado activo,
 * barra inferior en mobile), para que los tres roles se sientan el mismo
 * producto.
 */
const DESTINOS = [
  { href: '/admin', etiqueta: 'Panel', icono: 'panel' },
  { href: '/admin/usuarios', etiqueta: 'Usuarios', icono: 'usuarios' },
] as const;

export function NavegacionAdmin() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-[var(--color-borde)] bg-[var(--color-fondo)] md:block">
        <nav
          aria-label="Navegación de administrador"
          className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 px-4"
        >
          <Marca />
          <div className="flex items-center gap-1">
            {DESTINOS.map((destino) => (
              <EnlaceDestino key={destino.href} destino={destino} pathname={pathname} />
            ))}
          </div>
          <div className="ml-auto">
            <CerrarSesion />
          </div>
        </nav>
      </header>

      <nav
        aria-label="Navegación mobile de administrador"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-[var(--color-borde)] bg-[var(--color-fondo)] px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {DESTINOS.map((destino) => (
          <EnlaceDestino key={destino.href} destino={destino} pathname={pathname} mobile />
        ))}
        <div className="flex items-center justify-center [&_button]:h-auto [&_button]:flex-col [&_button]:border-0 [&_button]:px-1 [&_button]:py-2 [&_button]:text-xs">
          <CerrarSesion />
        </div>
      </nav>
    </>
  );
}

type Destino = (typeof DESTINOS)[number];

function EnlaceDestino({
  destino,
  pathname,
  mobile = false,
}: {
  destino: Destino;
  pathname: string;
  mobile?: boolean;
}) {
  // '/admin' es prefijo de toda ruta administrativa (/admin/usuarios, ...), así
  // que Panel solo puede matchear por igualdad exacta — un prefijo lo marcaría
  // activo en cualquier subpágina, incluida la de Usuarios.
  const activo =
    destino.href === '/admin'
      ? pathname === '/admin'
      : pathname === destino.href || pathname.startsWith(`${destino.href}/`);

  return (
    <Link
      href={destino.href}
      aria-current={activo ? 'page' : undefined}
      className={
        mobile
          ? `flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-xs ${activo ? 'font-semibold text-[var(--color-primario)]' : 'text-[var(--color-tenue)]'}`
          : `rounded-md px-3 py-2 text-sm font-medium ${activo ? 'bg-[var(--color-borde)] text-[var(--color-primario)]' : 'text-[var(--color-tenue)] hover:text-[var(--color-texto)]'}`
      }
    >
      {mobile && <IconoNavegacion tipo={destino.icono} />}
      <span>{destino.etiqueta}</span>
    </Link>
  );
}

function Marca() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 font-semibold"
      aria-label="FoodVoice"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-primario)] text-xs text-white">
        FV
      </span>
      <span>FoodVoice</span>
    </Link>
  );
}

function IconoNavegacion({ tipo }: { tipo: Destino['icono'] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5"
    >
      {tipo === 'panel' && <path d="M4 20V10M12 20V4M20 20v-7" />}
      {tipo === 'usuarios' && (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c0-3.5 2.7-6 5.5-6s5.5 2.5 5.5 6" />
          <circle cx="17.5" cy="9" r="2.4" />
          <path d="M15 14.5c2.4.3 4 2.2 4.5 5.5" />
        </>
      )}
    </svg>
  );
}
