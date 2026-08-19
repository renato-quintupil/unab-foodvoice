---

description: "Lista de tareas de implementación: E9 · Navegación y experiencia visual"
---

# Tareas: E9 · Navegación y experiencia visual

**Entrada**: documentos de diseño de `specs/004-navegacion-por-rol/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).

**Pruebas**: se incluyen. El Principio XI exige especificar antes de programar. Como E9 no toca
`services/api` (research.md, plan.md § Contexto Técnico), las pruebas nuevas son unitarias de
componente en `apps/web` con Vitest — no hay baterías de integración nuevas: el único
comportamiento con efecto en el servidor (`PUT /addresses/:id/default`) ya está cubierto por las
pruebas de integración de E2.

**Organización**: dos fases, en el orden de prioridad de la spec: **HU-15** (navegación, P1,
MVP) → **HU-16** (identidad visual, P2). HU-16 depende de archivos que crea HU-15 (les aplica la
paleta), no al revés — HU-15 es completamente funcional con la apariencia actual del producto.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: HU-15 · Navegación por rol (P1).
- **[US2]**: HU-16 · Identidad visual de la aplicación (P2).

## Convenciones de ruta

E9 es exclusivamente `apps/web/src/`. No se toca `services/api/` ni `packages/shared/`: ambos
quedan sin cambios respecto de E1/E3/E2. No se añade ninguna dependencia ni variable de entorno.

---

## Fase 1: Preparación

**Propósito**: crear el andamiaje de archivos vacíos para que ambas historias puedan empezar sin
pisarse, y confirmar una línea base verificable.

- [X] T001 [P] Crear `apps/web/src/app/cliente/layout.tsx` y `apps/web/src/app/cliente/_components/` (carpeta vacía) como andamiaje
- [X] T002 [P] Crear `apps/web/src/app/negocio/layout.tsx` y `apps/web/src/app/negocio/_components/` (carpeta vacía) como andamiaje
- [X] T003 [P] Crear `apps/web/src/components/selector-direccion.tsx` como andamiaje vacío
- [X] T004 Ejecutar la línea base de `specs/004-navegacion-por-rol/quickstart.md` —`pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el resultado y detener la implementación si existe un fallo preexistente

---

## Fase 2: Cimientos bloqueantes

**Propósito**: identificar qué es realmente compartido entre las dos historias antes de
empezarlas.

**Sin tareas.** HU-15 no depende de ningún cimiento compartido más allá del andamiaje de la Fase
1: usa los componentes UI (`Button`, `Input`), el cliente HTTP (`@/lib/api-client`) y el patrón
`exigirSesion` que E1 ya construyó, sin modificarlos. La única dependencia entre historias es la
inversa —HU-16 aplica su paleta a archivos que HU-15 crea— y se resuelve dentro de la Fase 4
como tarea de integración, siguiendo el mismo patrón que ya usó E2 entre sus historias.

**Punto de control**: HU-15 puede empezar inmediatamente después de la Fase 1.

---

## Fase 3: Historia de Usuario 1 — Navegación por rol (HU-15, P1) 🎯 MVP

**Objetivo**: cliente y negocio se mueven entre todas las pantallas de su rol desde un
encabezado persistente, sin escribir ninguna URL; el cliente además ve y cambia su dirección de
entrega predeterminada desde ahí.

**Prueba independiente**: con un cliente (con ≥2 direcciones activas) y un negocio, se completan
V-01 a V-15 de `quickstart.md` usando solo el encabezado — entrega valor por sí sola, con la
apariencia visual actual del producto (HU-16 la actualiza después, sin que HU-15 dependa de eso).

### Pruebas para US1 (escriben primero, deben fallar antes de implementar)

- [X] T005 [P] [US1] Prueba fallida: `NavegacionCliente` renderiza Menú/Carrito/Mis pedidos y marca como activo el que coincide con la ruta actual, en `apps/web/src/app/cliente/_components/navegacion.test.tsx`
- [X] T006 [P] [US1] Prueba fallida: `NavegacionCliente` muestra la etiqueta+texto de la dirección predeterminada cuando hay direcciones, y un acceso "Registrar dirección" cuando la lista está vacía, en el mismo archivo que T005
- [X] T007 [P] [US1] Prueba fallida: `SelectorDireccion` lista las direcciones activas recibidas por props, y al elegir una llama `PUT /addresses/:id/default` y refresca, en `apps/web/src/components/selector-direccion.test.tsx`
- [X] T008 [P] [US1] Prueba fallida: `NavegacionNegocio` renderiza Pedidos/Productos/Categorías y marca como activo el que coincide con la ruta actual, en `apps/web/src/app/negocio/_components/navegacion.test.tsx`
- [X] T009 [P] [US1] Prueba fallida: `FiltrosMenu` sincroniza la fila de íconos de categoría con el combobox "Tipo de comida" —elegir uno actualiza el otro— en `apps/web/src/app/menu/_components/filtros-menu.test.tsx`

