import { notFound } from 'next/navigation';
import { Role, type OrderDetailDto } from '@foodvoice/shared';
import { HistorialPedido } from '@/components/historial-pedido';
import { pedirALaApiOpcional } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle de mi pedido · FoodVoice' };

export default async function PaginaDetallePedidoCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesion([Role.CLIENTE]);
  const { id } = await params;
  const pedido = await pedirALaApiOpcional<OrderDetailDto>(`/orders/${id}`);
  if (!pedido) notFound();

  return (
    <HistorialPedido
      pedido={pedido}
      titulo="Detalle de mi pedido"
      volverA="/cliente/pedidos"
    />
  );
}
