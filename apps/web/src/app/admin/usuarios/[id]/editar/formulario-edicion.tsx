'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AdminAction,
  MSG_ERROR_INESPERADO,
  UpdateUserSchema,
  type UpdateUserInput,
  type UserDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { AvisoExito } from '@/components/aviso-exito';
import { Campo } from '@/components/campo';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Edición de datos de contacto y correo (T099, FR-010, api CHK031).
 *
 * Valida con `UpdateUserSchema`, que reutiliza las definiciones de
 * `CreateUserSchema`: ninguna edición puede dejar un usuario en un estado que
 * su alta habría rechazado.
 *
 * Muestra **sobre el formulario** un `409` que el navegador no podía
 * anticipar —correo duplicado o autoprotección—, porque son reglas que exigen
 * consultar el estado del sistema y solo se descubren al enviar la petición.
 */
export function FormularioEdicion({ usuario }: { usuario: UserDto }) {
  const router = useRouter();
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      fullName: usuario.fullName,
      email: usuario.email,
      phone: usuario.phone,
    },
  });

  async function enviar(datos: UpdateUserInput) {
    setError(null);
    setExito(false);
    try {
      await api.patch<UserDto>(`/admin/users/${usuario.id}`, datos);
      setExito(true);
      router.refresh();
    } catch (fallo) {
      if (!(fallo instanceof ErrorDeApi)) {
        setError(MSG_ERROR_INESPERADO);
        return;
      }

      const destino = fallo.aDonde();
      if (destino.tipo === 'campos') {
        for (const [campo, mensaje] of Object.entries(destino.fields)) {
          marcarCampo(campo as keyof UpdateUserInput, { message: mensaje });
        }
        return;
      }
      // Autoprotección y fallos del sistema: aviso sobre la vista, conservando
      // lo que la persona escribió.
      setError(fallo.mensaje);
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex max-w-md flex-col gap-4">
      {exito && <AvisoExito accion={AdminAction.EDITAR} nombre={usuario.fullName} />}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      )}

      <Campo id="fullName" etiqueta="Nombre completo" error={errors.fullName?.message}>
        {(control) => <Input {...control} {...register('fullName')} />}
      </Campo>

      <Campo id="email" etiqueta="Correo electrónico" error={errors.email?.message}>
        {(control) => <Input {...control} type="email" {...register('email')} />}
      </Campo>

      <Campo id="phone" etiqueta="Teléfono" error={errors.phone?.message}>
        {(control) => <Input {...control} {...register('phone')} />}
      </Campo>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Guardando…">
        Guardar cambios
      </AccionEnCurso>
    </form>
  );
}
