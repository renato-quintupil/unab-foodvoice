import { describe, expect, it } from 'vitest';
import { Role, UserStatus } from '../src/enums/role';
import { LoginSchema } from '../src/schemas/auth';
import { PasswordSchema } from '../src/schemas/password';
import {
  ChangeRoleSchema,
  ChangeStatusSchema,
  CreateUserSchema,
  ResetPasswordSchema,
  UpdateUserSchema,
} from '../src/schemas/user';

/** Devuelve el primer mensaje de error de un campo, o `undefined` si validó. */
function errorDe(resultado: { success: boolean; error?: unknown }, campo: string) {
  if (resultado.success) return undefined;
  const error = resultado.error as { issues: { path: (string | number)[]; message: string }[] };
  return error.issues.find((i) => i.path.join('.') === campo)?.message;
}

const usuarioValido = {
  fullName: 'María Pérez',
  email: 'maria.perez@ejemplo.cl',
  phone: '+56911112222',
  password: 'contrasena8',
  role: Role.CLIENTE,
};

describe('PasswordSchema (FR-032, SC-016, D-002)', () => {
  it('rechaza 7 caracteres y acepta 8', () => {
    expect(PasswordSchema.safeParse('1234567').success).toBe(false);
    expect(PasswordSchema.safeParse('12345678').success).toBe(true);
  });

  it('rechaza 73 caracteres y acepta 72', () => {
    expect(PasswordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(PasswordSchema.safeParse('a'.repeat(73)).success).toBe(false);
  });

  it('mide bytes UTF-8 y no caracteres: 40 acentuadas ocupan 80 bytes', () => {
    const acentuadas = 'á'.repeat(40);
    expect(acentuadas.length).toBeLessThan(72);
    expect(new TextEncoder().encode(acentuadas).length).toBeGreaterThan(72);
    expect(PasswordSchema.safeParse(acentuadas).success).toBe(false);
  });

  it('usa los mensajes en español exactos', () => {
    expect(errorDe(PasswordSchema.safeParse('corta'), '')).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
    expect(errorDe(PasswordSchema.safeParse('a'.repeat(73)), '')).toBe(
      'La contraseña no puede superar los 72 caracteres.',
    );
  });
});

describe('LoginSchema (FR-001, FR-008, security CHK017)', () => {
  it('normaliza el correo: recorta y pasa a minúsculas', () => {
    const resultado = LoginSchema.safeParse({
      email: '  MARIA.PEREZ@Ejemplo.CL  ',
      password: 'x',
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data.email).toBe('maria.perez@ejemplo.cl');
  });

  it('NO valida la longitud de la contraseña: una de un carácter es válida', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.cl', password: 'x' }).success).toBe(true);
  });

  it('exige que la contraseña no esté vacía, con mensaje en español', () => {
    const resultado = LoginSchema.safeParse({ email: 'a@b.cl', password: '' });
    expect(errorDe(resultado, 'password')).toBe('Debes ingresar tu contraseña.');
  });

  it('rechaza un correo con formato inválido, con mensaje en español', () => {
    const resultado = LoginSchema.safeParse({ email: 'no-es-correo', password: 'x' });
    expect(errorDe(resultado, 'email')).toBe('Debes ingresar un correo electrónico válido.');
  });
});

describe('CreateUserSchema (FR-009, FR-014, SC-005)', () => {
  it('acepta un usuario completo y normaliza el correo', () => {
    const resultado = CreateUserSchema.safeParse({
      ...usuarioValido,
      email: '  MARIA.PEREZ@Ejemplo.CL ',
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data.email).toBe('maria.perez@ejemplo.cl');
  });

  it('ningún campo obligatorio puede faltar', () => {
    for (const campo of ['fullName', 'email', 'phone', 'password', 'role'] as const) {
      const parcial = { ...usuarioValido };
      delete (parcial as Record<string, unknown>)[campo];
      expect(CreateUserSchema.safeParse(parcial).success, `falta ${campo}`).toBe(false);
    }
  });

  it('aplica los límites de la tabla de FR-014 con mensajes en español', () => {
    expect(errorDe(CreateUserSchema.safeParse({ ...usuarioValido, fullName: 'A' }), 'fullName')).toBe(
      'El nombre completo es obligatorio.',
    );
    expect(
      errorDe(CreateUserSchema.safeParse({ ...usuarioValido, fullName: 'a'.repeat(121) }), 'fullName'),
    ).toBe('El nombre completo es demasiado largo.');
    expect(errorDe(CreateUserSchema.safeParse({ ...usuarioValido, phone: '12345' }), 'phone')).toBe(
      'El teléfono es obligatorio.',
    );
    expect(
      errorDe(CreateUserSchema.safeParse({ ...usuarioValido, phone: '1'.repeat(21) }), 'phone'),
    ).toBe('El teléfono es demasiado largo.');
    expect(
      errorDe(
        CreateUserSchema.safeParse({
          ...usuarioValido,
          email: `${'a'.repeat(250)}@ejemplo.cl`,
        }),
        'email',
      ),
    ).toBe('El correo electrónico es demasiado largo.');
    expect(errorDe(CreateUserSchema.safeParse({ ...usuarioValido, role: 'JEFE' }), 'role')).toBe(
      'Debes seleccionar un rol válido.',
    );
  });

  it('acepta el rol ADMINISTRADOR (FR-009, RN-003)', () => {
    expect(
      CreateUserSchema.safeParse({ ...usuarioValido, role: Role.ADMINISTRADOR }).success,
    ).toBe(true);
  });
});

describe('UpdateUserSchema (FR-010, FR-014, security CHK003)', () => {
  it('acepta un subconjunto de los tres campos de contacto', () => {
    expect(UpdateUserSchema.safeParse({ phone: '+56999998888' }).success).toBe(true);
    expect(UpdateUserSchema.safeParse({ fullName: 'Ana Soto' }).success).toBe(true);
  });

  it('rechaza un cuerpo sin ningún campo', () => {
    const resultado = UpdateUserSchema.safeParse({});
    expect(resultado.success).toBe(false);
    expect(errorDe(resultado, '')).toBe('Debes modificar al menos un dato.');
  });

  it('descarta role, status y password: no son parte de la edición', () => {
    const resultado = UpdateUserSchema.safeParse({
      phone: '+56999998888',
      role: Role.ADMINISTRADOR,
      status: UserStatus.DESACTIVADO,
      password: 'otracosa1',
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({ phone: '+56999998888' });
  });

  it('produce EL MISMO resultado que CreateUserSchema sobre las mismas entradas inválidas', () => {
    const invalidas = [
      { campo: 'fullName', valor: 'A' },
      { campo: 'fullName', valor: 'a'.repeat(121) },
      { campo: 'email', valor: 'no-es-correo' },
      { campo: 'email', valor: `${'a'.repeat(250)}@ejemplo.cl` },
      { campo: 'phone', valor: '12345' },
      { campo: 'phone', valor: '1'.repeat(21) },
    ];

    for (const { campo, valor } of invalidas) {
      const enAlta = errorDe(CreateUserSchema.safeParse({ ...usuarioValido, [campo]: valor }), campo);
      const enEdicion = errorDe(UpdateUserSchema.safeParse({ [campo]: valor }), campo);
      expect(enEdicion, `${campo} = ${valor}`).toBe(enAlta);
      expect(enEdicion).toBeDefined();
    }
  });
});

describe('ChangeRoleSchema, ChangeStatusSchema y ResetPasswordSchema', () => {
  it('ChangeRoleSchema acepta los cuatro roles y rechaza cualquier otro', () => {
    for (const rol of Object.values(Role)) {
      expect(ChangeRoleSchema.safeParse({ role: rol }).success).toBe(true);
    }
    expect(errorDe(ChangeRoleSchema.safeParse({ role: 'JEFE' }), 'role')).toBe(
      'Debes seleccionar un rol válido.',
    );
  });

  it('ChangeStatusSchema acepta los dos estados y rechaza cualquier otro', () => {
    for (const estado of Object.values(UserStatus)) {
      expect(ChangeStatusSchema.safeParse({ status: estado }).success).toBe(true);
    }
    expect(errorDe(ChangeStatusSchema.safeParse({ status: 'BORRADO' }), 'status')).toBe(
      'Debes seleccionar un estado válido.',
    );
  });

  it('ResetPasswordSchema reutiliza PasswordSchema', () => {
    expect(ResetPasswordSchema.safeParse({ password: '1234567' }).success).toBe(false);
    expect(ResetPasswordSchema.safeParse({ password: '12345678' }).success).toBe(true);
    expect(errorDe(ResetPasswordSchema.safeParse({ password: 'corta' }), 'password')).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });
});
