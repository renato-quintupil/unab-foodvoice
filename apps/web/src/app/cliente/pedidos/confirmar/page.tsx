import { Role, type AddressDto, type CartDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { ConfirmarPedido } from './confirmar-pedido';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirmar pedido · FoodVoice' };

/**
 * Confirmar el pedido (HU-01, FR-022, FR-025).
 *
 * Carga el carrito y las direcciones activas en el servidor; la elección de
 * dirección y el envío viven en el cliente porque `PRICE_CHANGED` (FR-028)
 * exige recargar el carrito sin salir de la pantalla.
 */
export default async function PaginaConfirmarPedido() {
  await exigirSesion([Role.CLIENTE]);
  const [carrito, direcciones] = await Promise.all([
    pedirALaApi<CartDto>('/cart'),
    pedirALaApi<{ items: AddressDto[] }>('/addresses'),
  ]);

  const direccionesActivas = direcciones.items.filter((d) => d.active);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Confirmar pedido</h1>
      <ConfirmarPedido carritoInicial={carrito} direcciones={direccionesActivas} />
    </main>
  );
}
