'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AdminAction,
  UpdateUserSchema,
  type UpdateUserInput,
  type UserDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { AvisoExito } from '@/components/aviso-exito';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
        setError('No pudimos completar la operación.');
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" {...register('fullName')} aria-invalid={!!errors.fullName} />
        {errors.fullName && (
          <p className="text-sm text-[var(--color-error)]">{errors.fullName.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
        {errors.email && (
          <p className="text-sm text-[var(--color-error)]">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" {...register('phone')} aria-invalid={!!errors.phone} />
        {errors.phone && (
          <p className="text-sm text-[var(--color-error)]">{errors.phone.message}</p>
        )}
      </div>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Guardando…">
        Guardar cambios
      </AccionEnCurso>
    </form>
  );
}
