/**
 * Pantallas de productos (T050, T051, T054, T055, T056, T057, FR-012, FR-016,
 * FR-019, FR-020, FR-021, FR-025, FR-026, SC-002, SC-010, SC-019).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AYUDA_DESCRIPCION_PRODUCTO,
  CatalogAction,
  Dimension,
  MSG_CATEGORIA_INACTIVA,
  MSG_ERROR_INESPERADO,
  MSG_EXITO_CATALOGO,
  MSG_PRODUCTO_YA_EXISTE,
  ProductStatus,
  type CategoryDto,
  type ProductDto,
} from '@foodvoice/shared';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisosCatalogo } from '@/components/avisos-catalogo';
import { AccionesFila } from '@/app/negocio/productos/_components/acciones-fila';
import { FormularioProducto } from '@/app/negocio/productos/_components/formulario-producto';

const refresh = vi.fn();
const push = vi.fn();

/** Mutable: hay pruebas que necesitan mover a la persona a otro listado. */
const navegacion = { parametros: new URLSearchParams() };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => navegacion.parametros,
}));

const PIZZAS: CategoryDto = {
  id: '11111111-1111-4111-8111-111111111111',
  dimension: Dimension.TIPO_COMIDA,
  name: 'Pizzas',
  description: 'Agrupa preparaciones horneadas de masa con queso y verduras variadas del dia.',
  active: true,
  createdAt: '2026-08-16T12:00:00.000Z',
};

const INDULGENTE: CategoryDto = {
  ...PIZZAS,
  id: '22222222-2222-4222-8222-222222222222',
  dimension: Dimension.PERFIL_SALUD,
  name: 'Indulgente',
};

const CATEGORIAS = [PIZZAS, INDULGENTE];

const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

const PRODUCTO: ProductDto = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Pizza Napolitana',
  description: DESCRIPCION_OK,
  ingredients: 'Masa, tomate, mozzarella',
  price: 8990,
  foodTypeCategory: { id: PIZZAS.id, name: PIZZAS.name, dimension: PIZZAS.dimension },
  healthProfileCategory: {
    id: INDULGENTE.id,
    name: INDULGENTE.name,
    dimension: INDULGENTE.dimension,
  },
  active: true,
  available: true,
  status: ProductStatus.DISPONIBLE,
  priceTier: null,
  createdAt: '2026-08-16T12:00:00.000Z',
  dietaryTags: [],
};

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
  navegacion.parametros = new URLSearchParams();
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function respuesta(status: number, cuerpo: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo } as Response;
}

describe('Formulario de producto · clasificación (FR-012, HU14-E07)', () => {
  it('ofrece **un desplegable por dimensión, de selección única**', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);

    const tipo = screen.getByLabelText('Tipo de comida');
    const perfil = screen.getByLabelText('Perfil de salud');
    // `select` simple: elegir dos de la misma dimensión es imposible, no
    // rechazable. No es una lista múltiple deshabilitada por validación.
    expect(tipo).not.toHaveAttribute('multiple');
    expect(perfil).not.toHaveAttribute('multiple');
  });

  it('puebla cada desplegable **solo con las categorías de su dimensión**', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);

    const tipo = screen.getByLabelText('Tipo de comida');
    expect(within(tipo).getAllByRole('option').map((o) => o.textContent)).toEqual(['Pizzas']);

    const perfil = screen.getByLabelText('Perfil de salud');
    expect(within(perfil).getAllByRole('option').map((o) => o.textContent)).toEqual(['Indulgente']);
  });

  it('**explica qué falta y no muestra el formulario** si una dimensión no tiene categorías (HU14-E19)', () => {
    render(<FormularioProducto categorias={[PIZZAS]} />);

    expect(screen.getByTestId('falta-clasificacion')).toBeInTheDocument();
    expect(screen.getByText(/Perfil de salud/)).toBeInTheDocument();
    // No hay desplegable vacío ni botón de guardar: no hay nada que hacer aquí.
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear producto' })).not.toBeInTheDocument();
  });

  it('ofrece ir a crear la primera categoría (FR-012, SC-010)', () => {
    render(<FormularioProducto categorias={[]} />);
    expect(screen.getByRole('link', { name: /Crear la primera categoría/ })).toHaveAttribute(
      'href',
      '/negocio/categorias/nueva',
    );
  });

  it('nombra **las dos** dimensiones cuando faltan ambas', () => {
    render(<FormularioProducto categorias={[]} />);
    expect(screen.getByText(/Tipo de comida/)).toBeInTheDocument();
    expect(screen.getByText(/Perfil de salud/)).toBeInTheDocument();
  });
});

