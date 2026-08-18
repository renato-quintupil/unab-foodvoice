'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES,
  MSG_CARRITO_VACIO,
  MSG_ERROR_INESPERADO,
  formatearPrecio,
  type CartDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { Button } from '@/components/ui/button';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Carrito interactivo (HU-12, FR-003, FR-005, FR-007–FR-010).
 *
 * Cada mutación recibe el `CartDto` completo de vuelta y reemplaza el estado
 * local con él: el servidor recalcula el precio vigente y la disponibilidad
 * en cada respuesta (FR-006), así que no hay ningún cálculo derivado en el
 * cliente que pudiera desalinearse.
 */
export function Carrito({ inicial }: { inicial: CartDto }) {
  const [carrito, setCarrito] = useState(inicial);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hayNoDisponibles = carrito.lines.some((l) => !l.available);
  const vacio = carrito.lines.length === 0;
  const total = carrito.lines.reduce((suma, l) => suma + l.price * l.quantity, 0);

  async function mutar(clave: string, accion: () => Promise<CartDto>) {
    setError(null);
    setEnCurso(clave);
    try {
      setCarrito(await accion());
    } catch (fallo) {
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(null);
    }
  }

  if (vacio) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {MSG_CARRITO_VACIO}
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/menu">Ver el menú</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      )}

      {hayNoDisponibles && (
        <p
          role="status"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
          data-testid="aviso-no-disponibles"
        >
          {MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {carrito.lines.map((linea) => (
          <li
            key={linea.productId}
            data-testid="linea-carrito"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-borde)] p-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">{linea.productName}</span>
              <span className="text-sm">{formatearPrecio(linea.price)}</span>
              {!linea.available && (
                <span data-testid="no-disponible" className="text-xs text-[var(--color-error)]">
                  Ya no está disponible
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`cantidad-${linea.productId}`}>
                Cantidad de {linea.productName}
              </label>
              <input
                id={`cantidad-${linea.productId}`}
                type="number"
                min={0}
                step={1}
                defaultValue={linea.quantity}
                disabled={enCurso === linea.productId}
                onBlur={(evento) => {
                  const cantidad = Number(evento.currentTarget.value);
                  if (!Number.isInteger(cantidad) || cantidad === linea.quantity) return;
                  void mutar(linea.productId, () =>
                    api.patch<CartDto>(`/cart/lines/${linea.productId}`, { quantity: cantidad }),
                  );
                }}
                className="h-9 w-16 rounded-md border border-[var(--color-borde)] px-2 text-sm"
              />
              <AccionEnCurso
                type="button"
                variant="outline"
                size="sm"
                enCurso={enCurso === `quitar-${linea.productId}`}
                textoEnCurso="Quitando…"
                onClick={() =>
                  void mutar(`quitar-${linea.productId}`, () =>
                    api.delete<CartDto>(`/cart/lines/${linea.productId}`),
                  )
                }
              >
                Quitar
              </AccionEnCurso>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-[var(--color-borde)] pt-4">
        <span className="font-medium">Total: {formatearPrecio(total)}</span>
        <AccionEnCurso
          type="button"
          variant="ghost"
          enCurso={enCurso === 'vaciar'}
          textoEnCurso="Vaciando…"
          onClick={() => void mutar('vaciar', () => api.delete<CartDto>('/cart'))}
        >
          Vaciar carrito
        </AccionEnCurso>
      </div>

      <Button asChild>
        <Link
          href="/cliente/pedidos/confirmar"
          aria-disabled={hayNoDisponibles}
          className={hayNoDisponibles ? 'pointer-events-none opacity-50' : undefined}
          onClick={(evento) => {
            if (hayNoDisponibles) evento.preventDefault();
          }}
        >
          Confirmar pedido
        </Link>
      </Button>
    </div>
  );
}
