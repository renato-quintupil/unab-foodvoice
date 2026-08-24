'use client';

import { useRef, useState } from 'react';
import {
  ETIQUETA_TRAMO,
  MSG_ERROR_INESPERADO,
  SearchChannel,
  SearchIntent,
  formatearPrecio,
  recortarDescripcion,
  type AddResolutionResponse,
  type ProductDto,
  type SemanticSearchResponse,
} from '@foodvoice/shared';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';
import { ConfirmacionAgregado } from './confirmacion-agregado';

/**
 * Búsqueda por voz o texto (HU-06, HU-13).
 *
 * Voz y texto son la **misma solicitud** (FR-009): el micrófono solo llena el
 * campo con una transcripción editable antes de enviarla, nunca abre un
 * camino aparte. Los filtros manuales de `FiltrosMenu` siguen disponibles en
 * todo momento (Principio VI) — este componente no los reemplaza, se agrega
 * junto a ellos.
 *
 * Dos botones sobre el mismo texto: "Buscar" (`intent: SEARCH`) y "Agregar al
 * carrito por voz" (`intent: ADD`, HU-13). El servidor decide qué significa
 * la frase; este componente no adivina la intención por su cuenta
 * (Principio VII).
 *
 * **Al dictar por voz, la búsqueda se dispara sola** en cuanto termina el
 * reconocimiento — sin esperar un clic en "Buscar". Es seguro porque buscar
 * es de solo lectura (FR-008): una transcripción mal entendida como mucho da
 * resultados equivocados, nunca escribe nada, y el cliente puede corregir el
 * texto y volver a intentar.
 *
 * **"Agregar al carrito por voz" activa el micrófono por su cuenta** en vez
 * de reenviar lo que ya hubiera en el campo de texto. La primera versión
 * reenviaba el contenido actual del campo, que casi siempre era la última
 * *búsqueda* —no una instrucción de agregar— porque el cliente no tenía por
 * qué volver a escribir algo antes de tocar este botón: terminaba
 * "agregando" en base a una frase vieja y genérica ("quiero pizza") en vez de
 * la intención real. Como el botón promete "por voz", debe escuchar una
 * frase nueva cada vez que se toca, igual que el ícono del micrófono junto al
 * campo, solo que con `intent: 'ADD'` en vez de `'SEARCH'`.
 */
