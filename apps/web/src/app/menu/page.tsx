import Link from 'next/link';
import {
  ETIQUETA_ESTADO_PRODUCTO,
  ETIQUETA_TRAMO,
  MSG_MENU_VACIO,
  MSG_SIN_RESULTADOS_CATALOGO,
  ProductStatus,
  Role,
  formatearPrecio,
  recortarDescripcion,
  type CategoryDto,
  type MenuResponse,
  type ProductDto,
} from '@foodvoice/shared';
import { AgregarAlCarrito } from '@/components/agregar-al-carrito';
import { pedirALaApi } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';
import { FiltrosMenu } from './_components/filtros-menu';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Menú · FoodVoice' };

/**
 * El menú, tal como lo ve el cliente (T067, T068, T071, T072, T078, T088).
 *
 * **Sin paginación** (D-029, FR-031): el catálogo se recorre entero en una
 * pantalla desplazable. Paginarlo obligaría al cliente a saber en qué página está
 * lo que busca, que es justo lo que los filtros existen para evitar.
 *
 * **Abierta a los cuatro roles** (supuesto 12): quien tenga sesión ve el menú. La
 * exclusión de los productos no ofrecibles no la hace esta pantalla sino la
 * consulta (RN-018), de modo que ninguna vía —incluida la de voz de E6— pueda
 * saltársela.
 *
 * Dos vacíos que **no son el mismo** y no comparten mensaje (FR-030, FR-035):
 * un catálogo sin ningún producto activo y una combinación de filtros sin
 * resultados. Confundirlos haría creer al cliente que el local no tiene menú
 * cuando solo pidió algo demasiado estrecho.
 */
export default async function PaginaMenu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await exigirSesion();
  const parametros = await searchParams;

  const consulta = new URLSearchParams();
  for (const clave of ['foodTypeCategoryId', 'healthProfileCategoryId', 'priceTier'] as const) {
    const valor = parametros[clave];
    if (typeof valor === 'string' && valor !== '') consulta.set(clave, valor);
  }
  const hayFiltros = consulta.toString() !== '';

  const [menu, categorias] = await Promise.all([
    pedirALaApi<MenuResponse>(`/menu/products?${consulta.toString()}`),
    pedirALaApi<{ items: CategoryDto[] }>('/menu/categories'),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Menú</h1>

      <FiltrosMenu categorias={categorias.items} />

      {menu.items.length === 0 ? (
        <p className="rounded-md border border-[var(--color-borde)] px-4 py-6 text-sm">
          {/* Sin filtros aplicados, un menú vacío significa que el catálogo no
              tiene ningún producto activo; con filtros, que esa combinación no
              devuelve nada. Ni error, ni pantalla en blanco, ni carga
              permanente (SC-018, SC-022). */}
          {hayFiltros ? MSG_SIN_RESULTADOS_CATALOGO : MSG_MENU_VACIO}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menu.items.map((producto) => (
            <li key={producto.id}>
              <TarjetaDeProducto producto={producto} esCliente={sesion.role === Role.CLIENTE} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/**
 * Un producto en el menú.
 *
 * El **agotado va marcado y sin ninguna acción para seleccionarlo** (T068,
 * FR-029, SC-004): la etiqueta se ve sin desplegar nada ni pasar el cursor, y no
 * hay ningún control que permita pedirlo. Ocultarlo sería el error contrario y
 * haría creer que el local dejó de ofrecerlo (RN-003).
 *
 * La descripción va **recortada** (D-033, T088); completa está en la ficha. El
 * precio se compone con `formatearPrecio` y nunca a mano (T078).
 */
function TarjetaDeProducto({
  producto,
  esCliente,
}: {
  producto: ProductDto;
  esCliente: boolean;
}) {
  const agotado = producto.status === ProductStatus.AGOTADO;

  return (
    <article
      className="flex h-full flex-col gap-2 rounded-md border border-[var(--color-borde)] p-4"
      data-testid="producto"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">
          <Link href={`/menu/${producto.id}`} className="underline underline-offset-4">
            {producto.name}
          </Link>
        </h2>
        <span className="text-sm">{formatearPrecio(producto.price)}</span>
      </div>

      {agotado && (
        <p
          data-testid="agotado"
          className="w-fit rounded-md border border-[var(--color-borde)] px-2 py-0.5 text-xs"
        >
          {ETIQUETA_ESTADO_PRODUCTO[ProductStatus.AGOTADO]}
        </p>
      )}

      <p className="text-sm text-[var(--color-tenue)]">
        {recortarDescripcion(producto.description)}
      </p>

      <p className="text-xs text-[var(--color-tenue)]">
        {producto.foodTypeCategory.name} · {producto.healthProfileCategory.name}
        {producto.priceTier && ` · ${ETIQUETA_TRAMO[producto.priceTier]}`}
      </p>

      {esCliente && !agotado && (
        <div className="mt-auto pt-2">
          <AgregarAlCarrito productId={producto.id} />
        </div>
      )}
    </article>
  );
}