describe('Formulario de producto · campos (FR-013, FR-016, FR-017, SC-019)', () => {
  it('presenta los siete campos, con los ingredientes marcados como opcionales', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);
    for (const etiqueta of [
      'Nombre',
      'Descripción',
      'Ingredientes (opcional)',
      'Precio en pesos',
      'Tipo de comida',
      'Perfil de salud',
      'Apto para veganos',
    ]) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
    }
  });

  it('la aptitud vegana llega destildada por omisión (E6)', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);
    expect(screen.getByLabelText('Apto para veganos')).not.toBeChecked();
  });

  it('envía vegan: true cuando se tilda la aptitud vegana al crear', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(201, { ...PRODUCTO, dietaryTags: ['Vegano'] }));
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '8990');
    await usuario.click(screen.getByLabelText('Apto para veganos'));
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [, opciones] = fetchSimulado.mock.calls[0]!;
    expect(JSON.parse(opciones.body as string)).toMatchObject({ vegan: true });
  });

  it('muestra la ayuda de la descripción sin interacción previa (SC-019)', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);
    expect(screen.getByText(AYUDA_DESCRIPCION_PRODUCTO.explicacion)).toBeInTheDocument();
    expect(screen.getByText(`«${AYUDA_DESCRIPCION_PRODUCTO.ejemplo}»`)).toBeInTheDocument();
  });

  it('**el precio llega vacío**: uno prellenado se guardaría por descuido', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);
    expect(screen.getByLabelText('Precio en pesos')).toHaveValue(null);
  });

  it('avisa de que el precio se escribe sin puntos ni decimales (FR-015)', () => {
    render(<FormularioProducto categorias={CATEGORIAS} />);
    expect(screen.getByText(/Sin puntos ni decimales/)).toBeInTheDocument();
  });

  it('rechaza un precio con decimales **antes de llamar a la API**, junto al campo', async () => {
    const usuario = userEvent.setup();
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '4990.5');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(screen.getByText('El precio no puede tener decimales.')).toBeInTheDocument();
    });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('rechaza el precio cero con su propio mensaje (SC-012)', async () => {
    const usuario = userEvent.setup();
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '0');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(screen.getByText('El precio debe ser mayor que cero.')).toBeInTheDocument();
    });
  });

  it('rechaza una descripción sin sustancia, con el error asociado al campo (FR-039)', async () => {
    const usuario = userEvent.setup();
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), 'rica rica rica rica rica rica');
    await usuario.type(screen.getByLabelText('Precio en pesos'), '8990');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    const campo = screen.getByLabelText('Descripción');
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'));
    const idDelError = campo.getAttribute('aria-describedby');
    expect(document.getElementById(idDelError!)?.textContent).toContain('palabras distintas');
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('crea el producto y confirma nombrándolo (FR-025)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(201, PRODUCTO));
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '8990');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toHaveTextContent(
        MSG_EXITO_CATALOGO[CatalogAction.CREAR_PRODUCTO]('Pizza Napolitana'),
      );
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('presenta el nombre duplicado junto al campo del nombre (HU02-E02)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: {
          code: 'PRODUCT_NAME_ALREADY_EXISTS',
          message: MSG_PRODUCTO_YA_EXISTE,
          fields: { name: MSG_PRODUCTO_YA_EXISTE },
        },
      }),
    );
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '8990');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => expect(screen.getByText(MSG_PRODUCTO_YA_EXISTE)).toBeInTheDocument());
    expect(screen.getByLabelText('Nombre')).toHaveValue('Pizza Napolitana');
  });

  it('**presenta la categoría desactivada junto a su desplegable** (FR-021, SC-010, T057)', async () => {
    const usuario = userEvent.setup();
    const mensaje = MSG_CATEGORIA_INACTIVA('Tipo de comida');
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: {
          code: 'CATEGORY_INACTIVE',
          message: mensaje,
          fields: { foodTypeCategoryId: mensaje },
        },
      }),
    );
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '8990');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    const desplegable = screen.getByLabelText('Tipo de comida');
    await waitFor(() => expect(desplegable).toHaveAttribute('aria-invalid', 'true'));
    const idDelError = desplegable.getAttribute('aria-describedby');
    expect(document.getElementById(idDelError!)?.textContent).toContain('Tipo de comida');
  });

  it('inutiliza el botón mientras espera: un doble clic no crea dos (FR-026)', async () => {
    const usuario = userEvent.setup();
    let resolver: ((r: Response) => void) | undefined;
    fetchSimulado.mockReturnValue(
      new Promise<Response>((res) => {
        resolver = res;
      }),
    );
    render(<FormularioProducto categorias={CATEGORIAS} />);

    await usuario.type(screen.getByLabelText('Nombre'), 'Pizza Napolitana');
    await usuario.type(screen.getByLabelText('Descripción'), DESCRIPCION_OK);
    await usuario.type(screen.getByLabelText('Precio en pesos'), '8990');
    await usuario.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    });
    await usuario.click(screen.getByRole('button', { name: 'Guardando…' }));
    expect(fetchSimulado).toHaveBeenCalledTimes(1);

    resolver?.(respuesta(201, PRODUCTO));
  });
});

