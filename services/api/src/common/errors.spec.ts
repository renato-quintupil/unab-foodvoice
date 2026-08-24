/**
 * Catálogo cerrado de errores (T031, api CHK016, Principio II).
 */
import {
  MSG_AUTOPROTECCION,
  MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES,
  MSG_CARRITO_DESACTUALIZADO,
  MSG_CARRITO_VACIO,
  MSG_CORREO_YA_EXISTE,
  MSG_CREDENCIALES_INVALIDAS,
  MSG_CUENTA_BLOQUEADA,
  MSG_DIRECCION_EN_USO,
  MSG_DIRECCION_ELIGE_NUEVA_PREDETERMINADA,
  MSG_DIRECCION_ETIQUETA_DUPLICADA,
  MSG_DIRECCION_REQUERIDA,
  MSG_ERROR_INESPERADO,
  MSG_PEDIDO_NO_PENDIENTE,
  MSG_PRECIO_CAMBIO,
  MSG_SESION_EXPIRADA,
  MSG_SIN_PERMISO,
  MSG_LIMITE_BUSQUEDAS,
  MSG_BUSQUEDA_NO_DISPONIBLE,
} from '@foodvoice/shared';
import {
  autoproteccion,
  busquedaNoDisponible,
  carritoConLineasNoDisponibles,
  carritoDesactualizado,
  carritoVacio,
  correoYaExiste,
  credencialesInvalidas,
  cuentaBloqueada,
  cuerpoDemasiadoGrande,
  demasiadasBusquedas,
  direccionEnUso,
  direccionNecesitaNuevaPredeterminada,
  direccionRequerida,
  ErrorCode,
  etiquetaDireccionYaExiste,
  noEncontrado,
  pedidoNoPendiente,
  precioCambio,
  sesionInvalida,
  sinPermiso,
} from './errors';

describe('Catálogo cerrado (contracts/api.md)', () => {
  it('declara los veinticinco códigos y ninguno más', () => {
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
        // Los cuatro que suma E3 (contracts/api.md § Códigos de error nuevos).
        'CATEGORY_NAME_ALREADY_EXISTS',
        'PRODUCT_NAME_ALREADY_EXISTS',
        'CATEGORY_IN_USE',
        'CATEGORY_INACTIVE',
        // Los ocho que suma E2 (contracts/api.md § Códigos de error que E2 añade).
        'CART_EMPTY',
        'CART_HAS_UNAVAILABLE_LINES',
        'PRICE_CHANGED',
        'ADDRESS_REQUIRED',
        'ADDRESS_LABEL_ALREADY_EXISTS',
        'ADDRESS_NEEDS_NEW_DEFAULT',
        'ADDRESS_IN_USE',
        'ORDER_NOT_PENDING',
        // Los dos que suma E6 (contracts/api.md § Códigos de error que E6 añade).
        'TOO_MANY_REQUESTS',
        'SEARCH_UNAVAILABLE',
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
    { crear: carritoVacio, status: 409, code: 'CART_EMPTY', mensaje: MSG_CARRITO_VACIO },
    {
      crear: carritoConLineasNoDisponibles,
      status: 409,
      code: 'CART_HAS_UNAVAILABLE_LINES',
      mensaje: MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES,
    },
    { crear: precioCambio, status: 409, code: 'PRICE_CHANGED', mensaje: MSG_PRECIO_CAMBIO },
    {
      crear: carritoDesactualizado,
      status: 400,
      code: 'VALIDATION_ERROR',
      mensaje: MSG_CARRITO_DESACTUALIZADO,
    },
    { crear: direccionRequerida, status: 409, code: 'ADDRESS_REQUIRED', mensaje: MSG_DIRECCION_REQUERIDA },
    {
      crear: etiquetaDireccionYaExiste,
      status: 409,
      code: 'ADDRESS_LABEL_ALREADY_EXISTS',
      mensaje: MSG_DIRECCION_ETIQUETA_DUPLICADA,
    },
    {
      crear: direccionNecesitaNuevaPredeterminada,
      status: 409,
      code: 'ADDRESS_NEEDS_NEW_DEFAULT',
      mensaje: MSG_DIRECCION_ELIGE_NUEVA_PREDETERMINADA,
    },
    { crear: direccionEnUso, status: 409, code: 'ADDRESS_IN_USE', mensaje: MSG_DIRECCION_EN_USO },
    { crear: pedidoNoPendiente, status: 409, code: 'ORDER_NOT_PENDING', mensaje: MSG_PEDIDO_NO_PENDIENTE },
    { crear: demasiadasBusquedas, status: 429, code: 'TOO_MANY_REQUESTS', mensaje: MSG_LIMITE_BUSQUEDAS },
    {
      crear: busquedaNoDisponible,
      status: 503,
      code: 'SEARCH_UNAVAILABLE',
      mensaje: MSG_BUSQUEDA_NO_DISPONIBLE,
    },
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

describe('El 409 de etiqueta de dirección duplicada sitúa el mensaje junto al campo (FR-014)', () => {
  it('lleva `fields.label`', () => {
    expect(etiquetaDireccionYaExiste().fields).toEqual({ label: MSG_DIRECCION_ETIQUETA_DUPLICADA });
  });
});
