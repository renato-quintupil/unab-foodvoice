/**
 * Validación de arranque de las variables de entorno (FR-028, ops CHK003).
 *
 * **Si falta una variable obligatoria, el arranque falla nombrándola** y el
 * proceso termina con código distinto de cero. No existe arranque degradado ni
 * valor de reserva: un servicio en pie con una configuración incompleta es más
 * difícil de diagnosticar que uno que no arranca.
 *
 * La aplicación lee sus secretos **exclusivamente de variables de entorno**
 * (D-019): no lee archivos de configuración propios ni consulta ningún servicio
 * externo, de modo que cualquier gestor de secretos que sepa inyectar variables
 * funciona sin tocar una línea de código.
 */

/** Las que la API necesita para arrancar. `web` valida las suyas por su cuenta. */
const OBLIGATORIAS = ['DATABASE_URL'] as const;

/**
 * Solo el servidor HTTP las necesita, no la semilla (D-064, E6): `LLM_API_KEY`
 * habilita la búsqueda por voz, que la semilla nunca invoca. Mismo criterio de
 * "sin arranque degradado" que `DATABASE_URL`, pero acotado a quien de verdad
 * la usa — exigirla también para `db:seed` obligaría a configurar un proveedor
 * de IA solo para cargar el catálogo de ejemplo.
 */
const OBLIGATORIAS_SERVIDOR = ['LLM_API_KEY'] as const;

/** Las que solo la semilla necesita, comprobadas cuando se la ejecuta (D-010). */
const OBLIGATORIAS_SEMILLA = ['ADMIN_SEED_EMAIL', 'ADMIN_SEED_PASSWORD'] as const;

export type EnvValidada = {
  DATABASE_URL: string;
  NODE_ENV: string;
  PORT_API: number;
  /**
   * Interfaz en la que escucha la API. Opcional: sin valor, Node elige por su
   * cuenta y el comportamiento es el de siempre.
   *
   * Existe para las plataformas cuya red interna es **solo IPv6** —Railway,
   * entre otras—, donde el servicio debe enlazarse a `::` para que el resto del
   * proyecto lo alcance. No se fija a `::` por defecto porque un contenedor sin
   * IPv6 fallaría al arrancar con `EAFNOSUPPORT`, y eso rompería el despliegue
   * local, que es el que se usa a diario.
   */
  HOST_API: string | undefined;
  /** Clave de la API de Anthropic (E6, D-064). Nunca se expone en logs. */
  LLM_API_KEY: string;
  /** Modelo fijo, sin cambio silencioso ni valor de reserva (HU-06 §5.3). */
  LLM_MODEL: string;
  /** Milisegundos antes de abandonar la llamada al proveedor (D-065). */
  LLM_TIMEOUT_MS: number;
};

class ErrorDeConfiguracion extends Error {}

function exigir(nombres: readonly string[], entorno: NodeJS.ProcessEnv): void {
  const ausentes = nombres.filter((nombre) => {
    const valor = entorno[nombre];
    return valor === undefined || valor.trim() === '';
  });

  if (ausentes.length > 0) {
    throw new ErrorDeConfiguracion(
      `Falta configuración obligatoria: ${ausentes.join(', ')}. ` +
        'Copia .env.example a .env y completa esos valores. El servicio no arranca sin ellos.',
    );
  }
}

/** Valida lo que la API necesita para atender peticiones. */
export function validarEntorno(entorno: NodeJS.ProcessEnv = process.env): EnvValidada {
  exigir([...OBLIGATORIAS, ...OBLIGATORIAS_SERVIDOR], entorno);

  const puerto = Number(entorno.PORT_API ?? 3001);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new ErrorDeConfiguracion(`PORT_API no es un puerto válido: ${entorno.PORT_API}`);
  }

  const host = entorno.HOST_API?.trim();

  const timeoutLlm = Number(entorno.LLM_TIMEOUT_MS ?? 4000);
  if (!Number.isInteger(timeoutLlm) || timeoutLlm < 1) {
    throw new ErrorDeConfiguracion(`LLM_TIMEOUT_MS no es válido: ${entorno.LLM_TIMEOUT_MS}`);
  }

  return {
    DATABASE_URL: entorno.DATABASE_URL as string,
    NODE_ENV: entorno.NODE_ENV ?? 'development',
    PORT_API: puerto,
    HOST_API: host === undefined || host === '' ? undefined : host,
    LLM_API_KEY: entorno.LLM_API_KEY as string,
    LLM_MODEL: entorno.LLM_MODEL ?? 'claude-haiku-4-5-20251001',
    LLM_TIMEOUT_MS: timeoutLlm,
  };
}

/** Valida lo que la semilla necesita (D-010). Nunca hay contraseña por defecto. */
export function validarEntornoSemilla(entorno: NodeJS.ProcessEnv = process.env): {
  email: string;
  password: string;
  recuperar: boolean;
} {
  exigir([...OBLIGATORIAS, ...OBLIGATORIAS_SEMILLA], entorno);

  const password = entorno.ADMIN_SEED_PASSWORD as string;
  if (password.length < 8) {
    throw new ErrorDeConfiguracion(
      'ADMIN_SEED_PASSWORD debe tener al menos 8 caracteres (FR-032).',
    );
  }
  if (new TextEncoder().encode(password).length > 72) {
    throw new ErrorDeConfiguracion(
      'ADMIN_SEED_PASSWORD no puede superar los 72 bytes UTF-8 (D-002).',
    );
  }

  return {
    email: entorno.ADMIN_SEED_EMAIL as string,
    password,
    recuperar:
      entorno.ADMIN_SEED_RECOVER === 'true' || process.argv.includes('--recuperar'),
  };
}

export { ErrorDeConfiguracion };
