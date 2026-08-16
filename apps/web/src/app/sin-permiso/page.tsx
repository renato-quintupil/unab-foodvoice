import Link from 'next/link';
import { MSG_SIN_PERMISO } from '@foodvoice/shared';
import { DESTINO_POR_ROL, leerSesion } from '@/lib/sesion-servidor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acceso denegado · FoodVoice' };

/**
 * Acceso denegado (T072, FR-003, ux CHK004, A17).
 *
 * Es **página propia y no un aviso** sobre la vista restringida: un aviso
 * encima llegaría tarde, porque para entonces la vista ya habría mostrado su
 * contenido.
 *
 * Y **no cierra la sesión**: equivocarse de dirección no es un problema de
 * identidad. La persona sigue autenticada y vuelve a su página de inicio.
 */
export default async function PaginaSinPermiso() {
  const sesion = await leerSesion();
  const destino = sesion ? DESTINO_POR_ROL[sesion.role] : '/login';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Acceso denegado</h1>
      <p>{MSG_SIN_PERMISO}</p>
      <p>
        <Link href={destino} className="text-[var(--color-primario)] underline underline-offset-4">
          Volver a mi página de inicio
        </Link>
      </p>
    </main>
  );
}
