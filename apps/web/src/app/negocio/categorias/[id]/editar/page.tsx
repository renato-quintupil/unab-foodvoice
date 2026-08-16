import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Role, type CategoryDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FormularioCategoria } from '../../_components/formulario-categoria';

export const dynamic = 'force-dynamic';

/**
 * Edición de una categoría (T033, FR-006).
 *
 * La categoría se busca en el listado y no con un endpoint propio: `GET
 * /business/categories` devuelve todas sin paginar, de modo que un endpoint por
 * identificador sería una superficie más que mantener sin ningún requisito que
 * la pida (Principio III).
 *
 * Una categoría **desactivada también se puede editar** (CHK037): sigue visible
 * en la administración y su contenido debe poder corregirse mientras está fuera
 * de uso.
 */
export default async function PaginaEditarCategoria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesion([Role.NEGOCIO]);
  const { id } = await params;

  const { items } = await pedirALaApi<{ items: CategoryDto[] }>('/business/categories');
  const categoria = items.find((c) => c.id === id);
  if (!categoria) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/negocio/categorias" className="text-sm underline">
          Volver a las categorías
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Editar categoría</h1>
        <p className="text-sm text-[var(--color-tenue)]">
          Los cambios rigen de inmediato y no afectan a ningún pedido ya creado.
        </p>
      </div>

      <FormularioCategoria categoria={categoria} />
    </main>
  );
}
