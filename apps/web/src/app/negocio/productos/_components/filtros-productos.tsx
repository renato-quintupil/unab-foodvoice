'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  ETIQUETA_ESTADO_PRODUCTO,
  ProductStatus,
  type CategoryDto,
} from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Filtros del listado de administración (T053, FR-023).
 *
 * Los tres son **combinables entre sí** y viajan en la dirección, no en estado
 * local: así una dirección concreta describe siempre el mismo listado y se puede
 * compartir o recargar sin perderlo, con el mismo criterio que los filtros del
 * padrón de E1.
 *
 * Cambiar cualquier filtro **vuelve a la página 1**: mantener la página al
 * estrechar el filtro deja al negocio mirando una lista vacía con resultados
 * detrás.
 */
export function FiltrosProductos({ categorias }: { categorias: CategoryDto[] }) {
  const router = useRouter();
  const parametros = useSearchParams();

  function aplicar(cambios: Record<string, string>) {
    const siguientes = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === '') siguientes.delete(clave);
      else siguientes.set(clave, valor);
    }
    siguientes.delete('page');
    router.push(`/negocio/productos?${siguientes.toString()}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        const datos = new FormData(evento.currentTarget);
        aplicar({ search: String(datos.get('search') ?? '') });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search">Buscar por nombre</Label>
        <Input
          id="search"
          name="search"
          defaultValue={parametros.get('search') ?? ''}
          className="w-56"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Estado</Label>
        <select
          id="status"
          name="status"
          defaultValue={parametros.get('status') ?? ''}
          onChange={(evento) => aplicar({ status: evento.target.value })}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          {/* Sin filtro: solo los activos —disponibles y agotados—. Los dados de
              baja se recuperan eligiendo su estado (supuesto 20). */}
          <option value="">Activos (disponibles y agotados)</option>
          {Object.values(ProductStatus).map((estado) => (
            <option key={estado} value={estado}>
              {ETIQUETA_ESTADO_PRODUCTO[estado]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoryId">Categoría</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={parametros.get('categoryId') ?? ''}
          onChange={(evento) => aplicar({ categoryId: evento.target.value })}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          <option value="">Todas</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" variant="outline">
        Buscar
      </Button>
    </form>
  );
}
