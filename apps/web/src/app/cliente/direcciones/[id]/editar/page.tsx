import { notFound } from 'next/navigation';
import { Role, type AddressDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FormularioDireccion } from '../../_components/formulario-direccion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar dirección · FoodVoice' };

/**
 * Editar una dirección guardada (FR-016).
 *
 * No existe `GET /addresses/:id`: la lista completa siempre es chica
 * (Supuesto 3), así que se busca dentro de `GET /addresses` en lugar de un
 * endpoint de detalle que ningún otro consumidor necesitaría.
 */
export default async function PaginaEditarDireccion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesion([Role.CLIENTE]);
  const { id } = await params;

  const { items } = await pedirALaApi<{ items: AddressDto[] }>('/addresses');
  const direccion = items.find((d) => d.id === id);
  if (!direccion) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Editar dirección</h1>
      <FormularioDireccion direccion={direccion} />
    </main>
  );
}
