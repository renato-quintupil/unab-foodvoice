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

  async function ejecutar(intent: (typeof SearchIntent)[keyof typeof SearchIntent]) {
    if (texto.trim().length === 0) return;
    setError(null);
    setResultado(null);
    setAgregado(null);
    setEnCurso(true);
    try {
      if (intent === SearchIntent.ADD) {
        const respuesta = await api.post<AddResolutionResponse>('/menu/search', {
          query: texto,
          channel: canalRef.current,
          intent,
        });
        if (respuesta.status === 'RESOLVED') {
          setAgregado(respuesta);
        } else {
          setResultado(
            respuesta.status === 'CLARIFICATION'
              ? { status: 'CLARIFICATION', question: respuesta.question, options: respuesta.options }
              : null,
          );
          if (respuesta.status === 'NOT_FOUND') {
            setError('No encontré ese producto entre lo disponible ahora.');
          }
        }
      } else {
        const respuesta = await api.post<SemanticSearchResponse>('/menu/search', {
          query: texto,
          channel: canalRef.current,
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

  function activarMicrofono() {
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

    reconocimiento.onstart = () => setEscuchando(true);
    reconocimiento.onend = () => setEscuchando(false);
    reconocimiento.onerror = () => setEscuchando(false);
    reconocimiento.onresult = (evento) => {
      const transcripcion = evento.results[0]?.[0]?.transcript ?? '';
      // Transcripción editable (HU-06 §8): se llena el campo, no se envía
      // sola. El cliente puede corregirla antes de "Buscar" o "Agregar".
      setTexto(transcripcion);
      canalRef.current = SearchChannel.VOICE;
    };

    reconocimiento.start();
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
          onClick={activarMicrofono}
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
          enCurso={enCurso}
          textoEnCurso="Buscando…"
          onClick={() => void ejecutar(SearchIntent.SEARCH)}
        >
          Buscar
        </AccionEnCurso>
        <AccionEnCurso
          type="button"
          size="sm"
          enCurso={enCurso}
          textoEnCurso="Agregando…"
          onClick={() => void ejecutar(SearchIntent.ADD)}
        >
          Agregar al carrito por voz
        </AccionEnCurso>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      {agregado && (
        <ConfirmacionAgregado
          item={agregado.item}
          quantity={agregado.quantity}
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
