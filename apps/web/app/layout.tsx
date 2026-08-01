import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "FoodVoice",
  description:
    "Plataforma digital de delivery: gestión de pedidos, menú y trazabilidad.",
};

const NAV = [
  { href: "/local/menu", label: "Menú (Local)" },
  { href: "/cliente", label: "Pedir (Cliente)" },
  { href: "/pedidos", label: "Pedidos y trazabilidad" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <StoreProvider>
          <header className="border-b border-neutral-200 bg-white">
            <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <Link href="/" className="text-lg font-bold text-brand">
                FoodVoice
              </Link>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-neutral-600 hover:text-brand"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-neutral-200 bg-white">
            <p className="mx-auto max-w-5xl px-4 py-3 text-xs text-neutral-500">
              FoodVoice · Prototipo con estado en memoria (Sumativa 2). Los datos
              se reinician al recargar.
            </p>
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