describe('Formulario de producto · edición (FR-018, FR-022)', () => {
  it('llega con todos los datos actuales, y la descripción **completa** (D-033)', () => {
    const larga = `${DESCRIPCION_OK} ${'Detalle adicional del plato. '.repeat(10)}`.trim();
    render(
      <FormularioProducto categorias={CATEGORIAS} producto={{ ...PRODUCTO, description: larga }} />,
    );

    expect(screen.getByLabelText('Nombre')).toHaveValue('Pizza Napolitana');
    expect(screen.getByLabelText('Descripción')).toHaveValue(larga);
    expect(screen.getByLabelText('Ingredientes (opcional)')).toHaveValue('Masa, tomate, mozzarella');
    expect(screen.getByLabelText('Precio en pesos')).toHaveValue(8990);
  });

  it('llega con la clasificación actual seleccionada', () => {
    render(<FormularioProducto categorias={CATEGORIAS} producto={PRODUCTO} />);
    expect(screen.getByLabelText('Tipo de comida')).toHaveValue(PIZZAS.id);
    expect(screen.getByLabelText('Perfil de salud')).toHaveValue(INDULGENTE.id);
  });

  it('llega con la aptitud vegana tildada cuando el producto ya la tiene (E6)', () => {
    render(
      <FormularioProducto categorias={CATEGORIAS} producto={{ ...PRODUCTO, dietaryTags: ['Vegano'] }} />,
    );
    expect(screen.getByLabelText('Apto para veganos')).toBeChecked();
  });

  it('guarda con `PATCH` sobre el identificador del producto', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PRODUCTO, price: 9990 }));
    render(<FormularioProducto categorias={CATEGORIAS} producto={PRODUCTO} />);

    await usuario.clear(screen.getByLabelText('Precio en pesos'));
    await usuario.type(screen.getByLabelText('Precio en pesos'), '9990');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/business/products/${PRODUCTO.id}`);
    expect(opciones.method).toBe('PATCH');
  });
});

describe('Acciones de fila · agotar y reponer (FR-019, SC-002)', () => {
  it('**ofrece marcar agotado sin ningún diálogo**, en un solo clic (SC-002)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PRODUCTO, available: false }));
    render(<AccionesFila producto={PRODUCTO} />);

    await usuario.click(screen.getByRole('button', { name: 'Marcar agotado' }));

    // Sin diálogo intermedio: es la única acción de la épica exenta.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/business/products/${PRODUCTO.id}/availability`);
    expect(JSON.parse(opciones.body as string)).toEqual({ available: false });
  });

  it('ofrece reponer cuando está agotado, y envía `available: true`', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, PRODUCTO));
    render(<AccionesFila producto={{ ...PRODUCTO, available: false, status: ProductStatus.AGOTADO }} />);

    await usuario.click(screen.getByRole('button', { name: 'Reponer' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [, opciones] = fetchSimulado.mock.calls[0]!;
    expect(JSON.parse(opciones.body as string)).toEqual({ available: true });
  });

  it('confirma el cambio nombrando el producto (FR-025)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PRODUCTO, available: false }));
    render(<AccionesFila producto={PRODUCTO} />);

    await usuario.click(screen.getByRole('button', { name: 'Marcar agotado' }));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toHaveTextContent(
        MSG_EXITO_CATALOGO[CatalogAction.AGOTAR_PRODUCTO]('Pizza Napolitana'),
      );
    });
  });

  it('**no ofrece agotar un producto dado de baja**: no está en el menú', () => {
    render(<AccionesFila producto={{ ...PRODUCTO, active: false, status: ProductStatus.DADO_DE_BAJA }} />);
    expect(screen.queryByRole('button', { name: 'Marcar agotado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reponer' })).not.toBeInTheDocument();
  });

  it('presenta un fallo sobre la fila, sin aviso de éxito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(500, {}));
    render(<AccionesFila producto={PRODUCTO} />);

    await usuario.click(screen.getByRole('button', { name: 'Marcar agotado' }));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-fila')).toHaveTextContent(MSG_ERROR_INESPERADO);
    });
    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });
});

