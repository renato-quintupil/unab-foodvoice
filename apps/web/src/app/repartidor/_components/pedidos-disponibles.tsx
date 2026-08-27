import { MSG_SIN_PEDIDOS_DISPONIBLES, formatearPrecio, type OrderSummaryDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { BotonTomar } from './boton-tomar';

/**
 * Pedidos `en_preparacion` sin repartidor asignado (E5, HU-04, FR-001,
 * FR-006). Autoservicio: cualquier repartidor puede tomar cualquiera de la
 * lista, sin que el negocio intervenga (FR-002).
 */
export async function PedidosDisponibles() {
  const disponibles = await pedirALaApi<{ items: OrderSummaryDto[] }>('/delivery/orders/available');

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Pedidos disponibles</h2>

      {disponibles.items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {MSG_SIN_PEDIDOS_DISPONIBLES}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {disponibles.items.map((pedido) => (
            <li
              key={pedido.id}
              data-testid="pedido-disponible"
              className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
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
              </div>

              <div className="shrink-0">
                <BotonTomar pedidoId={pedido.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
