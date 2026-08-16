'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
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
 */
type Aviso = { accion: CatalogAction; nombre: string };

const Contexto = createContext<((aviso: Aviso) => void) | null>(null);

export function useAvisoCatalogo(): ((aviso: Aviso) => void) | null {
  return useContext(Contexto);
}

export function AvisosCatalogo({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);

  return (
    <Contexto.Provider value={setAviso}>
      {/* Reserva el sitio arriba del listado; el aviso aparece donde la vista
          empieza, no al final de una tabla de veinte filas. */}
      {aviso && <AvisoExitoCatalogo accion={aviso.accion} nombre={aviso.nombre} />}
      {children}
    </Contexto.Provider>
  );
}
