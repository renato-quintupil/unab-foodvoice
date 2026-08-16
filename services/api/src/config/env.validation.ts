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
  exigir(OBLIGATORIAS, entorno);

  const puerto = Number(entorno.PORT_API ?? 3001);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new ErrorDeConfiguracion(`PORT_API no es un puerto válido: ${entorno.PORT_API}`);
  }

  const host = entorno.HOST_API?.trim();

  return {
    DATABASE_URL: entorno.DATABASE_URL as string,
    NODE_ENV: entorno.NODE_ENV ?? 'development',
    PORT_API: puerto,
    HOST_API: host === undefined || host === '' ? undefined : host,
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
