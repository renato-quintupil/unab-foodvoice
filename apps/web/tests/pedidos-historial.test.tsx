/** Línea de tiempo compartida por cliente, negocio y administración (E4). */
import { render, screen } from '@testing-library/react';
import { type OrderDetailDto } from '@foodvoice/shared';
import { describe, expect, it, vi } from 'vitest';
import PaginaDetallePedidoAdmin from '@/app/admin/pedidos/[id]/page';
import PaginaPedidosAdmin from '@/app/admin/pedidos/page';
import PaginaDetallePedidoNegocio from '@/app/negocio/pedidos/[id]/page';
import { HistorialPedido } from '@/components/historial-pedido';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

vi.mock('@/lib/api-servidor', () => ({ pedirALaApi: vi.fn() }));
vi.mock('@/lib/sesion-servidor', () => ({ exigirSesion: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const PEDIDO_RECHAZADO: OrderDetailDto = {
  id: '22222222-2222-4222-8222-222222222222',
  status: 'rechazado',
  addressText: 'Los Aromos 123',
  rejectionReason: 'Se agotó el ingrediente principal',
  complaintReason: null,
  lines: [{ productId: 'p1', productName: 'Pizza Napolitana', price: 5990, quantity: 1 }],
  createdAt: '2026-08-23T14:00:00.000Z',
  history: [
    {
      previousStatus: null,
      resultingStatus: 'creado',
      actorName: 'María Pérez',
      actorRole: 'CLIENTE',
      reason: null,
      occurredAt: '2026-08-23T14:00:00.000Z',
    },
    {
      previousStatus: 'creado',
      resultingStatus: 'rechazado',
      actorName: 'Panadería Don José',
      actorRole: 'NEGOCIO',
      reason: null,
      occurredAt: '2026-08-23T14:05:00.000Z',
    },
  ],
};

describe('Detalle de pedido · cliente', () => {
  it('muestra cada estado con fecha y hora, y el motivo del rechazo final', () => {
    render(
      <HistorialPedido
        pedido={PEDIDO_RECHAZADO}
        titulo="Detalle de mi pedido"
        volverA="/cliente/pedidos"
      />,
    );

    expect(screen.getAllByTestId('evento-historial')).toHaveLength(2);
    expect(screen.getByText('Pedido creado')).toBeInTheDocument();
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.getAllByRole('time')).toHaveLength(2);
    expect(screen.getByText('Motivo: Se agotó el ingrediente principal')).toBeInTheDocument();
  });
});

describe('Detalle de pedido · negocio', () => {
  it('consulta la ruta de negocio y muestra nombre y rol de los actores', async () => {
    vi.mocked(pedirALaApi).mockResolvedValue(PEDIDO_RECHAZADO);

    const vista = await PaginaDetallePedidoNegocio({
      params: Promise.resolve({ id: PEDIDO_RECHAZADO.id }),
    });
    render(vista);

    expect(exigirSesion).toHaveBeenCalledWith(['NEGOCIO']);
    expect(pedirALaApi).toHaveBeenCalledWith(`/business/orders/${PEDIDO_RECHAZADO.id}`);
    expect(screen.getByText('María Pérez · Cliente')).toBeInTheDocument();
    expect(screen.getByText('Panadería Don José · Negocio')).toBeInTheDocument();
  });
});

describe('Detalle de pedido · administración', () => {
  it('enlaza la fila del reporte y consulta el detalle sin pertenencia', async () => {
    vi.mocked(pedirALaApi).mockResolvedValueOnce({
      items: [
        {
          id: PEDIDO_RECHAZADO.id,
          status: PEDIDO_RECHAZADO.status,
          createdAt: PEDIDO_RECHAZADO.createdAt,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const reporte = await PaginaPedidosAdmin({ searchParams: Promise.resolve({}) });
    const { unmount } = render(reporte);
    expect(screen.getByRole('link', { name: PEDIDO_RECHAZADO.id })).toHaveAttribute(
      'href',
      `/admin/pedidos/${PEDIDO_RECHAZADO.id}`,
    );
    unmount();

    vi.mocked(pedirALaApi).mockResolvedValueOnce(PEDIDO_RECHAZADO);
    const detalle = await PaginaDetallePedidoAdmin({
      params: Promise.resolve({ id: PEDIDO_RECHAZADO.id }),
    });
    render(detalle);

    expect(pedirALaApi).toHaveBeenLastCalledWith(
      `/admin/dashboard/orders/${PEDIDO_RECHAZADO.id}`,
    );
    expect(screen.getByText('María Pérez · Cliente')).toBeInTheDocument();
  });
});
