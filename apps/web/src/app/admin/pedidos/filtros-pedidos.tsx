'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ETIQUETA_ESTADO_PEDIDO, OrderStatus } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Filtros del reporte de pedidos (FR-020).
 *
 * Los campos de fecha usan `type="date"`, que en el navegador se muestra en el
 * formato local y envía `AAAA-MM-DD`, que es lo que el esquema compartido
 * valida: el formato interno nunca aparece escrito en pantalla (ux CHK021).
 */
export function FiltrosPedidos() {
  const router = useRouter();
  const parametros = useSearchParams();

  const [status, setStatus] = useState(parametros.get('status') ?? '');
  const [from, setFrom] = useState(parametros.get('from') ?? '');
  const [to, setTo] = useState(parametros.get('to') ?? '');

  function aplicar(evento: React.FormEvent) {
    evento.preventDefault();
    const nuevos = new URLSearchParams();
    if (status) nuevos.set('status', status);
    if (from) nuevos.set('from', from);
    if (to) nuevos.set('to', to);
    router.push(`/admin/pedidos?${nuevos.toString()}`);
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Estado</Label>
        <select
          id="status"
          value={status}
          onChange={(evento) => setStatus(evento.target.value)}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.values(OrderStatus).map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_ESTADO_PEDIDO[valor]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from">Desde</Label>
        <Input
          id="from"
          type="date"
          value={from}
          onChange={(evento) => setFrom(evento.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to">Hasta</Label>
        <Input id="to" type="date" value={to} onChange={(evento) => setTo(evento.target.value)} />
      </div>

      <Button type="submit">Aplicar filtros</Button>
    </form>
  );
}
