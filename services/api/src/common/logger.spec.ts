/**
 * Registro censurado (T119, D-019, FR-007, SC-027, ops CHK005).
 */
import { CAMPOS_CENSURADOS, censurar, cuerpoProhibido } from './logger';

describe('Lista de campos censurados', () => {
  it('cubre contraseñas, hashes, la cookie y las cadenas de configuración', () => {
    for (const esperado of [
      'password',
      'passwordHash',
      'cookie',
      'fv_session',
      'DATABASE_URL',
      'ADMIN_SEED_PASSWORD',
      'POSTGRES_PASSWORD',
    ]) {
      expect(CAMPOS_CENSURADOS as readonly string[]).toContain(esperado);
    }
  });

  it('censura el valor de un campo prohibido', () => {
    expect(censurar({ email: 'a@b.cl', password: 'secreta' })).toEqual({
      email: 'a@b.cl',
      password: '[censurado]',
    });
  });

  it('censura sin distinguir mayúsculas', () => {
    expect(censurar({ PassWord: 'secreta', Cookie: 'fv_session=abc' })).toEqual({
      PassWord: '[censurado]',
      Cookie: '[censurado]',
    });
  });

  it('censura campos ANIDADOS: un campo no se escapa por estar dentro de otro objeto', () => {
    const censurado = censurar({
      peticion: { cuerpo: { password: 'secreta', email: 'a@b.cl' } },
    });
    expect(JSON.stringify(censurado)).not.toContain('secreta');
    expect(JSON.stringify(censurado)).toContain('a@b.cl');
  });

  it('censura dentro de arreglos', () => {
    const censurado = censurar([{ passwordHash: '$2b$12$abc' }, { phone: '+56911112222' }]);
    expect(JSON.stringify(censurado)).not.toContain('$2b$12$abc');
    expect(JSON.stringify(censurado)).toContain('+56911112222');
  });

  it('deja intactos los valores que no son objetos', () => {
    expect(censurar('texto')).toBe('texto');
    expect(censurar(42)).toBe(42);
    expect(censurar(null)).toBeNull();
    expect(censurar(undefined)).toBeUndefined();
  });
});

describe('Rutas cuyo cuerpo no se registra en absoluto (D-019)', () => {
  it('el inicio de sesión y el restablecimiento quedan fuera', () => {
    expect(cuerpoProhibido('/api/v1/auth/login')).toBe(true);
    expect(cuerpoProhibido('/api/v1/admin/users/abc/password-reset')).toBe(true);
  });

  it('el resto de rutas no está en esa lista', () => {
    expect(cuerpoProhibido('/api/v1/admin/users')).toBe(false);
    expect(cuerpoProhibido('/api/v1/auth/me')).toBe(false);
  });
});

describe('LoggingInterceptor (D-019)', () => {
  function contexto(status: number) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST', originalUrl: '/api/v1/auth/login' }),
        getResponse: () => ({ statusCode: status }),
      }),
    };
  }

  it('registra una línea con verbo, ruta, estado y duración', async () => {
    const { LoggingInterceptor } = await import('./logger');
    const { of } = await import('rxjs');
    const { Logger } = await import('@nestjs/common');

    const escrito: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((mensaje: unknown) => {
      escrito.push(String(mensaje));
    });

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve) => {
      interceptor
        .intercept(contexto(200) as never, { handle: () => of({ ok: true }) } as never)
        .subscribe({ complete: resolve });
    });

    expect(escrito).toHaveLength(1);
    expect(escrito[0]).toMatch(/^POST \/api\/v1\/auth\/login 200 \d+ms$/);
    jest.restoreAllMocks();
  });

  it('NUNCA registra el cuerpo de la petición, ni siquiera censurado', async () => {
    const { LoggingInterceptor } = await import('./logger');
    const { of } = await import('rxjs');
    const { Logger } = await import('@nestjs/common');

    const escrito: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((mensaje: unknown) => {
      escrito.push(String(mensaje));
    });

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve) => {
      interceptor
        .intercept(contexto(200) as never, {
          handle: () => of({ password: 'secreta' }),
        } as never)
        .subscribe({ complete: resolve });
    });

    expect(escrito.join(' ')).not.toContain('secreta');
    jest.restoreAllMocks();
  });

  it('registra también cuando la petición falla', async () => {
    const { LoggingInterceptor } = await import('./logger');
    const { throwError } = await import('rxjs');
    const { Logger } = await import('@nestjs/common');

    const escrito: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((mensaje: unknown) => {
      escrito.push(String(mensaje));
    });

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve) => {
      interceptor
        .intercept(contexto(500) as never, {
          handle: () => throwError(() => new Error('fallo')),
        } as never)
        .subscribe({ error: () => resolve() });
    });

    expect(escrito).toHaveLength(1);
    expect(escrito[0]).toContain('500');
    jest.restoreAllMocks();
  });

  it('toma el estado de la EXCEPCIÓN, no de la respuesta aún sin fijar', async () => {
    // Cuando el manejador lanza, el filtro todavía no ha escrito el estado, así
    // que leer la respuesta daría 200 y toda petición fallida aparecería en el
    // registro como exitosa. Se comprobó contra el sistema real: los cuatro
    // inicios de sesión fallidos figuraban como `200`.
    const { LoggingInterceptor } = await import('./logger');
    const { throwError } = await import('rxjs');
    const { Logger } = await import('@nestjs/common');
    const { credencialesInvalidas } = await import('../common/errors');

    const escrito: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((mensaje: unknown) => {
      escrito.push(String(mensaje));
    });

    const interceptor = new LoggingInterceptor();
    await new Promise<void>((resolve) => {
      interceptor
        // La respuesta sigue diciendo 200: es exactamente el caso real.
        .intercept(contexto(200) as never, {
          handle: () => throwError(() => credencialesInvalidas()),
        } as never)
        .subscribe({ error: () => resolve() });
    });

    expect(escrito[0]).toContain('401');
    expect(escrito[0]).not.toContain('200');
    jest.restoreAllMocks();
  });
});
