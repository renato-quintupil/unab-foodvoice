'use client';

import { MSG_EXITO, type AdminAction } from '@foodvoice/shared';

/**
 * Confirmación de éxito tras una acción administrativa (T102, FR-037, SC-037,
 * ux CHK003).
 *
 * Pedir confirmación antes (FR-035) y no decir nada después dejaría al
 * administrador sin poder distinguir el éxito de un fallo silencioso. Por eso
 * este aviso aparece **solo cuando el cambio quedó firme**, y **nunca junto a
 * un mensaje de error**.
 *
 * El texto sale de `MSG_EXITO`, indexado por `AdminAction`: añadir una acción
 * registrable sin su mensaje de éxito deja de compilar.
 */
export type AvisoExitoProps = {
  accion: AdminAction;
  /** Nombre del usuario afectado, para que el aviso diga a quién se aplicó. */
  nombre: string;
};

export function AvisoExito({ accion, nombre }: AvisoExitoProps) {
  return (
    <p
      role="status"
      data-testid="aviso-exito"
      className="rounded-md border border-[var(--color-exito)] px-3 py-2 text-sm text-[var(--color-exito)]"
    >
      {MSG_EXITO[accion](nombre)}
    </p>
  );
}
