import { Role } from '@foodvoice/shared';
import { exigirSesion } from '@/lib/sesion-servidor';
import { PedidoEnCurso } from './_components/pedido-en-curso';
import { PedidosDisponibles } from './_components/pedidos-disponibles';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reparto · FoodVoice' };

/**
 * Pantalla del repartidor (E5, HU-04, FR-013). Reemplaza el placeholder sin
 * acciones que dejó E1: el pedido en curso, si existe, va primero — es lo
 * único que el repartidor necesita ver de inmediato al abrir la app.
 */
export default async function PaginaRepartidor() {
  await exigirSesion([Role.REPARTIDOR]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-semibold">Reparto</h1>
      <PedidoEnCurso />
      <PedidosDisponibles />
    </main>
  );
}
