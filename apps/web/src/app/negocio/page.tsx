import Link from 'next/link';
import { ETIQUETA_ROL, Role } from '@foodvoice/shared';
import { CerrarSesion } from '@/components/cerrar-sesion';
import { Button } from '@/components/ui/button';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/**
 * Página de inicio del rol negocio (FR-031 de E1, FR-002 y FR-012 de E3).
 *
 * En E1 esta pantalla usaba `InicioDeRol`, que tiene exactamente cuatro cosas y
 * **ninguna acción**, porque una función del rol antes de que su épica la
 * especificara habría sido alcance fantasma. E3 es esa épica: las tres entradas
 * que se añaden aquí son las que HU-14 y HU-02 exigen, y por eso ya no es la
 * pantalla genérica.
 *
 * El orden no es casual: **categorías antes que productos**. Sin al menos una
 * categoría activa por clasificación no se puede dar de alta ningún producto
 * (RN-012), y presentarlas al revés invitaría a chocar con ese bloqueo.
 */
export default async function PaginaInicioNegocio() {
  const sesion = await exigirSesion([Role.NEGOCIO]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">{sesion.fullName}</h1>
        <p className="text-[var(--color-tenue)]">{ETIQUETA_ROL[sesion.role]}</p>
      </div>

      <nav aria-label="Administración del catálogo" className="flex flex-col gap-3">
        <Button asChild variant="outline">
          <Link href="/negocio/categorias">Categorías</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/negocio/productos">Productos</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/menu">Ver el menú como lo ve el cliente</Link>
        </Button>
      </nav>

      <div>
        <CerrarSesion />
      </div>
    </main>
  );
}
