import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MSG_SESION_EXPIRADA } from '@foodvoice/shared';

/**
 * Llamadas a la API desde un Server Component.
 *
 * Van por la red interna, no por el proxy: en el servidor no hay navegador que
 * necesite una cookie same-origin, y dar un rodeo por Next.js para volver a
 * salir sería un salto de red sin propósito.
 *
 * Un `401` lleva a `/login` con el aviso; un `403`, a la página propia de
 * acceso denegado. Cualquier otro fallo se propaga para que lo recoja el límite
 * de error de la vista, **sin fabricar contenido**: una lista vacía significa
 * «no hay datos» y confundirla con «no pude preguntar» le mostraría al
 * administrador un padrón vacío como si fuera real (D-017).
 */
export async function pedirALaApi<T>(ruta: string): Promise<T> {
  const base = process.env.API_INTERNAL_URL;
  if (!base) throw new Error('API_INTERNAL_URL no está definida.');

  const cookie = (await cookies()).get('fv_session');

  const respuesta = await fetch(`${base.replace(/\/$/, '')}/api/v1${ruta}`, {
    headers: cookie ? { cookie: `fv_session=${cookie.value}` } : {},
    cache: 'no-store',
  });

  if (respuesta.status === 401) {
    redirect(`/login?aviso=${encodeURIComponent(MSG_SESION_EXPIRADA)}`);
  }
  if (respuesta.status === 403) redirect('/sin-permiso');
  if (!respuesta.ok) {
    throw new Error(`La API respondió ${respuesta.status} a ${ruta}`);
  }

  return (await respuesta.json()) as T;
}
