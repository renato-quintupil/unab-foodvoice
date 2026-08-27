/**
 * Pantallas de pedidos (HU-01, FR-025, FR-028, FR-031, FR-033, FR-037–FR-041).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MSG_CARRITO_VACIO,
  MSG_PRECIO_CAMBIO,
  MSG_SIN_PEDIDOS_PENDIENTES,
  type AddressDto,
  type CartDto,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmarPedido } from '@/app/cliente/pedidos/confirmar/confirmar-pedido';
import { AccionesPedido } from '@/app/negocio/pedidos/_components/acciones-pedido';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  refresh.mockClear();
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respuesta(status: number, cuerpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as Response;
}

const DIRECCION: AddressDto = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Casa',
  text: 'Los Aromos 123',
  isDefault: true,
  active: true,
  createdAt: '2026-08-17T12:00:00.000Z',
};

const CARRITO: CartDto = {
  lines: [
    { productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1, available: true },
  ],
};

const PEDIDO: OrderSummaryDto = {
  id: '22222222-2222-4222-8222-222222222222',
  status: 'creado',
  addressText: 'Los Aromos 123',
  rejectionReason: null,
  complaintReason: null,
  lines: [{ productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1 }],
  createdAt: '2026-08-17T12:00:00.000Z',
};

describe('Confirmar pedido (FR-022, FR-025, FR-028)', () => {
  it('carrito vacío: mensaje en español, sin formulario de confirmar', () => {
    render(<ConfirmarPedido carritoInicial={{ lines: [] }} direcciones={[DIRECCION]} />);
    expect(screen.getByText(MSG_CARRITO_VACIO)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument();
  });

  it('confirma con la dirección guardada preseleccionada (la predeterminada)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(201, PEDIDO));
    render(<ConfirmarPedido carritoInicial={CARRITO} direcciones={[DIRECCION]} />);

    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe('/api/orders');
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.addressId).toBe(DIRECCION.id);
    expect(cuerpo.expectedLines).toEqual([{ productId: 'p1', quantity: 1, price: 5990 }]);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toBeInTheDocument();
    });
  });

  it('sin direcciones guardadas, ofrece escribir una puntual', () => {
    render(<ConfirmarPedido carritoInicial={CARRITO} direcciones={[]} />);
    expect(screen.getByLabelText('Dirección')).toBeInTheDocument();
  });

  it('PRICE_CHANGED recarga el carrito, muestra el aviso y exige confirmar de nuevo', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(
        respuesta(409, { error: { code: 'PRICE_CHANGED', message: MSG_PRECIO_CAMBIO } }),
      )
      .mockResolvedValueOnce(
        respuesta(200, {
          lines: [{ ...CARRITO.lines[0], price: 6500 }],
        }),
      );
    render(<ConfirmarPedido carritoInicial={CARRITO} direcciones={[DIRECCION]} />);

    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    await waitFor(() => {
      expect(screen.getByText(MSG_PRECIO_CAMBIO)).toBeInTheDocument();
    });
    // El carrito recargado muestra el precio nuevo.
    expect(screen.getAllByText(/6\.500/).length).toBeGreaterThan(0);
    // No se dio por confirmado el pedido.
    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });
});

describe('Acciones del negocio: aceptar y rechazar (FR-031, FR-033)', () => {
  it('aceptar llama a PUT .../accept', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PEDIDO, status: 'en_preparacion' }));
    render(<AccionesPedido pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/business/orders/${PEDIDO.id}/accept`);
    expect(opciones.method).toBe('PUT');
    expect(refresh).toHaveBeenCalled();
  });

  it('rechazar exige un motivo dentro del diálogo antes de llamar a la API', async () => {
    const usuario = userEvent.setup();
    render(<AccionesPedido pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    const confirmar = screen.getAllByRole('button', { name: 'Confirmar rechazo' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    expect(fetchSimulado).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('rechazar con motivo llama a PUT .../reject con el texto escrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PEDIDO, status: 'rechazado' }));
    render(<AccionesPedido pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    await usuario.type(screen.getByLabelText('Motivo del rechazo'), 'Se acabó el ingrediente principal');
    const confirmar = screen.getAllByRole('button', { name: 'Confirmar rechazo' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/business/orders/${PEDIDO.id}/reject`);
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.reason).toBe('Se acabó el ingrediente principal');
  });
});

describe('Mensajes en español de la bandeja del negocio', () => {
  it('MSG_SIN_PEDIDOS_PENDIENTES existe y no está vacío', () => {
    expect(MSG_SIN_PEDIDOS_PENDIENTES.length).toBeGreaterThan(0);
  });
});
