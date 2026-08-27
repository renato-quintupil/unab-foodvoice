/**
 * Cierre del servicio (E7, HU-05, FR-001, FR-005 a FR-008, FR-010, FR-011).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MSG_SIN_PEDIDOS_CERRADOS,
  type OrderDetailDto,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaginaPedidosCerrados from '@/app/negocio/pedidos/cerrados/page';
import { BotonConfirmarCierre } from '@/app/cliente/pedidos/_components/boton-confirmar-cierre';
import { DialogoReclamo } from '@/app/cliente/pedidos/_components/dialogo-reclamo';
import PaginaMisPedidos from '@/app/cliente/pedidos/page';
import { BotonEntregar } from '@/app/repartidor/_components/boton-entregar';
import { HistorialPedido } from '@/components/historial-pedido';
import { pedirALaApi } from '@/lib/api-servidor';

vi.mock('@/lib/api-servidor', () => ({ pedirALaApi: vi.fn() }));
vi.mock('@/lib/sesion-servidor', () => ({ exigirSesion: vi.fn() }));

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

const PEDIDO_ENTREGADO: OrderSummaryDto = {
  id: '44444444-4444-4444-8444-444444444444',
  status: 'entregado',
  addressText: 'Los Aromos 123',
  rejectionReason: null,
  complaintReason: null,
  lines: [{ productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1 }],
  createdAt: '2026-08-27T12:00:00.000Z',
};

const PEDIDO_CERRADO: OrderSummaryDto = {
  ...PEDIDO_ENTREGADO,
  status: 'cerrado',
  complaintReason: 'Llegó frío y sin las papas',
};

describe('BotonEntregar (Historia 1, FR-001, SC-001)', () => {
  it('un clic llama a PUT .../deliver y refresca', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PEDIDO_ENTREGADO }));
    render(<BotonEntregar pedidoId={PEDIDO_ENTREGADO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Marcar como entregado' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/delivery/orders/${PEDIDO_ENTREGADO.id}/deliver`);
    expect(opciones.method).toBe('PUT');
    expect(refresh).toHaveBeenCalled();
  });
});

describe('BotonConfirmarCierre (Historia 2, FR-005, FR-006, SC-002)', () => {
  it('un clic llama a PUT .../confirm y refresca', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PEDIDO_CERRADO, complaintReason: null }));
    render(<BotonConfirmarCierre pedidoId={PEDIDO_ENTREGADO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Todo bien' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/orders/${PEDIDO_ENTREGADO.id}/confirm`);
    expect(opciones.method).toBe('PUT');
    expect(refresh).toHaveBeenCalled();
  });
});

describe('DialogoReclamo (Historia 3, FR-007, FR-008, Principio IX)', () => {
  it('exige un motivo dentro del diálogo antes de llamar a la API', async () => {
    const usuario = userEvent.setup();
    render(<DialogoReclamo pedidoId={PEDIDO_ENTREGADO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Reclamar' }));
    const confirmar = screen.getAllByRole('button', { name: 'Confirmar reclamo' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    expect(fetchSimulado).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('con motivo, llama a PUT .../complain con el texto escrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, PEDIDO_CERRADO));
    render(<DialogoReclamo pedidoId={PEDIDO_ENTREGADO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Reclamar' }));
    await usuario.type(screen.getByLabelText('Motivo del reclamo'), 'Llegó frío y sin las papas');
    const confirmar = screen.getAllByRole('button', { name: 'Confirmar reclamo' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/orders/${PEDIDO_ENTREGADO.id}/complain`);
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo.reason).toBe('Llegó frío y sin las papas');
  });
});

describe('Mis pedidos: acciones sobre un pedido entregado (FR-010)', () => {
  it('ofrece confirmar y reclamar solo cuando el pedido está entregado', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [PEDIDO_ENTREGADO] });

    render(await PaginaMisPedidos());

    expect(screen.getByRole('button', { name: 'Todo bien' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reclamar' })).toBeInTheDocument();
  });

  it('muestra el motivo del reclamo, igual que ya muestra el de rechazo', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [PEDIDO_CERRADO] });

    render(await PaginaMisPedidos());

    expect(screen.getByTestId('motivo-reclamo')).toHaveTextContent(
      'Reclamo: Llegó frío y sin las papas',
    );
    expect(screen.queryByRole('button', { name: 'Todo bien' })).not.toBeInTheDocument();
  });
});

describe('Pedidos cerrados del negocio (FR-011, D-081)', () => {
  it('sin pedidos cerrados, muestra el mensaje en español', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [] });

    render(await PaginaPedidosCerrados());

    expect(screen.getByText(MSG_SIN_PEDIDOS_CERRADOS)).toBeInTheDocument();
  });

  it('con pedidos cerrados, muestra el reclamo y un enlace al detalle', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [PEDIDO_CERRADO] });

    render(await PaginaPedidosCerrados());

    expect(pedirALaApi).toHaveBeenCalledWith('/business/orders/closed');
    expect(screen.getByText(/Llegó frío y sin las papas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver historial' })).toHaveAttribute(
      'href',
      `/negocio/pedidos/${PEDIDO_CERRADO.id}`,
    );
  });
});

describe('Trazabilidad muestra el reclamo (E4, FR-014, SC-006)', () => {
  it('cuando el último evento es cerrado con complaintReason', () => {
    const pedido: OrderDetailDto = {
      ...PEDIDO_CERRADO,
      history: [
        {
          previousStatus: null,
          resultingStatus: 'creado',
          actorName: 'Cliente De Prueba',
          actorRole: 'CLIENTE',
          occurredAt: '2026-08-27T12:00:00.000Z',
        },
        {
          previousStatus: 'entregado',
          resultingStatus: 'cerrado',
          actorName: 'Cliente De Prueba',
          actorRole: 'CLIENTE',
          occurredAt: '2026-08-27T12:10:00.000Z',
        },
      ],
    };

    render(<HistorialPedido pedido={pedido} titulo="Detalle de mi pedido" volverA="/cliente/pedidos" />);

    expect(screen.getByText('Reclamo: Llegó frío y sin las papas')).toBeInTheDocument();
  });
});
