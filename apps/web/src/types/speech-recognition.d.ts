/**
 * Tipos mínimos de la Web Speech API (E6, HU-06 §8). No forma parte del DOM
 * estándar de TypeScript — soporte de navegador limitado, según MDN — así
 * que se declara solo lo que `busqueda-por-voz.tsx` usa.
 */
export {};

declare global {
  interface SpeechRecognitionResultItem {
    transcript: string;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    [index: number]: SpeechRecognitionResultItem;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start(): void;
    stop(): void;
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}
