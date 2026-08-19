'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AddressDto } from '@foodvoice/shared';
import { CerrarSesion } from '@/components/cerrar-sesion';
import { SelectorDireccion } from '@/components/selector-direccion';

const DESTINOS = [
  { href: '/menu', etiqueta: 'Menú', icono: 'menu' },
  { href: '/cliente/carrito', etiqueta: 'Carrito', icono: 'carrito' },
  { href: '/cliente/pedidos', etiqueta: 'Mis pedidos', icono: 'pedidos' },
] as const;

export function NavegacionCliente({ direcciones }: { direcciones: AddressDto[] }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 hidden border-b border-[var(--color-borde)] bg-[var(--color-fondo)] md:block">
        <nav
          aria-label="Navegación de cliente"
          className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 px-4"
        >
          <Marca />
          <div className="flex items-center gap-1">
            {DESTINOS.map((destino) => (
              <EnlaceDestino key={destino.href} destino={destino} pathname={pathname} />
            ))}
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <SelectorDireccion direcciones={direcciones} />
            <CerrarSesion />
          </div>
        </nav>
      </header>

      <nav
        aria-label="Navegación mobile de cliente"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[var(--color-borde)] bg-[var(--color-fondo)] px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {DESTINOS.map((destino) => (
          <EnlaceDestino
            key={destino.href}
            destino={destino}
            pathname={pathname}
            mobile
          />
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
  const activo =
    destino.href === '/menu'
      ? pathname === '/menu' || pathname.startsWith('/menu/')
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
      href="/menu"
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
      {tipo === 'menu' && <path d="M4 6h16M4 12h16M4 18h16" />}
      {tipo === 'carrito' && <path d="M3 4h2l2.2 10h9.8l2-7H6M9 19h.01M17 19h.01" />}
      {tipo === 'pedidos' && <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />}
    </svg>
  );
}
