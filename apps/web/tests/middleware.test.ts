/**
 * Middleware de rutas (T070, D-007).
 *
 * Lo que se verifica aquí es que **no ejerce autorización real**: solo mira si
 * hay cookie y a qué segmento lleva la raíz. El rol vive en la sesión del
 * servidor y la cookie es opaca, así que el middleware no puede —ni debe—
 * decidir quién entra a dónde. Por diseño, el peor caso de una divergencia con
 * los guards es una redirección de más, nunca un acceso indebido.
 */
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, middleware } from '@/middleware';

function peticion(ruta: string, conCookie: boolean): NextRequest {
  const request = new NextRequest(new Request(`http://localhost:3000${ruta}`), {});
  if (conCookie) request.cookies.set('fv_session', '11111111-1111-4111-8111-111111111111');
  return request;
}

function destinoDe(respuesta: Response): string | null {
  const ubicacion = respuesta.headers.get('location');
  return ubicacion ? new URL(ubicacion).pathname : null;
}

describe('Sin cookie de sesión', () => {
  it('redirige a /login desde cualquier ruta protegida', () => {
    for (const ruta of ['/admin', '/cliente', '/admin/usuarios', '/sin-permiso']) {
      const respuesta = middleware(peticion(ruta, false));
      expect([ruta, destinoDe(respuesta)]).toEqual([ruta, '/login']);
    }
  });

  it('descarta la cadena de consulta al redirigir', () => {
    const respuesta = middleware(peticion('/admin/usuarios?search=maria', false));
    expect(new URL(respuesta.headers.get('location')!).search).toBe('');
  });

  it('deja pasar /login, que es pública', () => {
    const respuesta = middleware(peticion('/login', false));
    expect(destinoDe(respuesta)).toBeNull();
  });
});

describe('Con cookie de sesión', () => {
  it('desde la raíz lleva a /entrada, que consulta el rol', () => {
    // El middleware no sabe cuál es el rol —la cookie es opaca— y delega en la
    // página que sí puede preguntarlo, en vez de duplicar la regla en el borde.
    expect(destinoDe(middleware(peticion('/', true)))).toBe('/entrada');
  });

  it('NO decide nada sobre los segmentos por rol', () => {
    // Un cliente pidiendo /admin pasa el middleware: quien lo rechaza es el
    // servidor. Ocultar la ruta aquí daría una falsa sensación de seguridad.
    for (const ruta of ['/admin', '/admin/usuarios', '/negocio', '/repartidor']) {
      expect([ruta, destinoDe(middleware(peticion(ruta, true)))]).toEqual([ruta, null]);
    }
  });

  it('deja pasar /login aunque haya cookie', () => {
    expect(destinoDe(middleware(peticion('/login', true)))).toBeNull();
  });
});

describe('Alcance del middleware', () => {
  // Next.js ancla sus patrones a la ruta completa; al probarlos a mano hay que
  // hacerlo explícito, o `test` encontraría una coincidencia parcial en
  // cualquier cadena.
  const patron = new RegExp(`^${config.matcher[0]!}$`);

  it('NO intercepta /api: rompería la única vía al servicio', () => {
    expect(patron.test('/api/auth/login')).toBe(false);
    expect(patron.test('/admin/usuarios')).toBe(true);
  });

  it('no intercepta los recursos internos ni los estáticos', () => {
    expect(patron.test('/_next/static/algo.js')).toBe(false);
    expect(patron.test('/favicon.ico')).toBe(false);
  });
});
