'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Control de una acción en curso (T073, FR-038, SC-039, ux CHK014, ux CHK029).
 *
 * Un solo componente cubre las **dos** exigencias de FR-038, y por eso van
 * juntas: que las operaciones sujetas al umbral de 5 segundos no parezcan
 * congeladas, y que un doble clic no produzca dos efectos. Separarlas
 * invitaría a implementar una y olvidar la otra.
 *
 * Lo usan todos los formularios y acciones de US1, US2 y US3.
 */
export type AccionEnCursoProps = Omit<ButtonProps, 'disabled'> & {
  enCurso: boolean;
  /**
   * Deshabilita el control por una razón **distinta** a estar en curso —p.
   * ej. no hay todavía nada sobre lo que la acción tenga sentido—, sin
   * anunciarlo como `aria-busy` (eso queda reservado a `enCurso`).
   */
  disabled?: boolean;
  /** Qué se está haciendo, en español. Se anuncia a los lectores de pantalla. */
  textoEnCurso?: string;
  children: ReactNode;
};

export function AccionEnCurso({
  enCurso,
  disabled = false,
  textoEnCurso = 'Procesando…',
  children,
  ...props
}: AccionEnCursoProps) {
  return (
    <>
      <Button
        {...props}
        // Inutiliza el control que disparó la acción hasta que llega la
        // respuesta: es lo que impide que un doble clic produzca dos efectos.
        disabled={enCurso || disabled}
        aria-busy={enCurso}
      >
        {enCurso ? textoEnCurso : children}
      </Button>
      {/* `aria-live` para que quien no ve la pantalla sepa que algo ocurre. */}
      <span role="status" aria-live="polite" className="sr-only">
        {enCurso ? textoEnCurso : ''}
      </span>
    </>
  );
}
