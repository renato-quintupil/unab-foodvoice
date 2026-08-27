'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Marcar un pedido como entregado (E7, HU-05, FR-001, SC-001).
 *
 * Un clic directo, sin diálogo de confirmación (D-080): es la acción de
 * rutina al terminar la entrega física, igual que "Tomar" (E5).
 */
export function BotonEntregar({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entregar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.put(`/delivery/orders/${pedidoId}/deliver`, {});
      router.refresh();
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <AccionEnCurso
        type="button"
        size="sm"
        enCurso={enCurso}
        textoEnCurso="Marcando…"
        onClick={() => void entregar()}
      >
        Marcar como entregado
      </AccionEnCurso>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
