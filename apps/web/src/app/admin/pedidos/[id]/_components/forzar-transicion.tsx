'use client';

import { useState } from 'react';
import {
  ETIQUETA_ESTADO_PEDIDO,
  MSG_ERROR_INESPERADO,
  MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO,
  transicionesForzablesPorAdmin,
  type OrderStatus,
} from '@foodvoice/shared';
import { Campo } from '@/components/campo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Forzar la transición normal siguiente de un pedido (E8, HU-07 Historia 1,
 * FR-001, FR-002). El destino se calcula con `transicionesForzablesPorAdmin`
 * —la misma función que valida el servidor—, así que la interfaz nunca
 * ofrece un destino que el servidor vaya a rechazar (excluye, por ejemplo,
 * la retroceso reservada al repartidor).
 */
export function ForzarTransicion({
  pedidoId,
  estadoActual,
  onForzado,
}: {
  pedidoId: string;
  estadoActual: OrderStatus;
  onForzado: () => void;
}) {
  const destinos = transicionesForzablesPorAdmin(estadoActual);
  const [destino, setDestino] = useState(destinos[0] ?? '');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (destinos.length === 0) return null;

  async function confirmar(): Promise<boolean> {
    if (motivo.trim().length < 10) {
      setError(MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO);
      return false;
    }
    try {
      await api.put(`/admin/orders/${pedidoId}/force-transition`, {
        targetStatus: destino,
        reason: motivo,
      });
      onForzado();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <ConfirmarAccion
      etiqueta="Forzar transición"
      titulo="Forzar transición del pedido"
      descripcion="El pedido pasará al estado que elijas, en tu nombre como administrador, con el motivo que escribas."
      reversible={false}
      textoConfirmar="Confirmar transición"
      onConfirmar={confirmar}
      aviso={error}
      alCerrar={() => {
        setError(null);
        setMotivo('');
      }}
    >
      <Campo id="targetStatus" etiqueta="Nuevo estado">
        {(control) => (
          <select
            {...control}
            value={destino}
            onChange={(e) => setDestino(e.target.value as OrderStatus)}
            className="rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
          >
            {destinos.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_ESTADO_PEDIDO[estado]}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <Campo id="reason" etiqueta="Motivo de la intervención">
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