### Implementación de US1

- [X] T010 [P] [US1] Implementar `SelectorDireccion` (Client Component: lista de direcciones activas por props, marca la predeterminada, botón por dirección que llama `PUT /addresses/:id/default` vía `@/lib/api-client` y `router.refresh()`, acceso a "Gestionar direcciones" hacia `/cliente/direcciones`, aviso de error en español si el `PUT` falla sin alterar la dirección mostrada) en `apps/web/src/components/selector-direccion.tsx` (depende de T007)
- [X] T011 [US1] Implementar `NavegacionCliente` (Client Component: `usePathname()` para el estado activo, header superior con Menú/Carrito/Mis pedidos + `SelectorDireccion`, barra inferior mobile con los mismos destinos vía clases responsive de Tailwind, botón "Cerrar sesión" reusando `CerrarSesion`) en `apps/web/src/app/cliente/_components/navegacion.tsx` (depende de T005, T006, T010)
- [X] T012 [US1] Implementar `cliente/layout.tsx`: `exigirSesion([Role.CLIENTE])`, `GET /addresses` server-side filtrado a `active === true`, envuelve `children` con `NavegacionCliente` en `apps/web/src/app/cliente/layout.tsx` (depende de T011)
- [X] T013 [US1] Implementar `NavegacionNegocio` (Client Component: `usePathname()`, header superior con Pedidos/Productos/Categorías, barra inferior mobile, botón "Cerrar sesión") en `apps/web/src/app/negocio/_components/navegacion.tsx` (depende de T008)
- [X] T014 [US1] Implementar `negocio/layout.tsx`: `exigirSesion([Role.NEGOCIO])`, envuelve `children` con `NavegacionNegocio` en `apps/web/src/app/negocio/layout.tsx` (depende de T013)
- [X] T015 [US1] Extender `FiltrosMenu` con la fila de íconos de categoría (Todas/Pizzas/Sándwiches/Ensaladas, mismos íconos SVG en línea que `specs/004-navegacion-por-rol/design/`), invocando la misma función `aplicar('foodTypeCategoryId', …)` que ya usa el combobox — sin estado nuevo, en `apps/web/src/app/menu/_components/filtros-menu.tsx` (depende de T009)
- [X] T016 [US1] Modificar `menu/page.tsx` para montar `NavegacionCliente` cuando `sesion.role === Role.CLIENTE` y `NavegacionNegocio` cuando `sesion.role === Role.NEGOCIO` (sin encabezado nuevo para `ADMINISTRADOR`/`REPARTIDOR`, igual que hoy) en `apps/web/src/app/menu/page.tsx` (depende de T011, T013)

**Punto de control**: HU-15 es completamente funcional y probable de forma independiente — V-01 a
V-15 de `quickstart.md` pasan con la apariencia visual actual del producto.

---

## Fase 4: Historia de Usuario 2 — Identidad visual de la aplicación (HU-16, P2)

**Objetivo**: el login y los encabezados de HU-15 comparten una misma identidad visual (marca,
paleta cálida, tipografía) que expresa que la búsqueda/pedido por voz es el diferenciador del
producto, sin alterar el comportamiento de ningún formulario ni control existente.

**Prueba independiente**: V-16 y V-17 de `quickstart.md` — comparar el login recién rediseñado
con cualquier encabezado de HU-15 y confirmar que comparten paleta, tipografía y marca — entrega
valor por sí sola incluso si se mirara antes de que HU-15 esté terminada (aunque en la práctica
va después, porque aplica su paleta a los archivos que HU-15 crea).

### Pruebas para US2 (escriben primero, deben fallar antes de implementar)

- [X] T017 [P] [US2] Prueba fallida: `login/page.tsx` sigue renderizando los mismos campos (correo, contraseña) y el mismo `FormularioLogin` sin cambios de comportamiento, en `apps/web/src/app/login/page.test.tsx`

### Implementación de US2

