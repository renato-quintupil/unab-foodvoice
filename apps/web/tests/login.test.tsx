/**
 * Pantalla de inicio de sesión (T076, FR-001, FR-026, FR-038, FR-039).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MSG_CONTRASENA_OLVIDADA,
  MSG_CREDENCIALES_INVALIDAS,
  MSG_CUENTA_BLOQUEADA,
} from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormularioLogin } from '@/app/login/formulario-login';

const push = vi.fn();
let parametros = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => parametros,
}));

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockClear();
  parametros = new URLSearchParams();
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
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

describe('Campos y accesibilidad (FR-039)', () => {
  it('cada campo tiene su etiqueta asociada, en español', () => {
    render(<FormularioLogin />);
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('muestra el aviso de contraseña olvidada ANTES de cualquier intento (FR-026, A14)', () => {
    render(<FormularioLogin />);
    expect(screen.getByText(MSG_CONTRASENA_OLVIDADA)).toBeInTheDocument();
  });

  it('no ofrece ningún enlace de recuperación que prometa un flujo inexistente', () => {
    render(<FormularioLogin />);
    expect(screen.queryByRole('link', { name: /olvid/i })).not.toBeInTheDocument();
  });
});

describe('Validación en el navegador (FR-014, SC-005)', () => {
  it('exige ambos campos con los mensajes en español del paquete compartido', async () => {
    const usuario = userEvent.setup();
    render(<FormularioLogin />);

    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Debes ingresar un correo electrónico válido.')).toBeVisible();
    expect(await screen.findByText('Debes ingresar tu contraseña.')).toBeVisible();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('asocia el error al campo mediante aria-describedby', async () => {
    const usuario = userEvent.setup();
    render(<FormularioLogin />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'no-es-correo');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const campo = await screen.findByLabelText('Correo electrónico');
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'));
    expect(campo).toHaveAttribute('aria-describedby', 'error-email');
  });
});

describe('Respuesta del servidor', () => {
  it('lleva al destino del rol tras un inicio de sesión correcto (FR-031)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(200, { user: { role: 'CLIENTE' }, redirectTo: '/cliente' }),
    );
    render(<FormularioLogin />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'contrasena8');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/cliente'));
  });

  it('muestra el error sobre el formulario y NO junto a un campo (FR-008)', async () => {
    // Indicar cuál de los dos campos falló revelaría si el correo existe.
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(401, {
        error: { code: 'INVALID_CREDENTIALS', message: MSG_CREDENCIALES_INVALIDAS },
      }),
    );
    render(<FormularioLogin />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(MSG_CREDENCIALES_INVALIDAS);
    expect(screen.getByLabelText('Correo electrónico')).not.toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('conserva lo que la persona escribió tras un fallo (ux CHK008)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(401, { error: { message: MSG_CREDENCIALES_INVALIDAS } }),
    );
    render(<FormularioLogin />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('maria@ejemplo.cl');
  });

  it('muestra el mensaje de bloqueo temporal tal como llega (FR-033, SC-018)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(423, { error: { code: 'ACCOUNT_LOCKED', message: MSG_CUENTA_BLOQUEADA } }),
    );
    render(<FormularioLogin />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'contrasena8');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(MSG_CUENTA_BLOQUEADA);
  });
});

describe('Estado de carga (FR-038, SC-039)', () => {
  it('inutiliza el botón mientras la acción está en curso', async () => {
    const usuario = userEvent.setup();
    let resolver: (r: Response) => void = () => undefined;
    fetchSimulado.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolver = resolve;
      }),
    );
    render(<FormularioLogin />);

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Contraseña'), 'contrasena8');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const boton = await screen.findByRole('button', { name: 'Ingresando…' });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');

    // Un segundo clic no produce una segunda petición.
    await usuario.click(boton);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);

    resolver(respuesta(200, { user: {}, redirectTo: '/cliente' }));
  });
});

describe('Aviso de sesión expirada (FR-005, FR-006, A16)', () => {
  it('muestra el aviso que llega por la URL tras una expiración', () => {
    parametros = new URLSearchParams({ aviso: 'Tu sesión expiró.' });
    render(<FormularioLogin />);
    expect(screen.getByTestId('aviso-sesion')).toHaveTextContent('Tu sesión expiró.');
  });

  it('tras un cierre voluntario no muestra ningún aviso', () => {
    parametros = new URLSearchParams();
    render(<FormularioLogin />);
    expect(screen.queryByTestId('aviso-sesion')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
