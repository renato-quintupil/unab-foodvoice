import { NextRequest } from 'next/server';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';

/**
 * Proxy BFF hacia NestJS (D-006, D-017, api CHK005, api CHK013).
 *
 * Su **única** responsabilidad es que la cookie sea same-origin: el navegador
 * solo habla con Next.js, que reenvía por la red interna de Docker. Sin CORS,
 * sin token accesible desde el JavaScript de la página, sin NestJS expuesto a
 * Internet.
 *
 * **Sin lógica de negocio.** El proxy no decide nada; toda regla vive en
 * NestJS. Y el cuerpo se reenvía **sin analizar ni reserializar**, de modo que
 * lo que valida el esquema de NestJS sea exactamente lo que el navegador envió.
 */

/**
 * Lista blanca **cerrada** de cabeceras. Lo que no aparece, no se propaga.
 *
 * `authorization` queda fuera porque esta API no lo usa —la sesión viaja en la
 * cookie (D-001)— y reenviarlo abriría un segundo camino de autenticación que
 * nadie ha especificado. Las cabeceras de identidad del cliente quedan fuera
 * porque NestJS no toma ninguna decisión con ellas: FR-033 cuenta intentos por
 * correo y nunca por origen.
 */
const CABECERAS_HACIA_API = ['content-type', 'accept', 'cookie'] as const;
const CABECERAS_DESDE_API = ['content-type', 'set-cookie'] as const;

/**
 * Plazo máximo de espera (D-017). Por encima del objetivo de 5 segundos de
 * SC-001, para no cortar una petición legítima lenta, y muy por debajo del
 * tiempo que una persona tolera ante una pantalla quieta. Sin él, una petición
 * colgada dejaría el navegador esperando indefinidamente y sin mensaje.
 */
const PLAZO_MS = 10_000;

/** Cuerpo de error del `502`, con el mismo formato que cualquier otro fallo. */
const ERROR_UPSTREAM = JSON.stringify({
  error: { code: 'UPSTREAM_UNAVAILABLE', message: MSG_ERROR_INESPERADO },
});

function urlDeApi(request: NextRequest, segmentos: string[]): string {
  const base = process.env.API_INTERNAL_URL;
  if (!base) {
    throw new Error('API_INTERNAL_URL no está definida. El proxy no sabe a dónde reenviar.');
  }
  const ruta = segmentos.join('/');
  return `${base.replace(/\/$/, '')}/api/v1/${ruta}${request.nextUrl.search}`;
}

async function reenviar(
  request: NextRequest,
  contexto: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await contexto.params;

  const cabeceras = new Headers();
  for (const nombre of CABECERAS_HACIA_API) {
    const valor = request.headers.get(nombre);
    if (valor !== null) cabeceras.set(nombre, valor);
  }

  // El cuerpo se toma como flujo crudo: ni se analiza ni se reserializa.
  const tieneCuerpo = request.method !== 'GET' && request.method !== 'HEAD';
  const cuerpo = tieneCuerpo ? await request.arrayBuffer() : undefined;

  const cancelacion = AbortSignal.timeout(PLAZO_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(urlDeApi(request, path), {
      method: request.method,
      headers: cabeceras,
      body: cuerpo,
      signal: cancelacion,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    // Plazo agotado, conexión fallida o respuesta que no es HTTP válida.
    //
    // **No reintenta**: el proxy no sabe si NestJS llegó a aplicar la petición
    // antes de dejar de responder, y repetir una desactivación o un alta podría
    // duplicarla. **No fabrica contenido**: jamás una lista vacía, que se
    // confundiría con «no hay datos» y mostraría al administrador un padrón
    // vacío como si fuera real. **No filtra el detalle técnico**: el mensaje va
    // en español y no menciona direcciones internas, puertos ni trazas.
    return new Response(ERROR_UPSTREAM, {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const cabecerasSalida = new Headers();
  for (const nombre of CABECERAS_DESDE_API) {
    if (nombre === 'set-cookie') {
      // `getSetCookie` conserva las cookies múltiples, que un `get` colapsaría
      // en una sola cadena inválida.
      for (const cookie of respuesta.headers.getSetCookie()) {
        cabecerasSalida.append('set-cookie', cookie);
      }
      continue;
    }
    const valor = respuesta.headers.get(nombre);
    if (valor !== null) cabecerasSalida.set(nombre, valor);
  }

  return new Response(respuesta.body, {
    status: respuesta.status,
    headers: cabecerasSalida,
  });
}

export const GET = reenviar;
export const POST = reenviar;
export const PUT = reenviar;
export const PATCH = reenviar;
export const DELETE = reenviar;

/** Nunca se cachea: toda respuesta depende de la sesión de quien pregunta. */
export const dynamic = 'force-dynamic';
