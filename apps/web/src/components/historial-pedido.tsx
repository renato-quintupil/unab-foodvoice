import Link from 'next/link';
import {
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ROL,
  OrderStatus,
  formatearPrecio,
  type OrderDetailDto,
} from '@foodvoice/shared';
import { formatearFechaHora } from '@/lib/fechas';

type Props = {
  pedido: OrderDetailDto;
  titulo: string;
  volverA: string;
};

/** Presentación única del detalle para cliente, negocio y administración (D-051). */
export function HistorialPedido({ pedido, titulo, volverA }: Props) {
  const ultimoEvento = pedido.history.at(-1);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <Link href={volverA} className="text-sm underline underline-offset-4">
          Volver a pedidos
        </Link>
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-sm text-[var(--color-tenue)]">{pedido.addressText}</p>
      </header>

      <section aria-labelledby="resumen-pedido" className="flex flex-col gap-3">
        <h2 id="resumen-pedido" className="text-lg font-semibold">
          Productos
        </h2>
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
      </section>

      <section aria-labelledby="historial-pedido" className="flex flex-col gap-3">
        <h2 id="historial-pedido" className="text-lg font-semibold">
          Historial del pedido
        </h2>
        <ol className="flex flex-col gap-3 border-l-2 border-[var(--color-borde)] pl-5">
          {pedido.history.map((evento, indice) => (
            <li
              key={`${evento.occurredAt}-${indice}`}
              data-testid="evento-historial"
              className="relative flex flex-col gap-1 rounded-md border border-[var(--color-borde)] p-4 before:absolute before:-left-[1.72rem] before:top-5 before:size-3 before:rounded-full before:bg-[var(--color-texto)]"
            >
              <p className="font-medium">
                {evento.previousStatus === null
                  ? 'Pedido creado'
                  : ETIQUETA_ESTADO_PEDIDO[evento.resultingStatus]}
              </p>
              <time dateTime={evento.occurredAt} className="text-sm text-[var(--color-tenue)]">
                {formatearFechaHora(evento.occurredAt)}
              </time>
              <p className="text-sm">
                {evento.actorName} · {ETIQUETA_ROL[evento.actorRole]}
              </p>
              {indice === pedido.history.length - 1 &&
                ultimoEvento?.resultingStatus === OrderStatus.RECHAZADO &&
                pedido.rejectionReason && (
                  <p className="text-sm text-[var(--color-error)]">
                    Motivo: {pedido.rejectionReason}
                  </p>
                )}
              {indice === pedido.history.length - 1 &&
                ultimoEvento?.resultingStatus === OrderStatus.CERRADO &&
                pedido.complaintReason && (
                  <p className="text-sm text-[var(--color-error)]">
                    Reclamo: {pedido.complaintReason}
                  </p>
                )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
