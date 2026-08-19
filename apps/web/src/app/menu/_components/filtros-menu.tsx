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
    router.push(
      siguientes.toString() === '' ? '/menu' : `/menu?${siguientes.toString()}`,
    );
  }

  const hayFiltros = ['foodTypeCategoryId', 'healthProfileCategoryId', 'priceTier'].some(
    (clave) => parametros.get(clave),
  );
  const categoriasTipo = deDimension(Dimension.TIPO_COMIDA);
  const tipoSeleccionado = parametros.get('foodTypeCategoryId') ?? '';

  return (
    <form
      aria-label="Filtros del menú"
      className="flex flex-col gap-5"
      onSubmit={(evento) => evento.preventDefault()}
    >
      <div
        role="group"
        aria-label="Categorías de tipo de comida"
        className="flex max-w-full gap-2 overflow-x-auto pb-1"
      >
        <BotonCategoria
          etiqueta="Todas"
          activo={tipoSeleccionado === ''}
          onClick={() => aplicar('foodTypeCategoryId', '')}
        />
        {categoriasTipo.map((categoria) => (
          <BotonCategoria
            key={categoria.id}
            etiqueta={categoria.name}
            activo={tipoSeleccionado === categoria.id}
            onClick={() => aplicar('foodTypeCategoryId', categoria.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
      </div>
    </form>
  );
}

function BotonCategoria({
  etiqueta,
  activo,
  onClick,
}: {
  etiqueta: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
        activo
          ? 'border-[var(--color-primario)] bg-[var(--color-borde)] text-[var(--color-primario)]'
          : 'border-[var(--color-borde)] text-[var(--color-tenue)] hover:text-[var(--color-texto)]'
      }`}
    >
      <IconoCategoria nombre={etiqueta} />
      <span>{etiqueta}</span>
    </button>
  );
}

function IconoCategoria({ nombre }: { nombre: string }) {
  const normalizado = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="size-6"
    >
      <DibujoCategoria nombre={normalizado} />
    </svg>
  );
}

function DibujoCategoria({ nombre }: { nombre: string }) {
  if (nombre.includes('pizza')) {
    return (
      <>
        <path d="M5 19 12 4l7 15Z" />
        <path d="M8 14h8M10.5 10h.01M14 15.5h.01" />
      </>
    );
  }
  if (nombre.includes('sandwich')) {
    return (
      <>
        <path d="M4 10c1-4 4-6 8-6s7 2 8 6H4Z" />
        <path d="m5 12 3 2 4-2 4 2 3-2M5 16h14l-2 4H7Z" />
      </>
    );
  }
  if (nombre.includes('ensalada')) {
    return (
      <>
        <path d="M4 12h16c0 5-3 8-8 8s-8-3-8-8Z" />
        <path d="M8 12c-1-4 2-6 4-3 1-4 5-3 5 1" />
      </>
    );
  }
  return (
    <>
      <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />
    </>
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
