import { Role, type OrderDetailDto } from '@foodvoice/shared';
import { HistorialPedido } from '@/components/historial-pedido';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle del pedido · FoodVoice' };

export default async function PaginaDetallePedidoNegocio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesion([Role.NEGOCIO]);
  const { id } = await params;
  const pedido = await pedirALaApi<OrderDetailDto>(`/business/orders/${id}`);

  return (
    <HistorialPedido
      pedido={pedido}
      titulo="Detalle del pedido"
      volverA="/negocio/pedidos"
    />
  );
}
