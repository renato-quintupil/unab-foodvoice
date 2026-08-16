'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CatalogAction,
  ETIQUETA_DIMENSION,
  MSG_ERROR_INESPERADO,
  type CategoryDto,
} from '@foodvoice/shared';
import { AvisoExitoCatalogo } from '@/components/aviso-exito-catalogo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Desactivar y reactivar una categoría (T034, T035, T036, FR-007, FR-008,
 * FR-025, FR-026).
 *
 * Las dos piden **confirmación explícita y cancelable**, y las dos son
 * reversibles con la acción contraria. **No existe ninguna acción de borrado**
 * (FR-009): la desactivación es el único camino de retirada.
 *
 * El rechazo de FR-007 se presenta **con el número de productos que lo
 * bloquean**, tomado de `blockingProducts` del cuerpo y **no analizando el
 * texto** del mensaje: si mañana se reescribe el mensaje, la cifra sigue
 * saliendo del dato. Se muestra dentro del diálogo, que permanece abierto, para
 * que el negocio lea el motivo sin perder de vista qué intentaba hacer.
 */
export function AccionesCategoria({ categoria }: { categoria: CategoryDto }) {
  const router = useRouter();
  const [exito, setExito] = useState<CatalogAction | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const desactivando = categoria.active;
  const accion = desactivando
    ? CatalogAction.DESACTIVAR_CATEGORIA
    : CatalogAction.REACTIVAR_CATEGORIA;

  async function cambiarEstado(): Promise<boolean> {
    setAviso(null);
    setExito(null);
    try {
      await api.put(`/business/categories/${categoria.id}/status`, { active: !categoria.active });
      setExito(accion);
      router.refresh();
      return true;
    } catch (fallo) {
      // El aviso de éxito nunca convive con un error: o una cosa o la otra.
      if (!(fallo instanceof ErrorDeApi)) {
        setAviso(MSG_ERROR_INESPERADO);
        return false;
      }
      setAviso(fallo.mensaje);
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {exito && <AvisoExitoCatalogo accion={exito} nombre={categoria.name} />}

      <ConfirmarAccion
        etiqueta={desactivando ? 'Desactivar' : 'Reactivar'}
        titulo={desactivando ? 'Desactivar categoría' : 'Reactivar categoría'}
        descripcion={
          desactivando
            ? `«${categoria.name}» (${ETIQUETA_DIMENSION[categoria.dimension]}) dejará de ofrecerse como filtro al cliente y en el alta de productos. Seguirá visible aquí, marcada como desactivada, y no se borra ningún dato.`
            : `«${categoria.name}» (${ETIQUETA_DIMENSION[categoria.dimension]}) volverá a ofrecerse como filtro al cliente y en el alta de productos, con su nombre y su descripción intactos.`
        }
        // Toda retirada del catálogo es reversible con su acción contraria
        // (FR-009, SC-006).
        reversible
        textoConfirmar={desactivando ? 'Desactivar' : 'Reactivar'}
        onConfirmar={cambiarEstado}
        aviso={aviso}
        alCerrar={() => setAviso(null)}
      />
    </div>
  );
}
