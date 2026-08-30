import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavegacionAdmin } from './navegacion';

let pathname = '/admin';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  pathname = '/admin';
});

describe('NavegacionAdmin (HU-15/HU-17)', () => {
  it('renderiza los destinos del rol en escritorio y mobile', () => {
    render(<NavegacionAdmin />);

    expect(screen.getAllByRole('link', { name: 'Panel' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Usuarios' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Operaciones' })).toHaveLength(2);
  });

  it('marca como activo el destino que coincide con la ruta actual', () => {
    pathname = '/admin/usuarios';
    render(<NavegacionAdmin />);

    for (const enlace of screen.getAllByRole('link', { name: 'Usuarios' })) {
      expect(enlace).toHaveAttribute('aria-current', 'page');
    }
    for (const enlace of screen.getAllByRole('link', { name: 'Panel' })) {
      expect(enlace).not.toHaveAttribute('aria-current');
    }
  });

  it('mantiene Usuarios activo en sus rutas descendientes', () => {
    pathname = '/admin/usuarios/nuevo';
    render(<NavegacionAdmin />);

    for (const enlace of screen.getAllByRole('link', { name: 'Usuarios' })) {
      expect(enlace).toHaveAttribute('aria-current', 'page');
    }
  });
});
