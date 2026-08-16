import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protección de rutas (T070, D-007).
 *
 * **Es exclusivamente experiencia de usuario. La autorización real la ejercen
 * los guards de NestJS.** El middleware no reimplementa ninguna regla: solo
 * comprueba si hay cookie y a qué segmento lleva la raíz. No puede hacer más,
 * porque el rol vive en la sesión del servidor y el identificador de la cookie
 * es opaco — leerlo aquí exigiría consultar la base de datos desde el borde,
 * que es justo la duplicación que D-007 evita.
 *
 * De ahí que el peor caso de una divergencia entre esto y los guards sea una
 * molestia visible —una redirección de más—, nunca un acceso indebido. Los
 * pasos A6 y A17 de la guía lo comprueban invocando la ruta restringida sin
 * pasar por la interfaz.
 */

const COOKIE_SESION = 'fv_session';

/** Rutas que no exigen sesión. */
const PUBLICAS = ['/login'];

export function middleware(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl;
  const tieneCookie = peticion.cookies.has(COOKIE_SESION);

  if (PUBLICAS.includes(pathname)) {
    return NextResponse.next();
  }

  if (!tieneCookie) {
    const destino = peticion.nextUrl.clone();
    destino.pathname = '/login';
    destino.search = '';
    return NextResponse.redirect(destino);
  }

  // Desde la raíz, al segmento del rol. El middleware no sabe cuál es —la
  // cookie es opaca—, así que delega en `GET /auth/me`, que sí lo sabe, a
  // través de la página de entrada.
  if (pathname === '/') {
    const destino = peticion.nextUrl.clone();
    destino.pathname = '/entrada';
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Todo salvo los recursos internos de Next.js, los estáticos y **el propio
    // proxy**: interceptar `/api` rompería la única vía por la que el navegador
    // alcanza a NestJS.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
