import type { ReactNode } from 'react';
import { Role, type AddressDto } from '@foodvoice/shared';
import { NavegacionCliente } from './_components/navegacion';
import { pedirALaApi } from '@/lib/api-servidor';
import { claseBricolage } from '@/lib/fuentes';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

export default async function LayoutCliente({ children }: { children: ReactNode }) {
  await exigirSesion([Role.CLIENTE]);
  const { items } = await pedirALaApi<{ items: AddressDto[] }>('/addresses');
  const activas = items.filter((direccion) => direccion.active);

  return (
    <div className={`tema-voz ${claseBricolage} min-h-screen pb-20 md:pb-0`}>
      <NavegacionCliente direcciones={activas} />
      {children}
    </div>
  );
}
