import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MSG_SESION_EXPIRADA, Role, type SessionUser } from '@foodvoice/shared';

/**
 * Lectura de la sesión desde un Server Component.
 *
 * Consulta `GET /auth/me`, que es quien conoce el rol —la cookie es un
 * identificador opaco (D-001)—. La llamada ocurre **al montar una pantalla**,
 * es decir como consecuencia de una navegación de la persona: llamarlo por
 * temporizador está prohibido, porque refrescaría `last_activity_at`
 * indefinidamente y una sesión abandonada no expiraría nunca (FR-005, SC-024).
 */

const COOKIE_SESION = 'fv_session';

/** Destino de cada rol tras el inicio de sesión (FR-031). */
export const DESTINO_POR_ROL: Record<Role, string> = {
  [Role.CLIENTE]: '/cliente',
  [Role.NEGOCIO]: '/negocio',
  [Role.REPARTIDOR]: '/repartidor',
  [Role.ADMINISTRADOR]: '/admin',
};

export async function leerSesion(): Promise<SessionUser | null> {
  const base = process.env.API_INTERNAL_URL;
  if (!base) throw new Error('API_INTERNAL_URL no está definida.');

  const cookie = (await cookies()).get(COOKIE_SESION);
  if (!cookie) return null;

  const respuesta = await fetch(`${base.replace(/\/$/, '')}/api/v1/auth/me`, {
    headers: { cookie: `${COOKIE_SESION}=${cookie.value}` },
    cache: 'no-store',
  }).catch(() => null);

  if (!respuesta?.ok) return null;
  return (await respuesta.json()) as SessionUser;
}

/**
 * Exige sesión y, opcionalmente, uno de varios roles.
 *
 * Sin sesión lleva a `/login` con el aviso de expiración; con un rol que no
 * corresponde, a la **página propia** de acceso denegado (FR-003) — nunca a la
 * vista restringida con un aviso encima, que para entonces ya habría mostrado
 * su contenido.
 *
 * Esto sigue siendo experiencia de usuario: la autorización que cuenta es la de
 * los guards de NestJS, que rechazan igual una llamada directa a la API.
 */
export async function exigirSesion(rolesPermitidos?: Role[]): Promise<SessionUser> {
  const sesion = await leerSesion();
  // El texto sale de la constante compartida, nunca de un literal aquí: es lo
  // que garantiza que sea el mismo que muestra la API (Principio II, SC-018).
  if (!sesion) redirect(`/login?aviso=${encodeURIComponent(MSG_SESION_EXPIRADA)}`);

  if (rolesPermitidos && !rolesPermitidos.includes(sesion.role)) {
    redirect('/sin-permiso');
  }

  return sesion;
}
