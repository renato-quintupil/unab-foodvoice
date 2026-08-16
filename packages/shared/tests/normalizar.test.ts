import { describe, expect, it } from 'vitest';
import { escaparLike, normalizarBusqueda } from '../src/search/normalizar';

describe('normalizarBusqueda (FR-015, SC-021, D-011)', () => {
  it('«MARÍA» encuentra «María»: pliega acentos y pasa a minúsculas', () => {
    expect(normalizarBusqueda('MARÍA')).toBe('maria');
    expect(normalizarBusqueda('María Pérez')).toBe('maria perez');
  });

  it('«Nunez» encuentra «Nuñez»: la eñe se pliega a n', () => {
    expect(normalizarBusqueda('Nuñez')).toBe('nunez');
    expect(normalizarBusqueda('Nunez')).toBe('nunez');
  });

  it('pliega también diéresis y otros diacríticos', () => {
    expect(normalizarBusqueda('Müller')).toBe('muller');
    expect(normalizarBusqueda('Ángel Íñigo Úrsula')).toBe('angel inigo ursula');
  });

  it('colapsa espacios múltiples, tabulaciones y saltos de línea, y recorta', () => {
    expect(normalizarBusqueda('  María   \t  Pérez \n ')).toBe('maria perez');
  });

  it('es idempotente: normalizar dos veces da lo mismo', () => {
    const una = normalizarBusqueda('  MARÍA   Pérez ');
    expect(normalizarBusqueda(una)).toBe(una);
  });

  it('deja intacta una cadena vacía', () => {
    expect(normalizarBusqueda('')).toBe('');
  });
});

describe('escaparLike (D-011)', () => {
  it('neutraliza %, _ y \\', () => {
    expect(escaparLike('100%')).toBe('100\\%');
    expect(escaparLike('a_b')).toBe('a\\_b');
    expect(escaparLike('c\\d')).toBe('c\\\\d');
  });

  it('deja intacto un término sin caracteres especiales', () => {
    expect(escaparLike('maria perez')).toBe('maria perez');
  });

  it('se aplica después de normalizar, y el orden preserva el carácter especial', () => {
    expect(escaparLike(normalizarBusqueda('  100%  Í '))).toBe('100\\% i');
  });
});
