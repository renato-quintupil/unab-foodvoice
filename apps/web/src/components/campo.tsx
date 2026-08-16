import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/**
 * Campo de formulario con su etiqueta y su error **asociados** (T133, FR-039c,
 * SC-038).
 *
 * FR-039 exige dos cosas de cada campo: que tenga una etiqueta que un lector de
 * pantalla anuncie, y que su mensaje de error **quede asociado a ese campo y no
 * suelto en la página**. Lo segundo es lo que se rompía cuando cada formulario
 * pintaba el error por su cuenta: el párrafo quedaba visualmente debajo del
 * control, pero nada lo enlazaba con él, de modo que quien no ve la pantalla
 * enfocaba el campo y no oía por qué había fallado.
 *
 * Por eso los atributos no se pasan a mano sino que **los entrega este
 * componente al control**, en forma de argumento de `children`: no hay manera
 * de usar `Campo` y olvidarse del `aria-describedby`, que es exactamente el
 * fallo que se quiere hacer imposible. Es también la razón de que exista un
 * único `Campo` para las cuatro superficies con formulario —inicio de sesión,
 * alta, edición y restablecimiento— en lugar de uno por pantalla: cuatro copias
 * son cuatro sitios donde la regla puede divergir.
 */
export type PropsDelControl = {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};

export type CampoProps = {
  /** Identificador del control. El del error se deriva de él. */
  id: string;
  etiqueta: string;
  /** Mensaje de error, si el campo falla. Su ausencia limpia los atributos. */
  error?: string;
  children: (props: PropsDelControl) => ReactNode;
};

export function Campo({ id, etiqueta, error, children }: CampoProps) {
  const idDelError = `error-${id}`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? idDelError : undefined,
      })}
      {error && (
        <p id={idDelError} className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
