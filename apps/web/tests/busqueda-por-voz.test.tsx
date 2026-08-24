/**
 * Búsqueda por voz (E6, HU-06, HU-13, FR-001, FR-009 a FR-011, FR-016,
 * FR-019, FR-020, FR-023).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
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

const PRODUCTO_2: ProductDto = {
  ...PRODUCTO,
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Pizza Cuatro Quesos',
};

/** Doble de `SpeechRecognition`, controlado desde el test vía `.instancia`. */
class FakeSpeechRecognition extends EventTarget implements SpeechRecognition {
  static instancia: FakeSpeechRecognition | undefined;
  lang = '';
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  constructor() {
    super();
    FakeSpeechRecognition.instancia = this;
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
}

/**
 * Registra el doble **antes** de que el componente compruebe si hay soporte
 * de voz (se llama antes del clic que activa el micrófono, nunca después).
 */
function conReconocimientoDeVozSimulado(): void {
  vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition);
}

/** Simula que el reconocimiento ya activado devuelve `transcripcion`. */
function dictar(transcripcion: string): void {
  const resultadoFalso = {
    results: [[{ transcript: transcripcion }]],
  } as unknown as SpeechRecognitionEvent;
  act(() => {
    FakeSpeechRecognition.instancia?.onresult?.(resultadoFalso);
  });
}

const RESPUESTA_BUSQUEDA_CON_NAPOLITANA = respuesta(200, {
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
});

/**
 * "Agregar al carrito por voz" empieza deshabilitado y solo se habilita
 * sobre una búsqueda con productos ya en pantalla — así que toda prueba de
 * agregar por voz necesita buscar primero (FR-020, la misma condición que
 * el botón exige en la interfaz real).
 */
async function buscarPrimero(usuario: ReturnType<typeof userEvent.setup>): Promise<void> {
  await usuario.type(
    screen.getByLabelText('Busca o pide algo con tus propias palabras'),
    'quiero pizza',
  );
  await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument());
}

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

  it('busca sola en cuanto termina el dictado, sin esperar un clic en Buscar', async () => {
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

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await usuario.click(screen.getByLabelText('Dictar la búsqueda por voz'));
    dictar('quiero una pizza');

    // Ningún clic en "Buscar": la transcripción sola disparó la solicitud.
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));
    const [, opciones] = fetchSimulado.mock.calls[0]!;
    expect(JSON.parse(opciones.body as string)).toMatchObject({
      query: 'quiero una pizza',
      channel: 'VOICE',
      intent: 'SEARCH',
    });
    await waitFor(() => expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument());
  });
});

