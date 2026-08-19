import type { ReactNode } from 'react';
import { Role } from '@foodvoice/shared';
import { NavegacionAdmin } from './_components/navegacion';
import { claseBricolage } from '@/lib/fuentes';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/**
 * Envoltura de toda la superficie administrativa.
 *
 * Exigir el rol aquí y no en cada página es lo que impide que una vista nueva
 * se olvide de hacerlo. Sigue siendo experiencia de usuario: la autorización
 * que cuenta es la de los guards de NestJS (D-007).
 *
 * `.tema-voz` + `claseBricolage` (FR-017 de E9): mismo mecanismo que
 * `cliente/layout.tsx` y `negocio/layout.tsx` — redefine variables CSS ya
 * usadas por `Button`/`Input`, sin tocar su código.
 */
export default async function LayoutAdmin({ children }: { children: ReactNode }) {
  await exigirSesion([Role.ADMINISTRADOR]);

  return (
    <div className={`tema-voz ${claseBricolage} min-h-screen pb-20 md:pb-0`}>
      <NavegacionAdmin />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
