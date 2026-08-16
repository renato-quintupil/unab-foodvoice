'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CatalogAction,
  CreateCategorySchema,
  Dimension,
  ETIQUETA_DIMENSION,
  MSG_ERROR_INESPERADO,
  UpdateCategorySchema,
  type CategoryDto,
  type CreateCategoryInput,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { AvisoExitoCatalogo } from '@/components/aviso-exito-catalogo';
import { AyudaDescripcion } from '@/components/ayuda-descripcion';
import { Campo } from '@/components/campo';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Alta y edición de una categoría (T031, T033, FR-002, FR-003, FR-005, FR-006).
 *
 * **Un solo formulario para las dos operaciones**, y no dos: § Límites de los
 * campos exige que las mismas reglas rijan al crear y al editar, «de modo que
 * ninguna edición pueda dejar un registro en un estado que su alta habría
 * rechazado». Dos formularios serían dos sitios donde esa igualdad puede
 * romperse sin que nada avise.
 *
 * La única diferencia es la **dimensión**: se elige al crear y **no es editable**
 * después (FR-006). Al editar se muestra como dato, sin ningún control para
 * cambiarla —no un desplegable deshabilitado, que sugiere que podría abrirse—,
 * porque cambiarla movería de golpe todos los productos clasificados con ella a
 * otra pregunta distinta.
 *
 * El esquema aplicado es **el mismo que aplicará el servidor**, incluidas las
 * tres condiciones de sustancia de FR-039: no puede existir una descripción que
 * esta pantalla acepte y la API rechace (D-025).
 */
export type FormularioCategoriaProps = {
  /** Presente al editar; ausente al crear. */
  categoria?: CategoryDto;
};

export function FormularioCategoria({ categoria }: FormularioCategoriaProps) {
  const router = useRouter();
  const editando = categoria !== undefined;
  const [guardada, setGuardada] = useState<CategoryDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryInput>({
    // Al editar se usa el esquema sin `dimension`, que es el que la API acepta.
    resolver: zodResolver(editando ? UpdateCategorySchema : CreateCategorySchema),
    defaultValues: {
      dimension: categoria?.dimension ?? Dimension.TIPO_COMIDA,
      name: categoria?.name ?? '',
      description: categoria?.description ?? '',
    },
  });

  async function enviar(datos: CreateCategoryInput) {
    setError(null);
    setGuardada(null);
    try {
      const resultado = editando
        ? await api.patch<CategoryDto>(`/business/categories/${categoria.id}`, {
            name: datos.name,
            description: datos.description,
          })
        : await api.post<CategoryDto>('/business/categories', datos);

      setGuardada(resultado);
      router.refresh();
    } catch (fallo) {
      if (!(fallo instanceof ErrorDeApi)) {
        setError(MSG_ERROR_INESPERADO);
        return;
      }

      const destino = fallo.aDonde();
      if (destino.tipo === 'campos') {
        // Un `409` de nombre duplicado llega sobre un formulario que el
        // navegador había dado por válido: la unicidad exige consultar la base y
        // por eso no podía anticiparse. Se conserva lo escrito.
        for (const [campo, mensaje] of Object.entries(destino.fields)) {
          marcarCampo(campo as keyof CreateCategoryInput, { message: mensaje });
        }
        return;
      }
      setError(fallo.mensaje);
    }
  }

  if (guardada) {
    return (
      <div className="flex flex-col gap-4">
        <AvisoExitoCatalogo
          accion={editando ? CatalogAction.EDITAR_CATEGORIA : CatalogAction.CREAR_CATEGORIA}
          nombre={guardada.name}
        />
        <div className="flex gap-3">
          <a className="text-sm underline" href="/negocio/categorias">
            Volver a las categorías
          </a>
          {!editando && (
            <a className="text-sm underline" href="/negocio/categorias/nueva">
              Crear otra
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex max-w-xl flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      )}

      {editando ? (
        // Sin control: la dimensión no se cambia por ninguna vía (FR-006).
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Clasificación</span>
          <p className="text-sm text-[var(--color-tenue)]">
            {ETIQUETA_DIMENSION[categoria.dimension]} · no se puede cambiar
          </p>
        </div>
      ) : (
        <Campo id="dimension" etiqueta="Clasificación" error={errors.dimension?.message}>
          {(control) => (
            <select
              {...control}
              {...register('dimension')}
              className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
            >
              {Object.values(Dimension).map((dimension) => (
                <option key={dimension} value={dimension}>
                  {ETIQUETA_DIMENSION[dimension]}
                </option>
              ))}
            </select>
          )}
        </Campo>
      )}

      <Campo id="name" etiqueta="Nombre" error={errors.name?.message}>
        {(control) => <Input {...control} {...register('name')} />}
      </Campo>

      <Campo id="description" etiqueta="Descripción" error={errors.description?.message}>
        {(control) => (
          <>
            {/* La ayuda va **antes** del control y siempre visible: no es un
                `placeholder`, que desaparecería al escribir (SC-019). */}
            <AyudaDescripcion de="categoria" />
            <textarea
              {...control}
              {...register('description')}
              rows={3}
              className="mt-2 rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
            />
          </>
        )}
      </Campo>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Guardando…">
        {editando ? 'Guardar cambios' : 'Crear categoría'}
      </AccionEnCurso>
    </form>
  );
}
