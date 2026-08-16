import Link from 'next/link';
import {
  Dimension,
  ETIQUETA_DIMENSION,
  ETIQUETA_ESTADO_CATEGORIA,
  MSG_SIN_RESULTADOS_CATALOGO,
  Role,
  recortarDescripcion,
  type CategoryDto,
} from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { AccionesCategoria } from './_components/acciones-categoria';
import { FiltrosCategorias } from './_components/filtros-categorias';

export const dynamic = 'force-dynamic';

/**
 * Administración de categorías (T034, FR-010, FR-009, HU14-E10).
 *
 * Agrupadas **por dimensión**, que es como el negocio las piensa: son dos
 * preguntas distintas y mezclarlas obligaría a leer una columna para saber a
 * cuál pertenece cada fila.
 *
 * **Sin filtro, se ven activas y desactivadas** (FR-010): las desactivadas
 * siguen siendo visibles en la administración, marcadas, y solo desaparecen de
 * los filtros del cliente y del alta de productos. Es distinto del listado de
 * productos, que oculta las bajas por defecto, y responde a que aquí no hay
 * paginación que ensuciar. El **filtro por estado** (T089) es la otra mitad que
 * FR-010 pide: no cambia lo que se ve por omisión, permite estrecharlo.
 *
 * **No existe ninguna acción de borrado en esta pantalla** ni en ninguna otra
 * (FR-009, SC-006, HU14-E10). Recorrerla buscándola es el paso V-08.
 */
export default async function PaginaCategorias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion([Role.NEGOCIO]);
  const parametros = await searchParams;

  const consulta = new URLSearchParams();
  // Solo se reenvía lo que el endpoint acepta, y solo con los dos valores que
  // `ListCategoriesQuerySchema` admite: un `active=cualquiera` inventado a mano
  // en la barra de direcciones no llega a la API como filtro.
  const estado = parametros.active;
  if (estado === 'true' || estado === 'false') consulta.set('active', estado);
  const hayFiltros = consulta.toString() !== '';

  const { items } = await pedirALaApi<{ items: CategoryDto[] }>(
    `/business/categories?${consulta.toString()}`,
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categorías</h1>
          <p className="text-sm text-[var(--color-tenue)]">
            Organiza tu carta. Cada producto lleva una categoría de cada clasificación.
          </p>
        </div>
        <Button asChild>
          <Link href="/negocio/categorias/nueva">Crear categoría</Link>
        </Button>
      </header>

      <FiltrosCategorias />

      {items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {/* Con un filtro puesto, un listado vacío significa que no hay
              categorías **de ese estado**, no que falte crear la primera.
              Confundirlos mandaría al negocio a crear una categoría que ya
              tiene, solo por haber filtrado por «Desactivada» (FR-035). */}
          {hayFiltros
            ? MSG_SIN_RESULTADOS_CATALOGO
            : 'Todavía no hay categorías. Crea la primera de cada clasificación para poder dar de alta productos.'}
        </p>
      ) : (
        Object.values(Dimension).map((dimension) => {
          const deLaDimension = items.filter((c) => c.dimension === dimension);

          return (
            <section key={dimension} className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">{ETIQUETA_DIMENSION[dimension]}</h2>

              {deLaDimension.length === 0 ? (
                <p className="text-sm text-[var(--color-tenue)]">
                  {/* La advertencia de que no se podrán dar de alta productos
                      solo es cierta cuando se están viendo **todas**: filtrando
                      por «Desactivada», que no haya ninguna es lo normal. */}
                  {hayFiltros
                    ? MSG_SIN_RESULTADOS_CATALOGO
                    : 'Sin categorías en esta clasificación. No podrás dar de alta productos hasta crear la primera.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {deLaDimension.map((categoria) => (
                    <li
                      key={categoria.id}
                      className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium">{categoria.name}</span>
                          <span className="text-xs text-[var(--color-tenue)]">
                            {
                              ETIQUETA_ESTADO_CATEGORIA[
                                categoria.active ? 'ACTIVA' : 'DESACTIVADA'
                              ]
                            }
                          </span>
                        </div>
                        {/* Recortada en el listado, completa al editar (D-033). */}
                        <p className="text-sm text-[var(--color-tenue)]">
                          {recortarDescripcion(categoria.description)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-start gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/negocio/categorias/${categoria.id}/editar`}>Editar</Link>
                        </Button>
                        <AccionesCategoria categoria={categoria} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
