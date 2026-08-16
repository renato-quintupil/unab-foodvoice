'use client';

import { useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { CatalogAction } from '@foodvoice/shared';
import { AvisoExitoCatalogo } from '@/components/aviso-exito-catalogo';

/**
 * Confirmaciones de éxito que **sobreviven a que su fila desaparezca** (FR-025).
 *
 * **Por qué existe.** La validación funcional de E3 encontró esto: al dar de baja
 * un producto desde el listado, la confirmación se pintaba dentro de la propia
 * fila, y la fila desaparecía en el mismo instante —el listado sin filtros solo
 * muestra los activos—. El resultado era que la acción más delicada de la épica,
 * la única que exige confirmación explícita, era **la única que no confirmaba
 * nada**: el producto se esfumaba de la pantalla sin decir por qué.
 *
 * Es el mismo tipo de defecto que E1 encontró al validar a mano y que ninguna
 * prueba automática detecta: cada pieza funcionaba, y aun así el usuario no veía
 * el mensaje.
 *
 * La solución es elevar el aviso **por encima del listado**, donde no se desmonta
 * al refrescarse los datos. Las filas publican aquí su éxito en lugar de
 * pintarlo, y el aviso queda a la vista aunque la fila ya no exista.
 *
 * Fuera de un proveedor, `useAvisoCatalogo` devuelve `null`: quien lo use
 * entonces pinta el aviso donde estaba, que es lo correcto para un formulario de
 * página completa —allí no hay lista de la que salirse—.
 *
 * **Hasta dónde sobrevive.** Sobrevivir a la fila no es sobrevivir a todo: el
 * aviso vale para el listado en el que ocurrió la acción. Al cambiar los filtros
 * se está mirando otra cosa, y «Se dio de baja Pizza Cuatro Quesos.» sobre una
 * lista donde ese producto ya no figura describe una pantalla que no está a la
 * vista. Por eso el aviso recuerda con qué parámetros de búsqueda nació y se
 * retira en cuanto cambian.
 *
 * El refresco que dispara la propia acción no toca los parámetros, así que la
 * confirmación que E3 arregló sigue apareciendo: lo que la retira es que la
 * persona navegue a otro listado, no que los datos se recarguen.
 */
type Aviso = { accion: CatalogAction; nombre: string };

/** El aviso junto al listado al que se refiere, para saber cuándo caduca. */
type AvisoVigente = Aviso & { parametros: string };

const Contexto = createContext<((aviso: Aviso) => void) | null>(null);

export function useAvisoCatalogo(): ((aviso: Aviso) => void) | null {
  return useContext(Contexto);
}

export function AvisosCatalogo({ children }: { children: ReactNode }) {
  const parametros = useSearchParams().toString();
  const [aviso, setAviso] = useState<AvisoVigente | null>(null);

  const publicar = useCallback(
    (nuevo: Aviso) => setAviso({ ...nuevo, parametros }),
    [parametros],
  );

  // Derivado en el render, sin efecto: el aviso caduca en la misma pintura en
  // que llegan los parámetros nuevos, de modo que no llega a verse sobre el
  // listado al que ya no pertenece.
  const vigente = aviso?.parametros === parametros ? aviso : null;

  return (
    <Contexto.Provider value={publicar}>
      {/* Reserva el sitio arriba del listado; el aviso aparece donde la vista
          empieza, no al final de una tabla de veinte filas. */}
      {vigente && <AvisoExitoCatalogo accion={vigente.accion} nombre={vigente.nombre} />}
      {children}
    </Contexto.Provider>
  );
}
