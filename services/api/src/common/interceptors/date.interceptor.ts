import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Serializa toda fecha de la respuesta como **ISO 8601 en UTC** con sufijo `Z`
 * y milisegundos — `"2026-08-15T14:32:07.451Z"` (api CHK002).
 *
 * La API no formatea fechas para leerlas ni aplica husos horarios: la
 * conversión al huso local y el formato visible en español son responsabilidad
 * de la interfaz. Así, el dato no depende de la configuración del contenedor.
 *
 * Se hace en un interceptor y no confiando en el serializador por defecto para
 * que la garantía sea del transporte y no de cada endpoint por separado.
 */
@Injectable()
export class DateInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((cuerpo) => aIso(cuerpo)));
  }
}

function aIso(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map(aIso);
  if (valor !== null && typeof valor === 'object') {
    const salida: Record<string, unknown> = {};
    for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = aIso(contenido);
    }
    return salida;
  }
  return valor;
}
