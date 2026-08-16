'use client';

import { MSG_ERROR_INESPERADO } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';

/**
 * Límite de error de la aplicación (T120, D-019, Principio II, ops CHK033).
 *
 * Cuando PostgreSQL deja de estar disponible, la API responde `500` y esta
 * vista lo presenta como aviso **en español y sin ningún detalle técnico**.
 *
 * **No lleva a `/login`**, y ese es el punto que había que decidir por
 * adelantado: la reacción natural ante una consulta de sesión que falla es
 * tratarla como sesión inválida y expulsar al usuario. Sería un error —su
 * sesión sigue siendo válida, lo que falló es la base de datos— y le haría
 * perder el formulario y volver a autenticarse por un problema ajeno. Un fallo
 * de infraestructura no es un `401`.
 */
export default function LimiteDeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      role="alert"
      className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4 py-10"
    >
      <h1 className="text-xl font-semibold">No pudimos mostrar esta página</h1>
      <p>{MSG_ERROR_INESPERADO}</p>
      <div>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </main>
  );
}