export function BusquedaPorVoz() {
  const [texto, setTexto] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [permisoMicrofonoPedido, setPermisoMicrofonoPedido] = useState(false);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<SemanticSearchResponse | null>(null);
  const [agregado, setAgregado] = useState<Extract<AddResolutionResponse, { status: 'RESOLVED' }> | null>(
    null,
  );
  const canalRef = useRef<(typeof SearchChannel)[keyof typeof SearchChannel]>(SearchChannel.TEXT);

  // "Agregar al carrito por voz" solo tiene sentido sobre una búsqueda con
  // productos ya visibles en pantalla: agregar a ciegas, sin nada que el
  // cliente haya visto primero, no tiene contra qué confirmar lo que dijo.
  const haySearchConDatos = resultado?.status === 'RESULTS' && resultado.items.length > 0;

  /**
   * `consulta` es explícito y no se lee de `texto` (estado) porque el
   * autodisparo por voz llama a esta función en el mismo evento que recibe la
   * transcripción: leer el estado ahí encontraría el valor anterior, todavía
   * no actualizado por el `setTexto` de ese mismo turno.
   */
  async function ejecutar(
    intent: (typeof SearchIntent)[keyof typeof SearchIntent],
    consulta: string,
    canal: (typeof SearchChannel)[keyof typeof SearchChannel],
  ) {
    if (consulta.trim().length === 0) return;
    setError(null);
    // `resultado` (la lista de la última búsqueda) **no** se toca aquí: un
    // "agregar" no debería borrar lo que el cliente ya había encontrado antes
    // de que la respuesta llegue. Cada rama decide por su cuenta si tiene
    // algo nuevo que mostrar en su lugar.
    setAgregado(null);
    setEnCurso(true);
    try {
      if (intent === SearchIntent.ADD) {
        const respuesta = await api.post<AddResolutionResponse>('/menu/search', {
          query: consulta,
          channel: canal,
          intent,
        });
        if (respuesta.status === 'RESOLVED') {
          setAgregado(respuesta);
        } else if (respuesta.status === 'CLARIFICATION') {
          setResultado({ status: 'CLARIFICATION', question: respuesta.question, options: respuesta.options });
        } else {
          // NOT_FOUND: la búsqueda anterior, si la había, sigue visible —
          // solo se informa que esta frase puntual no encontró qué agregar.
          setError('No encontré ese producto entre lo disponible ahora.');
        }
      } else {
        const respuesta = await api.post<SemanticSearchResponse>('/menu/search', {
          query: consulta,
          channel: canal,
          intent,
        });
        setResultado(respuesta);
      }
    } catch (fallo) {
      // Cubre el 429 (límite de búsquedas) y el 503 (proveedor no disponible,
      // FR-016): en ambos casos el menú y sus filtros manuales siguen
      // funcionando, este componente solo informa el error localmente.
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : MSG_ERROR_INESPERADO);
    } finally {
      setEnCurso(false);
      canalRef.current = SearchChannel.TEXT;
    }
  }

  /**
   * Dictado con un destino fijo: `SEARCH` desde el ícono del micrófono,
   * `ADD` desde "Agregar al carrito por voz". Cada llamada escucha una frase
   * nueva y la dispara sola — nunca reutiliza lo que hubiera quedado escrito
   * de un dictado o búsqueda anterior.
   */
  function activarMicrofono(intent: (typeof SearchIntent)[keyof typeof SearchIntent]) {
    const Reconocimiento =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;
    if (!Reconocimiento) {
      setError('Tu navegador no soporta reconocimiento de voz. Puedes escribir tu búsqueda.');
      return;
    }

    // Consentimiento explícito antes de activar el micrófono (FR-018,
    // Principio X), aparte del permiso propio del navegador.
    if (!permisoMicrofonoPedido) {
      const acepta = window.confirm('¿Permitir el uso del micrófono para buscar por voz?');
      setPermisoMicrofonoPedido(true);
      if (!acepta) return;
    }

    const reconocimiento = new Reconocimiento();
    reconocimiento.lang = 'es-CL';
    reconocimiento.interimResults = false;
    reconocimiento.maxAlternatives = 1;

    reconocimiento.onstart = () => {
      setError(null);
      setEscuchando(true);
    };
    reconocimiento.onend = () => setEscuchando(false);
    // Sin esto, un fallo del reconocimiento (micrófono ocupado por la sesión
    // anterior, sin habla detectada, permiso revocado) volvía todo a la
    // normalidad en silencio: el botón "no hacía nada" a los ojos de quien lo
    // usaba, sin ninguna pista de qué pasó ni cómo seguir.
    reconocimiento.onerror = (evento) => {
      setEscuchando(false);
      if (evento.error === 'no-speech') {
        setError('No alcancé a escucharte. Inténtalo de nuevo.');
      } else if (evento.error === 'not-allowed' || evento.error === 'service-not-allowed') {
        setError('No tengo permiso para usar el micrófono. Revisa los permisos del navegador.');
      } else if (evento.error === 'aborted') {
        // Cancelado a propósito (p. ej. por el propio navegador al iniciar
        // una sesión nueva demasiado rápido): no hace falta alarmar.
      } else {
        setError('No pude escucharte esta vez. Inténtalo de nuevo.');
      }
    };
    reconocimiento.onresult = (evento) => {
      const transcripcion = evento.results[0]?.[0]?.transcript ?? '';
      // Transcripción visible y editable en el campo (HU-06 §8) — y, a la
      // vez, ya disparada: no hay razón para hacer esperar un clic extra
      // sobre una frase que el cliente recién terminó de decir.
      setTexto(transcripcion);
      canalRef.current = SearchChannel.VOICE;
      void ejecutar(intent, transcripcion, SearchChannel.VOICE);
    };

    try {
      reconocimiento.start();
    } catch {
      // Algunos navegadores lanzan de inmediato si todavía están liberando el
      // micrófono de una sesión anterior, en vez de disparar `onerror`.
      setEscuchando(false);
      setError('El micrófono todavía estaba ocupado. Espera un segundo e inténtalo de nuevo.');
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-borde)] p-4">
      <label htmlFor="busqueda-por-voz" className="text-sm font-medium">
        Busca o pide algo con tus propias palabras
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="busqueda-por-voz"
          value={texto}
          onChange={(evento) => {
            setTexto(evento.target.value);
            canalRef.current = SearchChannel.TEXT;
          }}
          placeholder="Ej: quiero algo económico y sano"
          className="min-w-[16rem] flex-1"
        />
        <button
          type="button"
          onClick={() => activarMicrofono(SearchIntent.SEARCH)}
          disabled={enCurso || escuchando}
          aria-pressed={escuchando}
          aria-label="Dictar la búsqueda por voz"
          className="rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm"
        >
          {escuchando ? 'Escuchando…' : '🎙️'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <AccionEnCurso
          type="button"
          size="sm"
          enCurso={enCurso || escuchando}
          textoEnCurso="Buscando…"
          onClick={() => void ejecutar(SearchIntent.SEARCH, texto, canalRef.current)}
        >
          Buscar
        </AccionEnCurso>
        <AccionEnCurso
          type="button"
          size="sm"
          enCurso={enCurso || escuchando}
          disabled={!haySearchConDatos}
          textoEnCurso="Escuchando…"
          onClick={() => activarMicrofono(SearchIntent.ADD)}
        >
          🎙️ Agregar al carrito por voz
        </AccionEnCurso>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {agregado && (
        <ConfirmacionAgregado
          items={agregado.items}
          onCancelar={() => setAgregado(null)}
          onConfirmado={() => setAgregado(null)}
        />
      )}

      {resultado && <ResultadoBusqueda resultado={resultado} onElegirOpcion={setTexto} />}
    </div>
  );
}

