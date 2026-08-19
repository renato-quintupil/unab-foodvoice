import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PaginaLogin from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/fuentes', () => ({ claseBricolage: 'fuente-prueba' }));

describe('PaginaLogin (HU-16)', () => {
  it('agrega el panel de marca sin quitar ni cambiar los controles de acceso', () => {
    render(<PaginaLogin />);

    expect(screen.getByTestId('panel-marca')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
