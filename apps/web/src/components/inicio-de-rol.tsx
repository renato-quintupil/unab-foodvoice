import Link from 'next/link';
import { ETIQUETA_ROL, Role, type SessionUser } from '@foodvoice/shared';
import { CerrarSesion } from '@/components/cerrar-sesion';
import { Button } from '@/components/ui/button';

/**
 * Página de inicio de un rol no administrador (T071 de E1, T073 de E3, FR-031).
 *
 * En E1 contenía **exactamente cuatro cosas** y ninguna acción, porque una
 * función del rol antes de que su épica la especificara habría sido alcance
 * fantasma (Principio III). E3 especifica la primera: el menú, que los cuatro
 * roles consultan por igual (supuesto 13). Cliente y repartidor comparten esta
 * pantalla, de modo que el enlace aparece una sola vez y para los dos.
 *
 * **Ninguno de los dos ve la administración del catálogo**: administrarlo es del
 * rol negocio, y la separación no depende de que este enlace exista o no, sino de
 * los guards de la API, que rechazan igual una llamada directa (FR-027).
 *
 * La etiqueta sale de `ETIQUETA_ROL`, que es la razón por la que el
 * identificador interno en mayúsculas nunca llega a la pantalla.
 */
export function InicioDeRol({ sesion }: { sesion: SessionUser }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{sesion.fullName}</h1>
      <p className="text-[var(--color-tenue)]">{ETIQUETA_ROL[sesion.role]}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/menu">Ver el menú</Link>
        </Button>
        {/* Solo el cliente tiene carrito y pedidos (RN-001, HU-12, HU-01). */}
        {sesion.role === Role.CLIENTE && (
          <>
            <Button asChild variant="outline">
              <Link href="/cliente/carrito">Mi carrito</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cliente/direcciones">Mis direcciones</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/cliente/pedidos">Mis pedidos</Link>
            </Button>
          </>
        )}
      </div>
      <div>
        <CerrarSesion />
      </div>
    </main>
  );
}
