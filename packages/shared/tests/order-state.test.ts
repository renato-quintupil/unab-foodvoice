/**
 * Máquina de estados del pedido (Principio XII v2.0.0, FR-030, D-035).
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

describe('Los seis estados del Principio XII v2.0.0', () => {
  it('son exactamente esos seis, en ese orden, y ninguno más', () => {
    expect(Object.values(OrderStatus)).toEqual([...LINEA, OrderStatus.RECHAZADO]);
  });

  it('no existe ningún estado inventado fuera de los seis', () => {
    const valores = Object.values(OrderStatus) as string[];
    for (const inventado of ['cancelado', 'anulado', 'devuelto']) {
      expect(valores).not.toContain(inventado);
    }
  });
});

describe('Transiciones estrictamente lineales (salvo la rama de `creado`)', () => {
  it('cada estado avanza al siguiente y solo al siguiente', () => {
    for (let i = 0; i < LINEA.length - 1; i += 1) {
      const actual = LINEA[i]!;
      const siguiente = LINEA[i + 1]!;
      // `creado` es la única rama del contrato (RN-008): también puede ir a
      // `rechazado`, cubierto en su propio describe más abajo.
      if (actual !== OrderStatus.CREADO) {
        expect(transicionesValidas(actual)).toEqual([siguiente]);
      }
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

describe('Cobertura de los seis estados', () => {
  it('todos tienen una entrada declarada, aunque sea vacía', () => {
    for (const estado of Object.values(OrderStatus)) {
      expect(transicionesValidas(estado)).toBeDefined();
      expect(Array.isArray(transicionesValidas(estado))).toBe(true);
    }
  });
});

describe('`rechazado`, la rama agregada por E2 (FR-030, RN-008, RN-010)', () => {
  it('es alcanzable únicamente desde `creado`', () => {
    expect(esTransicionValida(OrderStatus.CREADO, OrderStatus.RECHAZADO)).toBe(true);
    for (const estado of LINEA) {
      if (estado === OrderStatus.CREADO) continue;
      expect(esTransicionValida(estado, OrderStatus.RECHAZADO)).toBe(false);
    }
  });

  it('es terminal: no tiene transiciones salientes', () => {
    expect(transicionesValidas(OrderStatus.RECHAZADO)).toEqual([]);
    for (const estado of Object.values(OrderStatus)) {
      expect(esTransicionValida(OrderStatus.RECHAZADO, estado)).toBe(false);
    }
  });

  it('`creado` sigue pudiendo ir a `en_preparacion`, sin que la rama nueva lo reemplace', () => {
    expect(transicionesValidas(OrderStatus.CREADO)).toEqual([
      OrderStatus.EN_PREPARACION,
      OrderStatus.RECHAZADO,
    ]);
  });

  it('ninguna de las cinco transiciones lineales originales cambió', () => {
    for (let i = 0; i < LINEA.length - 1; i += 1) {
      expect(esTransicionValida(LINEA[i]!, LINEA[i + 1]!)).toBe(true);
    }
  });
});
