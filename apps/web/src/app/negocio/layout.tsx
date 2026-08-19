import type { ReactNode } from 'react';
import { Role } from '@foodvoice/shared';
import { NavegacionNegocio } from './_components/navegacion';
import { claseBricolage } from '@/lib/fuentes';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

export default async function LayoutNegocio({ children }: { children: ReactNode }) {
  await exigirSesion([Role.NEGOCIO]);

  return (
    <div className={`tema-voz ${claseBricolage} min-h-screen pb-20 md:pb-0`}>
      <NavegacionNegocio />
      {children}
    </div>
  );
}
