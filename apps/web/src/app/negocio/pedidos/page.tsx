import Link from 'next/link';
import {
  ETIQUETA_ESTADO_PEDIDO,
  MSG_SIN_PEDIDOS_PENDIENTES,
  OrderStatus,
  Role,
  formatearPrecio,
  type OrderSummaryDto,
  type Paginated,
} from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { AccionesPedido } from './_components/acciones-pedido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos · FoodVoice' };

/**
 * Bandeja del negocio (HU-01, FR-038, FR-040, FR-041, D-043).
 *
 * Combina `creado` y `en_preparacion`, paginada de 20 en 20, del más antiguo
 * al más reciente. Solo los pedidos en `creado` ofrecen aceptar/rechazar
 * (FR-032): un pedido en `en_preparacion` ya salió de esa decisión.
 */
export default async function PaginaBandejaNegocio({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirSesion([Role.NEGOCIO]);
  const parametros = await searchParams;
  const pagina = typeof parametros.page === 'string' ? parametros.page : '1';

  const bandeja = await pedirALaApi<Paginated<OrderSummaryDto>>(
    `/business/orders?page=${pagina}`,
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <div className="flex gap-4">
          <Link href="/negocio/pedidos/en-curso" className="text-sm underline">
            Ver en curso
          </Link>
          <Link href="/negocio/pedidos/rechazados" className="text-sm underline">
            Ver rechazados
          </Link>
          <Link href="/negocio/pedidos/cerrados" className="text-sm underline">
            Ver cerrados
          </Link>
        </div>
      </header>

      {bandeja.items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {MSG_SIN_PEDIDOS_PENDIENTES}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bandeja.items.map((pedido) => (
            <li
              key={pedido.id}
              data-testid="pedido"
              className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-md border border-[var(--color-borde)] px-2 py-0.5 text-xs">
                    {ETIQUETA_ESTADO_PEDIDO[pedido.status]}
                  </span>
                  <span className="text-xs text-[var(--color-tenue)]">{pedido.addressText}</span>
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {pedido.lines.map((linea) => (
                    <li key={linea.productId} className="flex justify-between gap-4">
                      <span>
                        {linea.quantity} × {linea.productName}
                      </span>
                      <span>{formatearPrecio(linea.price * linea.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/negocio/pedidos/${pedido.id}`} className="text-sm underline">
                  Ver historial
                </Link>
              </div>

              {pedido.status === OrderStatus.CREADO && (
                <div className="shrink-0">
                  <AccionesPedido pedidoId={pedido.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {bandeja.totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-3">
          {bandeja.page > 1 && (
            <Link href={`/negocio/pedidos?page=${bandeja.page - 1}`} className="text-sm underline">
              Anterior
            </Link>
          )}
          <span className="text-sm text-[var(--color-tenue)]">
            Página {bandeja.page} de {bandeja.totalPages}
          </span>
          {bandeja.page < bandeja.totalPages && (
            <Link href={`/negocio/pedidos?page=${bandeja.page + 1}`} className="text-sm underline">
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
