'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  LoginSchema,
  MSG_CONTRASENA_OLVIDADA,
  type LoginInput,
  type SessionUser,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, ErrorDeApi } from '@/lib/api-client';

type RespuestaLogin = { user: SessionUser; redirectTo: string };

/**
 * Formulario de inicio de sesión (T069, FR-001, FR-026, security CHK009).
 *
 * Valida con `LoginSchema` de `packages/shared`, de modo que el mensaje que ve
 * la persona sea literalmente el mismo lo valide el navegador o el servidor.
 */
export function FormularioLogin() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [avisoDelSistema, setAvisoDelSistema] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // `MSG_SESION_EXPIRADA` cuando la sesión caducó; nada tras un cierre
  // voluntario (FR-006, ux CHK024).
  const avisoDeSesion = parametros.get('aviso');

  async function enviar(datos: LoginInput) {
    setAvisoDelSistema(null);
    try {
      const { redirectTo } = await api.post<RespuestaLogin>('/auth/login', datos);
      router.push(redirectTo);
    } catch (error) {
      // Cualquier fallo del inicio de sesión —credenciales, bloqueo, sistema—
      // se presenta como aviso sobre el formulario, **conservando lo escrito**.
      // Nunca junto a un campo: FR-008 prohíbe indicar cuál de los dos falló.
      setAvisoDelSistema(
        error instanceof ErrorDeApi ? error.mensaje : 'No pudimos completar la operación.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {avisoDeSesion && (
        <p
          role="status"
          data-testid="aviso-sesion"
          className="rounded-md bg-zinc-100 px-3 py-2 text-sm"
        >
          {avisoDeSesion}
        </p>
      )}

      {avisoDelSistema && (
        <p
          role="alert"
          className="rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
        >
          {avisoDelSistema}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? 'true' : undefined}
          aria-describedby={errors.email ? 'error-email' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p id="error-email" className="text-sm text-[var(--color-error)]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? 'true' : undefined}
          aria-describedby={errors.password ? 'error-password' : undefined}
          {...register('password')}
        />
        {errors.password && (
          <p id="error-password" className="text-sm text-[var(--color-error)]">
            {errors.password.message}
          </p>
        )}
      </div>

      <AccionEnCurso type="submit" enCurso={isSubmitting} textoEnCurso="Ingresando…">
        Iniciar sesión
      </AccionEnCurso>

      {/*
        Aviso **permanente**, visible antes de cualquier intento fallido
        (FR-026, A14). No hay ningún enlace de «olvidé mi contraseña»: en v1 no
        existe autoservicio, y prometer un flujo inexistente dejaría a la
        persona reintentando hasta bloquearse la cuenta (security CHK009).
      */}
      <p className="text-sm text-[var(--color-tenue)]">{MSG_CONTRASENA_OLVIDADA}</p>
    </form>
  );
}
