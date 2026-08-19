import { redirect } from 'next/navigation';
import { Role } from '@foodvoice/shared';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/**
 * Aterrizaje del rol cliente (FR-016 de E9).
 *
 * Hasta E9 mostraba `InicioDeRol`: cuatro botones (Menú, Carrito,
 * Direcciones, Mis pedidos) porque el cliente no tenía otra forma de
 * navegar. El encabezado de HU-15 ya ofrece esos mismos destinos en
 * cualquier pantalla, así que mantener esta landing sería navegación
 * duplicada — de ahí la redirección directa a `/menu`.
 */
export default async function PaginaInicioCliente() {
  await exigirSesion([Role.CLIENTE]);
  redirect('/menu');
}
