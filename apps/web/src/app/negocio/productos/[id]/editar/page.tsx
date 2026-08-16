import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ETIQUETA_ESTADO_PRODUCTO,
  Role,
  type CategoryDto,
  type Paginated,
  type ProductDto,
} from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FormularioProducto } from '../../_components/formulario-producto';

export const dynamic = 'force-dynamic';

/**
 * Edición de un producto (T052, FR-018, FR-022).
 *
 * Se busca **entre todos los estados**, incluidos los dados de baja: editar un
 * producto retirado es lo que permite reclasificarlo para poder reactivarlo
 * (FR-021, HU02-E15), y es la salida que la pantalla de listado ofrece.
 *
 * Los desplegables se pueblan con las categorías **activas** más, si hiciera
 * falta, la que el producto ya tiene: sin ella, un producto clasificado con una
 * categoría desactivada perdería su clasificación al abrir el formulario.
 */
export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesion([Role.NEGOCIO]);
  const { id } = await params;

  const [porEstado, categorias] = await Promise.all([
    // No hay endpoint de producto por identificador en la superficie de
    // administración —solo en `/menu`, que excluye los no activos—, así que se
    // busca en los tres estados posibles.
    Promise.all(
      ['', '?status=AGOTADO', '?status=DADO_DE_BAJA'].map((filtro) =>
        pedirALaApi<Paginated<ProductDto>>(`/business/products${filtro}`),
      ),
    ),
    pedirALaApi<{ items: CategoryDto[] }>('/business/categories?active=true'),
  ]);

  const producto = porEstado.flatMap((pagina) => pagina.items).find((p) => p.id === id);
  if (!producto) notFound();

  // Las categorías que el producto ya tiene se conservan en el desplegable
  // aunque estén desactivadas, para que la edición no las pierda en silencio.
  const activas = categorias.items;
  const propias = [producto.foodTypeCategory, producto.healthProfileCategory]
    .filter((propia) => !activas.some((activa) => activa.id === propia.id))
    .map((propia) => ({
      ...propia,
      description: '',
      active: false,
      createdAt: producto.createdAt,
    }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/negocio/productos" className="text-sm underline">
          Volver a los productos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Editar producto</h1>
        <p className="text-sm text-[var(--color-tenue)]">
          {ETIQUETA_ESTADO_PRODUCTO[producto.status]} · los cambios rigen de inmediato y no afectan
          a ningún pedido ya creado.
        </p>
      </div>

      <FormularioProducto categorias={[...activas, ...propias]} producto={producto} />
    </main>
  );
}
