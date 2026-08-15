import { ETIQUETA_ROL, type SessionUser } from '@foodvoice/shared';
import { CerrarSesion } from '@/components/cerrar-sesion';

/**
 * Página de inicio de un rol no administrador (T071, FR-031, ux CHK010).
 *
 * Contiene **exactamente cuatro cosas**: el nombre completo, la etiqueta
 * visible del rol, «Cerrar sesión» y **ninguna otra acción**. Una función del
 * rol antes de que su épica la especifique sería alcance fantasma
 * (Principio III). El paso A18 de la guía lo comprueba a ojo.
 *
 * La etiqueta sale de `ETIQUETA_ROL`, que es la razón por la que el
 * identificador interno en mayúsculas nunca llega a la pantalla.
 */
export function InicioDeRol({ sesion }: { sesion: SessionUser }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{sesion.fullName}</h1>
      <p className="text-[var(--color-tenue)]">{ETIQUETA_ROL[sesion.role]}</p>
      <div>
        <CerrarSesion />
      </div>
    </main>
  );
}
