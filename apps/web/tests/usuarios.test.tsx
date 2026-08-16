/**
 * Listado y formularios de usuarios (T104, FR-035, FR-037, SC-019, SC-037,
 * SC-039).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MSG_CORREO_YA_EXISTE,
  MSG_ERROR_INESPERADO,
  MSG_EXITO,
  MSG_SIN_RESULTADOS_USUARIOS,
  Role,
  UserStatus,
  type UserDto,
} from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccionesUsuario } from '@/app/admin/usuarios/_components/acciones-usuario';
import { SinResultados } from '@/app/admin/usuarios/_components/sin-resultados';
import { FormularioAlta } from '@/app/admin/usuarios/nuevo/formulario-alta';
import { FormularioEdicion } from '@/app/admin/usuarios/[id]/editar/formulario-edicion';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

const USUARIO: UserDto = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'María Pérez',
  email: 'maria.perez@ejemplo.cl',
  phone: '+56911112222',
  role: Role.CLIENTE,
  status: UserStatus.ACTIVO,
  createdAt: '2026-08-15T12:00:00.000Z',
};

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
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as Response;
}

describe('Estado vacío del listado (FR-015, SC-020)', () => {
  it('muestra el mensaje en español y ofrece volver a la primera página', () => {
    render(<SinResultados />);
    expect(screen.getByText(MSG_SIN_RESULTADOS_USUARIOS)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /primera página/i })).toBeInTheDocument();
  });
});

describe('Formulario de alta (FR-009, FR-014, SC-005)', () => {
  it('presenta los cinco campos obligatorios con etiqueta en español', () => {
    render(<FormularioAlta />);
    for (const etiqueta of ['Nombre completo', 'Correo electrónico', 'Teléfono', 'Contraseña', 'Rol']) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
    }
  });

  it('muestra la contraseña mientras se escribe: hay que poder anotarla', () => {
    render(<FormularioAlta />);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
  });

  it('rechaza el envío incompleto con los mensajes del paquete compartido', async () => {
    const usuario = userEvent.setup();
    render(<FormularioAlta />);

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('El nombre completo es obligatorio.')).toBeVisible();
    expect(screen.getByText('El teléfono es obligatorio.')).toBeVisible();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('muestra el aviso de éxito nombrando al afectado (FR-037, SC-037)', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(201, USUARIO));
    render(<FormularioAlta />);

    await usuario.type(screen.getByLabelText('Nombre completo'), 'María Pérez');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria.perez@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Teléfono'), '+56911112222');
    await usuario.type(screen.getByLabelText('Contraseña'), 'contrasena8');
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    const aviso = await screen.findByTestId('aviso-exito');
    expect(aviso).toHaveTextContent(MSG_EXITO.CREAR('María Pérez'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('presenta un 409 del servidor junto al campo que no podía anticipar', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: MSG_CORREO_YA_EXISTE,
          fields: { email: MSG_CORREO_YA_EXISTE },
        },
      }),
    );
    render(<FormularioAlta />);

    await usuario.type(screen.getByLabelText('Nombre completo'), 'María Pérez');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria.perez@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Teléfono'), '+56911112222');
    await usuario.type(screen.getByLabelText('Contraseña'), 'contrasena8');
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText(MSG_CORREO_YA_EXISTE)).toBeVisible();
    // Y conserva lo que la persona escribió.
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('María Pérez');
  });

  it('inutiliza el control mientras la acción está en curso (SC-039)', async () => {
    const usuario = userEvent.setup();
    let resolver: (r: Response) => void = () => undefined;
    fetchSimulado.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolver = resolve;
      }),
    );
    render(<FormularioAlta />);

    await usuario.type(screen.getByLabelText('Nombre completo'), 'María Pérez');
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'maria.perez@ejemplo.cl');
    await usuario.type(screen.getByLabelText('Teléfono'), '+56911112222');
    await usuario.type(screen.getByLabelText('Contraseña'), 'contrasena8');
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    const boton = await screen.findByRole('button', { name: 'Creando…' });
    expect(boton).toBeDisabled();
    await usuario.click(boton);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);

    resolver(respuesta(201, USUARIO));
  });
});

describe('Formulario de edición (FR-010, api CHK031)', () => {
  it('llega con los datos actuales cargados', () => {
    render(<FormularioEdicion usuario={USUARIO} />);
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('María Pérez');
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('maria.perez@ejemplo.cl');
  });

  it('no ofrece cambiar rol, estado ni contraseña: son acciones con endpoint propio', () => {
    render(<FormularioEdicion usuario={USUARIO} />);
    expect(screen.queryByLabelText('Rol')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });

  it('muestra un 409 de autoprotección como aviso sobre el formulario', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(409, {
        error: { code: 'SELF_PROTECTION', message: 'No puedes desactivar tu propia cuenta.' },
      }),
    );
    render(<FormularioEdicion usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No puedes desactivar tu propia cuenta.',
    );
  });
});

describe('Confirmación antes de las acciones de impacto (FR-035, SC-019, ux CHK020)', () => {
  it('cancelar NO dispara ninguna llamada', async () => {
    const usuario = userEvent.setup();
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('el diálogo indica a quién afecta y qué efecto tiene', async () => {
    const usuario = userEvent.setup();
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');

    // El título nombra a quién afecta y la descripción, qué efecto tiene.
    expect(within(dialogo).getByRole('heading')).toHaveTextContent('María Pérez');
    expect(within(dialogo).getByText(/dejará de poder iniciar sesión/i)).toHaveTextContent(
      'María Pérez',
    );
  });

  it('declara que la desactivación SÍ se puede deshacer', async () => {
    const usuario = userEvent.setup();
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');

    expect(within(dialogo).getByText(/puedes deshacer esta acción/i)).toBeInTheDocument();
  });

  it('declara que el restablecimiento de contraseña NO se puede deshacer', async () => {
    const usuario = userEvent.setup();
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    const dialogo = await screen.findByRole('alertdialog');

    expect(within(dialogo).getByText(/no se puede deshacer/i)).toBeInTheDocument();
    expect(within(dialogo).getByText(/no volverá a mostrarse/i)).toBeInTheDocument();
  });

  it('confirmar ejecuta la acción y muestra el aviso de éxito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(respuesta(200, USUARIO));
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByTestId('aviso-exito')).toHaveTextContent(
      MSG_EXITO.DESACTIVAR('María Pérez'),
    );
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('un usuario desactivado ofrece «Reactivar» y no «Desactivar»', () => {
    render(<AccionesUsuario usuario={{ ...USUARIO, status: UserStatus.DESACTIVADO }} />);
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });

  it('el fallo de una acción muestra el error y NO el aviso de éxito', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'No pudimos completar.' } }),
    );
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos completar.');
    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });
});

describe('Cada error queda asociado a su campo (T133, FR-039c, SC-038)', () => {
  /**
   * No basta con que el mensaje se vea debajo del control: FR-039 exige que
   * **quede asociado a ese campo y no suelto en la página**, que es lo que
   * decide si quien no ve la pantalla se entera de por qué falló su campo al
   * enfocarlo. Se comprueba siguiendo el `aria-describedby` hasta el elemento
   * que realmente contiene el mensaje.
   */
  function mensajeAsociadoA(control: HTMLElement): string | null {
    const id = control.getAttribute('aria-describedby');
    if (!id) return null;
    return document.getElementById(id)?.textContent ?? null;
  }

  it('el alta asocia el error de cada uno de sus campos', async () => {
    const usuario = userEvent.setup();
    render(<FormularioAlta />);

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    for (const etiqueta of ['Nombre completo', 'Correo electrónico', 'Teléfono', 'Contraseña']) {
      const control = await screen.findByLabelText(etiqueta);
      await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'));
      expect(mensajeAsociadoA(control)).toBeTruthy();
    }
  });

  it('la edición asocia el error de cada uno de sus campos', async () => {
    const usuario = userEvent.setup();
    render(<FormularioEdicion usuario={USUARIO} />);

    await usuario.clear(screen.getByLabelText('Correo electrónico'));
    await usuario.type(screen.getByLabelText('Correo electrónico'), 'no-es-un-correo');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const control = screen.getByLabelText('Correo electrónico');
    await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'));
    expect(mensajeAsociadoA(control)).toBeTruthy();
  });

  it('sin error, el campo no arrastra ningún atributo que anunciar', () => {
    render(<FormularioEdicion usuario={USUARIO} />);
    const control = screen.getByLabelText('Correo electrónico');
    expect(control).not.toHaveAttribute('aria-invalid');
    expect(control).not.toHaveAttribute('aria-describedby');
  });
});

