'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO, MSG_MOTIVO_RECLAMO_REQUERIDO } from '@foodvoice/shared';
import { Campo } from '@/components/campo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Diálogo de reclamo al cerrar un pedido entregado (E7, HU-05, FR-007,
 * FR-008, FR-010).
 *
 * El motivo se exige **dentro** del mismo diálogo de confirmación, mismo
 * patrón que `DialogoRechazo` (E2): no hay un botón de «reclamar» sin ese
 * paso.
 */
export function DialogoReclamo({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirmar(): Promise<boolean> {
    if (motivo.trim().length < 10) {
      setError(MSG_MOTIVO_RECLAMO_REQUERIDO);
      return false;
    }
    try {
      await api.put(`/orders/${pedidoId}/complain`, { reason: motivo });
      router.refresh();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <ConfirmarAccion
      etiqueta="Reclamar"
      titulo="Reclamar por este pedido"
      descripcion="El pedido quedará cerrado con el motivo que escribas, visible para ti y para el negocio."
      reversible={false}
      textoConfirmar="Confirmar reclamo"
      onConfirmar={confirmar}
      aviso={error}
      alCerrar={() => {
        setError(null);
        setMotivo('');
      }}
    >
      <Campo id="reason" etiqueta="Motivo del reclamo">
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
