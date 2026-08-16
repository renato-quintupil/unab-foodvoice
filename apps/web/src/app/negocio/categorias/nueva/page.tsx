import Link from 'next/link';
import { Role } from '@foodvoice/shared';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FormularioCategoria } from '../_components/formulario-categoria';

export const dynamic = 'force-dynamic';

/** Alta de una categoría (T032, FR-002). Queda activa desde su creación. */
export default async function PaginaNuevaCategoria() {
  await exigirSesion([Role.NEGOCIO]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/negocio/categorias" className="text-sm underline">
          Volver a las categorías
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Crear categoría</h1>
        <p className="text-sm text-[var(--color-tenue)]">
          Queda disponible de inmediato en el alta de productos y como filtro del menú.
        </p>
      </div>

      <FormularioCategoria />
    </main>
  );
}
