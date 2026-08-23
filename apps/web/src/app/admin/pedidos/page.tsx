import Link from 'next/link';
import { Suspense } from 'react';
import {
  ETIQUETA_ESTADO_PEDIDO,
  MSG_SIN_RESULTADOS_PEDIDOS,
  type OrderDto,
  type Paginated,
} from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { formatearFecha } from '@/lib/fechas';
import { FiltrosPedidos } from './filtros-pedidos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reporte de pedidos · FoodVoice' };

/**
 * Reporte de pedidos (T114, FR-020, FR-022, SC-020, ux CHK021, ux CHK026).
 *
 * Las fechas se muestran en **`DD/MM/AAAA`**: el formato interno nunca aparece
 * en pantalla. La paginación y la indicación de total son las mismas que las
 * del listado de usuarios, porque ambas superficies comparten `Paginated<T>` y
 * el mismo `PAGE_SIZE`.
 *
 * En E1 la lista es vacía por diseño y la vista muestra el mensaje en español.
 */
export default async function PaginaPedidos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const consulta = new URLSearchParams();
  for (const clave of ['status', 'from', 'to', 'page'] as const) {
    const valor = parametros[clave];
    if (typeof valor === 'string' && valor !== '') consulta.set(clave, valor);
  }

  const pagina = await pedirALaApi<Paginated<OrderDto>>(
    `/admin/dashboard/orders?${consulta.toString()}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin" className="text-sm underline underline-offset-4">
          Volver al Panel
        </Link>
        <h1 className="text-2xl font-semibold">Reporte de pedidos</h1>
      </div>

      <Suspense fallback={null}>
        <FiltrosPedidos />
      </Suspense>

      <p className="text-sm text-[var(--color-tenue)]">
        {pagina.total === 1 ? '1 resultado' : `${pagina.total} resultados`}
      </p>

      {pagina.items.length === 0 ? (
        <div className="rounded-md border border-[var(--color-borde)] px-4 py-8 text-center">
          <p>{MSG_SIN_RESULTADOS_PEDIDOS}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-lg border-collapse text-sm">
            <caption className="sr-only">Pedidos que cumplen los filtros aplicados</caption>
            <thead>
              <tr className="border-b border-[var(--color-borde)] text-left">
                <th scope="col" className="py-2 pr-3">Pedido</th>
                <th scope="col" className="py-2 pr-3">Estado</th>
                <th scope="col" className="py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pagina.items.map((pedido) => (
                <tr key={pedido.id} className="border-b border-[var(--color-borde)]">
                  <td className="py-3 pr-3">
                    <Link href={`/admin/pedidos/${pedido.id}`} className="underline">
                      {pedido.id}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">{ETIQUETA_ESTADO_PEDIDO[pedido.status]}</td>
                  {/* DD/MM/AAAA, nunca el formato interno (ux CHK021). */}
                  <td className="py-3">{formatearFecha(pedido.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagina.totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-4 text-sm">
          <span>
            Página {pagina.page} de {pagina.totalPages}
          </span>
        </nav>
      )}
    </div>
  );
}
