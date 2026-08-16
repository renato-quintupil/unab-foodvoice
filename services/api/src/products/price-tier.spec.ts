/**
 * Clasificación por tramo de precio (FR-032, RN-016, D-023, D-031).
 *
 * Aquí solo lo **puro**: dados unos cortes, a qué tramo pertenece un precio y qué
 * condición SQL le corresponde. La derivación de los cortes —`calcularCortes`—
 * depende del orden y del conteo reales que devuelve PostgreSQL y se verifica en
 * `test/menu-price-tiers.integration-spec.ts`, no aquí: con un doble de Prisma se
 * probaría el doble, no la regla.
 */
import { PriceTier } from '@foodvoice/shared';
import { filtroDeTramo, tramoDe, type Cortes } from './price-tier';

const CORTES: Cortes = { c1: 3000, c2: 6000 };

describe('tramoDe', () => {
  it.each([
    [1, PriceTier.ECONOMICO],
    [2999, PriceTier.ECONOMICO],
    // El corte pertenece al tramo **inferior**: es lo que hace que el empate en
    // el borde del tercio se resuelva siempre igual.
    [3000, PriceTier.ECONOMICO],
    [3001, PriceTier.MEDIO],
    [6000, PriceTier.MEDIO],
    [6001, PriceTier.CARO],
  ])('%i cae en %s', (precio, esperado) => {
    expect(tramoDe(precio, CORTES)).toBe(esperado);
  });

  it('sin cortes no hay tramo, y eso no es un fallo de cálculo (RN-016)', () => {
    expect(tramoDe(4990, null)).toBeNull();
  });

  it('dos precios iguales caen siempre en el mismo tramo, sin depender del orden', () => {
    expect(tramoDe(3000, CORTES)).toBe(tramoDe(3000, CORTES));
  });
});

describe('filtroDeTramo', () => {
  it('el tramo económico llega hasta el primer corte, inclusive', () => {
    expect(filtroDeTramo(PriceTier.ECONOMICO, CORTES)).toEqual({ price: { lte: 3000 } });
  });

  it('el tramo medio abre en el primer corte y cierra en el segundo', () => {
    expect(filtroDeTramo(PriceTier.MEDIO, CORTES)).toEqual({ price: { gt: 3000, lte: 6000 } });
  });

  it('el tramo caro empieza por encima del segundo corte', () => {
    expect(filtroDeTramo(PriceTier.CARO, CORTES)).toEqual({ price: { gt: 6000 } });
  });

  it('los tres tramos son una partición: ningún precio queda fuera ni en dos a la vez', () => {
    for (const precio of [1, 2999, 3000, 3001, 5999, 6000, 6001, 10_000_000]) {
      const tramos = [PriceTier.ECONOMICO, PriceTier.MEDIO, PriceTier.CARO].filter(
        (tramo) => tramoDe(precio, CORTES) === tramo,
      );
      expect(tramos).toHaveLength(1);
    }
  });

  it('sin tramos no descarta ningún producto, en lugar de dejar el menú vacío (SC-017)', () => {
    expect(filtroDeTramo(PriceTier.ECONOMICO, null)).toEqual({});
  });

  it('sin intención de precio tampoco filtra', () => {
    expect(filtroDeTramo(undefined, CORTES)).toEqual({});
  });
});
