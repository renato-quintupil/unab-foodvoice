import Link from 'next/link';
import {
  ETIQUETA_ESTADO_PRODUCTO,
  MSG_SIN_RESULTADOS_CATALOGO,
  Role,
  formatearPrecio,
  recortarDescripcion,
  type CategoryDto,
  type Paginated,
  type ProductDto,
} from '@foodvoice/shared';
import { AvisosCatalogo } from '@/components/avisos-catalogo';
import { Button } from '@/components/ui/button';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { AccionesFila } from './_components/acciones-fila';
import { FiltrosProductos } from './_components/filtros-productos';

export const dynamic = 'force-dynamic';

/**
 * Listado de administración del catálogo (T053, T088, FR-023, FR-035, SC-024).
 *
 * Paginado de 20 en 20 con el total de resultados, filtros combinables y búsqueda
 * por nombre. **Sin ningún filtro muestra solo los activos** —disponibles y
 * agotados—: el trabajo cotidiano del negocio es sobre el menú vigente y una baja
 * es la excepción. El filtro de estado los recupera en un clic.
 *
 * La descripción se muestra **recortada** (D-033, T088): completa haría ilegible
 * una tabla de veinte filas. Íntegra está en el formulario de edición.
 */
export default async function PaginaProductos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion([Role.NEGOCIO]);
  const parametros = await searchParams;

  const consulta = new URLSearchParams();
  for (const clave of ['search', 'status', 'categoryId', 'page'] as const) {
    const valor = parametros[clave];
    if (typeof valor === 'string' && valor !== '') consulta.set(clave, valor);
  }

  const [productos, categorias] = await Promise.all([
    pedirALaApi<Paginated<ProductDto>>(`/business/products?${consulta.toString()}`),
    pedirALaApi<{ items: CategoryDto[] }>('/business/categories?active=true'),
  ]);

  const paginaActual = productos.page;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-[var(--color-tenue)]">
            {productos.total} {productos.total === 1 ? 'resultado' : 'resultados'}
          </p>
        </div>
        <Button asChild>
          <Link href="/negocio/productos/nuevo">Crear producto</Link>
        </Button>
      </header>

      <FiltrosProductos categorias={categorias.items} />

      {/* Envuelve el listado para que la confirmación de una baja o una
          reactivación **sobreviva a que su fila desaparezca** (FR-025). Sin
          esto, dar de baja era la única acción de la épica que no confirmaba
          nada, porque el producto salía de la vista por omisión en el mismo
          instante. */}
      <AvisosCatalogo>
        {productos.items.length === 0 ? (
          <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
            {MSG_SIN_RESULTADOS_CATALOGO}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {productos.items.map((producto) => (
              <li
                key={producto.id}
                className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{producto.name}</span>
                    <span className="text-sm">{formatearPrecio(producto.price)}</span>
                    <span className="text-xs text-[var(--color-tenue)]">
                      {ETIQUETA_ESTADO_PRODUCTO[producto.status]}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-tenue)]">
                    {recortarDescripcion(producto.description)}
                  </p>
                  <p className="text-xs text-[var(--color-tenue)]">
                    {producto.foodTypeCategory.name} · {producto.healthProfileCategory.name}
                  </p>
                </div>

                <div className="shrink-0">
                  <AccionesFila producto={producto} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AvisosCatalogo>

      {productos.totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-3">
          {paginaActual > 1 && (
            <Link
              href={`/negocio/productos?${paginar(consulta, paginaActual - 1)}`}
              className="text-sm underline"
            >
              Anterior
            </Link>
          )}
          <span className="text-sm text-[var(--color-tenue)]">
            Página {paginaActual} de {productos.totalPages}
          </span>
          {paginaActual < productos.totalPages && (
            <Link
              href={`/negocio/productos?${paginar(consulta, paginaActual + 1)}`}
              className="text-sm underline"
            >
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}

/** Conserva los filtros al cambiar de página: sin ellos, la página 2 mostraría otro conjunto. */
function paginar(consulta: URLSearchParams, pagina: number): string {
  const siguiente = new URLSearchParams(consulta.toString());
  siguiente.set('page', String(pagina));
  return siguiente.toString();
}