- [X] T018 [P] [US2] Declarar la fuente Bricolage Grotesque con `next/font/google` y exportar su `className` en `apps/web/src/lib/fuentes.ts`
- [X] T019 [US2] Agregar el bloque `.tema-voz { --color-fondo; --color-texto; --color-tenue; --color-borde; --color-primario; --color-coral; }` en `apps/web/src/app/globals.css`, sin tocar los valores de `:root` (depende de T018 solo para coordinar nombres de tokens, no de código)
- [X] T020 [US2] Crear el panel de marca (motivo de onda de voz, paleta cálida) como componente de `login/page.tsx`, aplicando `.tema-voz` y la clase de T018 al contenedor, sin modificar `formulario-login.tsx` en `apps/web/src/app/login/page.tsx` (depende de T017, T019)
- [X] T021 [US2] Aplicar `.tema-voz` y la clase de T018 al contenedor raíz de `apps/web/src/app/cliente/layout.tsx` (integra con US1; depende de T012, T019)
- [X] T022 [US2] Aplicar `.tema-voz` y la clase de T018 al contenedor raíz de `apps/web/src/app/negocio/layout.tsx` (integra con US1; depende de T014, T019)
- [X] T023 [US2] Aplicar `.tema-voz` y la clase de T018 al contenedor que `menu/page.tsx` monta cuando `sesion.role` es `CLIENTE` o `NEGOCIO` únicamente —nunca para `ADMINISTRADOR`/`REPARTIDOR` (integra con US1; depende de T016, T019)

**Punto de control**: HU-15 y HU-16 funcionan juntas — V-16, V-17 pasan, y `admin` (fuera de
`.tema-voz`) se ve exactamente igual que antes de esta épica.

---

## Fase 5: Pulido y validación final

**Propósito**: cerrar la trazabilidad completa de `spec.md` y confirmar que no se coló alcance
no pedido.

- [X] T024 Ejecutar `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` con todo lo anterior implementado
- [X] T025 Recorrer `specs/004-navegacion-por-rol/quickstart.md` completo (V-01 a V-20) con un cliente, un negocio y un administrador, incluida la sección G (alcance excluido) — ver `verificacion.md`
- [X] T026 Confirmar explícitamente que ningún badge de conteo (carrito, pedidos pendientes) quedó implementado — research.md § "Decisión explícitamente descartada" — y eliminarlo si algún paso anterior lo introdujo por arrastre del mockup
- [X] T027 Confirmar que `services/api/` y `packages/shared/` no tienen diffs respecto del estado previo a esta épica (FR-014, FR-015)

---

## Fase 6: Landing redundante (enmienda FR-016, tras verificación funcional)

**Propósito**: con el encabezado de HU-15 ya construido y verificado, `/cliente` y `/negocio`
quedaron mostrando una pantalla de botones que duplica lo que el encabezado ya ofrece —
detectado al usar la aplicación real, no en el diseño. Cubre FR-016 y los escenarios 12–14 de
HU-15.

- [X] T028 [P] Cambiar `apps/web/src/app/cliente/page.tsx` para redirigir a `/menu` con `redirect()` de `next/navigation`, en vez de renderizar `InicioDeRol`
- [X] T029 [P] Cambiar `apps/web/src/app/negocio/page.tsx` para redirigir a `/negocio/pedidos` con `redirect()`, en vez de su lista de botones propia
- [X] T030 Confirmar que `apps/web/src/app/repartidor/page.tsx` sigue usando `InicioDeRol` sin cambios (FR-015) — no se toca `apps/web/src/components/inicio-de-rol.tsx`
- [X] T031 Ejecutar `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build`, y recorrer V-21 a V-23 (nuevos, en `quickstart.md`) más V-01/V-09 (siguen pasando con la redirección)

---

## Fase 7: Identidad visual del administrador (enmienda FR-017, tras usar la aplicación)

**Propósito**: `NavegacionAdmin` seguía con el estilo previo a HU-16 (texto subrayado plano, sin
marca, sin íconos, sin `.tema-voz`) mientras cliente y negocio ya tenían el rediseño completo.
Cubre FR-017, los escenarios 15–17 de HU-15, el escenario 4 de HU-16 y SC-010.

- [X] T032 [P] Prueba fallida: `NavegacionAdmin` renderiza Panel/Usuarios con marca e íconos, y marca como activo el que coincide con la ruta actual, en `apps/web/src/app/admin/_components/navegacion.test.tsx`
- [X] T033 Reescribir `NavegacionAdmin` (Client Component: mismo patrón que `NavegacionCliente`/`NavegacionNegocio` — `usePathname()`, marca "FV", íconos de Panel/Usuarios, header superior `hidden md:block`, barra inferior `md:hidden`, `CerrarSesion`) en `apps/web/src/app/admin/_components/navegacion.tsx` (depende de T032) — encontró y corrigió un bug propio en la prueba: `/admin` es prefijo de toda ruta administrativa, así que "Panel" necesita match exacto, no por prefijo
- [X] T034 Aplicar `.tema-voz` y la clase de `claseBricolage` (`apps/web/src/lib/fuentes.ts`, ya existente) al contenedor raíz de `apps/web/src/app/admin/layout.tsx`, mismo patrón `min-h-screen pb-20 md:pb-0` que `cliente/layout.tsx`/`negocio/layout.tsx` (depende de T033)
- [X] T035 Ejecutar `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build`, y recorrer V-24 a V-26 (nuevos, en `quickstart.md`) más V-18 actualizado (admin ya no se ve "viejo" a propósito — revisar su redacción)

