/**
 * Búsqueda por voz (E6, HU-06, HU-13, FR-001, FR-009 a FR-011, FR-016,
 * FR-019, FR-020, FR-023).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dimension, ProductStatus, type ProductDto } from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusquedaPorVoz } from '@/app/menu/_components/busqueda-por-voz';

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respuesta(status: number, cuerpo: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as Response;
}

const PRODUCTO: ProductDto = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Pizza Napolitana',
  description: 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.',
  ingredients: 'Masa, tomate, mozzarella',
  price: 8990,
  foodTypeCategory: { id: '1', name: 'Pizzas', dimension: Dimension.TIPO_COMIDA },
  healthProfileCategory: { id: '2', name: 'Indulgente', dimension: Dimension.PERFIL_SALUD },
  active: true,
  available: true,
  status: ProductStatus.DISPONIBLE,
  priceTier: null,
  createdAt: '2026-08-23T12:00:00.000Z',
  dietaryTags: [],
};

describe('BusquedaPorVoz · texto (HU-06)', () => {
  it('funciona escribiendo texto, sin usar el micrófono', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, {
        status: 'RESULTS',
        interpretation: {
          priceTier: null,
          foodTypeCategoryId: null,
          healthProfileCategoryId: null,
          vegan: null,
          productTerms: [],
          openRecommendation: false,
        },
        items: [PRODUCTO],
      }),
    );

    render(<BusquedaPorVoz />);
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'quiero una pizza',
    );
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument());

    const [, opciones] = fetchSimulado.mock.calls[0]!;
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo).toMatchObject({ query: 'quiero una pizza', channel: 'TEXT', intent: 'SEARCH' });
  });

  it('renderiza el estado de aclaración con sus opciones', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, {
        status: 'CLARIFICATION',
        question: '¿Te refieres a algo saludable o a una porción pequeña?',
        options: ['Saludable', 'Porción pequeña'],
      }),
    );

    render(<BusquedaPorVoz />);
    await usuario.type(screen.getByLabelText('Busca o pide algo con tus propias palabras'), 'algo liviano');
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(
        screen.getByText('¿Te refieres a algo saludable o a una porción pequeña?'),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Saludable' })).toBeInTheDocument();
  });

  it('renderiza sin resultados sin sustituir por productos parciales', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, {
        status: 'NO_RESULTS',
        interpretation: {
          priceTier: null,
          foodTypeCategoryId: null,
          healthProfileCategoryId: null,
          vegan: null,
          productTerms: ['hamburguesa'],
          openRecommendation: false,
        },
      }),
    );

    render(<BusquedaPorVoz />);
    await usuario.type(screen.getByLabelText('Busca o pide algo con tus propias palabras'), 'hamburguesa');
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(screen.getByText(/No encontré productos/)).toBeInTheDocument();
    });
  });

  it('sigue disponible (campo de texto operativo) si el proveedor falla (FR-016)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(503, {
        error: { code: 'SEARCH_UNAVAILABLE', message: 'No pudimos interpretar tu búsqueda ahora.' },
      }),
    );

    render(<BusquedaPorVoz />);
    const campo = screen.getByLabelText('Busca o pide algo con tus propias palabras');
    await usuario.type(campo, 'algo');
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos interpretar tu búsqueda ahora.');
    });
    expect(campo).toBeEnabled();
  });

  it('avisa cuando el navegador no soporta reconocimiento de voz', async () => {
    const usuario = userEvent.setup();
    render(<BusquedaPorVoz />);
    await usuario.click(screen.getByLabelText('Dictar la búsqueda por voz'));

    expect(screen.getByRole('alert')).toHaveTextContent(/no soporta reconocimiento de voz/);
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe('BusquedaPorVoz · agregar por voz (HU-13)', () => {
  it('muestra la confirmación con producto, cantidad y precio antes de tocar el carrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, { status: 'RESOLVED', item: PRODUCTO, quantity: 1 }),
    );

    render(<BusquedaPorVoz />);
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'agrégame una napolitana',
    );
    await usuario.click(screen.getByRole('button', { name: 'Agregar al carrito por voz' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Confirmar agregado al carrito' })).toBeInTheDocument();
    });
    // Ninguna escritura todavía: la única llamada fue la de intent ADD.
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('cancelar no llama a ningún endpoint de carrito (FR-023)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, { status: 'RESOLVED', item: PRODUCTO, quantity: 1 }),
    );

    render(<BusquedaPorVoz />);
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'agrégame una napolitana',
    );
    await usuario.click(screen.getByRole('button', { name: 'Agregar al carrito por voz' }));
    await waitFor(() => screen.getByRole('dialog'));

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirmar llama a POST /cart/lines', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(respuesta(200, { status: 'RESOLVED', item: PRODUCTO, quantity: 1 }))
      .mockResolvedValueOnce(respuesta(200, { lines: [] }));

    render(<BusquedaPorVoz />);
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'agrégame una napolitana',
    );
    await usuario.click(screen.getByRole('button', { name: 'Agregar al carrito por voz' }));
    await waitFor(() => screen.getByRole('dialog'));

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(2));
    const [ruta] = fetchSimulado.mock.calls[1]!;
    expect(ruta).toBe('/api/cart/lines');
  });
});
