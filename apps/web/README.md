# apps/web

Aplicación **web** de FoodVoice para cliente, local comercial y administrador.

- **Stack:** Next.js (App Router) + React + TypeScript + TailwindCSS
- **Historias:** HU-01 pedidos, HU-02 menú, HU-03 trazabilidad, HU-06 búsqueda por voz (Web Speech API), HU-11 dirección del cliente
- **Etapa actual:** prototipo con estado en memoria (sin backend); la persistencia con API REST llega en Sprints posteriores
- **Agente responsable:** `web-frontend`

## Ejecutar

Desde la raíz del monorepo:

```bash
pnpm install
pnpm dev:web
```

La app queda en `http://localhost:3000`.

## Rutas

- `/` — inicio con acceso a los tres flujos
- `/local/menu` — administración de menú (HU-02)
- `/cliente` — catálogo, búsqueda por voz, dirección y creación de pedido (HU-01, HU-06, HU-11)
- `/pedidos` — gestión de estados y trazabilidad (HU-01, HU-03)

Los datos viven en memoria (`lib/store.tsx`) sobre los contratos de `@foodvoice/shared` y se reinician al recargar.
