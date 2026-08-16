/**
 * Rol de un usuario (FR-002, RN-001, RN-003).
 *
 * Conjunto cerrado y no extensible por el usuario final. Un usuario tiene
 * exactamente un rol vigente y no hay permisos diferenciados dentro de un rol.
 */
export const Role = {
  CLIENTE: 'CLIENTE',
  NEGOCIO: 'NEGOCIO',
  REPARTIDOR: 'REPARTIDOR',
  ADMINISTRADOR: 'ADMINISTRADOR',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

/** Estado del usuario en el padrón (FR-012, FR-013). No hay borrado físico. */
export const UserStatus = {
  ACTIVO: 'ACTIVO',
  DESACTIVADO: 'DESACTIVADO',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
