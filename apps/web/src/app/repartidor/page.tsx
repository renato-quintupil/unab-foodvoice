import { Role } from '@foodvoice/shared';
import { InicioDeRol } from '@/components/inicio-de-rol';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/** Página de inicio del rol repartidor (FR-031). */
export default async function PaginaInicioRepartidor() {
  const sesion = await exigirSesion([Role.REPARTIDOR]);
  return <InicioDeRol sesion={sesion} />;
}
