'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ETIQUETA_ESTADO, ETIQUETA_ROL, Role, UserStatus } from '@foodvoice/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Búsqueda y filtros del listado (FR-015).
 *
 * Los tres criterios son combinables. Al aplicarlos se vuelve a la **página 1**:
 * conservar la página actual con un filtro más estrecho es la vía directa a un
 * listado vacío que parece un defecto.
 *
 * Las etiquetas de rol y estado salen de `ETIQUETA_ROL` y `ETIQUETA_ESTADO`, de
 * modo que el identificador interno en mayúsculas nunca llegue a la pantalla.
 */
export function Filtros() {
  const router = useRouter();
  const parametros = useSearchParams();

  const [search, setSearch] = useState(parametros.get('search') ?? '');
  const [role, setRole] = useState(parametros.get('role') ?? '');
  const [status, setStatus] = useState(parametros.get('status') ?? '');

  function aplicar(evento: React.FormEvent) {
    evento.preventDefault();
    const nuevos = new URLSearchParams();
    if (search.trim()) nuevos.set('search', search.trim());
    if (role) nuevos.set('role', role);
    if (status) nuevos.set('status', status);
    router.push(`/admin/usuarios?${nuevos.toString()}`);
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-52 flex-1 flex-col gap-1.5">
        <Label htmlFor="search">Buscar por nombre o correo</Label>
        <Input
          id="search"
          value={search}
          onChange={(evento) => setSearch(evento.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="role">Rol</Label>
        <select
          id="role"
          value={role}
          onChange={(evento) => setRole(evento.target.value)}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.values(Role).map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_ROL[valor]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Estado</Label>
        <select
          id="status"
          value={status}
          onChange={(evento) => setStatus(evento.target.value)}
          className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.values(UserStatus).map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_ESTADO[valor]}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit">Aplicar filtros</Button>
    </form>
  );
}
