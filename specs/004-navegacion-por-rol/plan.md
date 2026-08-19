# Plan de Implementación: E9 · Navegación y experiencia visual

**Rama**: `004-navegacion-por-rol` | **Fecha**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/004-navegacion-por-rol/spec.md`

## Resumen

E9 agrega el shell de navegación que cliente y negocio nunca tuvieron (HU-15) y una identidad
visual coherente heredada del login (HU-16), sobre pantallas que E1/E3/E2 ya construyeron y
verificaron. No crea entidades, no crea endpoints: la única acción con efecto real —elegir la
dirección predeterminada desde el encabezado— reutiliza `PUT /api/v1/addresses/:id/default`,
ya construido en E2.

Dos decisiones estructurales gobiernan el diseño:

1. **`/menu` es una pantalla compartida por los cuatro roles y no tiene layout de segmento
   propio** (vive en `app/menu/`, no en `app/cliente/menu/`). Un `layout.tsx` de Next.js solo
   envuelve su propio segmento y sus hijos, así que no puede envolver un hermano — el despacho
   de qué encabezado mostrar en `/menu` se hace dentro de `menu/page.tsx` según `sesion.role`,
   no mediante un layout anidado.
2. **La identidad visual de HU-16 se acota a un wrapper, no al `:root` global.** `Button` e
   `Input` ya leen `var(--color-primario)`, `var(--color-borde)`, etc. por nombre; redefinir
   esos mismos nombres dentro de una clase envolvente (`.tema-voz`) alcanza a cualquier
   componente compartido que la use, sin tocar su código, mientras que `admin` —fuera del
   wrapper— sigue viendo los valores de `:root` sin cambios. Así FR-015 se cumple sin bifurcar
   la librería de componentes ni duplicar `Button`/`Input`.

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios
respecto de E1/E3/E2.

**Dependencias principales**: las ya presentes en el monorepo — Next.js 15 (App Router,
`next/font/google`), React 19, TailwindCSS 4, shadcn/ui. **E9 no incorpora ninguna dependencia
nueva**: la tipografía Bricolage Grotesque se resuelve con `next/font/google`, ya parte de
Next.js, no con un `<link>` externo.

**Almacenamiento**: PostgreSQL 16, sin cambios. E9 no crea tablas ni columnas; lee `Address` vía
`GET /addresses` (E2) y escribe únicamente a través de `PUT /addresses/:id/default` (E2).

**Pruebas**: se hereda la disposición de E1/E3/E2 — Vitest en `apps/web`, Jest en
`services/api`. E9 no toca `services/api`, así que no agrega baterías de integración nuevas: el
único comportamiento con efecto en el servidor (marcar predeterminada) ya está cubierto por las
pruebas de integración de E2. Las pruebas nuevas de E9 son unitarias de componente en
`apps/web` (qué se renderiza, qué queda marcado como activo, qué se dispara al elegir una
dirección).

**Plataforma objetivo**: navegador desde 360 px de ancho, igual que E1/E3/E2 — condición
directa de FR-010 (patrón mobile) y SC-006.

**Tipo de proyecto**: aplicación web en el mismo monorepo pnpm + Turborepo. E9 es
exclusivamente frontend (`apps/web`); no toca `services/api` ni `packages/shared`.

**Objetivos de rendimiento**: ninguno nuevo. Los encabezados son estáticos salvo el selector de
dirección (una llamada `PUT` puntual); no hay presupuesto de latencia declarado en la spec más
allá de la experiencia ya esperada del resto del producto.

**Restricciones**: nada de funcionalidad nueva más allá de navegar y elegir la dirección
predeterminada (FR-014); el rol administrador y las pantallas del rol repartidor no se tocan
(FR-015); sin auditoría formal de accesibilidad (heredado de E1); todo texto visible en español
(Principio II).

**Escala/Alcance**: dos `layout.tsx` nuevos (`cliente`, `negocio`), dos componentes de
navegación nuevos, un componente de selector de dirección nuevo, una modificación a
`menu/page.tsx` y a `FiltrosMenu`, una modificación a `login/page.tsx` y a `globals.css`. Cero
endpoints nuevos, cero migraciones.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Cero dependencias nuevas. Reutiliza el patrón de `layout.tsx` + `exigirSesion` ya probado en `admin`, y el endpoint de dirección predeterminada ya construido en E2. La identidad visual se acota redefiniendo variables CSS existentes en un wrapper, no bifurcando `Button`/`Input`. |
| **II · Idioma: todo en español** | Ningún texto nuevo se escribe suelto: las etiquetas de nav (Menú, Carrito, Mis pedidos, Pedidos, Productos, Categorías) y los textos del selector de dirección usan los mismos términos ya presentes en `packages/shared`/las pantallas existentes. |
| **III · Cero alcance fantasma** | Los badges de conteo (carrito, pedidos pendientes) que aparecían en el mockup **no se construyen**: ninguna FR de `spec.md` los pide, así que quedan fuera — es exactamente el tipo de deriva que este principio prohíbe. Se documenta explícitamente en Riesgos. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre los 8 criterios de éxito desde la UI, con dos roles y dos anchos de pantalla. Ninguno requiere leer código ni logs. |
| **V · Datos del usuario con respeto** | E9 no pide ni almacena ningún dato nuevo; solo lee y reordena direcciones que el cliente ya registró en E2. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | No aplica directamente: E9 no interpreta lenguaje natural. La navegación construida aquí es la misma para el flujo manual y para lo que E6 necesitará envolver más adelante — no le agrega una dependencia de voz a nada. |
| **VII · Entender la intención** | No aplica: E9 no interpreta lenguaje natural. |
| **VIII · El catálogo es la única verdad** | No aplica directamente: E9 no toca la consulta del catálogo, solo agrega una fila de acceso a categorías que ya existen (E3) sobre la misma consulta filtrada de siempre. |
| **IX · Confirmar antes de actuar y poder deshacer** | Elegir una dirección desde el encabezado es una acción reversible de un clic (se puede volver a cambiar en cualquier momento); no agrega ningún flujo irreversible. No aplica la exigencia de confirmación previa de agregar al carrito, que E9 no toca. |
| **X · Privacidad y datos mínimos** | Sin cambios: las direcciones siguen siendo texto libre: E9 no agrega mapas, pines ni geolocalización. |
| **XI · Calidad guiada por especificación (test-first)** | Los 14 escenarios Gherkin de `spec.md` (11 de HU-15, 3 de HU-16) preceden a este plan y se trazan a pruebas o validaciones concretas más abajo. |
| **XII · Trazabilidad del pedido de punta a punta** | No aplica: E9 no crea, transiciona ni consulta pedidos. |

### Estado de la enmienda constitucional

No se requiere ninguna enmienda: E9 no toca la máquina de estados del pedido ni ningún otro
principio versionado. La constitución vigente (2.0.0) no necesita cambios para este plan.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, `contracts/` y `quickstart.md`.
**PASS: sin violaciones constitucionales.** Se comprobó expresamente que ningún artefacto de la
Fase 1 introduce un endpoint, entidad o dependencia nueva, y que la exclusión de los badges de
conteo (Principio III) quedó documentada y no se coló de vuelta al diseño.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/004-navegacion-por-rol/
├── plan.md              # Este archivo
├── research.md          # Fase 0: cinco decisiones estructurales
├── data-model.md        # Fase 1: sin entidades nuevas; documenta el AddressDto reutilizado
├── quickstart.md        # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   └── README.md        # Fase 1: no hay contratos nuevos; referencia al endpoint reutilizado
├── design/               # Ya existente: capturas del mockup decidido
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos que E9 crea o modifica. Todo dentro de `apps/web`.

```text
apps/web/src/app/
├── globals.css                              # MODIFICADO · variables --color-* nuevas dentro de .tema-voz
├── login/
│   └── page.tsx                             # MODIFICADO · aplica .tema-voz y el panel de marca (HU-16)
├── cliente/
│   ├── layout.tsx                           # NUEVO · exigirSesion([CLIENTE]), fetch /addresses, aplica .tema-voz
│   └── _components/
│       └── navegacion.tsx                   # NUEVO · header desktop + tab bar mobile + selector de dirección
├── negocio/
│   ├── layout.tsx                           # NUEVO · exigirSesion([NEGOCIO]), aplica .tema-voz
│   └── _components/
│       └── navegacion.tsx                   # NUEVO · header desktop + tab bar mobile
└── menu/
    ├── page.tsx                             # MODIFICADO · despacha NavegacionCliente/NavegacionNegocio según sesion.role; aplica .tema-voz solo para esos roles
    └── _components/
        └── filtros-menu.tsx                 # MODIFICADO · agrega la fila de íconos de categoría sobre el mismo estado de FiltrosMenu

