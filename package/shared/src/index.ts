/**
 * Contratos de dominio compartidos de FoodVoice.
 *
 * Única fuente de verdad de los modelos que reutilizan las apps (web/móvil) y el
 * backend. Alineado con el modelo entidad-relación de `doc/arquitectura/arquitectura-base.md`.
 */

/** Roles del sistema (cuatro actores del dominio). */
export type Rol = "cliente" | "local" | "repartidor" | "admin";

/**
 * Estados por los que transita un pedido.
 * El orden refleja la máquina de estados de la arquitectura (HU-01, HU-03).
 */
export type EstadoPedido =
  | "creado"
  | "aceptado"
  | "en_preparacion"
  | "en_reparto"
  | "entregado"
  | "cerrado"
  | "rechazado";

/** Producto del menú de un local (HU-02). */
export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  categoria: string;
  /** Baja lógica: un producto inactivo no aparece en el catálogo del cliente. */
  activo: boolean;
}

/** Línea de un pedido. El precio se congela al momento de la compra. */
export interface ItemPedido {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

/** Dirección de entrega (HU-11). La textual es obligatoria; las coordenadas, opcionales. */
export interface Direccion {
  direccionTexto: string;
  latitud?: number;
  longitud?: number;
}

/** Registro de un cambio de estado, base de la trazabilidad (HU-03). */
export interface CambioEstado {
  estado: EstadoPedido;
  actor: Rol;
  /** Marca temporal en formato ISO 8601. */
  fechaHora: string;
}

/** Pedido con su estado actual y su historial completo (HU-01, HU-03). */
export interface Pedido {
  id: string;
  clienteNombre: string;
  items: ItemPedido[];
  direccion: Direccion;
  estadoActual: EstadoPedido;
  total: number;
  motivoRechazo?: string;
  /** Historial cronológico de transiciones. Fuente de verdad del estado. */
  historial: CambioEstado[];
  createdAt: string;
}

/**
 * Máquina de estados del pedido: transiciones válidas desde cada estado.
 * Ningún estado puede saltarse fuera de este orden (HU-03).
 */
export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  creado: ["aceptado", "rechazado"],
  aceptado: ["en_preparacion"],
  en_preparacion: ["en_reparto"],
  en_reparto: ["entregado"],
  entregado: ["cerrado"],
  cerrado: [],
  rechazado: [],
};

/** Indica si una transición de estado es válida según la máquina de estados. */
export function transicionValida(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

/** Etiquetas legibles de cada estado, para la interfaz. */
export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  creado: "Creado",
  aceptado: "Aceptado",
  en_preparacion: "En preparación",
  en_reparto: "En reparto",
  entregado: "Entregado",
  cerrado: "Cerrado",
  rechazado: "Rechazado",
};

/** Etiquetas legibles de cada rol. */
export const ETIQUETA_ROL: Record<Rol, string> = {
  cliente: "Cliente",
  local: "Local comercial",
  repartidor: "Repartidor",
  admin: "Administrador",
};
