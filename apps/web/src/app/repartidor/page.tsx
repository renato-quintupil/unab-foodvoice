import { Role, type DeliveryOrderDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { CerrarSesion } from '@/components/cerrar-sesion';
import { PedidoEnCurso } from './_components/pedido-en-curso';
import { PedidosDisponibles } from './_components/pedidos-disponibles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reparto · FoodVoice' };

/**
 * Pantalla del repartidor (E5, HU-04, FR-013). Reemplaza el placeholder sin
 * acciones que dejó E1: el pedido en curso, si existe, va primero — es lo
 * único que el repartidor necesita ver de inmediato al abrir la app.
 *
 * **La lista de disponibles solo se muestra sin pedido en curso** (FR-004):
 * un repartidor con un pedido en `asignado_repartidor` no debe encontrar
 * ninguna acción para tomar otro, ni siquiera un botón deshabilitado — el
 * servidor lo bloquearía igual (409), pero FR-004 exige que la interfaz no
 * lo ofrezca en absoluto.
 */
export default async function PaginaRepartidor() {
  await exigirSesion([Role.REPARTIDOR]);
  const { order } = await pedirALaApi<{ order: DeliveryOrderDto | null }>('/delivery/orders/current');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Reparto</h1>
        <CerrarSesion />
      </div>
      {order ? <PedidoEnCurso order={order} /> : <PedidosDisponibles />}
    </main>
  );
}
