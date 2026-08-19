/**
 * Pantallas del menú (T067, T068, T072, FR-029, FR-031, FR-033, FR-035,
 * SC-004, SC-018, SC-025).
 *
 * Aquí se comprueba lo que es **de la interfaz**: que los tres filtros existan,
 * sean combinables y viajen en la dirección, y que un producto agotado se vea
 * marcado sin ninguna acción para pedirlo. Que la consulta no devuelva jamás un
 * producto no ofrecible es de la API y se verifica en
 * `menu-visibility.integration-spec.ts`: es una propiedad de la consulta, no de
 * la pantalla (RN-018, D-031).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dimension,
  ETIQUETA_TRAMO,
  PriceTier,
  type CategoryDto,
} from '@foodvoice/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FiltrosMenu } from '@/app/menu/_components/filtros-menu';

const push = vi.fn();
let parametros = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => parametros,
}));

const PIZZAS: CategoryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  dimension: Dimension.TIPO_COMIDA,
  name: 'Pizzas',
  description:
    'Agrupa preparaciones horneadas de masa con queso y verduras variadas del dia.',
  active: true,
  createdAt: '2026-08-16T12:00:00.000Z',
};

const SOPAS: CategoryDto = {
  ...PIZZAS,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Sopas',
};

const SALUDABLE: CategoryDto = {
  ...PIZZAS,
  id: '22222222-2222-4222-8222-222222222222',
  dimension: Dimension.PERFIL_SALUD,
  name: 'Saludable',
};

const CATEGORIAS = [PIZZAS, SOPAS, SALUDABLE];

beforeEach(() => {
  push.mockClear();
  parametros = new URLSearchParams();
});

describe('Los tres filtros del menú (FR-031, FR-033, SC-025)', () => {
  it('ofrece un selector por cada dimensión y uno de tramo de precio', () => {
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    expect(screen.getByLabelText('Tipo de comida')).toBeInTheDocument();
    expect(screen.getByLabelText('Perfil de salud')).toBeInTheDocument();
    expect(screen.getByLabelText('Precio')).toBeInTheDocument();
  });

  it('cada selector de dimensión ofrece **solo las categorías de su dimensión**', () => {
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    const tipo = screen.getByLabelText('Tipo de comida');
    expect(within(tipo).getByRole('option', { name: 'Pizzas' })).toBeInTheDocument();
    expect(within(tipo).getByRole('option', { name: 'Sopas' })).toBeInTheDocument();
    expect(
      within(tipo).queryByRole('option', { name: 'Saludable' }),
    ).not.toBeInTheDocument();

    const salud = screen.getByLabelText('Perfil de salud');
    expect(within(salud).getByRole('option', { name: 'Saludable' })).toBeInTheDocument();
    expect(
      within(salud).queryByRole('option', { name: 'Pizzas' }),
    ).not.toBeInTheDocument();
  });

  it('el selector de precio nombra los tres tramos con su etiqueta visible', () => {
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    const precio = screen.getByLabelText('Precio');
    for (const tramo of Object.values(PriceTier)) {
      expect(
        within(precio).getByRole('option', { name: ETIQUETA_TRAMO[tramo] }),
      ).toBeInTheDocument();
    }
  });

  it('elegir una categoría la lleva a la dirección, no a estado local', async () => {
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    await userEvent.selectOptions(screen.getByLabelText('Tipo de comida'), PIZZAS.id);

    expect(push).toHaveBeenCalledWith(`/menu?foodTypeCategoryId=${PIZZAS.id}`);
  });

  it('los filtros **se combinan** en lugar de sustituirse (SC-018, SC-025)', async () => {
    parametros = new URLSearchParams({ foodTypeCategoryId: PIZZAS.id });
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    await userEvent.selectOptions(screen.getByLabelText('Precio'), PriceTier.ECONOMICO);

    const destino = push.mock.calls[0]![0] as string;
    // El filtro anterior sigue en la dirección: pedir «pizza económica» no
    // sustituye la pizza por lo económico.
    expect(destino).toContain(`foodTypeCategoryId=${PIZZAS.id}`);
    expect(destino).toContain(`priceTier=${PriceTier.ECONOMICO}`);
  });

  it('elegir «Cualquiera» quita ese filtro y conserva los demás', async () => {
    parametros = new URLSearchParams({
      foodTypeCategoryId: PIZZAS.id,
      priceTier: PriceTier.ECONOMICO,
    });
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    await userEvent.selectOptions(screen.getByLabelText('Precio'), '');

    const destino = push.mock.calls[0]![0] as string;
    expect(destino).toContain(`foodTypeCategoryId=${PIZZAS.id}`);
    expect(destino).not.toContain('priceTier');
  });

  it('«Quitar filtros» aparece solo cuando hay alguno, y sale del resultado vacío en un clic', async () => {
    const { rerender } = render(<FiltrosMenu categorias={CATEGORIAS} />);
    expect(
      screen.queryByRole('button', { name: 'Quitar filtros' }),
    ).not.toBeInTheDocument();

    parametros = new URLSearchParams({ priceTier: PriceTier.CARO });
    rerender(<FiltrosMenu categorias={CATEGORIAS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    expect(push).toHaveBeenCalledWith('/menu');
  });

  it('refleja los filtros de la dirección al cargar: recargar no los pierde', () => {
    parametros = new URLSearchParams({
      foodTypeCategoryId: SOPAS.id,
      priceTier: PriceTier.MEDIO,
    });
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    expect(screen.getByLabelText<HTMLSelectElement>('Tipo de comida').value).toBe(
      SOPAS.id,
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Precio').value).toBe(
      PriceTier.MEDIO,
    );
  });

  it('cada selector tiene su etiqueta asociada, y se opera con teclado (FR-037)', async () => {
    render(<FiltrosMenu categorias={CATEGORIAS} />);

    for (const etiqueta of ['Todas', 'Pizzas', 'Sopas']) {
      await userEvent.tab();
      expect(screen.getByRole('button', { name: etiqueta })).toHaveFocus();
    }
    await userEvent.tab();
    expect(screen.getByLabelText('Tipo de comida')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Perfil de salud')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Precio')).toHaveFocus();
  });

  it('una dimensión sin categorías activas deja su selector con «Cualquiera» y nada más', () => {
    render(<FiltrosMenu categorias={[PIZZAS]} />);

    const salud = screen.getByLabelText('Perfil de salud');
    expect(within(salud).getAllByRole('option')).toHaveLength(1);
  });
});
