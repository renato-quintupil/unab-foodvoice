'use client';

import { useState } from 'react';
import { MSG_ERROR_INESPERADO, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO } from '@foodvoice/shared';
import { Campo } from '@/components/campo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Cierre administrativo de un pedido fuera del camino normal (E8, HU-07
 * Historia 2, FR-003, FR-004). Mismo patrón que `ForzarTransicion` y
 * `DialogoRechazo` (E2): el motivo se exige dentro del propio diálogo.
 */
export function CerrarAdministrativamente({
  pedidoId,
  onCerrado,
}: {
  pedidoId: string;
  onCerrado: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirmar(): Promise<boolean> {
    if (motivo.trim().length < 10) {
      setError(MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO);
      return false;
    }
    try {
      await api.put(`/admin/orders/${pedidoId}/close`, { reason: motivo });
      onCerrado();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <ConfirmarAccion
      etiqueta="Cerrar administrativamente"
      titulo="Cerrar administrativamente el pedido"
      descripcion="El pedido quedará cerrado fuera del camino normal, con el motivo que escribas visible para el cliente y el negocio."
      reversible={false}
      textoConfirmar="Confirmar cierre"
      onConfirmar={confirmar}
      aviso={error}
      alCerrar={() => {
        setError(null);
        setMotivo('');
      }}
    >
      <Campo id="reason" etiqueta="Motivo del cierre">
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
