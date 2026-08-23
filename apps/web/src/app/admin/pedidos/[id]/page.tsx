import { type OrderDetailDto } from '@foodvoice/shared';
import { HistorialPedido } from '@/components/historial-pedido';
import { pedirALaApi } from '@/lib/api-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle del pedido · FoodVoice' };

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
    />
  );
}
