import { HUSO_REFERENCIA } from '@foodvoice/shared';

/**
 * Formato visible de las fechas: `DD/MM/AAAA` (FR-022, ux CHK021, ux CHK026).
 *
 * **El formato interno nunca aparece en pantalla.** La API devuelve ISO 8601 en
 * UTC y la conversión al huso de referencia del producto ocurre aquí, que es el
 * único lugar de la interfaz que la hace: si cada vista formateara por su
 * cuenta, dos pantallas mostrarían días distintos para el mismo instante.
 */
export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: HUSO_REFERENCIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
