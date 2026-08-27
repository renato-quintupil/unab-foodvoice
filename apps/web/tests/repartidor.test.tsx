/**
 * Pantalla del repartidor (E5, HU-04, FR-001, FR-002, FR-006, FR-007, FR-008,
 * FR-009, FR-013).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MSG_SIN_PEDIDOS_DISPONIBLES,
  type DeliveryOrderDto,
  type OrderSummaryDto,
} from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotonSoltar } from '@/app/repartidor/_components/boton-soltar';
import { BotonTomar } from '@/app/repartidor/_components/boton-tomar';
import { PedidoEnCurso } from '@/app/repartidor/_components/pedido-en-curso';
import { PedidosDisponibles } from '@/app/repartidor/_components/pedidos-disponibles';
import PaginaRepartidor from '@/app/repartidor/page';
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

const PEDIDO: OrderSummaryDto = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'en_preparacion',
  addressText: 'Los Aromos 123',
  rejectionReason: null,
  complaintReason: null,
  lines: [{ productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1 }],
  createdAt: '2026-08-27T12:00:00.000Z',
};

const PEDIDO_EN_CURSO: DeliveryOrderDto = {
  ...PEDIDO,
  status: 'asignado_repartidor',
  customerPhone: '+56912345678',
};

describe('Pedidos disponibles (Historia 1, FR-001, FR-006)', () => {
  it('sin pedidos disponibles, muestra el mensaje en español', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [] });

    render(await PedidosDisponibles());

    expect(screen.getByText(MSG_SIN_PEDIDOS_DISPONIBLES)).toBeInTheDocument();
  });

  it('con pedidos disponibles, muestra sus productos y un botón Tomar', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [PEDIDO] });

    render(await PedidosDisponibles());

    expect(pedirALaApi).toHaveBeenCalledWith('/delivery/orders/available');
    expect(screen.getByText(/Pizza Napolitana/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tomar' })).toBeInTheDocument();
    // El teléfono nunca aparece en la lista de disponibles (SC-007).
    expect(screen.queryByText(/\+569/)).not.toBeInTheDocument();
  });
});

describe('Tomar un pedido (BotonTomar, FR-002, FR-003, SC-001)', () => {
  it('un clic llama a PUT .../take y refresca', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PEDIDO, status: 'asignado_repartidor' }));
    render(<BotonTomar pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Tomar' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/delivery/orders/${PEDIDO.id}/take`);
    expect(opciones.method).toBe('PUT');
    expect(refresh).toHaveBeenCalled();
  });

  it('un 409 muestra el mensaje de error sin refrescar', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: { code: 'DELIVERY_ORDER_ALREADY_ASSIGNED', message: 'Este pedido ya no está disponible.' },
      }),
    );
    render(<BotonTomar pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Tomar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Este pedido ya no está disponible.');
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('Pedido en curso (Historia 2, FR-007, SC-007)', () => {
  it('muestra productos, dirección y teléfono', () => {
    render(<PedidoEnCurso order={PEDIDO_EN_CURSO} />);

    expect(screen.getByText(PEDIDO_EN_CURSO.addressText)).toBeInTheDocument();
    expect(screen.getByText(/\+56912345678/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soltar pedido' })).toBeInTheDocument();
  });
});

describe('Página del repartidor: una acción a la vez (FR-004)', () => {
  // `PedidosDisponibles` es en sí un Server Component async: `render()` de
  // Testing Library no resuelve un árbol de componentes async anidados (eso
  // sí lo hace Next.js en producción, ya verificado en el navegador real).
  // Se comprueba la composición devuelta por la página en vez de renderizar
  // el árbol completo — es lo que decide si la acción de tomar se ofrece.

  it('sin pedido en curso, decide renderizar la lista de disponibles', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ order: null });

    const vista = await PaginaRepartidor();
    const contenido = vista.props.children[1];

    expect(contenido.type).toBe(PedidosDisponibles);
  });

  it('con un pedido en curso, decide no renderizar la lista de disponibles', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ order: PEDIDO_EN_CURSO });

    const vista = await PaginaRepartidor();
    const contenido = vista.props.children[1];

    expect(contenido.type).toBe(PedidoEnCurso);
    expect(contenido.props.order).toBe(PEDIDO_EN_CURSO);
  });
});

describe('Soltar un pedido (BotonSoltar, Historia 3, FR-008, FR-009, Principio IX)', () => {
  it('pide confirmación antes de llamar a la API', async () => {
    const usuario = userEvent.setup();
    render(<BotonSoltar pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Soltar pedido' }));

    expect(fetchSimulado).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('confirmar llama a PUT .../release y refresca', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PEDIDO, status: 'en_preparacion' }));
    render(<BotonSoltar pedidoId={PEDIDO.id} />);

    await usuario.click(screen.getByRole('button', { name: 'Soltar pedido' }));
    await usuario.click(screen.getByRole('button', { name: 'Soltar' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/delivery/orders/${PEDIDO.id}/release`);
    expect(opciones.method).toBe('PUT');
    expect(refresh).toHaveBeenCalled();
  });
});
