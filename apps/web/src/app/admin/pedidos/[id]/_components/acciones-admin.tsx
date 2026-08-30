'use client';

import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@foodvoice/shared';
import { CerrarAdministrativamente } from './cerrar-administrativamente';
import { ForzarTransicion } from './forzar-transicion';

/**
 * Las dos acciones administrativas sobre un pedido no terminal (E8, HU-07
 * Historias 1 y 2). `page.tsx` ya decide si renderizar este componente según
 * el estado del pedido; aquí solo se agrupan los dos diálogos y su refresco.
 */
export function AccionesAdmin({
  pedidoId,
  estadoActual,
}: {
  pedidoId: string;
  estadoActual: OrderStatus;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ForzarTransicion pedidoId={pedidoId} estadoActual={estadoActual} onForzado={() => router.refresh()} />
      <CerrarAdministrativamente pedidoId={pedidoId} onCerrado={() => router.refresh()} />
    </div>
  );
}
