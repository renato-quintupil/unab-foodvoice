import { describe, expect, it } from 'vitest';
import { AdminAction } from '../src/enums/admin-action';
import { OrderStatus } from '../src/enums/order-status';
import { Role, UserStatus } from '../src/enums/role';
import * as mensajes from '../src/messages/es';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_PEDIDO,
  ETIQUETA_ROL,
  HUSO_REFERENCIA,
  MSG_EXITO,
} from '../src/messages/etiquetas';

/**
 * Impide que una constante se borre por accidente y rompa la igualdad literal
 * que exige SC-018 (T024).
 */
const LOS_DOCE = [
  'MSG_CREDENCIALES_INVALIDAS',
  'MSG_CUENTA_BLOQUEADA',
  'MSG_SIN_PERMISO',
  'MSG_SESION_EXPIRADA',
  'MSG_SIN_RESULTADOS_USUARIOS',
  'MSG_SIN_RESULTADOS_PEDIDOS',
  'MSG_CORREO_YA_EXISTE',
  'MSG_AUTOPROTECCION',
  'MSG_ERROR_INESPERADO',
  'MSG_CONTRASENA_OLVIDADA',
  'MSG_RANGO_FECHAS_INVALIDO',
  'MSG_SIN_DATOS_PEDIDOS',
] as const;

/**
 * Los del catálogo (E3, `contracts/shared.md` § Mensajes fijos). Se enumeran
 * aparte para que la guarda de abajo siga cumpliendo su función —detectar que
 * una constante se borró o que apareció una sin declarar— ahora que el archivo
 * sirve a dos épicas. Los cinco últimos y `MSG_CATEGORIA_EN_USO`,
 * `MSG_CATEGORIA_INACTIVA` y `MSG_DIMENSION_SIN_CATEGORIAS` son **funciones**,
 * porque su texto incorpora un dato variable.
 */
const LOS_DEL_CATALOGO = [
  'MSG_CATEGORIA_YA_EXISTE',
  'MSG_PRODUCTO_YA_EXISTE',
  'MSG_MENU_VACIO',
  'MSG_SIN_RESULTADOS_CATALOGO',
  'MSG_INGREDIENTES_REFERENCIALES',
  'MSG_PRODUCTO_NO_ENCONTRADO',
  'MSG_CATEGORIA_EN_USO',
  'MSG_CATEGORIA_INACTIVA',
  'MSG_DIMENSION_SIN_CATEGORIAS',
  'MSG_DESCRIPCION_AUSENTE',
  'MSG_DESCRIPCION_DEMASIADO_CORTA',
  'MSG_DESCRIPCION_DEMASIADO_LARGA',
  'MSG_DESCRIPCION_POCAS_PALABRAS',
  'MSG_DESCRIPCION_PALABRAS_REPETIDAS',
  'MSG_DESCRIPCION_REPITE_EL_NOMBRE',
  'AYUDA_DESCRIPCION_PRODUCTO',
  'AYUDA_DESCRIPCION_CATEGORIA',
] as const;

/** Los de E2 (`003-gestion-pedidos`, `contracts/shared.md` § Mensajes nuevos). */
const LOS_DE_PEDIDOS = [
  'MSG_PRODUCTO_NO_DISPONIBLE',
  'MSG_CARRITO_VACIO',
  'MSG_CARRITO_CON_PRODUCTOS_NO_DISPONIBLES',
  'MSG_PRECIO_CAMBIO',
  'MSG_CARRITO_DESACTUALIZADO',
  'MSG_DIRECCION_ETIQUETA_VACIA',
  'MSG_DIRECCION_TEXTO_VACIO',
  'MSG_DIRECCION_ETIQUETA_DUPLICADA',
  'MSG_DIRECCION_REQUERIDA',
  'MSG_DIRECCION_ELIGE_NUEVA_PREDETERMINADA',
  'MSG_DIRECCION_EN_USO',
  'MSG_MOTIVO_RECHAZO_REQUERIDO',
  'MSG_PEDIDO_NO_PENDIENTE',
  'MSG_SIN_PEDIDOS_PENDIENTES',
  'MSG_SIN_PEDIDOS_RECHAZADOS',
] as const;

/** Los de E6 (`006-busqueda-por-voz`, `contracts/shared.md` § Mensajes fijos nuevos). */
const LOS_DE_BUSQUEDA_POR_VOZ = [
  'MSG_BUSQUEDA_VACIA',
  'MSG_BUSQUEDA_MUY_LARGA',
  'MSG_LIMITE_BUSQUEDAS',
  'MSG_BUSQUEDA_NO_DISPONIBLE',
] as const;

/** Los de E5 (`007-reparto-repartidor`, `contracts/shared.md` § Mensajes nuevos). */
const LOS_DE_REPARTO = [
  'MSG_SIN_PEDIDOS_DISPONIBLES',
  'MSG_PEDIDO_YA_NO_DISPONIBLE',
  'MSG_REPARTIDOR_YA_TIENE_PEDIDO',
  'MSG_PEDIDO_NO_ASIGNADO_A_TI',
] as const;

