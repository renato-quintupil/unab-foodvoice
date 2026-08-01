"use client";

import { useState } from "react";
import { formatoCLP, useStore } from "@/lib/store";

export default function MenuLocalPage() {
  const { productos, crearProducto, actualizarProducto, alternarActivo } =
    useStore();

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [error, setError] = useState<string | null>(null);

  const agregar = () => {
    const precioNum = Number(precio);
    if (!nombre.trim() || !categoria.trim() || !Number.isFinite(precioNum) || precioNum <= 0) {
      setError("Ingresa nombre, categoría y un precio válido mayor a 0.");
      return;
    }
    crearProducto({ nombre: nombre.trim(), precio: precioNum, categoria: categoria.trim() });
    setNombre("");
    setPrecio("");
    setCategoria("");
    setError(null);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Administración de menú</h1>
        <p className="text-sm text-neutral-600">
          HU-02 · El local gestiona la disponibilidad de sus productos. Un
          producto desactivado no aparece en el catálogo del cliente.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">Nuevo producto</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Precio (CLP)"
            inputMode="numeric"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Categoría"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={agregar}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Agregar producto
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Productos ({productos.length})
        </h2>
        <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {productos.map((p) => (
            <ProductoFila
              key={p.id}
              nombre={p.nombre}
              precio={p.precio}
              categoria={p.categoria}
              activo={p.activo}
              onGuardar={(data) => actualizarProducto(p.id, data)}
              onAlternar={() => alternarActivo(p.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface FilaProps {
  nombre: string;
  precio: number;
  categoria: string;
  activo: boolean;
  onGuardar: (data: { nombre: string; precio: number; categoria: string }) => void;
  onAlternar: () => void;
}

function ProductoFila({ nombre, precio, categoria, activo, onGuardar, onAlternar }: FilaProps) {
  const [editando, setEditando] = useState(false);
  const [n, setN] = useState(nombre);
  const [pr, setPr] = useState(String(precio));
  const [c, setC] = useState(categoria);

  const guardar = () => {
    const precioNum = Number(pr);
    if (!n.trim() || !c.trim() || !Number.isFinite(precioNum) || precioNum <= 0) return;
    onGuardar({ nombre: n.trim(), precio: precioNum, categoria: c.trim() });
    setEditando(false);
  };

  if (editando) {
    return (
      <div className="grid gap-2 p-4 sm:grid-cols-4">
        <input className="rounded border border-neutral-300 px-2 py-1 text-sm sm:col-span-2" value={n} onChange={(e) => setN(e.target.value)} />
        <input className="rounded border border-neutral-300 px-2 py-1 text-sm" value={pr} onChange={(e) => setPr(e.target.value)} inputMode="numeric" />
        <input className="rounded border border-neutral-300 px-2 py-1 text-sm" value={c} onChange={(e) => setC(e.target.value)} />
        <div className="flex gap-2 sm:col-span-4">
          <button onClick={guardar} className="rounded bg-brand px-3 py-1 text-sm text-white hover:bg-brand-dark">Guardar</button>
          <button onClick={() => setEditando(false)} className="rounded border border-neutral-300 px-3 py-1 text-sm">Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {nombre}{" "}
          <span className={activo ? "text-xs text-green-700" : "text-xs text-neutral-400"}>
            {activo ? "· activo" : "· inactivo"}
          </span>
        </p>
        <p className="text-sm text-neutral-500">
          {categoria} · {formatoCLP(precio)}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditando(true)} className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50">
          Editar
        </button>
        <button
          onClick={onAlternar}
          className={
            activo
              ? "rounded border border-red-200 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
              : "rounded border border-green-200 px-3 py-1 text-sm text-green-700 hover:bg-green-50"
          }
        >
          {activo ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}
