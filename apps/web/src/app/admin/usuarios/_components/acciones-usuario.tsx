'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AdminAction,
  ETIQUETA_ROL,
  Role,
  UserStatus,
  type UserDto,
} from '@foodvoice/shared';
import { AvisoExito } from '@/components/aviso-exito';
import { ConfirmarAccion } from '@/components/confirmar-accion';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { api, ErrorDeApi } from '@/lib/api-client';

/**
 * Las cuatro acciones de impacto sobre un usuario (T101, FR-024, FR-035,
 * FR-037, SC-019, ux CHK020).
 *
 * Cada una pasa por el diálogo de confirmación y **declara si se puede
 * deshacer**: cambio de rol, desactivación y reactivación son reversibles; el
 * restablecimiento de contraseña **no**.
 *
 * Tras el éxito se muestra la confirmación de FR-037 nombrando al afectado, y
 * nunca junto a un mensaje de error.
 */
export function AccionesUsuario({ usuario }: { usuario: UserDto }) {
  const router = useRouter();
  const [exito, setExito] = useState<AdminAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rolNuevo, setRolNuevo] = useState<Role>(usuario.role);
  const [contrasena, setContrasena] = useState('');

  async function ejecutar(accion: AdminAction, llamada: () => Promise<unknown>) {
    setError(null);
    setExito(null);
    try {
      await llamada();
      setExito(accion);
      router.refresh();
    } catch (fallo) {
      // El aviso de éxito nunca convive con un error: o una cosa o la otra.
      setError(fallo instanceof ErrorDeApi ? fallo.mensaje : 'No pudimos completar la operación.');
    }
  }

  const desactivado = usuario.status === UserStatus.DESACTIVADO;

  return (
    <div className="flex flex-col gap-2">
      {exito && <AvisoExito accion={exito} nombre={usuario.fullName} />}
      {error && (
        <p role="alert" className="text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <ConfirmarAccion
          etiqueta="Cambiar rol"
          titulo={`Cambiar el rol de ${usuario.fullName}`}
          descripcion={`${usuario.fullName} pasará a tener el rol seleccionado. Su sesión terminará y el nuevo rol regirá en su próximo inicio de sesión.`}
          reversible
          textoConfirmar="Cambiar rol"
          onConfirmar={() =>
            ejecutar(AdminAction.CAMBIAR_ROL, () =>
              api.put(`/admin/users/${usuario.id}/role`, { role: rolNuevo }),
            )
          }
        >
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor={`rol-${usuario.id}`}>Nuevo rol</Label>
            <select
              id={`rol-${usuario.id}`}
              value={rolNuevo}
              onChange={(evento) => setRolNuevo(evento.target.value as Role)}
              className="h-10 rounded-md border border-[var(--color-borde)] px-3 text-sm"
            >
              {Object.values(Role).map((rol) => (
                <option key={rol} value={rol}>
                  {ETIQUETA_ROL[rol]}
                </option>
              ))}
            </select>
          </div>
        </ConfirmarAccion>

        <ConfirmarAccion
          etiqueta={desactivado ? 'Reactivar' : 'Desactivar'}
          titulo={`${desactivado ? 'Reactivar' : 'Desactivar'} a ${usuario.fullName}`}
          descripcion={
            desactivado
              ? `${usuario.fullName} volverá a poder iniciar sesión con sus credenciales actuales.`
              : `${usuario.fullName} dejará de poder iniciar sesión y sus sesiones abiertas terminarán. Su historial se conserva.`
          }
          reversible
          textoConfirmar={desactivado ? 'Reactivar' : 'Desactivar'}
          onConfirmar={() =>
            ejecutar(
              desactivado ? AdminAction.REACTIVAR : AdminAction.DESACTIVAR,
              () =>
                api.put(`/admin/users/${usuario.id}/status`, {
                  status: desactivado ? UserStatus.ACTIVO : UserStatus.DESACTIVADO,
                }),
            )
          }
        />

        <ConfirmarAccion
          etiqueta="Restablecer contraseña"
          titulo={`Restablecer la contraseña de ${usuario.fullName}`}
          descripcion={`La contraseña actual de ${usuario.fullName} dejará de servir y sus sesiones abiertas terminarán. Anota la nueva contraseña: no volverá a mostrarse.`}
          // La única de las cuatro que NO se puede deshacer.
          reversible={false}
          textoConfirmar="Restablecer"
          onConfirmar={() =>
            ejecutar(AdminAction.RESTABLECER_PASSWORD, () =>
              api.post(`/admin/users/${usuario.id}/password-reset`, {
                password: contrasena,
              }),
            )
          }
        >
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor={`contrasena-${usuario.id}`}>Nueva contraseña</Label>
            <Input
              id={`contrasena-${usuario.id}`}
              type="text"
              autoComplete="off"
              value={contrasena}
              onChange={(evento) => setContrasena(evento.target.value)}
            />
          </div>
        </ConfirmarAccion>
      </div>
    </div>
  );
}
