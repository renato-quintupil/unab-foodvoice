'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  MSG_CARRITO_VACIO,
  MSG_ERROR_INESPERADO,
  MSG_PRECIO_CAMBIO,
  formatearPrecio,
  type AddressDto,
  type CartDto,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { Campo } from '@/components/campo';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';

type FuenteDireccion = 'guardada' | 'puntual';

/**
 * Confirmar el pedido (HU-01, FR-022, FR-025, FR-028).
 *
 * `PRICE_CHANGED` (FR-028) recarga el carrito **sin abandonar la pantalla**
 * y exige un nuevo clic: es la reacción que la spec pide, y `GET /cart` ya
 * trae el precio vigente (contracts/api.md § `409 PRICE_CHANGED`).
 */
export function ConfirmarPedido({
  carritoInicial,
  direcciones,
}: {
  carritoInicial: CartDto;
  direcciones: AddressDto[];
}) {
  const [carrito, setCarrito] = useState(carritoInicial);
  const predeterminada = direcciones.find((d) => d.isDefault);
  const [fuente, setFuente] = useState<FuenteDireccion>(
    direcciones.length > 0 ? 'guardada' : 'puntual',
  );
  const [addressId, setAddressId] = useState(predeterminada?.id ?? direcciones[0]?.id ?? '');
  const [addressText, setAddressText] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedido, setPedido] = useState<OrderSummaryDto | null>(null);

  const hayNoDisponibles = carrito.lines.some((l) => !l.available);
  const total = carrito.lines.reduce((suma, l) => suma + l.price * l.quantity, 0);

  async function confirmar() {
    setError(null);
    setEnCurso(true);
    try {
      const cuerpo =
        fuente === 'guardada'
          ? { addressId, expectedLines: carrito.lines.map(aLineaEsperada) }
          : { addressText, expectedLines: carrito.lines.map(aLineaEsperada) };

      const resultado = await api.post<OrderSummaryDto>('/orders', cuerpo);
      setPedido(resultado);
    } catch (fallo) {
      if (fallo instanceof ErrorDeApi && fallo.code === 'PRICE_CHANGED') {
        const actualizado = await api.get<CartDto>('/cart');
        setCarrito(actualizado);
        setError(MSG_PRECIO_CAMBIO);
        return;
      }
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
    }
  }

  if (pedido) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          data-testid="aviso-exito"
          className="rounded-md border border-[var(--color-exito)] px-3 py-2 text-sm text-[var(--color-exito)]"
        >
          Tu pedido quedó confirmado.
        </p>
        <Link href="/cliente/pedidos" className="text-sm underline">
          Ver mis pedidos
        </Link>
      </div>
    );
  }

  if (carrito.lines.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {MSG_CARRITO_VACIO}
        </p>
        <Link href="/menu" className="text-sm underline">
          Ver el menú
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="resumen" className="flex flex-col gap-3">
        <h2 id="resumen" className="text-lg font-medium">
          Resumen
        </h2>
        <ul className="flex flex-col gap-2">
          {carrito.lines.map((linea) => (
            <li key={linea.productId} className="flex justify-between text-sm">
              <span>
                {linea.quantity} × {linea.productName}
                {!linea.available && (
                  <span className="ml-2 text-xs text-[var(--color-error)]">no disponible</span>
                )}
              </span>
              <span>{formatearPrecio(linea.price * linea.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-[var(--color-borde)] pt-2 text-right font-medium">
          Total: {formatearPrecio(total)}
        </p>
      </section>

      <section aria-labelledby="direccion" className="flex flex-col gap-3">
        <h2 id="direccion" className="text-lg font-medium">
          Dirección de entrega
        </h2>

        {direcciones.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="fuente-direccion"
              checked={fuente === 'guardada'}
              onChange={() => setFuente('guardada')}
            />
            Usar una dirección guardada
          </label>
        )}
        {fuente === 'guardada' && direcciones.length > 0 && (
          <Campo id="addressId" etiqueta="Dirección guardada">
            {(control) => (
              <select
                {...control}
                value={addressId}
                onChange={(e) => setAddressId(e.target.value)}
                className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
              >
                {direcciones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} — {d.text}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="fuente-direccion"
            checked={fuente === 'puntual'}
            onChange={() => setFuente('puntual')}
          />
          Escribir una dirección para este pedido
        </label>
        {fuente === 'puntual' && (
          <Campo id="addressText" etiqueta="Dirección">
            {(control) => (
              <Input {...control} value={addressText} onChange={(e) => setAddressText(e.target.value)} />
            )}
          </Campo>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      )}

      <AccionEnCurso
        type="button"
        enCurso={enCurso}
        textoEnCurso="Confirmando…"
        onClick={() => void confirmar()}
      >
        Confirmar pedido
      </AccionEnCurso>
      {hayNoDisponibles && (
        <p className="text-xs text-[var(--color-tenue)]">
          Hay productos no disponibles en tu carrito; vuelve al carrito para quitarlos antes de
          confirmar.
        </p>
      )}
    </div>
  );
}

function aLineaEsperada(linea: CartDto['lines'][number]): {
  productId: string;
  quantity: number;
  price: number;
} {
  return { productId: linea.productId, quantity: linea.quantity, price: linea.price };
}
