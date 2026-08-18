import Link from 'next/link';
import { Role, type AddressDto } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { AccionesDireccion } from './_components/acciones-direccion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mis direcciones · FoodVoice' };

/**
 * Lista de direcciones del cliente (HU-11, FR-018).
 *
 * Muestra **todas**, activas y desactivadas (FR-018): una desactivada sigue
 * siendo visible para poder reactivarla. Sin paginación (Supuesto 3).
 */
export default async function PaginaDirecciones() {
  await exigirSesion([Role.CLIENTE]);
  const { items } = await pedirALaApi<{ items: AddressDto[] }>('/addresses');

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Mis direcciones</h1>
        <Button asChild>
          <Link href="/cliente/direcciones/nueva">Registrar dirección</Link>
        </Button>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          Todavía no tienes direcciones guardadas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((direccion) => (
            <li
              key={direccion.id}
              data-testid="direccion"
              className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{direccion.label}</span>
                  {direccion.isDefault && (
                    <span
                      data-testid="predeterminada"
                      className="rounded-md border border-[var(--color-borde)] px-2 py-0.5 text-xs"
                    >
                      Predeterminada
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-tenue)]">
                    {direccion.active ? 'Activa' : 'Desactivada'}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-tenue)]">{direccion.text}</p>
              </div>

              <div className="flex shrink-0 flex-wrap items-start gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/cliente/direcciones/${direccion.id}/editar`}>Editar</Link>
                </Button>
                <AccionesDireccion direccion={direccion} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
