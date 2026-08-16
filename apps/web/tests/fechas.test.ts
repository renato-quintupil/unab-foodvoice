/**
 * Formato visible de las fechas (T114, FR-022, ux CHK021, ux CHK026).
 */
import { describe, expect, it } from 'vitest';
import { formatearFecha } from '@/lib/fechas';

describe('formatearFecha', () => {
  it('devuelve DD/MM/AAAA, con barras y no con guiones', () => {
    // El formato corto de `es-CL` usa guiones. Confiar en el predeterminado del
    // idioma habría incumplido el requisito de una forma que solo se vería en
    // pantalla, así que el texto se arma explícitamente.
    expect(formatearFecha('2026-08-15T12:00:00.000Z')).toBe('15/08/2026');
  });

  it('rellena con cero el día y el mes de una cifra', () => {
    expect(formatearFecha('2026-01-05T12:00:00.000Z')).toBe('05/01/2026');
  });

  it('el formato interno ISO nunca aparece en la salida', () => {
    const salida = formatearFecha('2026-08-15T12:00:00.000Z');
    expect(salida).not.toContain('T');
    expect(salida).not.toContain('Z');
    expect(salida).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('convierte al huso de referencia: las 01:00 UTC son del día anterior en Chile', () => {
    // Es la razón de que la conversión exista: sin ella, un pedido de las 22:00
    // en Chile aparecería como del día siguiente.
    expect(formatearFecha('2026-08-16T01:00:00.000Z')).toBe('15/08/2026');
  });

  it('el último instante del día local sigue perteneciendo a ese día', () => {
    expect(formatearFecha('2026-08-16T03:59:59.999Z')).toBe('15/08/2026');
  });
});
