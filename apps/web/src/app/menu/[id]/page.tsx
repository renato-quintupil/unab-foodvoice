import Link from 'next/link';
import {
  ETIQUETA_DIMENSION,
  ETIQUETA_ESTADO_PRODUCTO,
  ETIQUETA_TRAMO,
  Dimension,
  MSG_INGREDIENTES_REFERENCIALES,
  MSG_PRODUCTO_NO_ENCONTRADO,
  ProductStatus,
  formatearPrecio,
  type ProductDto,
} from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { pedirALaApiOpcional } from '@/lib/api-servidor';
import { exigirSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';

/**
 * Ficha de producto (T069, T070, T078, FR-017, FR-034, SC-020, D-032).
 *
 * Muestra la descripción **íntegra**, al contrario que el listado: es donde el
 * cliente decide, y el recorte de la tarjeta existe solo para que veinte
 * descripciones quepan en una pantalla (D-033).
 *
 * Un producto que no existe y uno dado de baja llevan **a la misma pantalla**, sin
 * ninguna diferencia observable: distinguirlos revelaría que el identificador
 * existe, que es justo lo que FR-028 evita al exigir que un producto retirado no
 * aparezca «ni accediendo directamente a su ficha por su dirección».
 */
export default async function PaginaFichaProducto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirSesion();
  const { id } = await params;

  const producto = await pedirALaApiOpcional<ProductDto>(`/menu/products/${id}`);
  if (!producto) return <NoEncontrado />;

  const agotado = producto.status === ProductStatus.AGOTADO;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <p>
        <Link href="/menu" className="text-sm underline underline-offset-4">
          Volver al menú
        </Link>
      </p>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{producto.name}</h1>
        <p className="text-lg">{formatearPrecio(producto.price)}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-tenue)]">
          {/* El estado va siempre visible, no solo cuando es un problema: el
              cliente tiene que poder saber de un vistazo si puede pedirlo. */}
          <span
            data-testid="estado"
            className="rounded-md border border-[var(--color-borde)] px-2 py-0.5"
          >
            {ETIQUETA_ESTADO_PRODUCTO[producto.status]}
          </span>
          <span>
            {ETIQUETA_DIMENSION[Dimension.TIPO_COMIDA]}: {producto.foodTypeCategory.name}
          </span>
          <span>
            {ETIQUETA_DIMENSION[Dimension.PERFIL_SALUD]}: {producto.healthProfileCategory.name}
          </span>
          {producto.priceTier && <span>Precio: {ETIQUETA_TRAMO[producto.priceTier]}</span>}
        </div>
      </header>

      {/* Ninguna acción para pedirlo, agotado o no: pedir es de E2. */}
      {agotado && (
        <p data-testid="agotado" className="text-sm">
          Este producto está agotado por ahora.
        </p>
      )}

      <section aria-labelledby="descripcion" className="flex flex-col gap-2">
        <h2 id="descripcion" className="text-lg font-medium">
          Descripción
        </h2>
        {/* Íntegra, sin recortar (D-033). */}
        <p className="text-sm">{producto.description}</p>
      </section>

      {/* **Sin ingredientes declarados, no hay sección ni advertencia** (T090).
          Lo exige el caso límite «Producto sin ingredientes declarados» de la
          spec: el campo es opcional y la ficha no muestra ninguna de las dos
          cosas. La advertencia acompaña a un dato; sin dato al que acompañar,
          anunciar que «los ingredientes son referenciales» habla de una lista
          que no existe, y la ausencia del campo nunca se lee como ausencia del
          ingrediente (RN-019) tampoco en la pantalla. */}
      {producto.ingredients && (
        <section aria-labelledby="ingredientes" className="flex flex-col gap-2">
          <h2 id="ingredientes" className="text-lg font-medium">
            Ingredientes
          </h2>
          <p className="text-sm">{producto.ingredients}</p>

          {/* Obligatoria y no configurable **siempre que se muestren
              ingredientes**: certificar la ausencia de un componente es
              seguridad alimentaria, no software (FR-017, RN-019, SC-020). */}
          <p role="note" data-testid="advertencia-ingredientes" className="text-sm">
            {MSG_INGREDIENTES_REFERENCIALES}
          </p>
        </section>
      )}
    </main>
  );
}

/**
 * La misma pantalla para un identificador inexistente y para un producto que ya
 * no está en el menú (T070, D-032).
 */
function NoEncontrado() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{MSG_PRODUCTO_NO_ENCONTRADO}</h1>
      <p className="text-sm text-[var(--color-tenue)]">
        Puede que ya no esté en el menú o que la dirección no sea correcta.
      </p>
      <Button asChild variant="outline">
        <Link href="/menu">Volver al menú</Link>
      </Button>
    </main>
  );
}
