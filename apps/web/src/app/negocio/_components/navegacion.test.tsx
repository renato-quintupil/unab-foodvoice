import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavegacionNegocio } from './navegacion';

let pathname = '/negocio/pedidos';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  pathname = '/negocio/pedidos';
});

describe('NavegacionNegocio (HU-15)', () => {
  it('renderiza los destinos del rol en escritorio y mobile', () => {
    render(<NavegacionNegocio />);

    expect(screen.getAllByRole('link', { name: 'Pedidos' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Productos' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Categorías' })).toHaveLength(2);
  });

  it('marca como activo el destino que coincide con la ruta actual', () => {
    pathname = '/negocio/productos/nuevo';
    render(<NavegacionNegocio />);

    for (const enlace of screen.getAllByRole('link', { name: 'Productos' })) {
      expect(enlace).toHaveAttribute('aria-current', 'page');
    }
    for (const enlace of screen.getAllByRole('link', { name: 'Pedidos' })) {
      expect(enlace).not.toHaveAttribute('aria-current');
    }
  });
});
