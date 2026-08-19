import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AddressDto } from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectorDireccion } from './selector-direccion';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const CASA: AddressDto = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Casa',
  text: 'Av. Providencia 1234',
  isDefault: true,
  active: true,
  createdAt: '2026-08-17T12:00:00.000Z',
};

const TRABAJO: AddressDto = {
  ...CASA,
  id: '22222222-2222-4222-8222-222222222222',
  label: 'Trabajo',
  text: 'Nueva Tajamar 555',
  isDefault: false,
};

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  refresh.mockClear();
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respuesta(status: number, cuerpo: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as Response;
}

describe('SelectorDireccion (HU-15)', () => {
  it('muestra la predeterminada y lista las demás direcciones activas', async () => {
    render(<SelectorDireccion direcciones={[CASA, TRABAJO]} />);

    expect(screen.getByText('Casa · Av. Providencia 1234')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Casa · Av. Providencia 1234' }),
    );
    expect(
      screen.getByRole('menuitem', { name: 'Trabajo · Nueva Tajamar 555' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Gestionar direcciones' }),
    ).toHaveAttribute('href', '/cliente/direcciones');
  });

  it('al elegir otra dirección llama PUT /addresses/:id/default y refresca', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...TRABAJO, isDefault: true }));
    render(<SelectorDireccion direcciones={[CASA, TRABAJO]} />);

    await usuario.click(
      screen.getByRole('button', { name: 'Casa · Av. Providencia 1234' }),
    );
    await usuario.click(
      screen.getByRole('menuitem', { name: 'Trabajo · Nueva Tajamar 555' }),
    );

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/addresses/${TRABAJO.id}/default`);
    expect(opciones).toMatchObject({ method: 'PUT' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('si el PUT falla avisa en español, conserva la predeterminada y no refresca', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(500, {
        error: { message: 'No pudimos cambiar la dirección predeterminada.' },
      }),
    );
    render(<SelectorDireccion direcciones={[CASA, TRABAJO]} />);

    await usuario.click(
      screen.getByRole('button', { name: 'Casa · Av. Providencia 1234' }),
    );
    await usuario.click(
      screen.getByRole('menuitem', { name: 'Trabajo · Nueva Tajamar 555' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cambiar la dirección predeterminada.',
    );
    expect(screen.getByText('Casa · Av. Providencia 1234')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sin direcciones ofrece registrar una', () => {
    render(<SelectorDireccion direcciones={[]} />);

    expect(screen.getByRole('link', { name: 'Registrar dirección' })).toHaveAttribute(
      'href',
      '/cliente/direcciones/nueva',
    );
  });
});
