'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO, type AddressDto } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { api, ErrorDeApi } from '@/lib/api-client';

export function SelectorDireccion({ direcciones }: { direcciones: AddressDto[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enCursoId, setEnCursoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activas = direcciones.filter((direccion) => direccion.active);
  const predeterminada = activas.find((direccion) => direccion.isDefault);

  if (!predeterminada) {
    return (
      <Link
        href="/cliente/direcciones/nueva"
        className="text-sm font-medium text-[var(--color-primario)] underline underline-offset-4"
      >
        Registrar dirección
      </Link>
    );
  }

  async function elegir(direccion: AddressDto) {
    if (direccion.isDefault || enCursoId !== null) return;
    setError(null);
    setEnCursoId(direccion.id);
    try {
      await api.put<AddressDto>(`/addresses/${direccion.id}/default`, {});
      setAbierto(false);
      router.refresh();
    } catch (causa) {
      setError(causa instanceof ErrorDeApi ? causa.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCursoId(null);
    }
  }

  const alternativas = activas.filter((direccion) => !direccion.isDefault);
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto((actual) => !actual)}
        className="flex max-w-xs items-center rounded-md border border-[var(--color-borde)] px-3 py-2 text-left text-sm"
      >
        <span className="truncate">
          {predeterminada.label} · {predeterminada.text}
        </span>
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg border border-[var(--color-borde)] bg-[var(--color-fondo)] p-2 shadow-lg"
        >
          {alternativas.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-[var(--color-tenue)]">
              No tienes otras direcciones activas.
            </p>
          )}
          {alternativas.map((direccion) => (
            <Button
              key={direccion.id}
              type="button"
              variant="ghost"
              role="menuitem"
              disabled={enCursoId !== null}
              onClick={() => elegir(direccion)}
              className="h-auto justify-start whitespace-normal px-2 py-2 text-left"
            >
              {direccion.label} · {direccion.text}
            </Button>
          ))}
          {error && (
            <p role="alert" className="px-2 py-1 text-sm text-[var(--color-error)]">
              {error}
            </p>
          )}
          <Link
            href="/cliente/direcciones"
            role="menuitem"
            className="rounded-md px-2 py-2 text-sm font-medium text-[var(--color-primario)] underline underline-offset-4"
          >
            Gestionar direcciones
          </Link>
        </div>
      )}
    </div>
  );
}
