import { OrderStatus, type OrderDetailDto } from '@foodvoice/shared';
import { HistorialPedido } from '@/components/historial-pedido';
import { pedirALaApi } from '@/lib/api-servidor';
import { AccionesAdmin } from './_components/acciones-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle del pedido · FoodVoice' };

/** Terminal: sin transiciones salientes propias (E8, D-083). */
const ES_TERMINAL = new Set<OrderStatus>([OrderStatus.CERRADO, OrderStatus.RECHAZADO]);

export default async function PaginaDetallePedidoAdmin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = await pedirALaApi<OrderDetailDto>(`/admin/dashboard/orders/${id}`);

  return (
    <HistorialPedido
      pedido={pedido}
      titulo="Detalle del pedido"
      volverA="/admin/pedidos"
      acciones={
        !ES_TERMINAL.has(pedido.status) ? (
          <AccionesAdmin pedidoId={pedido.id} estadoActual={pedido.status} />
        ) : undefined
      }
    />
  );
}
