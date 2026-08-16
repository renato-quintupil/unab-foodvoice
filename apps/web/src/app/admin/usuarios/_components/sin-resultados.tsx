import Link from 'next/link';
import { MSG_SIN_RESULTADOS_USUARIOS } from '@foodvoice/shared';

/**
 * Estado vacío del listado (T097, FR-015, SC-020).
 *
 * Cero resultados **no es un error**: la API devuelve `200` con lista vacía y
 * la interfaz lo dice en español. Ofrece volver a la primera página, que es la
 * salida del caso más común —haber navegado a una página que un filtro más
 * estrecho dejó fuera de rango—.
 */
export function SinResultados() {
  return (
    <div className="rounded-md border border-[var(--color-borde)] px-4 py-8 text-center">
      <p>{MSG_SIN_RESULTADOS_USUARIOS}</p>
      <p className="mt-2">
        <Link
          href="/admin/usuarios"
          className="text-[var(--color-primario)] underline underline-offset-4"
        >
          Volver a la primera página
        </Link>
      </p>
    </div>
  );
}
