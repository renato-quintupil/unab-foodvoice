"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ItemPedido } from "@foodvoice/shared";
import { formatoCLP, useStore } from "@/lib/store";
import { useBusquedaVoz } from "@/lib/useBusquedaVoz";

export default function ClientePage() {
  const { productos, crearPedido } = useStore();

  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [clienteNombre, setClienteNombre] = useState("");
  const [direccionTexto, setDireccionTexto] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<{ id: string } | null>(null);

  const { soportado, escuchando, escuchar } = useBusquedaVoz((texto) =>
    setBusqueda(texto),
  );

  // Solo productos activos son visibles para el cliente (HU-02).
  const catalogo = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos
      .filter((p) => p.activo)
      .filter((p) => (q ? p.nombre.toLowerCase().includes(q) : true));
  }, [productos, busqueda]);

  const items: ItemPedido[] = useMemo(() => {
    return Object.entries(carrito)
      .filter(([, cant]) => cant > 0)
      .map(([id, cantidad]) => {
        const prod = productos.find((p) => p.id === id)!;
        return {
          productoId: id,
          nombre: prod.nombre,
          cantidad,
          precioUnitario: prod.precio,
        };
      });
  }, [carrito, productos]);

  const total = items.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0);

  const sumar = (id: string, delta: number) =>
    setCarrito((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));

  const confirmarPedido = () => {
    if (items.length === 0) {
      setError("Agrega al menos un producto disponible.");
      return;
    }
    if (!clienteNombre.trim()) {
      setError("Ingresa tu nombre.");
      return;
    }
    if (!direccionTexto.trim()) {
      setError("La dirección es obligatoria para crear el pedido.");
      return;
    }
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const pedido = crearPedido(clienteNombre.trim(), items, {
      direccionTexto: direccionTexto.trim(),
      latitud: lat.trim() && Number.isFinite(latNum) ? latNum : undefined,
      longitud: lng.trim() && Number.isFinite(lngNum) ? lngNum : undefined,
    });
    setConfirmado({ id: pedido.id });
    setCarrito({});
    setDireccionTexto("");
    setLat("");
    setLng("");
    setError(null);
  };

  if (confirmado) {
    return (
      <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6">
        <h1 className="text-xl font-bold text-green-800">¡Pedido creado!</h1>
        <p className="text-sm text-green-800">
          Tu pedido <strong>{confirmado.id}</strong> quedó en estado{" "}
          <strong>Creado</strong>. El local debe aceptarlo para continuar.
        </p>
        <div className="flex gap-3">
          <Link href="/pedidos" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Ver seguimiento
          </Link>
          <button onClick={() => setConfirmado(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">
            Hacer otro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Catálogo</h1>
          <p className="text-sm text-neutral-600">
            HU-01 · HU-06 · HU-11 · Busca por texto o por voz, arma tu pedido e
            indica la dirección de entrega.
          </p>
        </header>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="Buscar productos…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {soportado && (
            <button
              onClick={escuchar}
              aria-label="Buscar por voz"
              className={
                escuchando
                  ? "rounded-lg bg-red-600 px-4 py-2 text-sm text-white"
                  : "rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
              }
            >
              {escuchando ? "Escuchando…" : "🎤 Voz"}
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {catalogo.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
              <div>
                <p className="font-medium">{p.nombre}</p>
                <p className="text-sm text-neutral-500">
                  {p.categoria} · {formatoCLP(p.precio)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => sumar(p.id, -1)} className="h-8 w-8 rounded border border-neutral-300 text-lg leading-none">−</button>
                <span className="w-6 text-center text-sm">{carrito[p.id] ?? 0}</span>
                <button onClick={() => sumar(p.id, 1)} className="h-8 w-8 rounded border border-neutral-300 text-lg leading-none">+</button>
              </div>
            </div>
          ))}
          {catalogo.length === 0 && (
            <p className="text-sm text-neutral-500">No hay productos que coincidan.</p>
          )}
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-semibold">Tu pedido</h2>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">Aún no agregas productos.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((it) => (
              <li key={it.productoId} className="flex justify-between">
                <span>{it.cantidad}× {it.nombre}</span>
                <span>{formatoCLP(it.precioUnitario * it.cantidad)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between border-t border-neutral-200 pt-2 text-sm font-semibold">
          <span>Total</span>
          <span>{formatoCLP(total)}</span>
        </div>

        <div className="space-y-2 border-t border-neutral-200 pt-3">
          <input className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Tu nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
          <input className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Dirección de entrega (obligatoria)" value={direccionTexto} onChange={(e) => setDireccionTexto(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Latitud (opc.)" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            <input className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Longitud (opc.)" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button onClick={confirmarPedido} className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Crear pedido
        </button>
      </aside>
    </div>
  );
}
