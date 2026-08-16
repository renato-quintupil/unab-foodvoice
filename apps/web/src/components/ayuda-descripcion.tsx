import { AYUDA_DESCRIPCION_CATEGORIA, AYUDA_DESCRIPCION_PRODUCTO } from '@foodvoice/shared';

/**
 * Ayuda contextual del campo de descripción (FR-005, FR-016, SC-019,
 * § Ayuda contextual de los campos de descripción).
 *
 * Muestra las **dos** cosas que el requisito exige, junto al campo y **visibles
 * antes de escribir nada**:
 *
 * 1. Un ejemplo real y completo de descripción bien escrita, del largo esperado.
 * 2. Una explicación de para qué se usa: que es el texto con el que el cliente
 *    podrá encontrar el producto o la categoría hablando.
 *
 * **No es un `placeholder`.** El requisito lo descarta expresamente: una marca de
 * agua desaparece al escribir, justo cuando la persona más necesita el ejemplo
 * delante. Tampoco es un `title` ni un desplegable: «legibles sin interacción
 * previa» significa que se ven al llegar al campo, y su ausencia se detecta
 * mirando la pantalla (SC-019, que no tiene cobertura automática).
 *
 * Los textos salen de `packages/shared`, de modo que las dos pantallas enseñen
 * lo mismo y la comprobación se haga en un solo sitio.
 */
export function AyudaDescripcion({ de }: { de: 'producto' | 'categoria' }) {
  const ayuda = de === 'producto' ? AYUDA_DESCRIPCION_PRODUCTO : AYUDA_DESCRIPCION_CATEGORIA;

  return (
    <div
      data-testid={`ayuda-descripcion-${de}`}
      className="rounded-md border border-[var(--color-borde)] bg-[var(--color-suave,transparent)] px-3 py-2 text-sm"
    >
      <p className="text-[var(--color-tenue)]">{ayuda.explicacion}</p>
      <p className="mt-2">
        <span className="font-medium">Por ejemplo: </span>
        <span className="italic">«{ayuda.ejemplo}»</span>
      </p>
    </div>
  );
}
