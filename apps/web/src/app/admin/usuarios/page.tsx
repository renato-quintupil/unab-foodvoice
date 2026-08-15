import Link from 'next/link';
import { Suspense } from 'react';
import {
  ETIQUETA_ESTADO,
  ETIQUETA_ROL,
  type Paginated,
  type UserDto,
} from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { pedirALaApi } from '@/lib/api-servidor';
import { formatearFecha } from '@/lib/fechas';
import { AccionesUsuario } from './_components/acciones-usuario';
import { Filtros } from './_components/filtros';
import { SinResultados } from './_components/sin-resultados';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuarios · FoodVoice' };

/**
 * Listado del padrón (T096, FR-015).
 *
 * Búsqueda, filtros por rol y estado, paginación de 20 y **total de
 * resultados**, que es el recuento de los que cumplen los criterios aplicados y
 * no el del padrón completo.
 */
export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const consulta = new URLSearchParams();
  for (const clave of ['search', 'role', 'status', 'page'] as const) {
    const valor = parametros[clave];
    if (typeof valor === 'string' && valor !== '') consulta.set(clave, valor);
  }

  const pagina = await pedirALaApi<Paginated<UserDto>>(
    `/admin/users?${consulta.toString()}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo">Nuevo usuario</Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <Filtros />
      </Suspense>

      <p className="text-sm text-[var(--color-tenue)]">
        {pagina.total === 1 ? '1 resultado' : `${pagina.total} resultados`}
      </p>

      {pagina.items.length === 0 ? (
        <SinResultados />
      ) : (
        // El desbordamiento horizontal se resuelve dentro de este contenedor:
        // el cuerpo de la página nunca se desplaza a lo ancho (FR-040).
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <caption className="sr-only">Padrón de usuarios de FoodVoice</caption>
            <thead>
              <tr className="border-b border-[var(--color-borde)] text-left">
                <th scope="col" className="py-2 pr-3">Nombre</th>
                <th scope="col" className="py-2 pr-3">Correo electrónico</th>
                <th scope="col" className="py-2 pr-3">Teléfono</th>
                <th scope="col" className="py-2 pr-3">Rol</th>
                <th scope="col" className="py-2 pr-3">Estado</th>
                <th scope="col" className="py-2 pr-3">Alta</th>
                <th scope="col" className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagina.items.map((usuario) => (
                <tr key={usuario.id} className="border-b border-[var(--color-borde)] align-top">
                  <td className="py-3 pr-3">
                    <Link
                      href={`/admin/usuarios/${usuario.id}/editar`}
                      className="underline underline-offset-4"
                    >
                      {usuario.fullName}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">{usuario.email}</td>
                  <td className="py-3 pr-3">{usuario.phone}</td>
                  <td className="py-3 pr-3">{ETIQUETA_ROL[usuario.role]}</td>
                  <td className="py-3 pr-3">{ETIQUETA_ESTADO[usuario.status]}</td>
                  <td className="py-3 pr-3">{formatearFecha(usuario.createdAt)}</td>
                  <td className="py-3">
                    <AccionesUsuario usuario={usuario} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion pagina={pagina} consulta={consulta} />
    </div>
  );
}

function Paginacion({
  pagina,
  consulta,
}: {
  pagina: Paginated<UserDto>;
  consulta: URLSearchParams;
}) {
  if (pagina.totalPages <= 1) return null;

  const enlace = (numero: number) => {
    const copia = new URLSearchParams(consulta);
    copia.set('page', String(numero));
    return `/admin/usuarios?${copia.toString()}`;
  };

  return (
    <nav aria-label="Paginación" className="flex items-center gap-4 text-sm">
      {pagina.page > 1 && (
        <Link href={enlace(pagina.page - 1)} className="underline underline-offset-4">
          Anterior
        </Link>
      )}
      <span>
        Página {pagina.page} de {pagina.totalPages}
      </span>
      {pagina.page < pagina.totalPages && (
        <Link href={enlace(pagina.page + 1)} className="underline underline-offset-4">
          Siguiente
        </Link>
      )}
    </nav>
  );
}
