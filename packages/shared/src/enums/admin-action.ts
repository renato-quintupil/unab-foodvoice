/**
 * Acciones administrativas registrables en la bitácora (FR-034).
 *
 * Seis valores, uno por cada acción que FR-034 enumera, y **ninguno más**. La
 * ausencia de valores para los eventos de autenticación —inicios de sesión,
 * fallos, bloqueos, cierres y expiraciones— es lo que hace **estructural** su
 * exclusión del registro, en lugar de depender de que el código recuerde no
 * escribirlos (supuesto 27, security CHK032).
 */
export const AdminAction = {
  CREAR: 'CREAR',
  EDITAR: 'EDITAR',
  CAMBIAR_ROL: 'CAMBIAR_ROL',
  DESACTIVAR: 'DESACTIVAR',
  REACTIVAR: 'REACTIVAR',
  RESTABLECER_PASSWORD: 'RESTABLECER_PASSWORD',
} as const;

export type AdminAction = (typeof AdminAction)[keyof typeof AdminAction];
