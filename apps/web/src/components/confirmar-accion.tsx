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
 *
 * **El diálogo solo se cierra cuando la acción quedó firme** (T135). Si se
 * rechaza —una contraseña fuera de rango, la autoprotección del administrador,
 * un fallo del sistema— permanece abierto con el mensaje dentro y lo que la
 * persona escribió intacto, como exige la tabla «Dónde se presenta cada
 * mensaje» de la spec. Cerrarlo y dejar el mensaje en la vista de atrás obliga
 * a reabrirlo para corregir, y aleja el error del campo que lo causó
 * (FR-030, FR-032, FR-039c).
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
  /**
   * Ejecuta la acción. Devuelve `true` si quedó aplicada —y entonces el diálogo
   * se cierra— y `false` si se rechazó, en cuyo caso permanece abierto. El
   * booleano es deliberado: una promesa resuelta no distingue «se aplicó» de
   * «falló y alguien capturó el error», que es justo la confusión que cerraba
   * el diálogo ante un rechazo.
   */
  onConfirmar: () => boolean | Promise<boolean>;
  /** Mensaje de rechazo que no pertenece a ningún campo, dentro del diálogo. */
  aviso?: string | null;
  /** Se invoca al cerrar, para que quien lo usa limpie sus mensajes. */
  alCerrar?: () => void;
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
  aviso,
  alCerrar,
  disabled,
  children,
}: ConfirmarAccionProps) {
  const [abierto, setAbierto] = useState(false);
  const [enCurso, setEnCurso] = useState(false);

  function cambiarApertura(valor: boolean) {
    setAbierto(valor);
    if (!valor) alCerrar?.();
  }

  async function confirmar() {
    setEnCurso(true);
    try {
      const aplicada = await onConfirmar();
      if (aplicada) cambiarApertura(false);
    } finally {
      setEnCurso(false);
    }
  }

  return (
    <AlertDialog open={abierto} onOpenChange={cambiarApertura}>
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

        {/* El rechazo se queda **dentro** del diálogo, junto a lo que la
            persona escribió. */}
        {aviso && (
          <p
            role="alert"
            data-testid="aviso-rechazo"
            className="mt-3 rounded-md border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
          >
            {aviso}
          </p>
        )}

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
