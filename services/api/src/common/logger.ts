import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Registro de la aplicación (T119, D-019, FR-007, SC-027, ops CHK005,
 * ops CHK031).
 *
 * La tabla de D-019, implementada:
 *
 * | Qué se registra                                       | Nivel        |
 * |-------------------------------------------------------|--------------|
 * | Arranque, migraciones y resultado de la semilla        | Informativo  |
 * | Cada petición: verbo, ruta, estado y duración          | Informativo  |
 * | Errores controlados que llegan al filtro, con su code  | Advertencia  |
 * | Errores no previstos, con traza e identificador        | Error        |
 *
 * **La prohibición se implementa como lista de campos censurados**, no como el
 * cuidado de quien escribe cada llamada: es la única forma de que siga siendo
 * cierta dentro de seis meses. Lo mismo vale para las rutas cuyo cuerpo entero
 * no debe aparecer nunca.
 */

/** Campos que **jamás** aparecen en el registro, en ningún nivel (D-019). */
export const CAMPOS_CENSURADOS = [
  'password',
  'passwordHash',
  'password_hash',
  'contrasena',
  'cookie',
  'set-cookie',
  'fv_session',
  'authorization',
  'DATABASE_URL',
  'ADMIN_SEED_PASSWORD',
  'POSTGRES_PASSWORD',
] as const;

/** Rutas cuyo cuerpo no se registra **entero**, ni siquiera censurado. */
const RUTAS_SIN_CUERPO = ['/auth/login', 'password-reset'] as const;

const OCULTO = '[censurado]';

/**
 * Sustituye recursivamente el valor de todo campo censurado.
 *
 * Se aplica sobre la estructura y no sobre el texto ya serializado, para que un
 * campo anidado no se escape por estar dentro de otro objeto.
 */
export function censurar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(censurar);
  if (valor === null || typeof valor !== 'object') return valor;

  const salida: Record<string, unknown> = {};
  for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
    const censurado = CAMPOS_CENSURADOS.some(
      (campo) => campo.toLowerCase() === clave.toLowerCase(),
    );
    salida[clave] = censurado ? OCULTO : censurar(contenido);
  }
  return salida;
}

/** ¿El cuerpo de esta ruta debe quedar fuera del registro por completo? */
export function cuerpoProhibido(ruta: string): boolean {
  return RUTAS_SIN_CUERPO.some((prohibida) => ruta.includes(prohibida));
}

/**
 * Una línea informativa por petición, con verbo, ruta, código de estado y
 * duración. **Nunca el cuerpo**: ninguna de las cuatro filas de la tabla de
 * D-019 lo incluye, y registrarlo «solo en desarrollo» es como acaba en
 * producción.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(contexto: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = contexto.switchToHttp();
    const peticion = http.getRequest<Request>();
    const inicio = Date.now();

    const registrar = () => {
      const respuesta = http.getResponse<Response>();
      const duracion = Date.now() - inicio;
      this.logger.log(
        `${peticion.method} ${peticion.originalUrl} ${respuesta.statusCode} ${duracion}ms`,
      );
    };

    return next.handle().pipe(tap({ next: registrar, error: registrar }));
  }
}