describe('Un rechazo no cierra el diálogo (T135, FR-030, FR-032, FR-039c)', () => {
  it('la contraseña fuera de rango deja el diálogo abierto, con el mensaje en su campo', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'La contraseña debe tener al menos 8 caracteres.',
          fields: { password: 'La contraseña debe tener al menos 8 caracteres.' },
        },
      }),
    );
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.type(within(dialogo).getByLabelText('Nueva contraseña'), 'corta');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Restablecer' }));

    // Sigue abierto: es donde está el campo que hay que corregir.
    const sigueAbierto = await screen.findByRole('alertdialog');
    const campo = within(sigueAbierto).getByLabelText('Nueva contraseña');

    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'));
    const idDelError = campo.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(idDelError)).toHaveTextContent(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    // Y lo que la persona escribió sigue ahí: no hay que reescribirlo.
    expect(campo).toHaveValue('corta');
    expect(screen.queryByTestId('aviso-exito')).not.toBeInTheDocument();
  });

  it('un fallo del sistema deja el diálogo abierto con el aviso dentro', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'No pudimos completar.' } }),
    );
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    const sigueAbierto = await screen.findByRole('alertdialog');
    expect(within(sigueAbierto).getByTestId('aviso-rechazo')).toHaveTextContent(
      'No pudimos completar.',
    );
  });

  it('el aviso de rechazo solo aparece en el diálogo que lo produjo', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockResolvedValue(
      respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'No pudimos completar.' } }),
    );
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    await usuario.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desactivar' }),
    );
    await screen.findByTestId('aviso-rechazo');

    // Al cerrar, el mensaje se va con él: no queda colgando en la vista.
    await usuario.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }),
    );
    await waitFor(() => expect(screen.queryByTestId('aviso-rechazo')).not.toBeInTheDocument());

    await usuario.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    const otroDialogo = await screen.findByRole('alertdialog');
    expect(within(otroDialogo).queryByTestId('aviso-rechazo')).not.toBeInTheDocument();
  });

  it('un fallo sin respuesta de la API usa el mensaje compartido, no un literal recortado', async () => {
    const usuario = userEvent.setup();
    fetchSimulado.mockRejectedValue(new Error('sin red'));
    render(<AccionesUsuario usuario={USUARIO} />);

    await usuario.click(screen.getByRole('button', { name: 'Desactivar' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByTestId('aviso-rechazo')).toHaveTextContent(MSG_ERROR_INESPERADO);
  });
});
