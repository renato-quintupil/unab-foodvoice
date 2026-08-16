import Link from 'next/link';
import { MSG_PRODUCTO_NO_ENCONTRADO } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';

/**
 * La misma pantalla para un identificador inexistente y para un producto que ya
 * no está en el menú (T070, D-032).
 *
 * Vive en `not-found.tsx` y no dentro de `page.tsx` para que la respuesta lleve
 * **código 404**: la pantalla ya decía lo correcto, pero un 200 le dice a todo
 * lo que no es una persona —buscadores, monitoreo, pruebas de humo— que la
 * dirección es válida.
 *
 * El 404 no debilita a FR-028, lo refuerza: **los dos casos siguen siendo
 * indistinguibles**, ahora también en el código de respuesta, de modo que
 * tampoco desde fuera del navegador se puede averiguar si un identificador
 * corresponde a un producto retirado.
 */
export default function FichaProductoNoEncontrada() {
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
