'use client';

import { useState } from 'react';
import { MSG_ERROR_INESPERADO, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO } from '@foodvoice/shared';
import { Campo } from '@/components/campo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Pausar el servicio completo (E8, HU-07 Historia 3, FR-009). El motivo se
 * exige dentro del propio diálogo, mismo patrón que `DialogoRechazo` (E2).
 */
export function DialogoPausa({ onPausado }: { onPausado: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirmar(): Promise<boolean> {
    if (motivo.trim().length < 10) {
      setError(MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO);
      return false;
    }
    try {
      await api.put('/admin/service/pause', { reason: motivo });
      onPausado();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <ConfirmarAccion
      etiqueta="Pausar servicio"
      titulo="Pausar el servicio"
      descripcion="Mientras el servicio esté pausado, los clientes no podrán confirmar pedidos nuevos. Los pedidos ya en curso no se ven afectados."
      reversible
      textoConfirmar="Confirmar pausa"
      onConfirmar={confirmar}
      aviso={error}
      alCerrar={() => {
        setError(null);
        setMotivo('');
      }}
    >
      <Campo id="reason" etiqueta="Motivo de la pausa">
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
