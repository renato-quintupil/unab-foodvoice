"use client";

/**
 * Store en memoria del prototipo (Sumativa 2).
 *
 * Implementa la lógica de HU-01 (pedidos con estado), HU-02 (menú) y HU-03
 * (trazabilidad) usando los contratos de `@foodvoice/shared`. No hay backend:
 * el estado vive en React y se reinicia al recargar. La migración a la API REST
 * (Sprint 3) reemplaza esta capa sin cambiar los contratos de dominio.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type CambioEstado,
  type Direccion,
  type EstadoPedido,
  type ItemPedido,
  type Pedido,
  type Producto,
  type Rol,
  transicionValida,
} from "@foodvoice/shared";

let contador = 1000;
const nuevoId = (prefijo: string): string => `${prefijo}-${++contador}`;

const PRODUCTOS_INICIALES: Producto[] = [
  { id: "prod-1", nombre: "Hamburguesa clásica", precio: 5990, categoria: "Hamburguesas", activo: true },
  { id: "prod-2", nombre: "Hamburguesa doble queso", precio: 7490, categoria: "Hamburguesas", activo: true },
  { id: "prod-3", nombre: "Papas fritas medianas", precio: 2990, categoria: "Acompañamientos", activo: true },
  { id: "prod-4", nombre: "Ensalada César", precio: 4990, categoria: "Ensaladas", activo: true },
  { id: "prod-5", nombre: "Bebida lata 350cc", precio: 1490, categoria: "Bebidas", activo: true },
  { id: "prod-6", nombre: "Jugo natural", precio: 2490, categoria: "Bebidas", activo: false },
];

interface StoreValor {
  productos: Producto[];
  pedidos: Pedido[];
  /** HU-02: alta de un producto (queda activo). */
  crearProducto: (data: Omit<Producto, "id" | "activo">) => void;
  /** HU-02: edición de nombre, precio y categoría. */
  actualizarProducto: (
    id: string,
    data: Partial<Omit<Producto, "id">>,
  ) => void;
  /** HU-02: activar/desactivar disponibilidad. */
  alternarActivo: (id: string) => void;
  /** HU-01 + HU-11: crea un pedido en estado "creado" con su historial inicial. */
  crearPedido: (
    clienteNombre: string,
    items: ItemPedido[],
    direccion: Direccion,
  ) => Pedido;
  /** HU-01 + HU-03: transiciona un pedido validando la máquina de estados. */
  cambiarEstado: (
    pedidoId: string,
    hacia: EstadoPedido,
    actor: Rol,
    motivoRechazo?: string,
  ) => boolean;
}

const StoreContext = createContext<StoreValor | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [productos, setProductos] = useState<Producto[]>(PRODUCTOS_INICIALES);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const crearProducto = useCallback(
    (data: Omit<Producto, "id" | "activo">) => {
      setProductos((prev) => [
        ...prev,
        { ...data, id: nuevoId("prod"), activo: true },
      ]);
    },
    [],
  );

  const actualizarProducto = useCallback(
    (id: string, data: Partial<Omit<Producto, "id">>) => {
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p)),
      );
    },
    [],
  );

  const alternarActivo = useCallback((id: string) => {
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, activo: !p.activo } : p)),
    );
  }, []);

  const crearPedido = useCallback(
    (clienteNombre: string, items: ItemPedido[], direccion: Direccion) => {
      const ahora = new Date().toISOString();
      const total = items.reduce(
        (acc, it) => acc + it.precioUnitario * it.cantidad,
        0,
      );
      const historialInicial: CambioEstado = {
        estado: "creado",
        actor: "cliente",
        fechaHora: ahora,
      };
      const pedido: Pedido = {
        id: nuevoId("ped"),
        clienteNombre,
        items,
        direccion,
        estadoActual: "creado",
        total,
        historial: [historialInicial],
        createdAt: ahora,
      };
      setPedidos((prev) => [pedido, ...prev]);
      return pedido;
    },
    [],
  );

  const cambiarEstado = useCallback(
    (
      pedidoId: string,
      hacia: EstadoPedido,
      actor: Rol,
      motivoRechazo?: string,
    ): boolean => {
      let ok = false;
      setPedidos((prev) =>
        prev.map((p) => {
          if (p.id !== pedidoId) return p;
          if (!transicionValida(p.estadoActual, hacia)) return p;
          ok = true;
          const cambio: CambioEstado = {
            estado: hacia,
            actor,
            fechaHora: new Date().toISOString(),
          };
          return {
            ...p,
            estadoActual: hacia,
            motivoRechazo:
              hacia === "rechazado" ? motivoRechazo : p.motivoRechazo,
            historial: [...p.historial, cambio],
          };
        }),
      );
      return ok;
    },
    [],
  );

  const valor = useMemo<StoreValor>(
    () => ({
      productos,
      pedidos,
      crearProducto,
      actualizarProducto,
      alternarActivo,
      crearPedido,
      cambiarEstado,
    }),
    [
      productos,
      pedidos,
      crearProducto,
      actualizarProducto,
      alternarActivo,
      crearPedido,
      cambiarEstado,
    ],
  );

  return <StoreContext.Provider value={valor}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValor {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore debe usarse dentro de <StoreProvider>");
  }
  return ctx;
}

/** Formatea un monto en pesos chilenos. */
export function formatoCLP(monto: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(monto);
}