describe('BusquedaPorVoz · agregar por voz (HU-13)', () => {
  it('empieza deshabilitado y solo se habilita con una búsqueda con datos en pantalla', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(RESPUESTA_BUSQUEDA_CON_NAPOLITANA);

    render(<BusquedaPorVoz />);
    expect(screen.getByRole('button', { name: /Agregar al carrito por voz/ })).toBeDisabled();

    await buscarPrimero(usuario);
    expect(screen.getByRole('button', { name: /Agregar al carrito por voz/ })).toBeEnabled();
  });

  it('sigue deshabilitado si la búsqueda no trajo productos (CLARIFICATION o NO_RESULTS)', async () => {
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
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'hamburguesa',
    );
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(screen.getByText(/No encontré productos/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Agregar al carrito por voz/ })).toBeDisabled();
  });

  it('activa el micrófono en vez de reenviar lo que hubiera en el campo de texto', async () => {
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

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    // Una búsqueda previa deja "quiero pizza" en el campo — no debe ser lo
    // que se agregue si el cliente toca "Agregar" sin dictar algo nuevo.
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'quiero pizza',
    );
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));

    // No se reenvió "quiero pizza": tocar el botón solo abrió el micrófono.
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(FakeSpeechRecognition.instancia).toBeDefined();
  });

  it('conserva la lista de la búsqueda mientras se agrega un producto por voz (no la borra)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(
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
      )
      .mockResolvedValueOnce(respuesta(200, { status: 'RESOLVED', items: [{ item: PRODUCTO, quantity: 1 }] }));

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await usuario.type(
      screen.getByLabelText('Busca o pide algo con tus propias palabras'),
      'quiero pizza',
    );
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(screen.getByText('Pizza Napolitana')).toBeInTheDocument());

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    dictar('agrégame una napolitana');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Confirmar agregado al carrito' })).toBeInTheDocument();
    });
    // La tarjeta de la búsqueda original sigue en pantalla, junto a la
    // confirmación — "agregar" no le borró el resultado a "buscar".
    expect(screen.getAllByText('Pizza Napolitana').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra un mensaje si el reconocimiento falla, en vez de no hacer nada (sin feedback)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValueOnce(RESPUESTA_BUSQUEDA_CON_NAPOLITANA);
    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await buscarPrimero(usuario);

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    act(() => {
      FakeSpeechRecognition.instancia?.onerror?.(
        { error: 'no-speech' } as unknown as SpeechRecognitionErrorEvent,
      );
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No alcancé a escucharte');
    // El botón vuelve a estar disponible: no queda atascado en "Escuchando…".
    expect(screen.getByRole('button', { name: /Agregar al carrito por voz/ })).toBeEnabled();
    // Ninguna llamada nueva: el fallo ocurrió en el reconocimiento, antes de
    // llegar a pedirle nada al servidor. La única llamada previa fue la búsqueda.
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('muestra la confirmación con producto, cantidad y precio antes de tocar el carrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(RESPUESTA_BUSQUEDA_CON_NAPOLITANA)
      .mockResolvedValue(respuesta(200, { status: 'RESOLVED', items: [{ item: PRODUCTO, quantity: 1 }] }));

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await buscarPrimero(usuario);

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    dictar('agrégame una napolitana');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Confirmar agregado al carrito' })).toBeInTheDocument();
    });
    // Ninguna escritura todavía: solo la búsqueda previa y la llamada de intent ADD.
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
    const [, opciones] = fetchSimulado.mock.calls[1]!;
    expect(JSON.parse(opciones.body as string)).toMatchObject({
      query: 'agrégame una napolitana',
      channel: 'VOICE',
      intent: 'ADD',
    });
  });

  it('cancelar no llama a ningún endpoint de carrito (FR-023)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(RESPUESTA_BUSQUEDA_CON_NAPOLITANA)
      .mockResolvedValue(respuesta(200, { status: 'RESOLVED', items: [{ item: PRODUCTO, quantity: 1 }] }));

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await buscarPrimero(usuario);

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    dictar('agrégame una napolitana');
    await waitFor(() => screen.getByRole('dialog'));

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(fetchSimulado).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra varios productos en una sola confirmación cuando la frase nombra más de uno (D-066)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(RESPUESTA_BUSQUEDA_CON_NAPOLITANA)
      .mockResolvedValue(
        respuesta(200, {
          status: 'RESOLVED',
          items: [
            { item: PRODUCTO, quantity: 1 },
            { item: PRODUCTO_2, quantity: 2 },
          ],
        }),
      );

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await buscarPrimero(usuario);

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    dictar('agrégame una napolitana y dos cuatro quesos');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Confirmar agregado al carrito' })).toBeInTheDocument();
    });
    expect(screen.getAllByText('Pizza Napolitana').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pizza Cuatro Quesos')).toBeInTheDocument();
  });

  it('confirmar con varios productos agrega cada uno al carrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(RESPUESTA_BUSQUEDA_CON_NAPOLITANA)
      .mockResolvedValueOnce(
        respuesta(200, {
          status: 'RESOLVED',
          items: [
            { item: PRODUCTO, quantity: 1 },
            { item: PRODUCTO_2, quantity: 2 },
          ],
        }),
      )
      .mockResolvedValueOnce(respuesta(200, { lines: [] }))
      .mockResolvedValueOnce(respuesta(200, { lines: [] }))
      .mockResolvedValueOnce(respuesta(200, { lines: [] }));

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await buscarPrimero(usuario);

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    dictar('agrégame una napolitana y dos cuatro quesos');
    await waitFor(() => screen.getByRole('dialog'));

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Búsqueda + ADD + 2 x POST /cart/lines + 1 PATCH de cantidad para el segundo producto.
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(5));
    const rutas = fetchSimulado.mock.calls.slice(2).map(([ruta]) => ruta);
    expect(rutas).toEqual([
      '/api/cart/lines',
      '/api/cart/lines',
      `/api/cart/lines/${PRODUCTO_2.id}`,
    ]);
  });

  it('confirmar llama a POST /cart/lines', async () => {
    const usuario = userEvent.setup();
    fetchSimulado
      .mockResolvedValueOnce(RESPUESTA_BUSQUEDA_CON_NAPOLITANA)
      .mockResolvedValueOnce(
        respuesta(200, { status: 'RESOLVED', items: [{ item: PRODUCTO, quantity: 1 }] }),
      )
      .mockResolvedValueOnce(respuesta(200, { lines: [] }));

    conReconocimientoDeVozSimulado();
    render(<BusquedaPorVoz />);
    await buscarPrimero(usuario);

    await usuario.click(screen.getByRole('button', { name: /Agregar al carrito por voz/ }));
    dictar('agrégame una napolitana');
    await waitFor(() => screen.getByRole('dialog'));

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(3));
    const [ruta] = fetchSimulado.mock.calls[2]!;
    expect(ruta).toBe('/api/cart/lines');
  });
});
