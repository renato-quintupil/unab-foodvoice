'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';
import { DialogoRechazo } from './dialogo-rechazo';

/**
 * Aceptar o rechazar un pedido en `creado` (HU-01, FR-031, SC-005).
 *
 * Aceptar es **un clic directo**, sin confirmación: es la acción de rutina
 * del negocio y SC-005 la mide en 2 clics o menos.
 */
export function AccionesPedido({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.put(`/business/orders/${pedidoId}/accept`, {});
      router.refresh();
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <AccionEnCurso
          type="button"
          size="sm"
          enCurso={enCurso}
          textoEnCurso="Aceptando…"
          onClick={() => void aceptar()}
        >
          Aceptar
        </AccionEnCurso>
        <DialogoRechazo pedidoId={pedidoId} onRechazado={() => router.refresh()} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