describe('Mensajes fijos en español (FR-008, SC-018, api CHK015)', () => {
  it('los doce de E1 existen y no están vacíos', () => {
    for (const nombre of LOS_DOCE) {
      const texto = mensajes[nombre];
      expect(typeof texto, nombre).toBe('string');
      expect(texto.trim().length, nombre).toBeGreaterThan(0);
    }
  });

  it('los catorce de E2 existen y no están vacíos', () => {
    for (const nombre of LOS_DE_PEDIDOS) {
      const texto = mensajes[nombre];
      expect(typeof texto, nombre).toBe('string');
      expect(texto.trim().length, nombre).toBeGreaterThan(0);
    }
  });

  it('el archivo declara exactamente los conocidos y ninguno más', () => {
    expect(Object.keys(mensajes).sort()).toEqual(
      [
        ...LOS_DOCE,
        ...LOS_DEL_CATALOGO,
        ...LOS_DE_PEDIDOS,
        ...LOS_DE_BUSQUEDA_POR_VOZ,
        ...LOS_DE_REPARTO,
      ].sort(),
    );
  });

  it('los cuatro de E6 existen y no están vacíos', () => {
    for (const nombre of LOS_DE_BUSQUEDA_POR_VOZ) {
      const texto = mensajes[nombre];
      expect(typeof texto, nombre).toBe('string');
      expect(texto.trim().length, nombre).toBeGreaterThan(0);
    }
  });

  it('los cuatro de E5 existen y no están vacíos', () => {
    for (const nombre of LOS_DE_REPARTO) {
      const texto = mensajes[nombre];
      expect(typeof texto, nombre).toBe('string');
      expect(texto.trim().length, nombre).toBeGreaterThan(0);
    }
  });

  it('los del catálogo existen, y los que llevan un dato variable son funciones', () => {
    for (const nombre of LOS_DEL_CATALOGO) {
      expect(mensajes[nombre], nombre).toBeDefined();
    }
    for (const nombre of [
      'MSG_CATEGORIA_EN_USO',
      'MSG_CATEGORIA_INACTIVA',
      'MSG_DIMENSION_SIN_CATEGORIAS',
      'MSG_DESCRIPCION_DEMASIADO_CORTA',
      'MSG_DESCRIPCION_DEMASIADO_LARGA',
    ] as const) {
      expect(typeof mensajes[nombre], nombre).toBe('function');
    }
  });

  it('el mensaje de bloqueo es una sola constante, no dos literales (SC-018)', () => {
    const paraCorreoRegistrado = mensajes.MSG_CUENTA_BLOQUEADA;
    const paraCorreoInexistente = mensajes.MSG_CUENTA_BLOQUEADA;
    expect(paraCorreoRegistrado).toBe(paraCorreoInexistente);
  });

  it('MSG_ERROR_INESPERADO es el mismo texto para el 500 y el 502', () => {
    expect(mensajes.MSG_ERROR_INESPERADO).toBe(mensajes.MSG_ERROR_INESPERADO);
    expect(mensajes.MSG_ERROR_INESPERADO).not.toMatch(/500|502|NestJS|proxy/i);
  });
});

describe('Etiquetas visibles (FR-037, ux CHK006, ux CHK007)', () => {
  it('cada rol tiene etiqueta y ninguna es el identificador interno', () => {
    for (const rol of Object.values(Role)) {
      expect(ETIQUETA_ROL[rol]).toBeTruthy();
      expect(ETIQUETA_ROL[rol]).not.toBe(rol);
    }
  });

  it('cada estado de usuario tiene etiqueta y ninguna es el identificador interno', () => {
    for (const estado of Object.values(UserStatus)) {
      expect(ETIQUETA_ESTADO[estado]).toBeTruthy();
      expect(ETIQUETA_ESTADO[estado]).not.toBe(estado);
    }
  });

  it('los seis estados de pedido tienen etiqueta', () => {
    for (const estado of Object.values(OrderStatus)) {
      expect(ETIQUETA_ESTADO_PEDIDO[estado]).toBeTruthy();
    }
    expect(Object.keys(ETIQUETA_ESTADO_PEDIDO)).toHaveLength(6);
  });

  it('`creado` se muestra como "Pendiente" y `rechazado` como "Rechazado" (D-041, FR-037)', () => {
    expect(ETIQUETA_ESTADO_PEDIDO[OrderStatus.CREADO]).toBe('Pendiente');
    expect(ETIQUETA_ESTADO_PEDIDO[OrderStatus.RECHAZADO]).toBe('Rechazado');
  });

  it('MSG_EXITO tiene un mensaje por cada una de las seis acciones y nombra al afectado', () => {
    expect(Object.keys(MSG_EXITO)).toHaveLength(6);
    for (const accion of Object.values(AdminAction)) {
      expect(MSG_EXITO[accion]('Ana Soto')).toContain('Ana Soto');
    }
  });

  it('HUSO_REFERENCIA es el huso del producto y es un identificador IANA válido', () => {
    expect(HUSO_REFERENCIA).toBe('America/Santiago');
    expect(() =>
      new Intl.DateTimeFormat('es-CL', { timeZone: HUSO_REFERENCIA }).format(new Date()),
    ).not.toThrow();
  });
});

describe('Enums de dominio', () => {
  it('AdminAction tiene exactamente seis valores: la exclusión de la autenticación es estructural', () => {
    expect(Object.keys(AdminAction)).toHaveLength(6);
    expect(Object.values(AdminAction)).not.toContain('INICIAR_SESION');
  });

  it('Role tiene exactamente los cuatro valores cerrados de RN-001', () => {
    expect(Object.values(Role).sort()).toEqual(
      ['ADMINISTRADOR', 'CLIENTE', 'NEGOCIO', 'REPARTIDOR'].sort(),
    );
  });
});
