import Link from 'next/link';
import {
  ETIQUETA_ESTADO_PEDIDO,
  MSG_SIN_PEDIDOS_EN_CURSO,
  Role,
  formatearPrecio,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos en curso · FoodVoice' };

/**
 * Pedidos `asignado_repartidor` y `entregado` del negocio — corrección
 * post-verificación (ver `enCursoDelNegocio`).
 *
 * Sin esta pantalla, un pedido dejaba de ser visible para el negocio en
 * cuanto un repartidor lo tomaba, y solo volvía a aparecer si el cliente lo
 * cerraba (`/negocio/pedidos/cerrados`) o nunca, si no actuaba. Combina dos
 * estados en una sola lista, a diferencia de "rechazados"/"cerrados", por
 * eso cada fila muestra su propia etiqueta de estado (mismo patrón que la
 * bandeja principal).
 */
export default async function PaginaPedidosEnCurso() {
  await exigirSesion([Role.NEGOCIO]);
  const { items } = await pedirALaApi<{ items: OrderSummaryDto[] }>('/business/orders/in-progress');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Pedidos en curso</h1>
        <Link href="/negocio/pedidos" className="text-sm underline">
          Volver a pedidos
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {MSG_SIN_PEDIDOS_EN_CURSO}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((pedido) => (
            <li
              key={pedido.id}
              data-testid="pedido-en-curso"
              className="flex flex-col gap-2 rounded-md border border-[var(--color-borde)] p-4"
            >
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
