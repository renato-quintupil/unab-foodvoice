/**
 * Máquina de estados del pedido (Principio XII v3.0.0, FR-030, D-035).
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

describe('Transiciones estrictamente lineales (salvo `creado` y el retroceso de reparto)', () => {
  it('cada estado avanza al siguiente y solo al siguiente', () => {
    for (let i = 0; i < LINEA.length - 1; i += 1) {
      const actual = LINEA[i]!;
      const siguiente = LINEA[i + 1]!;
      // `creado` es la única rama de avance del contrato (RN-008): también
      // puede ir a `rechazado`. `asignado_repartidor` es la única con una
      // transición de retroceso (enmienda 3.0.0). Ambas se cubren en sus
      // propios describe más abajo.
      if (actual !== OrderStatus.CREADO && actual !== OrderStatus.ASIGNADO_REPARTIDOR) {
        expect(transicionesValidas(actual)).toEqual([siguiente]);
      }
      expect(esTransicionValida(actual, siguiente)).toBe(true);
    }
  });

  it('no hay transiciones de retroceso, salvo la única excepción de reparto', () => {
    // La linealidad estricta es lo que hace que el historial de trazabilidad
    // sea legible como una secuencia casi lineal, con una única excepción
    // documentada (E5, enmienda constitucional 3.0.0).
    for (let i = 1; i < LINEA.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        const actual = LINEA[i]!;
        const destino = LINEA[j]!;
        const esLaExcepcionDeReparto =
          actual === OrderStatus.ASIGNADO_REPARTIDOR && destino === OrderStatus.EN_PREPARACION;
        expect(esTransicionValida(actual, destino)).toBe(esLaExcepcionDeReparto);
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

describe('`asignado_repartidor → en_preparacion`, el retroceso agregado por E5 (enmienda 3.0.0)', () => {
  it('es la única transición de retroceso de toda la máquina', () => {
    expect(esTransicionValida(OrderStatus.ASIGNADO_REPARTIDOR, OrderStatus.EN_PREPARACION)).toBe(
      true,
    );
  });

  it('`asignado_repartidor` conserva también su transición de avance hacia `entregado`', () => {
    expect(transicionesValidas(OrderStatus.ASIGNADO_REPARTIDOR)).toEqual([
      OrderStatus.EN_PREPARACION,
      OrderStatus.ENTREGADO,
    ]);
  });

  it('no habilita ningún otro retroceso: `en_preparacion` no puede volver a `creado`', () => {
    expect(esTransicionValida(OrderStatus.EN_PREPARACION, OrderStatus.CREADO)).toBe(false);
  });

  it('`entregado` sigue sin volver a `en_preparacion` ni a `asignado_repartidor`', () => {
    expect(esTransicionValida(OrderStatus.ENTREGADO, OrderStatus.EN_PREPARACION)).toBe(false);
    expect(esTransicionValida(OrderStatus.ENTREGADO, OrderStatus.ASIGNADO_REPARTIDOR)).toBe(
      false,
    );
  });
});
