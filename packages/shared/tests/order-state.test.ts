/**
 * Máquina de estados del pedido (T105, Principio XII, FR-023, D-012).
 */
import { describe, expect, it } from 'vitest';
import { OrderStatus } from '../src/enums/order-status';
import { esTransicionValida, transicionesValidas } from '../src/order-state/machine';

const LINEA: OrderStatus[] = [
  OrderStatus.CREADO,
  OrderStatus.EN_PREPARACION,
  OrderStatus.ASIGNADO_REPARTIDOR,
  OrderStatus.ENTREGADO,
  OrderStatus.CERRADO,
];

describe('Los cinco estados del Principio XII', () => {
  it('son exactamente esos cinco, en ese orden, y ninguno más', () => {
    expect(Object.values(OrderStatus)).toEqual(LINEA);
  });

  it('no existe estado de cancelación ni de rechazo (FR-023)', () => {
    const valores = Object.values(OrderStatus) as string[];
    for (const inventado of ['cancelado', 'rechazado', 'anulado', 'devuelto']) {
      expect(valores).not.toContain(inventado);
    }
  });
});

describe('Transiciones estrictamente lineales', () => {
  it('cada estado avanza al siguiente y solo al siguiente', () => {
    for (let i = 0; i < LINEA.length - 1; i += 1) {
      const actual = LINEA[i]!;
      const siguiente = LINEA[i + 1]!;
      expect(transicionesValidas(actual)).toEqual([siguiente]);
      expect(esTransicionValida(actual, siguiente)).toBe(true);
    }
  });

  it('no hay transiciones de retroceso', () => {
    // La linealidad estricta es lo que hace que el historial de trazabilidad
    // sea legible como una secuencia y no como un grafo.
    for (let i = 1; i < LINEA.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        expect(esTransicionValida(LINEA[i]!, LINEA[j]!)).toBe(false);
      }
    }
  });

  it('no hay saltos: `creado` no llega directo a `entregado`', () => {
    expect(esTransicionValida(OrderStatus.CREADO, OrderStatus.ENTREGADO)).toBe(false);
    expect(esTransicionValida(OrderStatus.CREADO, OrderStatus.CERRADO)).toBe(false);
  });

  it('ningún estado transiciona a sí mismo', () => {
    for (const estado of LINEA) {
      expect(esTransicionValida(estado, estado)).toBe(false);
    }
  });
});

describe('`cerrado` es terminal', () => {
  it('transicionesValidas(cerrado) devuelve el conjunto vacío', () => {
    expect(transicionesValidas(OrderStatus.CERRADO)).toEqual([]);
  });

  it('ningún estado es alcanzable desde `cerrado`', () => {
    for (const estado of LINEA) {
      expect(esTransicionValida(OrderStatus.CERRADO, estado)).toBe(false);
    }
  });
});

describe('Cobertura de los cinco estados', () => {
  it('todos tienen una entrada declarada, aunque sea vacía', () => {
    for (const estado of LINEA) {
      expect(transicionesValidas(estado)).toBeDefined();
      expect(Array.isArray(transicionesValidas(estado))).toBe(true);
    }
  });
});
