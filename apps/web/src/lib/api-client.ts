import { MSG_ERROR_INESPERADO, MSG_SESION_EXPIRADA } from '@foodvoice/shared';

/**
 * Cliente de la API y reglas de presentación de sus errores (T074, D-017,
 * ux CHK002, ux CHK008, ux CHK024).
 *
 * Todas las llamadas van al **mismo origen**, contra el proxy de Next.js: el
 * navegador nunca habla con NestJS directamente (D-006).
 *
 * La tabla «Dónde se presenta cada mensaje» de la spec se implementa aquí y en
 * un solo lugar, porque repartirla por pantalla es como acaba divergiendo:
 *
 * | Situación                     | Dónde va                                        |
 * |-------------------------------|-------------------------------------------------|
 * | Error por campo (`fields`)    | Junto al campo                                  |
 * | `409` y fallos del sistema    | Aviso sobre la vista, **conservando lo escrito** |
 * | `403`                         | Página de acceso denegado                        |
 * | `401`                         | `/login` con `MSG_SESION_EXPIRADA`               |
 * | `401` tras cierre voluntario  | `/login` **sin ningún mensaje**                  |
 */

/** Dónde debe presentarse el error, decidido una sola vez. */
export type DestinoDelError =
  | { tipo: 'campos'; fields: Record<string, string>; mensaje: string }
  | { tipo: 'aviso'; mensaje: string }
  | { tipo: 'sin-permiso' }
  | { tipo: 'sesion-expirada' };

export class ErrorDeApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly mensaje: string,
    readonly fields?: Record<string, string>,
  ) {
    super(mensaje);
    this.name = 'ErrorDeApi';
  }

  /**
   * Un `409` es una regla de negocio que el navegador **no podía anticipar**
   * —correo duplicado, autoprotección—, porque exige consultar el estado del
   * sistema (`shared.md` § Frontera de responsabilidad). Llega sobre un
   * formulario que la interfaz había dado por válido, así que se muestra sin
   * perder lo que la persona escribió.
   */
  aDonde(): DestinoDelError {
    if (this.status === 401) return { tipo: 'sesion-expirada' };
    if (this.status === 403) return { tipo: 'sin-permiso' };
    if (this.status === 400 && this.fields && Object.keys(this.fields).length > 0) {
      return { tipo: 'campos', fields: this.fields, mensaje: this.mensaje };
    }
    if (this.status === 409 && this.fields && Object.keys(this.fields).length > 0) {
      return { tipo: 'campos', fields: this.fields, mensaje: this.mensaje };
    }
    return { tipo: 'aviso', mensaje: this.mensaje };
  }
}

type CuerpoDeError = {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
};

async function interpretar(respuesta: Response): Promise<never> {
  let cuerpo: CuerpoDeError = {};
  try {
    cuerpo = (await respuesta.json()) as CuerpoDeError;
  } catch {
    // Una respuesta sin JSON válido es un fallo del sistema como cualquier
    // otro: no se le muestra a la persona nada distinto por eso.
  }

  throw new ErrorDeApi(
    respuesta.status,
    cuerpo.error?.code ?? 'INTERNAL_ERROR',
    cuerpo.error?.message ?? MSG_ERROR_INESPERADO,
    cuerpo.error?.fields,
  );
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      // La cookie es same-origin y `httpOnly`: el JavaScript de la página no
      // la lee, solo el navegador la adjunta.
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(opciones.headers ?? {}) },
    });
  } catch {
    // Ni siquiera se pudo alcanzar el proxy. Mismo mensaje que un fallo del
    // servicio: para quien lo lee son la misma situación.
    throw new ErrorDeApi(0, 'INTERNAL_ERROR', MSG_ERROR_INESPERADO);
  }

  if (!respuesta.ok) await interpretar(respuesta);
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta, { method: 'GET' }),
  post: <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, { method: 'POST', body: JSON.stringify(cuerpo ?? {}) }),
  patch: <T>(ruta: string, cuerpo: unknown) =>
    pedir<T>(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  put: <T>(ruta: string, cuerpo: unknown) =>
    pedir<T>(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) }),
};

/**
 * Destino tras un `401`.
 *
 * El cierre **voluntario** lleva a `/login` sin ningún mensaje: decirle «tu
 * sesión expiró» a quien acaba de pulsar «Cerrar sesión» sería informarle de un
 * problema que no existe (FR-006, ux CHK024).
 */
export function destinoTrasSesionTerminada(fueVoluntario: boolean): string {
  if (fueVoluntario) return '/login';
  return `/login?aviso=${encodeURIComponent(MSG_SESION_EXPIRADA)}`;
}
