'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CreateAddressSchema,
  MSG_ERROR_INESPERADO,
  type AddressDto,
  type CreateAddressInput,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { Campo } from '@/components/campo';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Alta y edición de una dirección (HU-11, FR-012, FR-013, FR-016).
 *
 * **Solo dos campos de texto**: etiqueta y dirección — ningún mapa, pin ni
 * coordenadas (FR-021, HU11-E15, Principio X). El mismo esquema de creación
 * valida los dos casos, porque editar exige el mismo par completo y no una
 * edición parcial (FR-016).
 */
export type FormularioDireccionProps = {
  /** Presente al editar; ausente al crear. */
  direccion?: AddressDto;
};

export function FormularioDireccion({ direccion }: FormularioDireccionProps) {
  const router = useRouter();
  const editando = direccion !== undefined;
  const [guardada, setGuardada] = useState<AddressDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<CreateAddressInput>({
    resolver: zodResolver(CreateAddressSchema),
    defaultValues: {
      label: direccion?.label ?? '',
      text: direccion?.text ?? '',
    },
  });

  async function enviar(datos: CreateAddressInput) {
    setError(null);
    setGuardada(null);
    try {
      const resultado = editando
        ? await api.patch<AddressDto>(`/addresses/${direccion.id}`, datos)
        : await api.post<AddressDto>('/addresses', datos);

      setGuardada(resultado);
      router.refresh();
    } catch (fallo) {
      if (!(fallo instanceof ErrorDeApi)) {
        setError(MSG_ERROR_INESPERADO);
        return;
      }

      const destino = fallo.aDonde();
      if (destino.tipo === 'campos') {
        for (const [campo, mensaje] of Object.entries(destino.fields)) {
          marcarCampo(campo as keyof CreateAddressInput, { message: mensaje });
        }
        return;
      }
      setError(fallo.mensaje);
    }
  }

  if (guardada) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="status"
          data-testid="aviso-exito"
          className="rounded-md border border-[var(--color-exito)] px-3 py-2 text-sm text-[var(--color-exito)]"
        >
          {editando ? `Se guardaron los cambios de «${guardada.label}».` : `Se guardó la dirección «${guardada.label}».`}
        </p>
        <div className="flex gap-3">
          <a className="text-sm underline" href="/cliente/direcciones">
            Volver a mis direcciones
          </a>
          {!editando && (
            <a className="text-sm underline" href="/cliente/direcciones/nueva">
              Registrar otra
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

      <Campo id="label" etiqueta="Etiqueta" error={errors.label?.message}>
        {(control) => <Input {...control} {...register('label')} placeholder="Casa, Trabajo…" />}
      </Campo>

      <Campo id="text" etiqueta="Dirección" error={errors.text?.message}>
        {(control) => (
          <textarea
            {...control}
            {...register('text')}
            rows={3}
            className="rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
          />
        )}
      </Campo>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Guardando…">
        {editando ? 'Guardar cambios' : 'Registrar dirección'}
      </AccionEnCurso>
    </form>
  );
}
