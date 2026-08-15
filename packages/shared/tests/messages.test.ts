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

describe('Mensajes fijos en español (FR-008, SC-018, api CHK015)', () => {
  it('los doce existen y no están vacíos', () => {
    for (const nombre of LOS_DOCE) {
      const texto = mensajes[nombre];
      expect(typeof texto, nombre).toBe('string');
      expect(texto.trim().length, nombre).toBeGreaterThan(0);
    }
  });

  it('el archivo declara exactamente esos doce y ninguno más', () => {
    expect(Object.keys(mensajes).sort()).toEqual([...LOS_DOCE].sort());
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

  it('los cinco estados de pedido tienen etiqueta', () => {
    for (const estado of Object.values(OrderStatus)) {
      expect(ETIQUETA_ESTADO_PEDIDO[estado]).toBeTruthy();
    }
    expect(Object.keys(ETIQUETA_ESTADO_PEDIDO)).toHaveLength(5);
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
