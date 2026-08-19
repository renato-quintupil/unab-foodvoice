import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dimension, type CategoryDto } from '@foodvoice/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FiltrosMenu } from './filtros-menu';

const push = vi.fn();
let parametros = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => parametros,
}));

const PIZZAS: CategoryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  dimension: Dimension.TIPO_COMIDA,
  name: 'Pizzas',
  description: 'Preparaciones horneadas de masa con ingredientes variados.',
  active: true,
  createdAt: '2026-08-16T12:00:00.000Z',
};

const SANDWICHES: CategoryDto = {
  ...PIZZAS,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Sándwiches',
};

const ENSALADAS: CategoryDto = {
  ...PIZZAS,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Ensaladas',
};

const CATEGORIAS = [PIZZAS, SANDWICHES, ENSALADAS];

beforeEach(() => {
  push.mockClear();
  parametros = new URLSearchParams();
});

describe('Fila de categorías de FiltrosMenu (HU-15)', () => {
  it('muestra Todas y cada categoría de tipo de comida como controles navegables', () => {
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pizzas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sándwiches' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ensaladas' })).toBeInTheDocument();
  });

  it('la fila y el combobox comparten el mismo criterio de la URL en ambos sentidos', async () => {
    const usuario = userEvent.setup();
    const vista = render(<FiltrosMenu categorias={CATEGORIAS} />);

    await usuario.click(screen.getByRole('button', { name: 'Pizzas' }));
    expect(push).toHaveBeenLastCalledWith(`/menu?foodTypeCategoryId=${PIZZAS.id}`);

    parametros = new URLSearchParams({ foodTypeCategoryId: PIZZAS.id });
    vista.rerender(<FiltrosMenu categorias={CATEGORIAS} />);
    expect(screen.getByRole('button', { name: 'Pizzas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('Tipo de comida')).toHaveValue(PIZZAS.id);

    await usuario.selectOptions(screen.getByLabelText('Tipo de comida'), SANDWICHES.id);
    expect(push).toHaveBeenLastCalledWith(`/menu?foodTypeCategoryId=${SANDWICHES.id}`);

    parametros = new URLSearchParams({ foodTypeCategoryId: SANDWICHES.id });
    vista.rerender(<FiltrosMenu categorias={CATEGORIAS} />);
    expect(screen.getByRole('button', { name: 'Sándwiches' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