apps/web/src/components/
└── selector-direccion.tsx                   # NUEVO · dropdown reutilizable; PUT /addresses/:id/default + router.refresh()

apps/web/src/app/cliente/direcciones/
└── page.tsx                                 # sin cambios funcionales — sigue siendo el único lugar para crear/editar/desactivar
```

**Decisión de estructura**: se sigue el mismo patrón que `admin/layout.tsx` +
`admin/_components/navegacion.tsx` ya construido en E1, extendido a `cliente` y `negocio`. Un
solo componente de navegación por rol resuelve tanto el header de escritorio como la barra
inferior mobile mediante clases responsive de Tailwind (`hidden md:flex` / `flex md:hidden`),
en vez de dos componentes separados — más simple (Principio I) y evita que ambos se
desincronicen. El selector de dirección es un componente aparte porque lo usa solo
`cliente/_components/navegacion.tsx`, pero vive en `components/` por si una pantalla futura
(fuera de esta épica) necesita el mismo patrón.

## Fases de entrega

### Fase A · Identidad visual (HU-16, P2 en la spec pero base técnica de HU-15)

Variables `--color-*` nuevas dentro de `.tema-voz` en `globals.css`, tipografía Bricolage
Grotesque vía `next/font/google`, y el rediseño de `login/page.tsx`. Se implementa primero
porque HU-15 la consume (FR-013): construir el header antes que la identidad obligaría a
rehacer sus estilos.

### Fase B · Navegación de cliente (HU-15, P1)

`cliente/layout.tsx` + `cliente/_components/navegacion.tsx` + `selector-direccion.tsx`. Cubre
FR-001, FR-003 a FR-007, FR-010, FR-011 y los escenarios 1, 2, 4–7, 9, 10 de HU-15.

### Fase C · Navegación de negocio (HU-15, P1)

`negocio/layout.tsx` + `negocio/_components/navegacion.tsx`. Cubre FR-002, FR-003, FR-010,
FR-011 y los escenarios 3, 9, 10 de HU-15.

### Fase D · Categorías del menú y despacho en `/menu` (HU-15, P1)

Modificar `menu/page.tsx` para despachar el header correcto según `sesion.role` y aplicar
`.tema-voz` solo a cliente/negocio; extender `FiltrosMenu` con la fila de íconos. Cubre FR-008,
FR-009 y los escenarios 8, 9 de HU-15. Va después de B y C porque el despacho necesita que
ambos componentes de navegación ya existan.

### Fase E · Validación funcional

Recorrer los 8 criterios de éxito desde la aplicación con ambos roles y dos anchos de pantalla
(`quickstart.md`), confirmando además que `admin` no cambió (FR-015) y que ningún badge de
conteo se coló al build (Principio III).

## Complexity Tracking

La puerta constitucional pasa sin violaciones que justificar. No aplica esta sección.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Reintroducir los badges de conteo del mockup (carrito, pedidos pendientes) porque "ya estaban dibujados" | Medio: alcance no pedido por ninguna FR (Principio III) | Excluidos explícitamente en este plan; `tasks.md` no debe generar una tarea para ellos, y la revisión de Fase E los busca activamente para confirmarlo |
| Redefinir `--color-primario` etc. en `:root` en vez de en `.tema-voz`, afectando a `admin` sin querer | Alto: viola FR-015 | Las variables nuevas se declaran únicamente dentro de `.tema-voz`; la validación de Fase E incluye mirar `admin` explícitamente y confirmar que no cambió |
| Duplicar el estado de filtro entre la fila de íconos y el combobox "Tipo de comida" (dos fuentes de verdad) | Alto: rompe FR-009 | La fila de íconos se implementa dentro de `FiltrosMenu`, llamando la misma función `aplicar('foodTypeCategoryId', …)` que ya usa el combobox — no hay un segundo estado que sincronizar |
| Que `/menu` muestre el header de cliente/negocio también a admin o repartidor | Medio: viola FR-015 | El despacho en `menu/page.tsx` es explícito por `sesion.role`; sin rama para `ADMINISTRADOR`/`REPARTIDOR`, esos roles ven `/menu` sin encabezado nuevo, igual que hoy |
| Que el selector de dirección deje el encabezado en un estado inconsistente si el `PUT` falla | Medio: contradice el edge case de `spec.md` | El componente no actualiza el estado local hasta recibir `200`; ante error, muestra el aviso ya usado en `/cliente/direcciones` y conserva la dirección predeterminada anterior visible |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Identidad visual: FR-012, FR-013; HU-16 escenarios 1–3 | A |
| FR-001, FR-003 a FR-007, FR-010, FR-011; HU-15 escenarios 1, 2, 4–7, 9, 10 | B |
| FR-002, FR-003, FR-010, FR-011; HU-15 escenario 3 | C |
| FR-008, FR-009; HU-15 escenario 8 | D |
| FR-014, FR-015; SC-001 a SC-008 | E |
