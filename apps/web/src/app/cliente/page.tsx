import { Role } from '@foodvoice/shared';
import { InicioDeRol } from '@/components/inicio-de-rol';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/** Página de inicio del rol cliente (FR-031). */
export default async function PaginaInicioCliente() {
  const sesion = await exigirSesion([Role.CLIENTE]);
  return <InicioDeRol sesion={sesion} />;
}
