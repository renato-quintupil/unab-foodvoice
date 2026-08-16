import { describe, expect, it } from 'vitest';
import { PRECIO_MAXIMO, PRECIO_MINIMO, formatearPrecio } from '../src/format/precio';
import { MAX_DESCRIPCION_LISTADO, recortarDescripcion } from '../src/format/texto';

describe('formatearPrecio (§ Presentación del precio, D-030)', () => {
  it('produce «$4.990»: símbolo de peso, punto de miles y sin decimales', () => {
    expect(formatearPrecio(4990)).toBe('$4.990');
  });

  it('no agrupa por debajo de mil', () => {
    expect(formatearPrecio(990)).toBe('$990');
    expect(formatearPrecio(1)).toBe('$1');
  });

  it('agrupa de tres en tres en los dos órdenes de magnitud del catálogo', () => {
    expect(formatearPrecio(12000)).toBe('$12.000');
    expect(formatearPrecio(1234567)).toBe('$1.234.567');
  });

  it('formatea las dos cotas declaradas del campo', () => {
    expect(formatearPrecio(PRECIO_MINIMO)).toBe('$1');
    expect(formatearPrecio(PRECIO_MAXIMO)).toBe('$10.000.000');
  });

  it('nunca muestra decimales, aunque reciba un valor con parte fraccionaria', () => {
    // FR-015 los rechaza en la validación; aquí se comprueba que la
    // presentación tampoco los inventa ni redondea hacia arriba.
    expect(formatearPrecio(4990.5)).toBe('$4.990');
    expect(formatearPrecio(4990.99)).toBe('$4.990');
  });

  it('escribe el signo antes del símbolo, no entre ambos', () => {
    expect(formatearPrecio(-4990)).toBe('-$4.990');
  });

  it('formatea el cero sin signo', () => {
    expect(formatearPrecio(0)).toBe('$0');
  });
});

describe('recortarDescripcion (§ Presentación de la descripción, D-033)', () => {
  const larga =
    'Masa delgada con salsa de tomate, mozzarella fresca, albahaca y aceite de oliva; contundente y para compartir entre dos personas con hambre de verdad al final de una jornada larga';

  it('deja intacto un texto que ya cabe', () => {
    const corta = 'Masa con queso y albahaca';
    expect(recortarDescripcion(corta)).toBe(corta);
  });

  it('deja intacto un texto de exactamente el máximo: el límite es inclusivo', () => {
    const justa = 'x'.repeat(MAX_DESCRIPCION_LISTADO);
    expect(recortarDescripcion(justa)).toBe(justa);
  });

  it('recorta un texto más largo y añade puntos suspensivos', () => {
    const r = recortarDescripcion(larga);
    expect(r.endsWith('…')).toBe(true);
    expect(r.length).toBeLessThanOrEqual(MAX_DESCRIPCION_LISTADO + 1);
  });

  it('nunca parte una palabra por la mitad', () => {
    const r = recortarDescripcion(larga).slice(0, -1);
    // Toda palabra del recorte aparece completa en el original.
    for (const palabra of r.split(' ')) {
      expect(larga.split(' ')).toContain(palabra);
    }
  });

  it('no deja un signo de puntuación colgando antes de los puntos suspensivos', () => {
    const conComa = `${'palabra '.repeat(19)}final, siguiente palabra que sobra del limite`;
    const r = recortarDescripcion(conComa);
    expect(r).not.toMatch(/[,;:.]…$/u);
  });

  it('respeta un máximo pasado por parámetro', () => {
    expect(recortarDescripcion('Masa delgada con queso', 12)).toBe('Masa delgada…');
  });

  it('corta en el límite cuando el texto no tiene ningún espacio antes de él', () => {
    const sinEspacios = 'a'.repeat(200);
    expect(recortarDescripcion(sinEspacios, 10)).toBe(`${'a'.repeat(10)}…`);
  });

  it('el recorte es solo presentación: no altera el texto recibido', () => {
    const original = larga;
    recortarDescripcion(larga);
    expect(larga).toBe(original);
  });
});
