'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AccionEnCurso } from '@/components/accion-en-curso';
import { api, destinoTrasSesionTerminada } from '@/lib/api-client';

/**
 * Cierre de sesión (FR-006).
 *
 * Lleva a `/login` **sin ningún mensaje**: decirle «tu sesión expiró» a quien
 * acaba de pulsar «Cerrar sesión» sería informarle de un problema que no existe
 * (ux CHK024, A16).
 */
export function CerrarSesion() {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);

  async function cerrar() {
    setEnCurso(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Si la sesión ya no valía, el resultado deseado es el mismo: salir. No
      // se muestra ningún error por algo que la persona no necesita resolver.
    }
    router.push(destinoTrasSesionTerminada(true));
    router.refresh();
  }

  return (
    <AccionEnCurso
      variant="outline"
      enCurso={enCurso}
      textoEnCurso="Cerrando sesión…"
      onClick={cerrar}
    >
      Cerrar sesión
    </AccionEnCurso>
  );
}