describe('Acciones de fila · baja y reactivación (FR-020, FR-021)', () => {
  it('**dar de baja pide confirmación cancelable** (FR-020, Principio IX)', async () => {
    const usuario = userEvent.setup();
    render(<AccionesFila producto={PRODUCTO} />);

    await usuario.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent('«Pizza Napolitana»');
    expect(dialogo).toHaveTextContent('$8.990');
    expect(dialogo).toHaveTextContent(/desaparecerá del menú/);

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('usa el vocabulario del catálogo: «dar de baja», nunca «eliminar»', () => {
    render(<AccionesFila producto={PRODUCTO} />);
    for (const prohibida of [/eliminar/i, /borrar/i, /archivar/i, /desactivar/i]) {
      expect(screen.queryByRole('button', { name: prohibida })).not.toBeInTheDocument();
    }
  });

  it('da de baja y confirma (FR-025)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PRODUCTO, active: false }));
    render(<AccionesFila producto={PRODUCTO} />);

    await usuario.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Dar de baja' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toHaveTextContent(
        MSG_EXITO_CATALOGO[CatalogAction.DAR_DE_BAJA_PRODUCTO]('Pizza Napolitana'),
      );
    });
  });

  it('**presenta el bloqueo por categoría desactivada dentro del diálogo** (HU02-E15, T057)', async () => {
    const usuario = userEvent.setup();
    const mensaje = MSG_CATEGORIA_INACTIVA('Tipo de comida');
    fetchSimulado.mockResolvedValue(
      respuesta(409, { error: { code: 'CATEGORY_INACTIVE', message: mensaje } }),
    );
    render(
      <AccionesFila producto={{ ...PRODUCTO, active: false, status: ProductStatus.DADO_DE_BAJA }} />,
    );

    await usuario.click(screen.getByRole('button', { name: 'Reactivar' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Reactivar' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-rechazo')).toHaveTextContent('Tipo de comida');
    });
    // El diálogo permanece abierto y el aviso de éxito no aparece.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });

  it('el rechazo del diálogo **no se duplica** debajo de la fila (T084)', async () => {
    const usuario = userEvent.setup();
    const mensaje = MSG_CATEGORIA_INACTIVA('Tipo de comida');
    fetchSimulado.mockResolvedValue(
      respuesta(409, { error: { code: 'CATEGORY_INACTIVE', message: mensaje } }),
    );
    render(
      <AccionesFila producto={{ ...PRODUCTO, active: false, status: ProductStatus.DADO_DE_BAJA }} />,
    );

    await usuario.click(screen.getByRole('button', { name: 'Reactivar' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Reactivar' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-rechazo')).toBeInTheDocument();
    });
    // Un solo anuncio: con dos, un lector de pantalla leería el mismo error dos
    // veces. Lo encontró la validación funcional de E3.
    expect(screen.queryByTestId('aviso-fila')).not.toBeInTheDocument();
    expect(screen.getAllByText(mensaje)).toHaveLength(1);
  });

  it('la confirmación de la baja **sobrevive a que la fila desaparezca** (FR-025, T084)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PRODUCTO, active: false }));

    // Reproduce el listado real: la fila se desmonta al refrescarse, porque la
    // vista por omisión solo muestra los activos. Antes del arreglo, el aviso se
    // iba con ella y la acción no confirmaba nada.
    function Listado() {
      const [visible, setVisible] = useState(true);
      return (
        <AvisosCatalogo>
          {visible && (
            <div>
              <AccionesFila producto={PRODUCTO} />
              <button type="button" onClick={() => setVisible(false)}>
                simular refresco
              </button>
            </div>
          )}
        </AvisosCatalogo>
      );
    }
    render(<Listado />);

    await usuario.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Dar de baja' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toBeInTheDocument();
    });

    await usuario.click(screen.getByRole('button', { name: 'simular refresco' }));
    expect(screen.getByTestId('aviso-exito')).toHaveTextContent(
      MSG_EXITO_CATALOGO[CatalogAction.DAR_DE_BAJA_PRODUCTO]('Pizza Napolitana'),
    );
  });

  it('pero **caduca al cambiar los filtros**: no describe un listado que no se está mirando', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...PRODUCTO, active: false }));

    // Un elemento nuevo en cada pintura: React se salta el render si recibe el
    // mismo objeto, y entonces la prueba no probaría nada.
    const arbol = () => (
      <AvisosCatalogo>
        <AccionesFila producto={PRODUCTO} />
      </AvisosCatalogo>
    );
    const { rerender } = render(arbol());

    await usuario.click(screen.getByRole('button', { name: 'Dar de baja' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = within(dialogo).getAllByRole('button', { name: 'Dar de baja' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toBeInTheDocument();
    });

    // La persona filtra por «Dado de baja». El aviso hablaba del listado
    // anterior; dejarlo ahí anuncia una baja sobre una lista donde el producto
    // aparece justamente como dado de baja.
    navegacion.parametros = new URLSearchParams({ status: 'DADO_DE_BAJA' });
    rerender(arbol());

    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });

  it('**ofrece reclasificar** un producto dado de baja, que es la salida de FR-021', () => {
    render(
      <AccionesFila producto={{ ...PRODUCTO, active: false, status: ProductStatus.DADO_DE_BAJA }} />,
    );
    expect(screen.getByTestId('reclasificar')).toHaveAttribute(
      'href',
      `/negocio/productos/${PRODUCTO.id}/editar`,
    );
  });
});
