/**
 * Inventario de las vistas del panel (T115, FR-021, RN-004, SC-015,
 * ux CHK034).
 *
 * **Por qué existe este archivo.** SC-015 exige que «el 100 % de las vistas del
 * panel» no ofrezca acciones que modifiquen datos. Sin un inventario, esa
 * afirmación no es verificable: nadie puede sostener que las visitó todas. Con
 * él, la comprobación C4 de la guía se hace **contra una lista cerrada** y no
 * recorriendo la aplicación a ojo.
 *
 * **Los enlaces de navegación no cuentan como modificación**: navegar no es
 * modificar, así que el enlace del panel hacia la gestión de usuarios no
 * incumple FR-021.
 *
 * Este inventario cubre **el panel**, no la superficie administrativa entera:
 * `/admin/usuarios` es la gestión de HU-09 y sí modifica datos, por diseño.
 */

export type VistaDelPanel = {
  ruta: string;
  nombre: string;
  /** Qué muestra, para que la comprobación no dependa de abrirla. */
  contenido: string;
  /** Controles que escriben datos. Debe ser vacío en todas (RN-004). */
  accionesDeEscritura: readonly string[];
};

export const VISTAS_DEL_PANEL: readonly VistaDelPanel[] = [
  {
    ruta: '/admin',
    nombre: 'Panel',
    contenido:
      'Usuarios activos por rol (cuatro cifras) y pedidos por estado (cinco cifras), más el enlace a Usuarios.',
    accionesDeEscritura: [],
  },
  {
    ruta: '/admin/pedidos',
    nombre: 'Reporte de pedidos',
    contenido:
      'Filtros por estado y rango de fechas, y la tabla de resultados con su mensaje de «sin datos».',
    accionesDeEscritura: [],
  },
];

/** Comprobación de SC-015 contra el inventario, no contra el recuerdo. */
export function elPanelEsDeSoloLectura(): boolean {
  return VISTAS_DEL_PANEL.every((vista) => vista.accionesDeEscritura.length === 0);
}
