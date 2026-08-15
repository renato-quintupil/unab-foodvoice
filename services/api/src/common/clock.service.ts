import { Injectable } from '@nestjs/common';

/**
 * Única fuente de tiempo de la aplicación (D-009).
 *
 * Ningún módulo puede llamar a `Date.now()` ni a `new Date()` directamente: el
 * reloj aparece en la firma de cada servicio que lo usa. Es lo que permite
 * probar las reglas de 30 y de 15 minutos sin esperarlas de verdad, y lo que
 * hace que el tiempo sea visible en el código en lugar de ser magia global.
 *
 * El reloj es siempre el del proceso de la API — nunca el del navegador, que el
 * usuario controla, ni el de PostgreSQL, para que la regla se pruebe con un
 * doble sin depender del motor.
 */
@Injectable()
export class ClockService {
  ahora(): Date {
    return new Date();
  }
}
