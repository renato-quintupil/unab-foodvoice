/**
 * Pedidos en curso del negocio (asignado_repartidor/entregado), corrección
 * post-verificación: sin esta pantalla, el negocio perdía de vista un pedido
 * desde que salía a reparto hasta que el cliente lo cerraba.
 */
import { render, screen } from '@testing-library/react';
import { MSG_SIN_PEDIDOS_EN_CURSO, type OrderSummaryDto } from '@foodvoice/shared';
import { describe, expect, it, vi } from 'vitest';
import PaginaPedidosEnCurso from '@/app/negocio/pedidos/en-curso/page';
import { pedirALaApi } from '@/lib/api-servidor';

vi.mock('@/lib/api-servidor', () => ({ pedirALaApi: vi.fn() }));
vi.mock('@/lib/sesion-servidor', () => ({ exigirSesion: vi.fn() }));

const PEDIDO_ASIGNADO: OrderSummaryDto = {
  id: '55555555-5555-4555-8555-555555555555',
  status: 'asignado_repartidor',
  addressText: 'Los Aromos 123',
  rejectionReason: null,
  complaintReason: null,
  lines: [{ productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1 }],
  createdAt: '2026-09-05T12:00:00.000Z',
};

describe('Pedidos en curso del negocio', () => {
  it('sin pedidos en curso, muestra el mensaje en español', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [] });

    render(await PaginaPedidosEnCurso());

    expect(screen.getByText(MSG_SIN_PEDIDOS_EN_CURSO)).toBeInTheDocument();
  });

  it('con pedidos en curso, muestra su estado y un enlace al detalle', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue({ items: [PEDIDO_ASIGNADO] });

    render(await PaginaPedidosEnCurso());

    expect(pedirALaApi).toHaveBeenCalledWith('/business/orders/in-progress');
    expect(screen.getByText('Asignado a repartidor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver historial' })).toHaveAttribute(
      'href',
      `/negocio/pedidos/${PEDIDO_ASIGNADO.id}`,
    );
  });
});
