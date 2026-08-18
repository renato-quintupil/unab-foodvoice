import { Role, type CartDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { Carrito } from './carrito-cliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi carrito · FoodVoice' };

/**
 * Carrito del cliente (HU-12).
 *
 * Server Component solo para la carga inicial y la sesión; toda mutación —
 * agregar, cambiar cantidad, quitar, vaciar— vive en `carrito-cliente.tsx`
 * porque el carrito cambia con cada acción del cliente y esperar una
 * navegación completa por cada clic sería justo lo que FR-005 («en cualquier
 * momento») pide evitar.
 */
export default async function PaginaCarrito() {
  await exigirSesion([Role.CLIENTE]);
  const carrito = await pedirALaApi<CartDto>('/cart');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Mi carrito</h1>
      <Carrito inicial={carrito} />
    </main>
  );
}
