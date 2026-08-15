'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AdminAction,
  CreateUserSchema,
  ETIQUETA_ROL,
  Role,
  type CreateUserInput,
  type UserDto,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { AvisoExito } from '@/components/aviso-exito';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Alta de un usuario (T098, FR-009, FR-014, SC-005, supuesto 23).
 *
 * Los cinco campos son obligatorios y se validan con `CreateUserSchema`, el
 * mismo esquema que aplicará el servidor.
 *
 * La contraseña se muestra **solo mientras el administrador la escribe**:
 * ninguna pantalla posterior la recupera, y el diálogo de alta lo advierte para
 * que la anote antes de continuar.
 *
 * El alta **no** requiere confirmación previa (FR-035): no es una acción de
 * impacto sobre un usuario existente.
 */
export function FormularioAlta() {
  const router = useRouter();
  const [creado, setCreado] = useState<UserDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', role: Role.CLIENTE },
  });

  async function enviar(datos: CreateUserInput) {
    setError(null);
    setCreado(null);
    try {
      const usuario = await api.post<UserDto>('/admin/users', datos);
      setCreado(usuario);
      router.refresh();
    } catch (fallo) {
      if (!(fallo instanceof ErrorDeApi)) {
        setError('No pudimos completar la operación.');
        return;
      }

      const destino = fallo.aDonde();
      if (destino.tipo === 'campos') {
        // Un `409` de correo duplicado llega sobre un formulario que el
        // navegador había dado por válido: es una regla que exige consultar el
        // padrón, y por eso no podía anticiparse (api CHK031).
        for (const [campo, mensaje] of Object.entries(destino.fields)) {
          marcarCampo(campo as keyof CreateUserInput, { message: mensaje });
        }
        return;
      }
      setError(fallo.mensaje);
    }
  }

  if (creado) {
    return (
      <div className="flex flex-col gap-4">
        <AvisoExito accion={AdminAction.CREAR} nombre={creado.fullName} />
        <p className="text-sm text-[var(--color-tenue)]">
          Entrega la contraseña a la persona: el sistema no vuelve a mostrarla.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex max-w-md flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      )}

      <Campo id="fullName" etiqueta="Nombre completo" error={errors.fullName?.message}>
        <Input id="fullName" {...register('fullName')} aria-invalid={!!errors.fullName} />
      </Campo>

      <Campo id="email" etiqueta="Correo electrónico" error={errors.email?.message}>
        <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
      </Campo>

      <Campo id="phone" etiqueta="Teléfono" error={errors.phone?.message}>
        <Input id="phone" {...register('phone')} aria-invalid={!!errors.phone} />
      </Campo>

      <Campo id="password" etiqueta="Contraseña" error={errors.password?.message}>
        {/* Visible mientras se escribe: hay que poder anotarla. */}
        <Input
          id="password"
          type="text"
          autoComplete="off"
          {...register('password')}
          aria-invalid={!!errors.password}
        />
      </Campo>

      <Campo id="role" etiqueta="Rol" error={errors.role?.message}>
        <select
          id="role"
          {...register('role')}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          {Object.values(Role).map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETA_ROL[rol]}
            </option>
          ))}
        </select>
      </Campo>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Creando…">
        Crear usuario
      </AccionEnCurso>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Cada campo con su etiqueta asociada y su error asociado al campo
          (FR-039). */}
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error && (
        <p id={`error-${id}`} className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
