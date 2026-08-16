import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { MSG_ERROR_INESPERADO, MSG_SIN_PERMISO } from '@foodvoice/shared';
import { AppError, ErrorCode } from '../errors';

/**
 * Filtro global de excepciones (Principio II, api CHK016).
 *
 * Garantiza dos cosas que no pueden quedar a criterio de cada endpoint:
 *
 * 1. **Ninguna respuesta filtra detalles técnicos.** Todo lo que no es un
 *    `AppError` del catálogo cerrado se convierte en `500 INTERNAL_ERROR` con
 *    `MSG_ERROR_INESPERADO`; el detalle queda en la salida de diagnóstico.
 * 2. **El formato de error es uno solo**, `{ error: { code, message, fields } }`,
 *    de modo que la interfaz no necesite un camino aparte por endpoint.
 *
 * El `500` incluye un **identificador de correlación** que también viaja al
 * cliente (D-019): es lo que permite relacionar el mensaje en español que ve el
 * usuario con la traza concreta, sin filtrarle nada.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      this.logger.warn(`${exception.code} · ${exception.getStatus()}`);
      respuesta.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.mensaje,
          ...(exception.fields ? { fields: exception.fields } : {}),
          // `extra` va **después** de `fields` y antes de nada más: hoy solo lo
          // usa `CATEGORY_IN_USE` con `blockingProducts` (E3). Se difunde en el
          // filtro y no en cada endpoint para que el formato de error siga
          // siendo uno solo.
          ...(exception.extra ?? {}),
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const traducido = this.traducirExcepcionDeNest(exception);
      this.logger.warn(`${traducido.code} · ${traducido.status}`);
      respuesta.status(traducido.status).json({
        error: { code: traducido.code, message: traducido.message },
      });
      return;
    }

    const correlacion = randomUUID();
    this.logger.error(
      `INTERNAL_ERROR · correlación ${correlacion}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    respuesta.status(500).json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: MSG_ERROR_INESPERADO,
        correlationId: correlacion,
      },
    });
  }

  /**
   * Traduce las excepciones que produce el propio framework —ruta inexistente,
   * verbo no admitido, cuerpo que excede el límite— a códigos del catálogo.
   * Nunca deja escapar su mensaje original, que está en inglés y puede describir
   * la implementación.
   */
  private traducirExcepcionDeNest(exception: HttpException): {
    status: number;
    code: ErrorCode;
    message: string;
  } {
    const status = exception.getStatus();

    if (status === 413) {
      return {
        status: 413,
        code: ErrorCode.PAYLOAD_TOO_LARGE,
        message: MSG_ERROR_INESPERADO,
      };
    }
    if (status === 503) {
      // `GET /health` cuando PostgreSQL no responde (D-019). El catálogo cerrado
      // no tiene código propio para esto porque no es un error de la API sino
      // una señal de infraestructura; se conserva el 503 y el cuerpo genérico.
      return {
        status: 503,
        code: ErrorCode.INTERNAL_ERROR,
        message: MSG_ERROR_INESPERADO,
      };
    }
    if (status === 404) {
      return { status: 404, code: ErrorCode.NOT_FOUND, message: MSG_ERROR_INESPERADO };
    }
    if (status === 403) {
      return { status: 403, code: ErrorCode.FORBIDDEN, message: MSG_SIN_PERMISO };
    }
    return { status: 500, code: ErrorCode.INTERNAL_ERROR, message: MSG_ERROR_INESPERADO };
  }
}
