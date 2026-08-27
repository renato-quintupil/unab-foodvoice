import { formatearPrecio, type DeliveryOrderDto } from '@foodvoice/shared';
import { BotonSoltar } from './boton-soltar';

/**
 * El pedido que el repartidor tiene actualmente en curso, con el teléfono de
 * contacto del cliente (E5, HU-04, Historia 2, FR-007).
 *
 * Recibe `order` ya resuelto por la página (una sola consulta a
 * `GET /delivery/orders/current`, compartida con la decisión de si mostrar
 * la lista de disponibles, FR-004) en vez de pedirlo de nuevo.
 */
export function PedidoEnCurso({ order }: { order: DeliveryOrderDto }) {
  return (
    <section
      data-testid="pedido-en-curso"
      className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4"
    >
      <h2 className="text-lg font-semibold">Tu pedido en curso</h2>
      <p className="text-sm">{order.addressText}</p>
      <p className="text-sm text-[var(--color-tenue)]">Teléfono de contacto: {order.customerPhone}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {order.lines.map((linea) => (
          <li key={linea.productId} className="flex justify-between gap-4">
            <span>
              {linea.quantity} × {linea.productName}
            </span>
            <span>{formatearPrecio(linea.price * linea.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="self-end">
        <BotonSoltar pedidoId={order.id} />
      </div>
    </section>
  );
}
