import Link from "next/link";

const ACCESOS = [
  {
    href: "/local/menu",
    titulo: "Menú del local",
    descripcion:
      "Administra la disponibilidad de productos: alta, edición y activación/desactivación (HU-02).",
  },
  {
    href: "/cliente",
    titulo: "Pedir como cliente",
    descripcion:
      "Explora el catálogo, busca por voz, indica tu dirección y crea un pedido (HU-01, HU-06, HU-11).",
  },
  {
    href: "/pedidos",
    titulo: "Pedidos y trazabilidad",
    descripcion:
      "Gestiona el estado de cada pedido y consulta su historial de cambios (HU-01, HU-03).",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold">FoodVoice</h1>
        <p className="max-w-2xl text-neutral-600">
          Prototipo funcional del flujo central de FoodVoice: crear un pedido,
          seguir su estado de extremo a extremo y administrar el menú. Esta
          versión opera con estado en memoria como incremento de la Sumativa 2;
          la persistencia con backend llega en los siguientes Sprints.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {ACCESOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-brand hover:shadow-sm"
          >
            <h2 className="mb-2 font-semibold text-brand">{a.titulo}</h2>
            <p className="text-sm text-neutral-600">{a.descripcion}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
