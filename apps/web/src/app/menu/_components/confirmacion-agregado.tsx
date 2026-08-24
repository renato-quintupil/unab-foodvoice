'use client';

import { useState } from 'react';
import { MSG_ERROR_INESPERADO, formatearPrecio, type ItemResuelto } from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Confirmación de agregado por voz (HU-13, FR-020 a FR-025).
 *
 * Muestra todos los productos, cantidades y precios **vigentes** — los que ya
 * trajo `AddResolutionResponse.status === 'RESOLVED'`, revalidados por el
 * servidor inmediatamente antes de responder — y exige una aprobación
 * explícita (Principio IX) antes de tocar el carrito. Cancelar no llama a
 * ningún endpoint (FR-023).
 *
 * `items` puede traer más de un producto cuando la frase nombró varios
 * (D-066): una sola confirmación agrega todos con el mismo criterio.
 *
 * Reutiliza los endpoints **ya existentes** de E2 (`POST /cart/lines` y, si
 * la cantidad es mayor a 1, `PATCH /cart/lines/:productId`) — sin ningún
 * endpoint de escritura nuevo (D-063).
 */
export function ConfirmacionAgregado({
  items,
  onCancelar,
  onConfirmado,
}: {
  items: ItemResuelto[];
  onCancelar: () => void;
  onConfirmado: () => void;
}) {
  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((resuelto) => [resuelto.item.id, resuelto.quantity])),
  );
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cambiarCantidad(productId: string, valor: number) {
    setCantidades((actual) => ({ ...actual, [productId]: Math.max(1, valor || 1) }));
  }

  async function confirmar() {
    setError(null);
    setEnCurso(true);
    try {
      for (const resuelto of items) {
        const cantidad = cantidades[resuelto.item.id] ?? resuelto.quantity;
        await api.post('/cart/lines', { productId: resuelto.item.id });
        if (cantidad > 1) {
          await api.patch(`/cart/lines/${resuelto.item.id}`, { quantity: cantidad });
        }
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

      <div className="flex flex-col gap-3">
        {items.map((resuelto) => (
          <div key={resuelto.item.id} className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{resuelto.item.name}</span>
              <span className="text-sm">{formatearPrecio(resuelto.item.price)}</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              Cantidad
              <input
                type="number"
                min={1}
                step={1}
                value={cantidades[resuelto.item.id] ?? resuelto.quantity}
                onChange={(evento) =>
                  cambiarCantidad(resuelto.item.id, Number(evento.target.value))
                }
                className="h-9 w-20 rounded-md border border-[var(--color-borde)] px-2 text-sm"
              />
            </label>
          </div>
        ))}
      </div>

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
