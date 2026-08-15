import { HUSO_REFERENCIA } from '@foodvoice/shared';

/**
 * Formato visible de las fechas: `DD/MM/AAAA` (FR-022, ux CHK021, ux CHK026).
 *
 * **El formato interno nunca aparece en pantalla.** La API devuelve ISO 8601 en
 * UTC y la conversión al huso de referencia del producto ocurre aquí, que es el
 * único lugar de la interfaz que la hace: si cada vista formateara por su
 * cuenta, dos pantallas mostrarían días distintos para el mismo instante.
 *
 * **Por qué se arma el texto a mano en lugar de dejárselo a `Intl`.** El
 * formato corto de `es-CL` usa guiones —`15-08-2026`—, así que confiar en el
 * predeterminado del idioma habría incumplido el `DD/MM/AAAA` que exige el
 * requisito, y de una forma que ninguna prueba de la interfaz habría notado
 * hasta verla en pantalla. `Intl` sigue haciendo lo que solo él puede hacer:
 * resolver a qué día del calendario corresponde el instante en el huso de
 * referencia, incluidos los cambios de horario.
 */
export function formatearFecha(iso: string): string {
  const partes = new Intl.DateTimeFormat('es-CL', {
    timeZone: HUSO_REFERENCIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date(iso));

  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${valor('day')}/${valor('month')}/${valor('year')}`;
}
