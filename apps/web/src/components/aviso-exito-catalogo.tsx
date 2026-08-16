'use client';

import { MSG_EXITO_CATALOGO, type CatalogAction } from '@foodvoice/shared';

/**
 * Confirmación de éxito tras una acción del catálogo (FR-025, T036, T056).
 *
 * Hermano de `AvisoExito`, que sirve a las acciones administrativas de E1. Son
 * **dos componentes y no uno** porque cada uno está indexado por su propio
 * conjunto de acciones —`AdminAction` y `CatalogAction`—, y eso es precisamente
 * lo que hace que añadir una acción sin su mensaje de éxito deje de compilar.
 * Fundirlos exigiría aceptar un texto ya resuelto y perder esa garantía.
 *
 * Aparece **solo cuando el cambio quedó firme**, y **nunca junto a un mensaje de
 * error**: si la acción se rechaza se muestra el error y no ambos (FR-025).
 */
export type AvisoExitoCatalogoProps = {
  accion: CatalogAction;
  /** Nombre del elemento afectado, para que el aviso diga a qué se aplicó. */
  nombre: string;
};

export function AvisoExitoCatalogo({ accion, nombre }: AvisoExitoCatalogoProps) {
  return (
    <p
      role="status"
      data-testid="aviso-exito"
      className="rounded-md border border-[var(--color-exito)] px-3 py-2 text-sm text-[var(--color-exito)]"
    >
      {MSG_EXITO_CATALOGO[accion](nombre)}
    </p>
  );
}
