'use client';

import { useState } from 'react';
import { MSG_ERROR_INESPERADO, formatearPrecio, type ProductDto } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Confirmación de agregado por voz (HU-13, FR-020 a FR-025).
 *
 * Muestra producto, cantidad y precio **vigentes** — los que ya trajo
 * `AddResolutionResponse.status === 'RESOLVED'`, revalidados por el servidor
 * inmediatamente antes de responder — y exige una aprobación explícita
 * (Principio IX) antes de tocar el carrito. Cancelar no llama a ningún
 * endpoint (FR-023).
 *
 * Reutiliza los endpoints **ya existentes** de E2 (`POST /cart/lines` y, si
 * la cantidad es mayor a 1, `PATCH /cart/lines/:productId`) — sin ningún
 * endpoint de escritura nuevo (D-063).
 */
export function ConfirmacionAgregado({
  item,
  quantity,
  onCancelar,
  onConfirmado,
}: {
  item: ProductDto;
  quantity: number;
  onCancelar: () => void;
  onConfirmado: () => void;
}) {
  const [cantidad, setCantidad] = useState(quantity);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setError(null);
    setEnCurso(true);
    try {
      await api.post('/cart/lines', { productId: item.id });
      if (cantidad > 1) {
        await api.patch(`/cart/lines/${item.id}`, { quantity: cantidad });
      }
      onConfirmado();
    } catch (fallo) {
      // FR-025: mismo mensaje que el flujo manual de carrito, no uno distinto
      // para la vía de voz — `ErrorDeApi.mensaje` ya trae el texto de la API.
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Confirmar agregado al carrito"
      className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4"
    >
      <p className="text-sm text-[var(--color-tenue)]">Vas a agregar:</p>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{item.name}</span>
        <span className="text-sm">{formatearPrecio(item.price)}</span>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Cantidad
        <input
          type="number"
          min={1}
          step={1}
          value={cantidad}
          onChange={(evento) => setCantidad(Math.max(1, Number(evento.target.value) || 1))}
          className="h-9 w-20 rounded-md border border-[var(--color-borde)] px-2 text-sm"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <AccionEnCurso
          type="button"
          enCurso={enCurso}
          textoEnCurso="Agregando…"
          onClick={() => void confirmar()}
        >
          Confirmar
        </AccionEnCurso>
        <button
          type="button"
          onClick={onCancelar}
          disabled={enCurso}
          className="rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
