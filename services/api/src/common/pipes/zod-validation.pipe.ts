import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodObject, ZodSchema, ZodTypeAny } from 'zod';
import { AppError, ErrorCode } from '../errors';

/**
 * Valida el cuerpo o los parámetros con un esquema de `packages/shared` y
 * traduce los errores de Zod al formato `{ error: { code, message, fields } }`.
 *
 * **Las claves de `fields` provienen siempre del esquema y nunca de la
 * petición** (api CHK014). Un campo que el esquema no conoce se descarta en
 * silencio y no aparece en `fields`. La razón es doble: evita devolver al
 * navegador un texto que el propio cliente inyectó, y garantiza que la interfaz
 * pueda asociar cada mensaje a un control real del formulario.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const resultado = this.schema.safeParse(value);
    if (resultado.success) return resultado.data;
    throw errorDeValidacion(resultado.error, this.schema);
  }
}

/** Nombres de campo declarados por el esquema, desenvolviendo `refine`/`effects`. */
function camposDelEsquema(schema: ZodTypeAny): Set<string> {
  let actual: ZodTypeAny = schema;
  // `.refine()` envuelve el objeto en un ZodEffects; hay que llegar al interior
  // para saber qué campos declaró realmente el esquema.
  while (actual && '_def' in actual && 'schema' in (actual._def as Record<string, unknown>)) {
    actual = (actual._def as { schema: ZodTypeAny }).schema;
  }
  if (actual instanceof ZodObject) {
    return new Set(Object.keys(actual.shape as Record<string, unknown>));
  }
  return new Set();
}

/** Construye el `400 VALIDATION_ERROR` a partir de un `ZodError`. */
export function errorDeValidacion(error: ZodError, schema: ZodTypeAny): AppError {
  const conocidos = camposDelEsquema(schema);
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const campo = issue.path[0];
    if (typeof campo !== 'string' || !conocidos.has(campo)) continue;
    // El primer mensaje por campo es el que se muestra: el formulario solo
    // tiene un lugar donde ponerlo.
    if (!(campo in fields)) fields[campo] = issue.message;
  }

  const primero = error.issues[0];
  const mensaje = primero ? primero.message : 'Los datos enviados no son válidos.';

  return new AppError(
    400,
    ErrorCode.VALIDATION_ERROR,
    mensaje,
    Object.keys(fields).length > 0 ? fields : undefined,
  );
}
