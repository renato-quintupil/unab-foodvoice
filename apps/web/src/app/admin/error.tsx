'use client';

import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';

/**
 * Límite de error de la superficie administrativa (T120, D-019, ops CHK033).
 *
 * Se declara aquí además de en la raíz para que el aviso aparezca **sobre la
 * vista actual**, conservando la navegación del administrador en lugar de
 * reemplazar la pantalla entera. Tampoco lleva a `/login`.
 */
export default function LimiteDeErrorAdmin({ reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-md border border-[var(--color-error)] px-4 py-6"
    >
      <p className="font-medium">No pudimos completar la operación</p>
      <p className="text-sm">{MSG_ERROR_INESPERADO}</p>
      <div>
        <Button variant="outline" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
