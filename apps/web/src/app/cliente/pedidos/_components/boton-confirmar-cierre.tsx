'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Confirmar que un pedido entregado llegó bien (E7, HU-05, FR-005, FR-006,
 * SC-002).
 *
 * Un clic directo, sin diálogo de confirmación (D-080): no hay ningún
 * efecto no obvio que explicarle al cliente antes de cerrar un pedido sin
 * comentarios.
 */
export function BotonConfirmarCierre({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.put(`/orders/${pedidoId}/confirm`, {});
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
        textoEnCurso="Confirmando…"
        onClick={() => void confirmar()}
      >
        Todo bien
      </AccionEnCurso>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
