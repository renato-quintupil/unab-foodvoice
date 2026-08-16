'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Dimension,
  ETIQUETA_DIMENSION,
  ETIQUETA_TRAMO,
  PriceTier,
  type CategoryDto,
} from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Filtros del menú (T067, FR-031, FR-033, FR-035, SC-018, SC-025).
 *
 * Son **tres desplegables combinables**, uno por cada dimensión y uno de tramo de
 * precio, y esa es exactamente la paridad que el Principio VI exige: todo lo que
 * E6 resolverá por voz —«una pizza saludable y económica»— se alcanza aquí sin
 * hablar, componiendo los tres.
 *
 * Los filtros viajan en la dirección y no en estado local, con el mismo criterio
 * que en la administración: una dirección concreta describe siempre el mismo
 * menú, se puede recargar y se puede compartir.
 *
 * **Cada control aplica al cambiar**, sin botón de «buscar»: el menú no se pagina
 * (D-029) y no hay texto libre que escribir, de modo que exigir una confirmación
 * añadiría un clic a cada ajuste sin ganar nada. «Quitar filtros» está siempre
 * visible para que del resultado vacío se salga en un solo clic (FR-035).
 */
export function FiltrosMenu({ categorias }: { categorias: CategoryDto[] }) {
  const router = useRouter();
  const parametros = useSearchParams();

  const deDimension = (dimension: Dimension) =>
    categorias.filter((categoria) => categoria.dimension === dimension);

  function aplicar(clave: string, valor: string) {
    const siguientes = new URLSearchParams(parametros.toString());
    if (valor === '') siguientes.delete(clave);
    else siguientes.set(clave, valor);
    router.push(siguientes.toString() === '' ? '/menu' : `/menu?${siguientes.toString()}`);
  }

  const hayFiltros = ['foodTypeCategoryId', 'healthProfileCategoryId', 'priceTier'].some((clave) =>
    parametros.get(clave),
  );

  return (
    <form
      aria-label="Filtros del menú"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(evento) => evento.preventDefault()}
    >
      <SelectorDeCategoria
        id="foodTypeCategoryId"
        etiqueta={ETIQUETA_DIMENSION[Dimension.TIPO_COMIDA]}
        categorias={deDimension(Dimension.TIPO_COMIDA)}
        valor={parametros.get('foodTypeCategoryId') ?? ''}
        alCambiar={(valor) => aplicar('foodTypeCategoryId', valor)}
      />

      <SelectorDeCategoria
        id="healthProfileCategoryId"
        etiqueta={ETIQUETA_DIMENSION[Dimension.PERFIL_SALUD]}
        categorias={deDimension(Dimension.PERFIL_SALUD)}
        valor={parametros.get('healthProfileCategoryId') ?? ''}
        alCambiar={(valor) => aplicar('healthProfileCategoryId', valor)}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceTier">Precio</Label>
        <select
          id="priceTier"
          name="priceTier"
          value={parametros.get('priceTier') ?? ''}
          onChange={(evento) => aplicar('priceTier', evento.target.value)}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          <option value="">Cualquiera</option>
          {Object.values(PriceTier).map((tramo) => (
            <option key={tramo} value={tramo}>
              {ETIQUETA_TRAMO[tramo]}
            </option>
          ))}
        </select>
      </div>

      {hayFiltros && (
        <Button type="button" variant="ghost" onClick={() => router.push('/menu')}>
          Quitar filtros
        </Button>
      )}
    </form>
  );
}

function SelectorDeCategoria({
  id,
  etiqueta,
  categorias,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  categorias: CategoryDto[];
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <select
        id={id}
        name={id}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
      >
        <option value="">Cualquiera</option>
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.name}
          </option>
        ))}
      </select>
    </div>
  );
}
