/**
 * Tests del proxy BFF (T044, D-006, D-017, api CHK005, api CHK013).
 */
import { NextRequest } from 'next/server';
import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/[...path]/route';

const API = 'http://api:3001';

function peticion(
  url: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): NextRequest {
  return new NextRequest(new Request(url, init));
}

const contexto = (path: string[]) => ({ params: Promise.resolve({ path }) });

let fetchSimulado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.API_INTERNAL_URL = API;
  fetchSimulado = vi.fn();
  vi.stubGlobal('fetch', fetchSimulado);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Reenvío transparente', () => {
  it('reenvía el verbo, la ruta bajo /api/v1 y la cadena de consulta', async () => {
    fetchSimulado.mockResolvedValue(new Response('{}', { status: 200 }));

    await GET(
      peticion('http://localhost:3000/api/admin/users?page=2&role=CLIENTE'),
      contexto(['admin', 'users']),
    );

    const [url, opciones] = fetchSimulado.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/api/v1/admin/users?page=2&role=CLIENTE`);
    expect(opciones.method).toBe('GET');
  });

  it('propaga solo content-type, accept y cookie hacia NestJS', async () => {
    fetchSimulado.mockResolvedValue(new Response('{}', { status: 200 }));

    await POST(
      peticion('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: '{"email":"a@b.cl"}',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          cookie: 'fv_session=abc',
          authorization: 'Bearer secreto',
          'x-forwarded-for': '10.0.0.1',
          origin: 'http://malicioso.cl',
          referer: 'http://malicioso.cl',
          'user-agent': 'curl/8',
        },
      }),
      contexto(['auth', 'login']),
    );

    const [, opciones] = fetchSimulado.mock.calls[0] as [string, RequestInit];
    const enviadas = opciones.headers as Headers;

    expect(enviadas.get('content-type')).toBe('application/json');
    expect(enviadas.get('accept')).toBe('application/json');
    expect(enviadas.get('cookie')).toBe('fv_session=abc');

    for (const prohibida of [
      'authorization',
      'x-forwarded-for',
      'origin',
      'referer',
      'user-agent',
      'host',
    ]) {
      expect(enviadas.get(prohibida), prohibida).toBeNull();
    }
  });

  it('propaga de vuelta el código de estado, content-type y set-cookie, y nada más', async () => {
    const cabeceras = new Headers({ 'content-type': 'application/json' });
    cabeceras.append('set-cookie', 'fv_session=xyz; HttpOnly; Path=/');
    cabeceras.set('x-powered-by', 'Express');
    fetchSimulado.mockResolvedValue(new Response('{"ok":true}', { status: 201, headers: cabeceras }));

    const respuesta = await POST(
      peticion('http://localhost:3000/api/admin/users', { method: 'POST', body: '{}' }),
      contexto(['admin', 'users']),
    );

    expect(respuesta.status).toBe(201);
    expect(respuesta.headers.get('content-type')).toBe('application/json');
    expect(respuesta.headers.get('set-cookie')).toContain('fv_session=xyz');
    expect(respuesta.headers.get('x-powered-by')).toBeNull();
  });

  it('reenvía el cuerpo sin modificar', async () => {
    fetchSimulado.mockResolvedValue(new Response('{}', { status: 200 }));
    const crudo = '{"email":"MARIA@Ejemplo.CL","password":"secreta1"}';

    await POST(
      peticion('http://localhost:3000/api/auth/login', { method: 'POST', body: crudo }),
      contexto(['auth', 'login']),
    );

    const [, opciones] = fetchSimulado.mock.calls[0] as [string, RequestInit];
    expect(new TextDecoder().decode(opciones.body as ArrayBuffer)).toBe(crudo);
  });

  it('propaga los códigos de error tal cual, sin transformarlos', async () => {
    fetchSimulado.mockResolvedValue(
      new Response('{"error":{"code":"FORBIDDEN"}}', {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const respuesta = await GET(
      peticion('http://localhost:3000/api/admin/users'),
      contexto(['admin', 'users']),
    );

    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ error: { code: 'FORBIDDEN' } });
  });
});

describe('Cuando NestJS no responde (D-017)', () => {
  it('devuelve 502 UPSTREAM_UNAVAILABLE con el mensaje en español', async () => {
    fetchSimulado.mockRejectedValue(new Error('ECONNREFUSED'));

    const respuesta = await GET(
      peticion('http://localhost:3000/api/admin/users'),
      contexto(['admin', 'users']),
    );

    expect(respuesta.status).toBe(502);
    expect(await respuesta.json()).toEqual({
      error: { code: 'UPSTREAM_UNAVAILABLE', message: MSG_ERROR_INESPERADO },
    });
  });

  it('NUNCA devuelve 200 con lista vacía: eso se confundiría con «no hay datos»', async () => {
    fetchSimulado.mockRejectedValue(new Error('timeout'));

    const respuesta = await GET(
      peticion('http://localhost:3000/api/admin/users'),
      contexto(['admin', 'users']),
    );

    expect(respuesta.status).not.toBe(200);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    expect(cuerpo).not.toHaveProperty('items');
  });

  it('no reintenta: una sola llamada al servicio', async () => {
    fetchSimulado.mockRejectedValue(new Error('ECONNREFUSED'));

    await POST(
      peticion('http://localhost:3000/api/admin/users', { method: 'POST', body: '{}' }),
      contexto(['admin', 'users']),
    );

    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('no filtra el detalle técnico: ni direcciones, ni puertos, ni trazas', async () => {
    fetchSimulado.mockRejectedValue(new Error('connect ECONNREFUSED 172.18.0.3:3001'));

    const respuesta = await GET(
      peticion('http://localhost:3000/api/admin/users'),
      contexto(['admin', 'users']),
    );

    const texto = await respuesta.text();
    expect(texto).not.toMatch(/172\.18|3001|ECONNREFUSED|api:/);
  });

  it('declara un plazo de espera en la petición', async () => {
    fetchSimulado.mockResolvedValue(new Response('{}', { status: 200 }));

    await GET(peticion('http://localhost:3000/api/health'), contexto(['health']));

    const [, opciones] = fetchSimulado.mock.calls[0] as [string, RequestInit];
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
  });
});
