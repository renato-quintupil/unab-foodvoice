import Link from 'next/link';
import { Role, type CategoryDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FormularioProducto } from '../_components/formulario-producto';

export const dynamic = 'force-dynamic';

/**
 * Alta de un producto (T052, FR-012).
 *
 * Pide **solo las categorías activas** (`?active=true`): una desactivada no se
 * ofrece en el alta (FR-011), y es también lo que permite al formulario detectar
 * que una dimensión no tiene ninguna y explicarlo en lugar de mostrar un
 * desplegable vacío (HU14-E19).
 */
export default async function PaginaNuevoProducto() {
  await exigirSesion([Role.NEGOCIO]);
  const { items } = await pedirALaApi<{ items: CategoryDto[] }>(
    '/business/categories?active=true',
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/negocio/productos" className="text-sm underline">
          Volver a los productos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Crear producto</h1>
        <p className="text-sm text-[var(--color-tenue)]">
          Queda disponible en el menú del cliente sin ningún paso adicional.
        </p>
      </div>

      <FormularioProducto categorias={items} />
    </main>
  );
}
