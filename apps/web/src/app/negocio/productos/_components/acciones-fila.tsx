'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CatalogAction,
  MSG_ERROR_INESPERADO,
  ProductStatus,
  formatearPrecio,
  type ProductDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { AvisoExitoCatalogo } from '@/components/aviso-exito-catalogo';
import { useAvisoCatalogo } from '@/components/avisos-catalogo';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Acciones de una fila del listado de productos (T054, T055, T056, T057,
 * FR-019, FR-020, FR-021, FR-025, FR-026, SC-002).
 *
 * **Agotar y reponer no piden confirmación** y están aquí, en la fila, en un solo
 * clic desde el listado (FR-019, SC-002). Es la única acción de la épica exenta,
 * y la exención es deliberada: ocurre varias veces al día en medio del servicio,
 * es inmediatamente reversible con la acción contraria y no destruye ningún dato.
 * Exigir confirmación haría imposible el criterio de dos clics.
 *
 * **Dar de baja y reactivar sí la piden** (FR-020): ambas cambian lo que el
 * cliente ve en el menú y no forman parte de la rutina del servicio. Reutilizan el
 * `ConfirmarAccion` de E1 en lugar de un diálogo propio —el plan lo situaba en un
 * archivo `dialogo-confirmacion.tsx`—, porque ya cumple lo que FR-020 y FR-037
 * piden: teclado, foco, cancelación sin efecto y **permanecer abierto ante un
 * rechazo**, que es justo lo que hace falta para presentar el
 * `409 CATEGORY_INACTIVE` de FR-021 sin perder de vista qué se intentaba.
 */
export function AccionesFila({ producto }: { producto: ProductDto }) {
  const router = useRouter();
  const publicarExito = useAvisoCatalogo();
  const [exito, setExito] = useState<CatalogAction | null>(null);
  // **Dos avisos de rechazo, no uno.** El del diálogo lo pinta `ConfirmarAccion`
  // dentro de él; el de la fila sirve a agotar y reponer, que no tienen diálogo.
  // Compartir un solo estado hacía que un rechazo de la baja se mostrara **dos
  // veces** —en el diálogo y debajo de la fila—, y un lector de pantalla lo
  // anunciaba dos veces. Lo encontró la validación funcional de E3.
  const [avisoDeFila, setAvisoDeFila] = useState<string | null>(null);
  const [avisoDeDialogo, setAvisoDeDialogo] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState(false);

  const dadoDeBaja = producto.status === ProductStatus.DADO_DE_BAJA;
  const agotado = producto.status === ProductStatus.AGOTADO;

  /**
   * `enDialogo` decide **dónde** se presenta el rechazo y **dónde** el éxito.
   *
   * Una acción con diálogo hace desaparecer la fila del listado —una baja sale
   * de la vista por omisión, que solo muestra los activos—, así que su éxito se
   * publica por encima del listado; si se pintara aquí se desmontaría con la fila
   * y la acción no confirmaría nada.
   */
  async function ejecutar(
    accion: CatalogAction,
    llamada: () => Promise<unknown>,
    enDialogo: boolean,
  ): Promise<boolean> {
    const marcarAviso = enDialogo ? setAvisoDeDialogo : setAvisoDeFila;
    marcarAviso(null);
    setExito(null);
    setEnCurso(true);
    try {
      await llamada();
      if (enDialogo && publicarExito) publicarExito({ accion, nombre: producto.name });
      else setExito(accion);
      router.refresh();
      return true;
    } catch (fallo) {
      // El aviso de éxito nunca convive con un error (FR-025).
      marcarAviso(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
      return false;
    } finally {
      setEnCurso(false);
    }
  }

  const cambiarDisponibilidad = () =>
    ejecutar(
      agotado ? CatalogAction.REPONER_PRODUCTO : CatalogAction.AGOTAR_PRODUCTO,
      () => api.put(`/business/products/${producto.id}/availability`, { available: agotado }),
      // Sin diálogo: la fila permanece en el listado y el aviso se ve donde está.
      false,
    );

  const cambiarEstado = () =>
    ejecutar(
      dadoDeBaja ? CatalogAction.REACTIVAR_PRODUCTO : CatalogAction.DAR_DE_BAJA_PRODUCTO,
      () => api.put(`/business/products/${producto.id}/status`, { active: dadoDeBaja }),
      true,
    );

  return (
    <div className="flex flex-col gap-2">
      {exito && <AvisoExitoCatalogo accion={exito} nombre={producto.name} />}

      {/* Un rechazo que no pertenece a ningún diálogo —agotar o reponer— se
          presenta aquí, sobre la fila, conservando el listado. */}
      {avisoDeFila && (
        <p
          role="alert"
          data-testid="aviso-fila"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {avisoDeFila}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* Agotar y reponer: **sin diálogo**, un solo clic (SC-002). No se
            ofrece sobre un producto dado de baja, que no está en el menú. */}
        {!dadoDeBaja && (
          <AccionEnCurso
            variant="outline"
            size="sm"
            enCurso={enCurso}
            textoEnCurso="Guardando…"
            onClick={() => void cambiarDisponibilidad()}
          >
            {agotado ? 'Reponer' : 'Marcar agotado'}
          </AccionEnCurso>
        )}

        <Link
          href={`/negocio/productos/${producto.id}/editar`}
          className="rounded-md border border-[var(--color-borde)] px-3 py-1.5 text-sm"
        >
          Editar
        </Link>

        <ConfirmarAccion
          etiqueta={dadoDeBaja ? 'Reactivar' : 'Dar de baja'}
          titulo={dadoDeBaja ? 'Reactivar producto' : 'Dar de baja el producto'}
          descripcion={
            dadoDeBaja
              ? `«${producto.name}» (${formatearPrecio(producto.price)}) volverá al menú del cliente, disponible y con todos sus datos intactos.`
              : `«${producto.name}» (${formatearPrecio(producto.price)}) desaparecerá del menú del cliente y nadie podrá pedirlo. Seguirá aquí, marcado como dado de baja, y no se borra ningún dato.`
          }
          // Toda retirada es reversible con su acción contraria (SC-006).
          reversible
          textoConfirmar={dadoDeBaja ? 'Reactivar' : 'Dar de baja'}
          onConfirmar={cambiarEstado}
          aviso={avisoDeDialogo}
          alCerrar={() => setAvisoDeDialogo(null)}
        />

        {/* La salida que FR-021 exige ofrecer cuando la reactivación se bloquea
            por una categoría desactivada: reclasificarlo (T057). */}
        {dadoDeBaja && (
          <Link
            href={`/negocio/productos/${producto.id}/editar`}
            className="text-sm underline"
            data-testid="reclasificar"
          >
            Reclasificar
          </Link>
        )}
      </div>
    </div>
  );
}
