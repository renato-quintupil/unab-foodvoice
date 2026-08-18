/**
 * Pantallas de direcciones (HU-11, FR-012–FR-024).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MSG_DIRECCION_ETIQUETA_DUPLICADA, MSG_DIRECCION_EN_USO, type AddressDto } from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccionesDireccion } from '@/app/cliente/direcciones/_components/acciones-direccion';
import { FormularioDireccion } from '@/app/cliente/direcciones/_components/formulario-direccion';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

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

const DIRECCION: AddressDto = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Casa',
  text: 'Los Aromos 123, depto 4B',
  isDefault: true,
  active: true,
  createdAt: '2026-08-17T12:00:00.000Z',
};

describe('Formulario de dirección · solo texto (FR-021, HU11-E15)', () => {
  it('presenta exactamente etiqueta y dirección, sin mapa, pin ni coordenadas', () => {
    render(<FormularioDireccion />);
    expect(screen.getByLabelText('Etiqueta')).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección')).toBeInTheDocument();
    expect(screen.queryByText(/mapa|pin|coordenada/i)).not.toBeInTheDocument();
  });

  it('rechaza una etiqueta corta **antes de llamar a la API**, junto al campo', async () => {
    const usuario = userEvent.setup();
    render(<FormularioDireccion />);

    await usuario.type(screen.getByLabelText('Etiqueta'), 'C');
    await usuario.type(screen.getByLabelText('Dirección'), 'Los Aromos 123, depto 4B');
    await usuario.click(screen.getByRole('button', { name: 'Registrar dirección' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Etiqueta')).toHaveAttribute('aria-invalid', 'true');
    });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('rechaza un texto de solo espacios, junto al campo', async () => {
    const usuario = userEvent.setup();
    render(<FormularioDireccion />);

    await usuario.type(screen.getByLabelText('Etiqueta'), 'Casa');
    await usuario.type(screen.getByLabelText('Dirección'), '          ');
    await usuario.click(screen.getByRole('button', { name: 'Registrar dirección' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Dirección')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('crea la dirección y muestra la confirmación de éxito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(201, DIRECCION));
    render(<FormularioDireccion />);

    await usuario.type(screen.getByLabelText('Etiqueta'), 'Casa');
    await usuario.type(screen.getByLabelText('Dirección'), 'Los Aromos 123, depto 4B');
    await usuario.click(screen.getByRole('button', { name: 'Registrar dirección' }));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito')).toBeInTheDocument();
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('presenta la etiqueta duplicada junto al campo de la etiqueta', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: {
          code: 'ADDRESS_LABEL_ALREADY_EXISTS',
          message: MSG_DIRECCION_ETIQUETA_DUPLICADA,
          fields: { label: MSG_DIRECCION_ETIQUETA_DUPLICADA },
        },
      }),
    );
    render(<FormularioDireccion />);

    await usuario.type(screen.getByLabelText('Etiqueta'), 'Casa');
    await usuario.type(screen.getByLabelText('Dirección'), 'Los Aromos 123, depto 4B');
    await usuario.click(screen.getByRole('button', { name: 'Registrar dirección' }));

    await waitFor(() => {
      expect(screen.getByText(MSG_DIRECCION_ETIQUETA_DUPLICADA)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('Casa');
  });

  it('edición: llega con la etiqueta y el texto actuales, guarda con PATCH', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, { ...DIRECCION, text: 'Los Aromos 456' }));
    render(<FormularioDireccion direccion={DIRECCION} />);

    expect(screen.getByLabelText('Etiqueta')).toHaveValue('Casa');
    await usuario.clear(screen.getByLabelText('Dirección'));
    await usuario.type(screen.getByLabelText('Dirección'), 'Los Aromos 456');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalled());
    const [ruta, opciones] = fetchSimulado.mock.calls[0]!;
    expect(ruta).toBe(`/api/addresses/${DIRECCION.id}`);
    expect(opciones.method).toBe('PATCH');
  });
});

describe('Acciones de dirección (FR-015, FR-018, FR-019, FR-024)', () => {
  it('la predeterminada activa no ofrece "Marcar predeterminada"', () => {
    render(<AccionesDireccion direccion={DIRECCION} />);
    expect(screen.queryByRole('button', { name: 'Marcar predeterminada' })).not.toBeInTheDocument();
  });

  it('una activa no predeterminada ofrece marcarla como predeterminada', () => {
    render(<AccionesDireccion direccion={{ ...DIRECCION, isDefault: false }} />);
    expect(screen.getByRole('button', { name: 'Marcar predeterminada' })).toBeInTheDocument();
  });

  it('una dirección activa ofrece Desactivar; una desactivada ofrece Reactivar', () => {
    const { rerender } = render(<AccionesDireccion direccion={DIRECCION} />);
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivar' })).not.toBeInTheDocument();

    rerender(<AccionesDireccion direccion={{ ...DIRECCION, active: false, isDefault: false }} />);
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });

  it('eliminar una dirección en uso muestra MSG_DIRECCION_EN_USO dentro del diálogo, sin cerrarlo', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: { code: 'ADDRESS_IN_USE', message: MSG_DIRECCION_EN_USO },
      }),
    );
    render(<AccionesDireccion direccion={DIRECCION} />);

    await usuario.click(screen.getByRole('button', { name: 'Eliminar' }));
    const dialogo = screen.getByRole('alertdialog');
    const confirmar = screen.getAllByRole('button', { name: 'Eliminar' });
    await usuario.click(confirmar[confirmar.length - 1]!);

    await waitFor(() => {
      expect(screen.getByTestId('aviso-rechazo')).toHaveTextContent(MSG_DIRECCION_EN_USO);
    });
    expect(dialogo).toBeInTheDocument();
  });

  it('desactivar cancelable: cancelar no llama a la API', async () => {
    const usuario = userEvent.setup();
    render(<AccionesDireccion direccion={DIRECCION} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});
