import { Role } from '@foodvoice/shared';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FormularioDireccion } from '../_components/formulario-direccion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nueva dirección · FoodVoice' };

export default async function PaginaNuevaDireccion() {
  await exigirSesion([Role.CLIENTE]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Registrar dirección</h1>
      <FormularioDireccion />
    </main>
  );
}
