import { render, screen } from '@testing-library/react';
import type { AddressDto } from '@foodvoice/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavegacionCliente } from './navegacion';

let pathname = '/menu';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const DIRECCION: AddressDto = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Casa',
  text: 'Av. Providencia 1234',
  isDefault: true,
  active: true,
  createdAt: '2026-08-17T12:00:00.000Z',
};

beforeEach(() => {
  pathname = '/menu';
});

describe('NavegacionCliente (HU-15)', () => {
  it('renderiza los destinos del rol en escritorio y mobile', () => {
    render(<NavegacionCliente direcciones={[]} />);

    expect(screen.getAllByRole('link', { name: 'Menú' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Carrito' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Mis pedidos' })).toHaveLength(2);
  });

  it('marca como activo el destino que coincide con la ruta actual', () => {
    pathname = '/cliente/carrito';
    render(<NavegacionCliente direcciones={[]} />);

    for (const enlace of screen.getAllByRole('link', { name: 'Carrito' })) {
      expect(enlace).toHaveAttribute('aria-current', 'page');
    }
    for (const enlace of screen.getAllByRole('link', { name: 'Menú' })) {
      expect(enlace).not.toHaveAttribute('aria-current');
    }
  });

  it('mantiene Mis pedidos activo en sus rutas descendientes', () => {
    pathname = '/cliente/pedidos/confirmar';
    render(<NavegacionCliente direcciones={[]} />);

    for (const enlace of screen.getAllByRole('link', { name: 'Mis pedidos' })) {
      expect(enlace).toHaveAttribute('aria-current', 'page');
    }
  });

  it('muestra la etiqueta y el texto de la dirección predeterminada', () => {
    render(<NavegacionCliente direcciones={[DIRECCION]} />);

    expect(screen.getByText('Casa · Av. Providencia 1234')).toBeInTheDocument();
  });

  it('ofrece registrar una dirección cuando no hay ninguna activa', () => {
    render(<NavegacionCliente direcciones={[]} />);

    expect(screen.getByRole('link', { name: 'Registrar dirección' })).toHaveAttribute(
      'href',
      '/cliente/direcciones/nueva',
    );
  });
});
