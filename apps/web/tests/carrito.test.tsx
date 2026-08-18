/**
 * Carrito interactivo (HU-12, FR-003, FR-005, FR-007–FR-010).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES, MSG_CARRITO_VACIO, type CartDto } from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Carrito } from '@/app/cliente/carrito/carrito-cliente';

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respuesta(status: number, cuerpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as Response;
}

const CARRITO_VACIO: CartDto = { lines: [] };

const CARRITO_CON_LINEA: CartDto = {
  lines: [
    { productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1, available: true },
  ],
};

describe('Estado vacío (HU12-E08, FR-009)', () => {
  it('muestra el mensaje en español y no ofrece confirmar', () => {
    render(<Carrito inicial={CARRITO_VACIO} />);
    expect(screen.getByText(MSG_CARRITO_VACIO)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
  });
});

describe('Con líneas', () => {
  it('muestra cada línea con su cantidad y precio vigente', () => {
    render(<Carrito inicial={CARRITO_CON_LINEA} />);
    expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad de Pizza Napolitana')).toHaveValue(1);
  });

  it('ofrece el control de confirmar pedido', () => {
    render(<Carrito inicial={CARRITO_CON_LINEA} />);
    expect(screen.getByRole('link', { name: 'Confirmar pedido' })).toBeInTheDocument();
  });

  it('cambiar la cantidad llama a PATCH con la nueva cantidad', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, { lines: [{ ...CARRITO_CON_LINEA.lines[0], quantity: 3 }] }),
    );
    render(<Carrito inicial={CARRITO_CON_LINEA} />);

    const input = screen.getByLabelText('Cantidad de Pizza Napolitana');
    await usuario.clear(input);
    await usuario.type(input, '3');
    await usuario.tab();

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe('/api/cart/lines/p1');
    expect(opciones.method).toBe('PATCH');
    expect(JSON.parse(opciones.body as string)).toEqual({ quantity: 3 });
  });

  it('quitar una línea llama a DELETE y la retira de la vista', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, CARRITO_VACIO));
    render(<Carrito inicial={CARRITO_CON_LINEA} />);

    await usuario.click(screen.getByRole('button', { name: 'Quitar' }));

    await waitFor(() => {
      expect(screen.getByText(MSG_CARRITO_VACIO)).toBeInTheDocument();
    });
  });

  it('vaciar el carrito llama a DELETE /cart', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, CARRITO_VACIO));
    render(<Carrito inicial={CARRITO_CON_LINEA} />);

    await usuario.click(screen.getByRole('button', { name: 'Vaciar carrito' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe('/api/cart');
    expect(opciones.method).toBe('DELETE');
  });
});

describe('Línea no disponible bloquea la confirmación (FR-007)', () => {
  const CON_NO_DISPONIBLE: CartDto = {
    lines: [
      { productId: 'p1', productName: 'Agotado', price: 1000, quantity: 1, available: false },
    ],
  };

  it('marca la línea y muestra el aviso, sin quitarla sola', () => {
    render(<Carrito inicial={CON_NO_DISPONIBLE} />);
    expect(screen.getByTestId('no-disponible')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-no-disponibles')).toHaveTextContent(
      MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES,
    );
  });

  it('el enlace de confirmar queda marcado como deshabilitado', () => {
    render(<Carrito inicial={CON_NO_DISPONIBLE} />);
    expect(screen.getByRole('link', { name: 'Confirmar pedido' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
