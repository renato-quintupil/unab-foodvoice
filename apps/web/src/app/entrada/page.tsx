import { redirect } from 'next/navigation';
import { DESTINO_POR_ROL, leerSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/**
 * Reparto desde la raíz hacia el segmento del rol (FR-031).
 *
 * El middleware no puede hacerlo por su cuenta: la cookie es un identificador
 * opaco y el rol vive en la sesión del servidor (D-001, D-007). Esta página es
 * el único punto que consulta quién es y a dónde corresponde llevarlo, sin que
 * la regla quede duplicada en el borde.
 */
export default async function PaginaEntrada() {
  const sesion = await leerSesion();
  redirect(sesion ? DESTINO_POR_ROL[sesion.role] : '/login');
}
