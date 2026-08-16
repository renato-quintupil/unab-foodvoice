'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ETIQUETA_ESTADO_CATEGORIA } from '@foodvoice/shared';
import { Label } from '@/components/ui/label';

/**
 * Filtro por estado del listado de categorías (T089, FR-010).
 *
 * FR-010 pide las categorías «agrupadas **o** filtrables por dimensión **y**
 * filtrables por estado». La agrupación por dimensión ya la hace la pantalla, de
 * modo que aquí solo vive la mitad que faltaba: el estado.
 *
 * Viaja en la dirección y no en estado local, igual que los filtros del listado
 * de productos: una dirección concreta describe siempre el mismo listado y se
 * puede recargar o compartir sin perderlo.
 *
 * **El valor por omisión sigue siendo «todas»** —activas y desactivadas—, que es
 * lo que FR-010 exige de esta vista y lo contrario del listado de productos, que
 * oculta las bajas. La diferencia es deliberada: una categoría desactivada tiene
 * que verse aquí para poder reactivarla, y aquí no hay paginación que ensuciar.
 */
export function FiltrosCategorias() {
  const router = useRouter();
  const parametros = useSearchParams();

  return (
    <form className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="active">Estado</Label>
        <select
          id="active"
          name="active"
          defaultValue={parametros.get('active') ?? ''}
          onChange={(evento) => {
            const siguientes = new URLSearchParams(parametros.toString());
            if (evento.target.value === '') siguientes.delete('active');
            else siguientes.set('active', evento.target.value);
            router.push(`/negocio/categorias?${siguientes.toString()}`);
          }}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          <option value="">Todas</option>
          {/* Los valores son los que el endpoint acepta (`active=true|false`);
              lo que se lee en pantalla sale de `ETIQUETA_ESTADO_CATEGORIA`, para
              que el vocabulario no se improvise aquí. */}
          <option value="true">{ETIQUETA_ESTADO_CATEGORIA.ACTIVA}</option>
          <option value="false">{ETIQUETA_ESTADO_CATEGORIA.DESACTIVADA}</option>
        </select>
      </div>
    </form>
  );
}
