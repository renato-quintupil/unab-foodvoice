'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Soltar el pedido en curso (E5, HU-04, Historia 3, FR-008, FR-009).
 *
 * Pide confirmación explícita (Principio IX): a diferencia de tomar un
 * pedido, soltarlo tiene un efecto real sobre otra persona — cualquier otro
 * repartidor puede tomarlo de inmediato — así que no es un clic de rutina.
 */
export function BotonSoltar({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);

  async function soltar(): Promise<boolean> {
    setAviso(null);
    try {
      await api.put(`/delivery/orders/${pedidoId}/release`, {});
      router.refresh();
      return true;
    } catch (fallo) {
      setAviso(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    }
  }

  return (
    <ConfirmarAccion
      etiqueta="Soltar pedido"
      titulo="Soltar este pedido"
      descripcion="El pedido volverá a estar disponible para cualquier repartidor, incluido tú mismo. Úsalo si no puedes salir a repartirlo."
      reversible
      textoConfirmar="Soltar"
      onConfirmar={soltar}
      aviso={aviso}
      alCerrar={() => setAviso(null)}
    />
  );
}
