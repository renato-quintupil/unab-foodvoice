'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CatalogAction,
  CreateProductSchema,
  Dimension,
  ETIQUETA_DIMENSION,
  MSG_DIMENSION_SIN_CATEGORIAS,
  MSG_ERROR_INESPERADO,
  UpdateProductSchema,
  formatearPrecio,
  type CategoryDto,
  type CreateProductInput,
  type ProductDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { AvisoExitoCatalogo } from '@/components/aviso-exito-catalogo';
import { AyudaDescripcion } from '@/components/ayuda-descripcion';
import { Campo } from '@/components/campo';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Alta y edición de un producto (T050, T051, T052, T057, FR-012, FR-013, FR-016,
 * FR-018, FR-022).
 *
 * **Un desplegable por dimensión, de selección única** (FR-012). No es una lista
 * múltiple con validación posterior: el requisito lo descarta expresamente, y un
 * `select` simple hace que elegir dos categorías de la misma dimensión sea
 * imposible en lugar de rechazable.
 *
 * Los desplegables se pueblan **solo con categorías activas** (FR-011): una
 * categoría desactivada no se ofrece, de modo que el `409 CATEGORY_INACTIVE` solo
 * puede llegar por una carrera —alguien desactivó la categoría mientras el
 * formulario estaba abierto— y no por una elección que la pantalla permitió.
 *
 * Cuando una dimensión **no tiene ninguna categoría activa**, no se muestra un
 * desplegable vacío: se explica qué falta, se ofrece ir a crearla y **no se deja
 * guardar** (HU14-E19, FR-012, SC-010). Un desplegable vacío deja al negocio
 * mirando un control que no puede usar, sin decirle por qué.
 */
export type FormularioProductoProps = {
  /** Categorías **activas** de las dos dimensiones. */
  categorias: CategoryDto[];
  /** Presente al editar; ausente al crear. */
  producto?: ProductDto;
};

