/**
 * Catálogo cerrado de errores (T031, api CHK016, Principio II).
 */
import {
  MSG_AUTOPROTECCION,
  MSG_CORREO_YA_EXISTE,
  MSG_CREDENCIALES_INVALIDAS,
  MSG_CUENTA_BLOQUEADA,
  MSG_ERROR_INESPERADO,
  MSG_SESION_EXPIRADA,
  MSG_SIN_PERMISO,
} from '@foodvoice/shared';
import {
  autoproteccion,
  correoYaExiste,
  credencialesInvalidas,
  cuentaBloqueada,
  cuerpoDemasiadoGrande,
  ErrorCode,
  noEncontrado,
  sesionInvalida,
  sinPermiso,
} from './errors';

describe('Catálogo cerrado (contracts/api.md)', () => {
  it('declara los once códigos y ninguno más', () => {
    expect(Object.keys(ErrorCode).sort()).toEqual(
      [
        'VALIDATION_ERROR',
        'UNAUTHENTICATED',
        'INVALID_CREDENTIALS',
        'FORBIDDEN',
        'NOT_FOUND',
        'EMAIL_ALREADY_EXISTS',
        'SELF_PROTECTION',
        'PAYLOAD_TOO_LARGE',
        'ACCOUNT_LOCKED',
        'INTERNAL_ERROR',
        'UPSTREAM_UNAVAILABLE',
      ].sort(),
    );
  });
});

describe('Cada error lleva su código, su estado y su mensaje en español', () => {
  const CASOS = [
    { crear: credencialesInvalidas, status: 401, code: 'INVALID_CREDENTIALS', mensaje: MSG_CREDENCIALES_INVALIDAS },
    { crear: cuentaBloqueada, status: 423, code: 'ACCOUNT_LOCKED', mensaje: MSG_CUENTA_BLOQUEADA },
    { crear: sesionInvalida, status: 401, code: 'UNAUTHENTICATED', mensaje: MSG_SESION_EXPIRADA },
    { crear: sinPermiso, status: 403, code: 'FORBIDDEN', mensaje: MSG_SIN_PERMISO },
    { crear: noEncontrado, status: 404, code: 'NOT_FOUND', mensaje: MSG_ERROR_INESPERADO },
    { crear: correoYaExiste, status: 409, code: 'EMAIL_ALREADY_EXISTS', mensaje: MSG_CORREO_YA_EXISTE },
    { crear: autoproteccion, status: 409, code: 'SELF_PROTECTION', mensaje: MSG_AUTOPROTECCION },
    { crear: cuerpoDemasiadoGrande, status: 413, code: 'PAYLOAD_TOO_LARGE', mensaje: MSG_ERROR_INESPERADO },
  ];

  it.each(CASOS)('$code', ({ crear, status, code, mensaje }) => {
    const error = crear();
    expect(error.getStatus()).toBe(status);
    expect(error.code).toBe(code);
    expect(error.mensaje).toBe(mensaje);
  });

  it('ningún mensaje visible filtra detalles técnicos', () => {
    for (const { crear } of CASOS) {
      const texto = crear().mensaje;
      expect(texto).not.toMatch(/prisma|postgres|sql|constraint|stack|undefined|null/i);
      // Y todos van en español: llevan al menos un signo de puntuación final.
      expect(texto).toMatch(/[.!?]$/);
    }
  });
});

describe('El 423 no revela cuánto falta (api CHK010, SC-018)', () => {
  it('no lleva `fields` ni ningún dato del tiempo restante', () => {
    const error = cuentaBloqueada();
    expect(error.fields).toBeUndefined();
    expect(error.mensaje).not.toMatch(/restante|quedan|faltan/i);
  });
});

describe('El 409 de correo duplicado sitúa el mensaje junto al campo', () => {
  it('lleva `fields.email`, para que la interfaz pueda mostrarlo donde toca', () => {
    expect(correoYaExiste().fields).toEqual({ email: MSG_CORREO_YA_EXISTE });
  });
});
