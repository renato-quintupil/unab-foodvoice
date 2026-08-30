'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO, type ServiceStatusDto } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';
import { formatearFechaHora } from '@/lib/fechas';
import { DialogoPausa } from './dialogo-pausa';

/**
 * Estado del servicio y sus dos acciones (E8, HU-07 Historia 3). Reanudar es
 * un clic directo, sin diálogo (mismo criterio que "Aceptar" en E2 y
 * "Confirmar" en E7): no tiene ningún efecto que deba explicarse antes.
 */
export function EstadoServicio({ estado }: { estado: ServiceStatusDto }) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reanudar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.put('/admin/service/resume', {});
      router.refresh();
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-[var(--color-borde)] p-4">
        <p className="font-medium">{estado.paused ? 'Servicio pausado' : 'Servicio activo'}</p>
        {estado.paused && (
          <>
            <p className="mt-1 text-sm">Motivo: {estado.reason}</p>
            {estado.pausedAt && (
              <p className="text-sm text-[var(--color-tenue)]">
                Desde {formatearFechaHora(estado.pausedAt)}
              </p>
            )}
          </>
        )}
        {!estado.paused && (
          <p className="text-sm text-[var(--color-tenue)]">
            Los clientes pueden confirmar pedidos con normalidad.
          </p>
        )}
      </div>

      {estado.paused ? (
        <AccionEnCurso enCurso={enCurso} textoEnCurso="Reanudando…" onClick={() => void reanudar()}>
          Reanudar servicio
        </AccionEnCurso>
      ) : (
        <DialogoPausa onPausado={() => router.refresh()} />
      )}

      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
