'use client';

import { useState } from 'react';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * «Agregar» al carrito, desde el menú (HU-12, FR-002, RN-002).
 *
 * El propio clic **es** la confirmación exigida por el Principio IX (FR-002,
 * Clarifications 2026-08-17): no hay un segundo paso ni un diálogo. Solo se
 * muestra al rol `CLIENTE`: `apps/web/src/app/menu/page.tsx` y
 * `.../menu/[id]/page.tsx` deciden eso antes de montar este componente.
 */
export function AgregarAlCarrito({ productId }: { productId: string }) {
  const [agregado, setAgregado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState(false);

  async function agregar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.post('/cart/lines', { productId });
      setAgregado(true);
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <AccionEnCurso
        type="button"
        size="sm"
        enCurso={enCurso}
        textoEnCurso="Agregando…"
        onClick={() => void agregar()}
      >
        Agregar
      </AccionEnCurso>
      {agregado && (
        <p role="status" className="text-xs text-[var(--color-exito)]">
          Agregado al carrito.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
