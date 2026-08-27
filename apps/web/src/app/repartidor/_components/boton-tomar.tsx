'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Tomar un pedido disponible (E5, HU-04, FR-002, SC-001).
 *
 * Un clic directo, sin confirmación: es la acción de rutina del repartidor,
 * igual que "Aceptar" ya lo es para el negocio (E2) — no hay nada que
 * deshacer aquí que soltar (Historia 3) no resuelva.
 */
export function BotonTomar({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tomar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.put(`/delivery/orders/${pedidoId}/take`, {});
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
        textoEnCurso="Tomando…"
        onClick={() => void tomar()}
      >
        Tomar
      </AccionEnCurso>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