---

## Dependencias y orden de ejecución

### Dependencias de fase

- **Preparación (Fase 1)**: sin dependencias — empieza de inmediato.
- **Cimientos (Fase 2)**: vacía — no bloquea nada más allá de la Fase 1.
- **HU-15 (Fase 3)**: depende de la Fase 1. Es el MVP; entrega valor completo por sí sola.
- **HU-16 (Fase 4)**: depende de la Fase 1 para T017–T020; depende de que existan
  `cliente/layout.tsx`, `negocio/layout.tsx` y el despacho en `menu/page.tsx` (Fase 3) para
  T021–T023, sus tareas de integración.
- **Pulido (Fase 5)**: depende de que ambas historias estén completas.

### Dentro de cada historia

- Pruebas antes que implementación (Principio XI).
- `SelectorDireccion` antes que `NavegacionCliente` (lo compone).
- Cada `layout.tsx` después de su componente de navegación.
- El despacho de `menu/page.tsx` después de que existan ambos componentes de navegación.

### Oportunidades de paralelismo

- T001–T003 (Fase 1) en paralelo.
- T005–T009 (pruebas de US1) en paralelo entre sí.
- T010, T013 (implementación de US1 que no depende una de la otra) en paralelo.
- T017–T018 (US2) en paralelo.
- T021, T022, T023 (integración de US2 sobre archivos distintos) en paralelo entre sí, una vez
  completa T019 y sus respectivas dependencias de US1.

---

## Ejemplo de paralelismo: Historia de Usuario 1

```bash
# Lanzar juntas las pruebas de US1:
Tarea: "Prueba fallida de NavegacionCliente en apps/web/src/app/cliente/_components/navegacion.test.tsx"
Tarea: "Prueba fallida de SelectorDireccion en apps/web/src/components/selector-direccion.test.tsx"
Tarea: "Prueba fallida de NavegacionNegocio en apps/web/src/app/negocio/_components/navegacion.test.tsx"
Tarea: "Prueba fallida de la fila de categorías en apps/web/src/app/menu/_components/filtros-menu.test.tsx"

# Lanzar juntas la implementación de piezas independientes:
Tarea: "Implementar SelectorDireccion en apps/web/src/components/selector-direccion.tsx"
Tarea: "Implementar NavegacionNegocio en apps/web/src/app/negocio/_components/navegacion.tsx"
```

---

## Estrategia de implementación

### MVP primero (solo HU-15)

1. Completar la Fase 1: Preparación.
2. Completar la Fase 3: HU-15 (la Fase 2 no tiene tareas).
3. **Detenerse y validar**: V-01 a V-15 de `quickstart.md` de forma independiente.
4. Es un incremento completo y demostrable, aunque visualmente sea el producto actual.

### Entrega incremental

1. Preparación → línea base lista.
2. HU-15 → validar de forma independiente → demostrable (MVP).
3. HU-16 → validar de forma independiente → demostrable (identidad visual completa).
4. Pulido → cierre y confirmación de que no se coló alcance no pedido.

---

## Trazabilidad requisito → tarea

| Requisitos / escenarios | Tareas |
|---|---|
| FR-001, FR-003 a FR-007, FR-010, FR-011; escenarios 1, 2, 4–7, 10, 11 de HU-15 | T005–T007, T010–T012 |
| FR-002, FR-003, FR-010, FR-011; escenarios 3, 10, 11 de HU-15 | T008, T013–T014 |
| FR-008, FR-009; escenarios 8, 9 de HU-15 | T009, T015–T016 |
| FR-012; escenarios 1–3 de HU-16 | T017, T020 |
| FR-013; escenarios 2–3 de HU-16 | T018, T019, T021–T023 |
| FR-014, FR-015; SC-001 a SC-008 | T024–T027 |
| FR-016; escenarios 12–14 de HU-15; SC-009 | T028–T031 |
| FR-017; escenarios 15–17 de HU-15; escenario 4 de HU-16; SC-010 | T032–T035 |

## Notas

- [P] = archivos distintos, sin dependencias entre sí.
- [US1]/[US2] trazan cada tarea a su historia en `spec.md`.
- Verificar que las pruebas fallan antes de implementar (Principio XI).
- Detenerse en cada punto de control para validar la historia de forma independiente.
- Evitar: reintroducir los badges de conteo del mockup, tocar `services/api`/`packages/shared`,
  o modificar `admin` — ninguno está pedido por `spec.md` (Principio III).
