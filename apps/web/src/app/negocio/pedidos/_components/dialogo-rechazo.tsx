'use client';

import { useState } from 'react';
import { MSG_ERROR_INESPERADO, MSG_MOTIVO_RECHAZO_REQUERIDO } from '@foodvoice/shared';
import { Campo } from '@/components/campo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Diálogo de rechazo (HU-01, FR-031, FR-033, RN-007).
 *
 * El motivo se exige **dentro** del mismo diálogo de confirmación: no hay un
 * botón de «rechazar» sin ese paso. Reutiliza `ConfirmarAccion` (que ya
 * cumple SC-005: abrir el diálogo y confirmar son los 2 clics; escribir el
 * motivo no cuenta como un clic adicional) en lugar de un diálogo propio.
 */
export function DialogoRechazo({
  pedidoId,
  onRechazado,
}: {
  pedidoId: string;
  onRechazado: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirmar(): Promise<boolean> {
    if (motivo.trim().length < 10) {
      setError(MSG_MOTIVO_RECHAZO_REQUERIDO);
      return false;
    }
    try {
      await api.put(`/business/orders/${pedidoId}/reject`, { reason: motivo });
      onRechazado();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <ConfirmarAccion
      etiqueta="Rechazar"
      titulo="Rechazar pedido"
      descripcion="El cliente verá este pedido como «Rechazado» junto con el motivo que escribas."
      reversible={false}
      textoConfirmar="Confirmar rechazo"
      onConfirmar={confirmar}
      aviso={error}
      alCerrar={() => {
        setError(null);
        setMotivo('');
      }}
    >
      <Campo id="reason" etiqueta="Motivo del rechazo">
        {(control) => (
          <textarea
            {...control}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
          />
        )}
      </Campo>
    </ConfirmarAccion>
  );
}
