/**
 * `ZodValidationPipe` (T030, api CHK014).
 *
 * Lo que aquí importa es una garantía sola: **las claves de `fields` provienen
 * siempre del esquema y nunca de la petición**. Evita devolver al navegador un
 * texto que el propio cliente inyectó, y garantiza que la interfaz pueda
 * asociar cada mensaje a un control real del formulario.
 */
import { CreateUserSchema, LoginSchema, UpdateUserSchema } from '@foodvoice/shared';
import { AppError } from '../errors';
import { ZodValidationPipe } from './zod-validation.pipe';

const METADATOS = { type: 'body' } as const;

describe('ZodValidationPipe', () => {
  it('devuelve los datos ya transformados por el esquema', () => {
    const pipe = new ZodValidationPipe(LoginSchema);

    const resultado = pipe.transform(
      { email: '  MARIA@Ejemplo.CL ', password: 'x' },
      METADATOS as never,
    );

    expect(resultado).toEqual({ email: 'maria@ejemplo.cl', password: 'x' });
  });

  it('lanza 400 VALIDATION_ERROR con el mensaje en español', () => {
    const pipe = new ZodValidationPipe(LoginSchema);

    try {
      pipe.transform({ email: 'no-es-correo', password: 'x' }, METADATOS as never);
      fail('debería haber lanzado');
    } catch (error) {
      const app = error as AppError;
      expect(app.getStatus()).toBe(400);
      expect(app.code).toBe('VALIDATION_ERROR');
      expect(app.mensaje).toBe('Debes ingresar un correo electrónico válido.');
    }
  });

  it('agrupa los errores por campo', () => {
    const pipe = new ZodValidationPipe(CreateUserSchema);

    try {
      pipe.transform({ fullName: 'A', email: 'malo', phone: '1' }, METADATOS as never);
      fail('debería haber lanzado');
    } catch (error) {
      const campos = (error as AppError).fields ?? {};
      expect(Object.keys(campos).sort()).toEqual(
        ['fullName', 'email', 'phone', 'password', 'role'].sort(),
      );
    }
  });

  it('un campo DESCONOCIDO enviado por el cliente no aparece en `fields`', () => {
    const pipe = new ZodValidationPipe(CreateUserSchema);

    try {
      pipe.transform(
        { email: 'malo', '<img src=x onerror=alert(1)>': 'inyectado' },
        METADATOS as never,
      );
      fail('debería haber lanzado');
    } catch (error) {
      const campos = (error as AppError).fields ?? {};
      expect(JSON.stringify(campos)).not.toContain('<img');
      for (const clave of Object.keys(campos)) {
        expect(Object.keys(CreateUserSchema.shape)).toContain(clave);
      }
    }
  });

  it('desenvuelve los esquemas con `refine` para conocer sus campos', () => {
    // `UpdateUserSchema` es un ZodEffects: sin desenvolverlo, `fields` saldría
    // vacío y la interfaz no podría situar el error junto al campo.
    const pipe = new ZodValidationPipe(UpdateUserSchema);

    try {
      pipe.transform({ email: 'no-es-correo' }, METADATOS as never);
      fail('debería haber lanzado');
    } catch (error) {
      expect((error as AppError).fields).toEqual({
        email: 'Debes ingresar un correo electrónico válido.',
      });
    }
  });

  it('un error sin campo asociado no produce `fields`', () => {
    const pipe = new ZodValidationPipe(UpdateUserSchema);

    try {
      pipe.transform({}, METADATOS as never);
      fail('debería haber lanzado');
    } catch (error) {
      const app = error as AppError;
      expect(app.mensaje).toBe('Debes modificar al menos un dato.');
      expect(app.fields).toBeUndefined();
    }
  });

  it('conserva el primer mensaje por campo, que es el que se muestra', () => {
    const pipe = new ZodValidationPipe(CreateUserSchema);

    try {
      pipe.transform({ password: '' }, METADATOS as never);
      fail('debería haber lanzado');
    } catch (error) {
      expect((error as AppError).fields?.password).toBe(
        'La contraseña debe tener al menos 8 caracteres.',
      );
    }
  });
});
