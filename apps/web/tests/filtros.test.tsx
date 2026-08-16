/**
 * Filtros del listado de usuarios (T096, FR-015, SC-034, ux CHK006).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ETIQUETA_ESTADO, ETIQUETA_ROL, Role, UserStatus } from '@foodvoice/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Filtros } from '@/app/admin/usuarios/_components/filtros';

const push = vi.fn();
let parametros = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => parametros,
}));

beforeEach(() => {
  push.mockClear();
  parametros = new URLSearchParams();
});

describe('Vocabulario visible (ux CHK006)', () => {
  it('los roles se nombran con su etiqueta y nunca con el identificador interno', () => {
    render(<Filtros />);
    for (const rol of Object.values(Role)) {
      expect(screen.getByRole('option', { name: ETIQUETA_ROL[rol] })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: rol })).not.toBeInTheDocument();
    }
  });

  it('los estados se nombran con su etiqueta', () => {
    render(<Filtros />);
    for (const estado of Object.values(UserStatus)) {
      expect(screen.getByRole('option', { name: ETIQUETA_ESTADO[estado] })).toBeInTheDocument();
    }
  });

  it('cada control tiene su etiqueta asociada en español (FR-039)', () => {
    render(<Filtros />);
    expect(screen.getByLabelText('Buscar por nombre o correo')).toBeInTheDocument();
    expect(screen.getByLabelText('Rol')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
  });
});

describe('Aplicación de los filtros (FR-015, SC-034)', () => {
  it('los tres criterios son combinables y viajan juntos', async () => {
    const usuario = userEvent.setup();
    render(<Filtros />);

    await usuario.type(screen.getByLabelText('Buscar por nombre o correo'), 'María');
    await usuario.selectOptions(screen.getByLabelText('Rol'), Role.CLIENTE);
    await usuario.selectOptions(screen.getByLabelText('Estado'), UserStatus.ACTIVO);
    await usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    const destino = new URL(push.mock.calls[0]![0] as string, 'http://localhost');
    expect(destino.searchParams.get('search')).toBe('María');
    expect(destino.searchParams.get('role')).toBe(Role.CLIENTE);
    expect(destino.searchParams.get('status')).toBe(UserStatus.ACTIVO);
  });

  it('vuelve a la página 1: conservar la actual con un filtro más estrecho llevaría a un listado vacío', async () => {
    const usuario = userEvent.setup();
    parametros = new URLSearchParams({ page: '3' });
    render(<Filtros />);

    await usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    const destino = new URL(push.mock.calls[0]![0] as string, 'http://localhost');
    expect(destino.searchParams.get('page')).toBeNull();
  });

  it('un criterio vacío no viaja en la consulta', async () => {
    const usuario = userEvent.setup();
    render(<Filtros />);

    await usuario.type(screen.getByLabelText('Buscar por nombre o correo'), '   ');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(push.mock.calls[0]![0]).toBe('/admin/usuarios?');
  });

  it('llega con los criterios ya aplicados de la URL', () => {
    parametros = new URLSearchParams({ search: 'maría', role: Role.NEGOCIO });
    render(<Filtros />);

    expect(screen.getByLabelText('Buscar por nombre o correo')).toHaveValue('maría');
    expect(screen.getByLabelText('Rol')).toHaveValue(Role.NEGOCIO);
  });
});
