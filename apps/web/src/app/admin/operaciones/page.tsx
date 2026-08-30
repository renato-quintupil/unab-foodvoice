import type { ServiceStatusDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { EstadoServicio } from './_components/estado-servicio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Operaciones · FoodVoice' };

/** Pausar/reanudar el servicio (E8, HU-07 Historia 3, D-089). */
export default async function PaginaOperaciones() {
  const estado = await pedirALaApi<ServiceStatusDto>('/admin/service/status');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Operaciones</h1>
        <p className="text-sm text-[var(--color-tenue)]">
          Pausa el servicio para impedir pedidos nuevos temporalmente, sin afectar los que ya
          están en curso.
        </p>
      </header>

      <EstadoServicio estado={estado} />
    </main>
  );
}
