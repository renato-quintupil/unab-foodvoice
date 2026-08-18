'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO, type AddressDto } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Marcar predeterminada, desactivar/reactivar y eliminar una dirección
 * (HU-11, FR-015, FR-018, FR-019, FR-024).
 *
 * **Eliminar se ofrece siempre**, aunque `AddressDto` no diga si la
 * dirección ya se usó (D-039 la mantiene interna): la interfaz lo intenta y
 * el `409 ADDRESS_IN_USE` explica que el camino correcto es desactivarla, en
 * lugar de adivinar la condición de antemano y arriesgarse a que diverja de
 * lo que decide el servidor.
 */
export function AccionesDireccion({ direccion }: { direccion: AddressDto }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);

  async function marcarPredeterminada() {
    setError(null);
    setEnCurso('predeterminada');
    try {
      await api.put(`/addresses/${direccion.id}/default`, {});
      router.refresh();
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(null);
    }
  }

  async function reactivar() {
    setError(null);
    setEnCurso('reactivar');
    try {
      await api.put(`/addresses/${direccion.id}/status`, { active: true });
      router.refresh();
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(null);
    }
  }

  async function desactivar(): Promise<boolean> {
    try {
      await api.put(`/addresses/${direccion.id}/status`, { active: false });
      router.refresh();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  async function eliminar(): Promise<boolean> {
    try {
      await api.delete(`/addresses/${direccion.id}`);
      router.refresh();
      return true;
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {direccion.active && !direccion.isDefault && (
          <AccionEnCurso
            type="button"
            variant="outline"
            size="sm"
            enCurso={enCurso === 'predeterminada'}
            textoEnCurso="Marcando…"
            onClick={() => void marcarPredeterminada()}
          >
            Marcar predeterminada
          </AccionEnCurso>
        )}

        {direccion.active ? (
          <ConfirmarAccion
            etiqueta="Desactivar"
            titulo={`Desactivar «${direccion.label}»`}
            descripcion="Dejará de ofrecerse para pedidos nuevos. Podrás reactivarla más adelante."
            reversible
            textoConfirmar="Desactivar"
            onConfirmar={desactivar}
            aviso={error}
            alCerrar={() => setError(null)}
          />
        ) : (
          <AccionEnCurso
            type="button"
            variant="outline"
            size="sm"
            enCurso={enCurso === 'reactivar'}
            textoEnCurso="Reactivando…"
            onClick={() => void reactivar()}
          >
            Reactivar
          </AccionEnCurso>
        )}

        <ConfirmarAccion
          etiqueta="Eliminar"
          titulo={`Eliminar «${direccion.label}»`}
          descripcion="Se borra sin dejar rastro. Si ya se usó en un pedido, no se podrá eliminar: la opción correcta será desactivarla."
          reversible={false}
          textoConfirmar="Eliminar"
          onConfirmar={eliminar}
          aviso={error}
          alCerrar={() => setError(null)}
        />
      </div>

      {error && !enCurso && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
