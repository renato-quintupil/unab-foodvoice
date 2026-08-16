/**
 * Pantallas de categorías (T031, T033, T035, T036, FR-005, FR-006, FR-007,
 * FR-025, FR-026, SC-015, SC-019).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AYUDA_DESCRIPCION_CATEGORIA,
  Dimension,
  MSG_CATEGORIA_EN_USO,
  MSG_CATEGORIA_YA_EXISTE,
  MSG_ERROR_INESPERADO,
  MSG_EXITO_CATALOGO,
  CatalogAction,
  type CategoryDto,
} from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccionesCategoria } from '@/app/negocio/categorias/_components/acciones-categoria';
import { FormularioCategoria } from '@/app/negocio/categorias/_components/formulario-categoria';
import { AyudaDescripcion } from '@/components/ayuda-descripcion';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

const CATEGORIA: CategoryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  dimension: Dimension.TIPO_COMIDA,
  name: 'Pizzas',
  description:
    'Agrupa preparaciones horneadas de masa con distintas combinaciones de queso y verduras.',
  active: true,
  createdAt: '2026-08-16T12:00:00.000Z',
};

const DESCRIPCION_OK = CATEGORIA.description;

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  refresh.mockClear();
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respuesta(status: number, cuerpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as Response;
}

describe('Ayuda contextual de la descripción (FR-005, FR-016, SC-019)', () => {
  it('muestra el ejemplo y la explicación **sin ninguna interacción previa**', () => {
    render(<AyudaDescripcion de="categoria" />);
    expect(screen.getByText(AYUDA_DESCRIPCION_CATEGORIA.explicacion)).toBeInTheDocument();
    expect(screen.getByText(`«${AYUDA_DESCRIPCION_CATEGORIA.ejemplo}»`)).toBeInTheDocument();
  });

  it('**no es un `placeholder`**: el texto está en la página, no dentro del campo', () => {
    render(<FormularioCategoria />);
    const campo = screen.getByLabelText('Descripción');
    // Una marca de agua desaparecería al escribir, justo cuando más se necesita.
    expect(campo).not.toHaveAttribute('placeholder');
    expect(screen.getByTestId('ayuda-descripcion-categoria')).toBeInTheDocument();
  });
});

describe('Formulario de categoría · alta (FR-002, FR-003)', () => {
  it('presenta los tres campos con etiqueta en español', () => {
    render(<FormularioCategoria />);
    for (const etiqueta of ['Clasificación', 'Nombre', 'Descripción']) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
    }
  });

  it('ofrece exactamente las dos dimensiones fijas, con su nombre visible (FR-001)', () => {
    render(<FormularioCategoria />);
    const opciones = screen.getAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual(['Tipo de comida', 'Perfil de salud']);
  });

  it('rechaza una descripción corta **antes de llamar a la API**, junto al campo', async () => {
    const usuario = userEvent.setup();
    render(<FormularioCategoria />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas');
    await usuario.type(screen.getByLabelText('Descripción'), 'corta');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(screen.getByText(/30 caracteres/)).toBeInTheDocument();
    });
    // El mismo esquema que aplicará el servidor: no hace falta preguntarle.
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('asocia el error **al campo** de la descripción, no suelto en la página', async () => {
    const usuario = userEvent.setup();
    render(<FormularioCategoria />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas');
    await usuario.type(screen.getByLabelText('Descripción'), 'rica rica rica rica rica rica rica');
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    const campo = screen.getByLabelText('Descripción');
    await waitFor(() => {
      expect(campo).toHaveAttribute('aria-invalid', 'true');
    });
    const idDelError = campo.getAttribute('aria-describedby');
    expect(idDelError).toBeTruthy();
    expect(document.getElementById(idDelError!)?.textContent).toContain('palabras distintas');
  });

  it('crea la categoría y muestra la confirmación de éxito nombrándola (FR-025)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(201, CATEGORIA));
    render(<FormularioCategoria />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toHaveTextContent(
        MSG_EXITO_CATALOGO[CatalogAction.CREAR_CATEGORIA]('Pizzas'),
      );
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('presenta el nombre duplicado **junto al campo del nombre**, conservando lo escrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: {
          code: 'CATEGORY_NAME_ALREADY_EXISTS',
          message: MSG_CATEGORIA_YA_EXISTE,
          fields: { name: MSG_CATEGORIA_YA_EXISTE },
        },
      }),
    );
    render(<FormularioCategoria />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(screen.getByText(MSG_CATEGORIA_YA_EXISTE)).toBeInTheDocument();
    });
    // Lo escrito sigue ahí: la regla exigía consultar la base y no podía
    // anticiparse en el navegador.
    expect(screen.getByLabelText('Nombre')).toHaveValue('Pizzas');
  });

  it('presenta un fallo del sistema como aviso, sin perder lo escrito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(500, {}));
    render(<FormularioCategoria />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(MSG_ERROR_INESPERADO);
    });
    expect(screen.getByLabelText('Descripción')).toHaveValue(DESCRIPCION_OK);
  });

  it('**inutiliza el botón mientras espera respuesta**: un doble clic no crea dos (FR-026)', async () => {
    const usuario = userEvent.setup();
    let resolver: ((r: Response) => void) | undefined;
    fetchSimulado.mockReturnValue(
      new Promise<Response>((res) => {
        resolver = res;
      }),
    );
    render(<FormularioCategoria />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    const boton = screen.getByRole('button', { name: 'Crear categoría' });
    await usuario.click(boton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    });
    await usuario.click(screen.getByRole('button', { name: 'Guardando…' }));
    expect(fetchSimulado).toHaveBeenCalledTimes(1);

    resolver?.(respuesta(201, CATEGORIA));
  });
});

describe('Formulario de categoría · edición (FR-006)', () => {
  it('llega con el nombre y la descripción actuales', () => {
    render(<FormularioCategoria categoria={CATEGORIA} />);
    expect(screen.getByLabelText('Nombre')).toHaveValue('Pizzas');
    expect(screen.getByLabelText('Descripción')).toHaveValue(DESCRIPCION_OK);
  });

  it('**no ofrece ningún control para cambiar la dimensión** (FR-006)', () => {
    render(<FormularioCategoria categoria={CATEGORIA} />);
    // Ni desplegable habilitado ni deshabilitado: no hay control.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/Tipo de comida · no se puede cambiar/)).toBeInTheDocument();
  });

  it('muestra la descripción **completa**, sin recortar (D-033)', () => {
    const larga = `${DESCRIPCION_OK} ${'Texto adicional muy largo. '.repeat(12)}`.trim();
    render(<FormularioCategoria categoria={{ ...CATEGORIA, description: larga }} />);
    expect(screen.getByLabelText('Descripción')).toHaveValue(larga);
  });

  it('guarda con `PATCH` y **no envía la dimensión**', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...CATEGORIA, name: 'Pizzas Artesanales' }));
    render(<FormularioCategoria categoria={CATEGORIA} />);

    await usuario.clear(screen.getByLabelText('Nombre'));
    await usuario.type(screen.getByLabelText('Nombre'), 'Pizzas Artesanales');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0];
    expect(ruta).toBe(`/api/business/categories/${CATEGORIA.id}`);
    expect(opciones.method).toBe('PATCH');
    const cuerpo = JSON.parse(opciones.body as string);
    expect(cuerpo).toEqual({ name: 'Pizzas Artesanales', description: DESCRIPCION_OK });
    expect(cuerpo).not.toHaveProperty('dimension');
  });

  it('aplica las **mismas** reglas de descripción que el alta (CHK028)', async () => {
    const usuario = userEvent.setup();
    render(<FormularioCategoria categoria={CATEGORIA} />);

    await usuario.clear(screen.getByLabelText('Descripción'));
    await usuario.type(screen.getByLabelText('Descripción'), 'corta');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(screen.getByText(/30 caracteres/)).toBeInTheDocument());
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe('Acciones de la categoría (FR-007, FR-008, FR-009, SC-015)', () => {
  it('ofrece desactivar cuando está activa, y **ninguna acción de borrado**', () => {
    render(<AccionesCategoria categoria={CATEGORIA} />);
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    for (const prohibida of [/eliminar/i, /borrar/i, /dar de baja/i]) {
      expect(screen.queryByRole('button', { name: prohibida })).not.toBeInTheDocument();
    }
  });

  it('ofrece reactivar cuando está desactivada (HU14-E18)', () => {
    render(<AccionesCategoria categoria={{ ...CATEGORIA, active: false }} />);
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
  });

  it('pide confirmación cancelable y **cancelar no llama a la API** (FR-020, Principio IX)', async () => {
    const usuario = userEvent.setup();
    render(<AccionesCategoria categoria={CATEGORIA} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('la confirmación dice **a qué afecta y qué efecto tiene**', async () => {
    const usuario = userEvent.setup();
    render(<AccionesCategoria categoria={CATEGORIA} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('«Pizzas»');
    expect(dialogo).toHaveTextContent('Tipo de comida');
    expect(dialogo).toHaveTextContent(/dejará de ofrecerse/);
    expect(dialogo).toHaveTextContent(/Puedes deshacer esta acción/);
  });

  it('desactiva y muestra la confirmación de éxito (FR-025)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...CATEGORIA, active: false }));
    render(<AccionesCategoria categoria={CATEGORIA} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Desactivar' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toHaveTextContent(
        MSG_EXITO_CATALOGO[CatalogAction.DESACTIVAR_CATEGORIA]('Pizzas'),
      );
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('**presenta el conteo de bloqueadores dentro del diálogo, que no se cierra** (SC-015)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: {
          code: 'CATEGORY_IN_USE',
          message: MSG_CATEGORIA_EN_USO(3),
          blockingProducts: 3,
        },
      }),
    );
    render(<AccionesCategoria categoria={CATEGORIA} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Desactivar' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-rechazo')).toHaveTextContent('3 productos activos');
    });
    // El diálogo permanece abierto: el motivo se lee sin perder de vista qué se
    // intentaba hacer.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });
});
