import { ETIQUETA_ESTADO_PEDIDO, Role, formatearPrecio, type OrderSummaryDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis pedidos · FoodVoice' };

/**
 * Mis pedidos (HU-01, FR-037). Estado actual y, si corresponde, el motivo de
 * rechazo — sin historial (RN-011, E4) ni ninguna acción de edición (FR-035).
 */
export default async function PaginaMisPedidos() {
  await exigirSesion([Role.CLIENTE]);
  const { items } = await pedirALaApi<{ items: OrderSummaryDto[] }>('/orders');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Mis pedidos</h1>

      {items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          Todavía no has confirmado ningún pedido.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((pedido) => (
            <li
              key={pedido.id}
              data-testid="pedido"
              className="flex flex-col gap-2 rounded-md border border-[var(--color-borde)] p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span
                  data-testid="estado-pedido"
                  className="rounded-md border border-[var(--color-borde)] px-2 py-0.5 text-xs"
                >
                  {ETIQUETA_ESTADO_PEDIDO[pedido.status]}
                </span>
                <span className="text-xs text-[var(--color-tenue)]">{pedido.addressText}</span>
              </div>

              <ul className="flex flex-col gap-1 text-sm">
                {pedido.lines.map((linea) => (
                  <li key={linea.productId} className="flex justify-between">
                    <span>
                      {linea.quantity} × {linea.productName}
                    </span>
                    <span>{formatearPrecio(linea.price * linea.quantity)}</span>
                  </li>
                ))}
              </ul>

              {pedido.rejectionReason && (
                <p data-testid="motivo-rechazo" className="text-sm text-[var(--color-error)]">
                  Motivo: {pedido.rejectionReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
