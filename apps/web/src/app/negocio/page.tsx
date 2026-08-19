import { redirect } from 'next/navigation';
import { Role } from '@foodvoice/shared';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/**
 * Aterrizaje del rol negocio (FR-016 de E9).
 *
 * Hasta E9 esta pantalla tenía su propia lista de botones (Categorías,
 * Productos, Pedidos, Ver el menú), añadida en E3 para cubrir HU-14/HU-02
 * antes de que negocio tuviera un encabezado. El encabezado de HU-15 ya
 * ofrece esos mismos destinos en cualquier pantalla, así que mantener esta
 * landing sería navegación duplicada — de ahí la redirección directa a
 * `/negocio/pedidos`.
 */
export default async function PaginaInicioNegocio() {
  await exigirSesion([Role.NEGOCIO]);
  redirect('/negocio/pedidos');
}
