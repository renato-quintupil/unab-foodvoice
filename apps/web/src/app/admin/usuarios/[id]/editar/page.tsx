import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Paginated, UserDto } from '@foodvoice/shared';
import { pedirALaApi } from '@/lib/api-servidor';
import { FormularioEdicion } from './formulario-edicion';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar usuario · FoodVoice' };

/**
 * Edición de un usuario (FR-010).
 *
 * **Por qué esta página recorre el listado en lugar de pedir el usuario por su
 * identificador.** El contrato define doce endpoints y **ninguno lee un usuario
 * suelto**: la única lectura del padrón es `GET /admin/users`, paginada. Añadir
 * un `GET /admin/users/:id` sería superficie que ningún requisito pide, y el
 * Principio III lo prohíbe — si hiciera falta, correspondería enmendar la spec
 * antes de construirlo.
 *
 * El recorrido es aceptable en v1 y su límite está declarado: un solo local,
 * un padrón de pocas páginas y una lectura por navegación a esta pantalla. Si
 * el padrón creciera, esto sería lo primero que dejaría de servir, y entonces
 * el endpoint tendría un requisito real que lo justifique.
 */
export default async function PaginaEditarUsuario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await buscarUsuario(id);
  if (!usuario) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/admin/usuarios" className="text-sm underline underline-offset-4">
          Volver a Usuarios
        </Link>
        <h1 className="text-2xl font-semibold">Editar a {usuario.fullName}</h1>
      </div>
      <FormularioEdicion usuario={usuario} />
    </div>
  );
}

async function buscarUsuario(id: string): Promise<UserDto | null> {
  let pagina = 1;
  let totalPages = 1;

  do {
    const respuesta = await pedirALaApi<Paginated<UserDto>>(`/admin/users?page=${pagina}`);
    const encontrado = respuesta.items.find((usuario) => usuario.id === id);
    if (encontrado) return encontrado;

    totalPages = respuesta.totalPages;
    pagina += 1;
  } while (pagina <= totalPages);

  return null;
}
