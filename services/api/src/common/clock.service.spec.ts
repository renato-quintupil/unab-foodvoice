/**
 * `ClockService` (T029, D-009).
 *
 * Es deliberadamente trivial, y precisamente por eso conviene fijarlo: su valor
 * no está en lo que hace sino en que **ningún otro módulo llame a `new Date()`
 * directamente**, de modo que el tiempo aparezca en la firma de cada servicio
 * que lo usa y pueda sustituirse en las pruebas.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClockService } from './clock.service';

describe('ClockService', () => {
  it('devuelve el instante actual', () => {
    const antes = Date.now();
    const ahora = new ClockService().ahora();
    const despues = Date.now();

    expect(ahora).toBeInstanceOf(Date);
    expect(ahora.getTime()).toBeGreaterThanOrEqual(antes);
    expect(ahora.getTime()).toBeLessThanOrEqual(despues);
  });

  it('es sustituible: una subclase puede congelar el tiempo', () => {
    const fijo = new Date('2026-08-15T12:00:00.000Z');
    class RelojFijo extends ClockService {
      override ahora(): Date {
        return fijo;
      }
    }
    expect(new RelojFijo().ahora()).toBe(fijo);
  });

  it('ningún servicio de auth ni de users lee el reloj de pared por su cuenta', () => {
    // Es la garantía que hace testeables las reglas de 30 y 15 minutos sin
    // esperarlas de verdad. Si alguien la rompe, esta prueba lo dice.
    //
    // Lo prohibido es **leer** el instante actual: `new Date()` sin argumentos
    // y `Date.now()`. Derivar una fecha del instante que devolvió el reloj
    // inyectado —`new Date(ahora.getTime() + 15 * 60_000)`— es correcto y es
    // justamente lo que hace sustituible el tiempo.
    const raiz = join(__dirname, '..');
    const archivos = [
      'auth/session.service.ts',
      'auth/login-attempt.service.ts',
      'auth/auth.service.ts',
      'users/users.service.ts',
    ];

    for (const archivo of archivos) {
      const fuente = readFileSync(join(raiz, archivo), 'utf8');
      const codigo = fuente.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
      expect([archivo, /new Date\(\s*\)/.test(codigo)]).toEqual([archivo, false]);
      expect([archivo, /Date\.now\(/.test(codigo)]).toEqual([archivo, false]);
    }
  });
});