export function FormularioProducto({ categorias, producto }: FormularioProductoProps) {
  const router = useRouter();
  const editando = producto !== undefined;
  const [guardado, setGuardado] = useState<ProductDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deTipoComida = categorias.filter((c) => c.dimension === Dimension.TIPO_COMIDA);
  const dePerfilSalud = categorias.filter((c) => c.dimension === Dimension.PERFIL_SALUD);

  const {
    register,
    handleSubmit,
    watch,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(editando ? UpdateProductSchema : CreateProductSchema),
    defaultValues: {
      name: producto?.name ?? '',
      description: producto?.description ?? '',
      ingredients: producto?.ingredients ?? '',
      // Sin valor por omisión: un precio prellenado se guardaría por descuido.
      price: producto?.price ?? undefined,
      foodTypeCategoryId: producto?.foodTypeCategory.id ?? deTipoComida[0]?.id ?? '',
      healthProfileCategoryId: producto?.healthProfileCategory.id ?? dePerfilSalud[0]?.id ?? '',
      // E6: única aptitud dietética de v1, sin pantalla de administración
      // aparte — se marca o desmarca directamente en el producto (D-059).
      vegan: producto?.dietaryTags.includes('Vegano') ?? false,
    },
  });

  /** Lo escrito en el campo de precio, para mostrar cómo se verá formateado. */
  const precioEscrito = Number(watch('price'));

  /** Dimensiones sin ninguna categoría activa (HU14-E19). */
  const sinCategorias = [
    ...(deTipoComida.length === 0 ? [Dimension.TIPO_COMIDA] : []),
    ...(dePerfilSalud.length === 0 ? [Dimension.PERFIL_SALUD] : []),
  ];

  async function enviar(datos: CreateProductInput) {
    setError(null);
    setGuardado(null);
    try {
      const resultado = editando
        ? await api.patch<ProductDto>(`/business/products/${producto.id}`, datos)
        : await api.post<ProductDto>('/business/products', datos);

      setGuardado(resultado);
      router.refresh();
    } catch (fallo) {
      if (!(fallo instanceof ErrorDeApi)) {
        setError(MSG_ERROR_INESPERADO);
        return;
      }

      const destino = fallo.aDonde();
      if (destino.tipo === 'campos') {
        // Cubre el nombre duplicado y la categoría desactivada: los dos llegan
        // con `fields`, de modo que el mensaje queda junto al control que lo
        // causó y no suelto en la página (FR-021, T057).
        for (const [campo, mensaje] of Object.entries(destino.fields)) {
          marcarCampo(campo as keyof CreateProductInput, { message: mensaje });
        }
        return;
      }
      setError(fallo.mensaje);
    }
  }

  // **No se muestra el formulario en absoluto** si falta una clasificación: no
  // hay nada que la persona pueda hacer aquí hasta crearla.
  if (sinCategorias.length > 0) {
    return (
      <div
        data-testid="falta-clasificacion"
        className="flex flex-col gap-4 rounded-md border border-[var(--color-borde)] p-4"
      >
        {sinCategorias.map((dimension) => (
          <p key={dimension}>{MSG_DIMENSION_SIN_CATEGORIAS(ETIQUETA_DIMENSION[dimension])}</p>
        ))}
        <Link href="/negocio/categorias/nueva" className="text-sm underline">
          Crear la primera categoría
        </Link>
      </div>
    );
  }

  if (guardado) {
    return (
      <div className="flex flex-col gap-4">
        <AvisoExitoCatalogo
          accion={editando ? CatalogAction.EDITAR_PRODUCTO : CatalogAction.CREAR_PRODUCTO}
          nombre={guardado.name}
        />
        <div className="flex gap-3">
          <a className="text-sm underline" href="/negocio/productos">
            Volver a los productos
          </a>
          {!editando && (
            <a className="text-sm underline" href="/negocio/productos/nuevo">
              Crear otro
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

      <Campo id="name" etiqueta="Nombre" error={errors.name?.message}>
        {(control) => <Input {...control} {...register('name')} />}
      </Campo>

      <Campo id="description" etiqueta="Descripción" error={errors.description?.message}>
        {(control) => (
          <>
            <AyudaDescripcion de="producto" />
            <textarea
              {...control}
              {...register('description')}
              rows={3}
              className="mt-2 rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
            />
          </>
        )}
      </Campo>

      <Campo id="ingredients" etiqueta="Ingredientes (opcional)" error={errors.ingredients?.message}>
        {(control) => (
          <>
            <p className="text-sm text-[var(--color-tenue)]">
              Se muestran al cliente como información referencial. Puedes escribirlos en una línea o
              en varias.
            </p>
            <textarea
              {...control}
              {...register('ingredients')}
              rows={2}
              className="mt-2 rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
            />
          </>
        )}
      </Campo>

      <Campo id="price" etiqueta="Precio en pesos" error={errors.price?.message}>
        {(control) => (
          <>
            {/* Se ingresa el entero desnudo, sin separadores: el formato
                `$4.990` es solo de presentación (§ Presentación del precio). */}
            <Input {...control} type="number" step={1} min={1} {...register('price')} />
            <p className="mt-1 text-sm text-[var(--color-tenue)]">
              Sin puntos ni decimales. Por ejemplo: 4990
            </p>
            {/* Cómo lo verá el cliente, compuesto con `formatearPrecio` y nunca
                a mano (T078, § Presentación del precio). Muestra el formato
                sobre el valor real que se está escribiendo, de modo que quien lo
                ingresa no tenga que imaginárselo. */}
            {Number.isInteger(precioEscrito) && precioEscrito > 0 && (
              <p className="mt-1 text-sm" data-testid="precio-formateado">
                Se mostrará como {formatearPrecio(precioEscrito)}
              </p>
            )}
          </>
        )}
      </Campo>

      <Campo
        id="foodTypeCategoryId"
        etiqueta={ETIQUETA_DIMENSION[Dimension.TIPO_COMIDA]}
        error={errors.foodTypeCategoryId?.message}
      >
        {(control) => (
          <select
            {...control}
            {...register('foodTypeCategoryId')}
            className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
          >
            {deTipoComida.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.name}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Campo
        id="healthProfileCategoryId"
        etiqueta={ETIQUETA_DIMENSION[Dimension.PERFIL_SALUD]}
        error={errors.healthProfileCategoryId?.message}
      >
        {(control) => (
          <select
            {...control}
            {...register('healthProfileCategoryId')}
            className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
          >
            {dePerfilSalud.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.name}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <Campo id="vegan" etiqueta="Apto para veganos" error={errors.vegan?.message}>
        {(control) => (
          <div className="flex items-center gap-2">
            <input type="checkbox" {...control} {...register('vegan')} className="h-4 w-4" />
            <span className="text-sm text-[var(--color-tenue)]">
              Solo lo que declares aquí aparece en la búsqueda por voz como apto para veganos; no se
              infiere de los ingredientes.
            </span>
          </div>
        )}
      </Campo>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Guardando…">
        {editando ? 'Guardar cambios' : 'Crear producto'}
      </AccionEnCurso>
    </form>
  );
}
