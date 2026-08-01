"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_ROL,
  TRANSICIONES,
  type EstadoPedido,
  type Pedido,
  type Rol,
} from "@foodvoice/shared";
import { formatoCLP, useStore } from "@/lib/store";

// Acción asociada a cada transición: etiqueta y actor que la ejecuta.
const ACCIONES: Record<EstadoPedido, { etiqueta: string; actor: Rol }> = {
  creado: { etiqueta: "Crear", actor: "cliente" },
  aceptado: { etiqueta: "Aceptar", actor: "local" },
  rechazado: { etiqueta: "Rechazar", actor: "local" },
  en_preparacion: { etiqueta: "Iniciar preparación", actor: "local" },
  en_reparto: { etiqueta: "Enviar a reparto", actor: "local" },
  entregado: { etiqueta: "Marcar entregado", actor: "repartidor" },
  cerrado: { etiqueta: "Cerrar pedido", actor: "cliente" },
};

const COLOR_ESTADO: Record<EstadoPedido, string> = {
  creado: "bg-blue-100 text-blue-800",
  aceptado: "bg-indigo-100 text-indigo-800",
  en_preparacion: "bg-amber-100 text-amber-800",
  en_reparto: "bg-purple-100 text-purple-800",
  entregado: "bg-green-100 text-green-800",
  cerrado: "bg-neutral-200 text-neutral-700",
  rechazado: "bg-red-100 text-red-800",
};

export default function PedidosPage() {
  const { pedidos } = useStore();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Pedidos y trazabilidad</h1>
        <p className="text-sm text-neutral-600">
          HU-01 · HU-03 · Gestiona el estado de cada pedido respetando las
          transiciones válidas y consulta su historial completo.
        </p>
      </header>

      {pedidos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Todavía no hay pedidos.{" "}
          <Link href="/cliente" className="text-brand underline">
            Crea uno como cliente
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => (
            <PedidoCard key={p.id} pedido={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const { cambiarEstado } = useStore();
  const [verHistorial, setVerHistorial] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const siguientes = TRANSICIONES[pedido.estadoActual];

  const ejecutar = (hacia: EstadoPedido) => {
    if (hacia === "rechazado") {
      setRechazando(true);
      return;
    }
    cambiarEstado(pedido.id, hacia, ACCIONES[hacia].actor);
  };

  const confirmarRechazo = () => {
    cambiarEstado(pedido.id, "rechazado", "local", motivo.trim() || "Sin motivo indicado");
    setRechazando(false);
    setMotivo("");
  };

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {pedido.id}{" "}
            <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[pedido.estadoActual]}`}>
              {ETIQUETA_ESTADO[pedido.estadoActual]}
            </span>
          </p>
          <p className="text-sm text-neutral-500">Cliente: {pedido.clienteNombre}</p>
        </div>
        <p className="text-right font-semibold">{formatoCLP(pedido.total)}</p>
      </div>

      <ul className="mt-3 space-y-0.5 text-sm text-neutral-700">
        {pedido.items.map((it) => (
          <li key={it.productoId}>
            {it.cantidad}× {it.nombre}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-sm text-neutral-600">
        📍 {pedido.direccion.direccionTexto}
        {pedido.direccion.latitud != null && pedido.direccion.longitud != null && (
          <span className="text-neutral-400">
            {" "}
            ({pedido.direccion.latitud}, {pedido.direccion.longitud})
          </span>
        )}
      </p>

      {pedido.motivoRechazo && pedido.estadoActual === "rechazado" && (
        <p className="mt-2 text-sm text-red-700">Motivo del rechazo: {pedido.motivoRechazo}</p>
      )}

      {/* Acciones de transición (HU-01) */}
      {siguientes.length > 0 && !rechazando && (
        <div className="mt-4 flex flex-wrap gap-2">
          {siguientes.map((estado) => (
            <button
              key={estado}
              onClick={() => ejecutar(estado)}
              className={
                estado === "rechazado"
                  ? "rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  : "rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              }
            >
              {ACCIONES[estado].etiqueta}{" "}
              <span className="opacity-70">· {ETIQUETA_ROL[ACCIONES[estado].actor]}</span>
            </button>
          ))}
        </div>
      )}

      {rechazando && (
        <div className="mt-4 space-y-2">
          <input
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Motivo del rechazo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={confirmarRechazo} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700">
              Confirmar rechazo
            </button>
            <button onClick={() => setRechazando(false)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Trazabilidad (HU-03) */}
      <button
        onClick={() => setVerHistorial((v) => !v)}
        className="mt-4 text-sm text-brand hover:underline"
      >
        {verHistorial ? "Ocultar" : "Ver"} historial ({pedido.historial.length})
      </button>

      {verHistorial && (
        <ol className="mt-3 space-y-2 border-l-2 border-neutral-200 pl-4">
          {pedido.historial.map((c, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{ETIQUETA_ESTADO[c.estado]}</span>
              <span className="text-neutral-500">
                {" "}
                · {ETIQUETA_ROL[c.actor]} ·{" "}
                {new Date(c.fechaHora).toLocaleString("es-CL")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
