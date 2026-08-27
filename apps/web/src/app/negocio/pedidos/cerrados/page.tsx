import Link from 'next/link';
import { MSG_SIN_PEDIDOS_CERRADOS, Role, formatearPrecio, type OrderSummaryDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos cerrados · FoodVoice' };

/**
 * Pedidos cerrados del negocio, con el reclamo cuando lo hay (E7, HU-05,
 * FR-011, D-081).
 *
 * Hallazgo de `/speckit.analyze` (C1): sin esta pantalla, el negocio no
 * tenía ningún camino hacia el detalle de un pedido `cerrado` — su bandeja
 * solo admite `creado`/`en_preparacion`, y "rechazados" solo `rechazado`.
 * Mismo patrón exacto que esa pantalla.
 */
export default async function PaginaPedidosCerrados() {
  await exigirSesion([Role.NEGOCIO]);
  const { items } = await pedirALaApi<{ items: OrderSummaryDto[] }>('/business/orders/closed');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Pedidos cerrados</h1>
        <Link href="/negocio/pedidos" className="text-sm underline">
          Volver a pedidos
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {MSG_SIN_PEDIDOS_CERRADOS}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((pedido) => (
            <li
              key={pedido.id}
              data-testid="pedido-cerrado"
              className="flex flex-col gap-2 rounded-md border border-[var(--color-borde)] p-4"
            >
              <span className="text-xs text-[var(--color-tenue)]">{pedido.addressText}</span>
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
              {pedido.complaintReason && (
                <p className="text-sm text-[var(--color-error)]">Reclamo: {pedido.complaintReason}</p>
              )}
              <Link href={`/negocio/pedidos/${pedido.id}`} className="text-sm underline">
                Ver historial
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
