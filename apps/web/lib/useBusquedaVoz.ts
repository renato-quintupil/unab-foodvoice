"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook de búsqueda por voz (HU-06) sobre la Web Speech API.
 *
 * Degrada con elegancia: si el navegador no soporta la API, `soportado` es
 * `false` y la interfaz oculta el botón de voz, dejando la búsqueda textual
 * como alternativa obligatoria.
 */

// Tipos mínimos de la Web Speech API (no incluida en las librerías estándar de TS).
interface ResultadoVoz {
  0: { transcript: string };
}
interface EventoVoz {
  results: { 0: ResultadoVoz };
}
interface ReconocimientoVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: EventoVoz) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type ConstructorReconocimiento = new () => ReconocimientoVoz;

function obtenerConstructor(): ConstructorReconocimiento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useBusquedaVoz(alReconocer: (texto: string) => void) {
  const [soportado, setSoportado] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const refReconocimiento = useRef<ReconocimientoVoz | null>(null);
  const refCallback = useRef(alReconocer);
  refCallback.current = alReconocer;

  useEffect(() => {
    const Ctor = obtenerConstructor();
    if (!Ctor) return;
    setSoportado(true);
    const reconocimiento = new Ctor();
    reconocimiento.lang = "es-CL";
    reconocimiento.continuous = false;
    reconocimiento.interimResults = false;
    reconocimiento.onresult = (e) => {
      const texto = e.results[0][0].transcript;
      refCallback.current(texto);
    };
    reconocimiento.onend = () => setEscuchando(false);
    reconocimiento.onerror = () => setEscuchando(false);
    refReconocimiento.current = reconocimiento;
    return () => reconocimiento.stop();
  }, []);

  const escuchar = () => {
    if (!refReconocimiento.current || escuchando) return;
    setEscuchando(true);
    refReconocimiento.current.start();
  };

  return { soportado, escuchando, escuchar };
}
