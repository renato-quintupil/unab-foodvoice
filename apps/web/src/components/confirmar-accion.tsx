'use client';

import { useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

/**
 * Confirmación antes de una acción de impacto (T100, T101, FR-035, SC-019,
 * Principio IX, ux CHK020).
 *
 * Indica **a quién afecta** y **qué efecto tiene**, y declara si la acción se
 * puede deshacer. Esa última distinción es la que evita tratar con la misma
 * ligereza una desactivación —reversible— y un restablecimiento de contraseña,
 * que **no lo es**: la contraseña anterior desaparece y nadie puede
 * recuperarla.
 *
 * **Cancelar no dispara ninguna llamada**, y por tanto no abre transacción
 * alguna ni deja rastro en la bitácora (SC-019).
 */
export type ConfirmarAccionProps = {
  /** Texto del control que abre el diálogo. */
  etiqueta: string;
  titulo: string;
  /** A quién afecta y qué efecto tiene, en español. */
  descripcion: string;
  /** Si la acción se puede deshacer (Principio IX). */
  reversible: boolean;
  textoConfirmar: string;
  onConfirmar: () => void | Promise<void>;
  disabled?: boolean;
  children?: ReactNode;
};

export function ConfirmarAccion({
  etiqueta,
  titulo,
  descripcion,
  reversible,
  textoConfirmar,
  onConfirmar,
  disabled,
  children,
}: ConfirmarAccionProps) {
  const [abierto, setAbierto] = useState(false);
  const [enCurso, setEnCurso] = useState(false);

  async function confirmar() {
    setEnCurso(true);
    try {
      await onConfirmar();
      setAbierto(false);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={setAbierto}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {etiqueta}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        <p className="mt-3 text-sm text-[var(--color-tenue)]">
          {reversible
            ? 'Puedes deshacer esta acción más adelante.'
            : 'Esta acción no se puede deshacer.'}
        </p>

        <AlertDialogFooter>
          {/* Cancelar cierra el diálogo y no llama a nada. */}
          <AlertDialogCancel asChild>
            <Button variant="ghost" disabled={enCurso}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              onClick={(evento) => {
                evento.preventDefault();
                void confirmar();
              }}
              disabled={enCurso}
              aria-busy={enCurso}
            >
              {enCurso ? 'Procesando…' : textoConfirmar}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