function ResultadoBusqueda({
  resultado,
  onElegirOpcion,
}: {
  resultado: SemanticSearchResponse;
  onElegirOpcion: (opcion: string) => void;
}) {
  if (resultado.status === 'CLARIFICATION') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-[var(--color-borde)] p-3">
        <p className="text-sm">{resultado.question}</p>
        <div className="flex flex-wrap gap-2">
          {resultado.options.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => onElegirOpcion(opcion)}
              className="rounded-md border border-[var(--color-borde)] px-3 py-1 text-sm"
            >
              {opcion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (resultado.status === 'NO_RESULTS') {
    return (
      <p className="rounded-md border border-[var(--color-borde)] px-3 py-2 text-sm">
        No encontré productos que cumplan lo que pediste. Prueba con otra frase o usa los filtros del
        menú.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {resultado.items.map((producto) => (
        <li key={producto.id}>
          <TarjetaDeResultado producto={producto} />
        </li>
      ))}
    </ul>
  );
}

function TarjetaDeResultado({ producto }: { producto: ProductDto }) {
  return (
    <article className="flex flex-col gap-1 rounded-md border border-[var(--color-borde)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{producto.name}</span>
        <span className="text-sm">{formatearPrecio(producto.price)}</span>
      </div>
      <p className="text-sm text-[var(--color-tenue)]">{recortarDescripcion(producto.description)}</p>
      <p className="text-xs text-[var(--color-tenue)]">
        {producto.foodTypeCategory.name} · {producto.healthProfileCategory.name}
        {producto.priceTier && ` · ${ETIQUETA_TRAMO[producto.priceTier]}`}
        {producto.dietaryTags.length > 0 && ` · ${producto.dietaryTags.join(', ')}`}
      </p>
    </article>
  );
}
