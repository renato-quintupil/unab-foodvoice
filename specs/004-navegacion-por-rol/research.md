# Investigación · E9 Navegación y experiencia visual

`spec.md` no dejó ningún `[NEEDS CLARIFICATION]` sin resolver — la única ambigüedad real se
cerró en `/speckit-clarify` (selector de dirección con efecto real, reutilizando
`PUT /addresses/:id/default`). Lo que sigue son las decisiones **técnicas** que el plan
necesitaba antes de poder describir estructura de código, y que no estaban en la spec porque
son de implementación, no de comportamiento observable.

## D-001 · Patrón de layout por rol

**Decisión**: `cliente/layout.tsx` y `negocio/layout.tsx`, cada uno un Server Component que
llama `exigirSesion([Role.X])` y envuelve `children` con el componente de navegación
correspondiente — exactamente el patrón que `admin/layout.tsx` ya usa desde E1.

**Rationale**: es el único patrón de autorización-más-navegación que el proyecto ya construyó y
verificó. Centralizar `exigirSesion` en el layout (en vez de repetirlo por página) es lo que
impide que una pantalla nueva se olvide de exigir el rol correcto — el mismo razonamiento que
ya está escrito como comentario en `admin/layout.tsx`.

**Alternativas consideradas**: exigir el rol en cada `page.tsx` individualmente — descartado
porque ya causó (y el comentario de `admin/layout.tsx` lo dice explícitamente) el riesgo de que
una pantalla nueva lo olvide.

## D-002 · `/menu` no tiene layout de segmento propio

**Decisión**: el despacho de qué encabezado mostrar en `/menu` (cliente, negocio, o ninguno
para admin/repartidor) se resuelve dentro de `menu/page.tsx`, leyendo `sesion.role`, no
mediante un layout anidado.

**Rationale**: en Next.js App Router, `app/menu/` y `app/cliente/` son segmentos **hermanos**,
no anidados — un `layout.tsx` en `app/cliente/` nunca envuelve `app/menu/`. Como `/menu` es
deliberadamente compartida por los cuatro roles desde E3 (su ausencia de `@Roles` es
intencional), no puede moverse bajo `app/cliente/menu/` sin romper el acceso de negocio, admin
y repartidor ya construido y verificado.

**Alternativas consideradas**:
- Mover `/menu` a `/cliente/menu` — descartado: rompe el acceso de los otros tres roles y las
  rutas ya enlazadas desde E3/E2 (`Ver el menú como lo ve el cliente` en la landing de negocio).
- Un layout raíz único que decida el header para toda la app — descartado: mezclaría la lógica
  de cuatro roles distintos en un solo archivo, contra Principio I (simplicidad) y contra el
  patrón ya establecido de un layout por rol.

## D-003 · Selector de dirección: componente y transporte

**Decisión**: `SelectorDireccion` es un Client Component que recibe la lista de direcciones
activas por props (obtenida server-side en `cliente/layout.tsx` vía `GET /addresses`, ya
construido en E2), y al elegir una hace `PUT /addresses/:id/default` con el cliente HTTP ya
existente (`@/lib/api-client`) seguido de `router.refresh()` — el mismo patrón que
`CerrarSesion` ya usa para reflejar cambios de sesión sin recargar toda la página a mano.

**Rationale**: reutiliza tanto el endpoint (E2) como el patrón de mutación-desde-cliente
(`CerrarSesion`) ya presentes en el código; no introduce un mecanismo de estado nuevo (sin
Context, sin librería de estado global) para un dato que ya vive en el servidor.

**Alternativas consideradas**: mantener el estado de la dirección elegida en el cliente
(`useState`) sin refetch — descartado porque dejaría al encabezado desincronizado de
`/cliente/direcciones` si la persona edita direcciones en otra pestaña o vuelve atrás.

## D-004 · Fila de categorías: mismo estado que el filtro existente

**Decisión**: la fila de íconos de categoría se implementa **dentro de** `FiltrosMenu`
(`menu/_components/filtros-menu.tsx`), invocando la misma función `aplicar('foodTypeCategoryId',
valor)` que ya usa el combobox "Tipo de comida", en vez de un componente independiente con su
propio estado.

**Rationale**: FR-009 exige que ambos controles reflejen y controlen el mismo criterio. La
forma de garantizar eso **por construcción**, no por sincronización manual entre dos estados,
es que sea literalmente el mismo estado (el query param `foodTypeCategoryId` en la URL) leído y
escrito por el mismo código.

**Alternativas consideradas**: un componente `FilaCategorias` separado que reciba y emita el
valor seleccionado vía props desde `menu/page.tsx` — descartado: agrega una capa de
sincronización (levantar el estado, pasarlo para abajo y para arriba) que no aporta nada sobre
llamar la misma función directamente.

## D-005 · Identidad visual acotada por wrapper, no por `:root`

**Decisión**: las variables `--color-fondo`, `--color-texto`, `--color-tenue`, `--color-borde`,
`--color-primario` se **redefinen con los mismos nombres** dentro de una clase `.tema-voz`
(más `--color-coral`, nueva, exclusiva del tema), aplicada al elemento raíz de `login/page.tsx`,
`cliente/layout.tsx` y `negocio/layout.tsx`. El `:root` global no se toca.

**Rationale**: `Button` e `Input` (`components/ui/`) ya leen esas variables por nombre
(`var(--color-primario)`, etc.), así que cualquier descendiente de `.tema-voz` hereda los
valores nuevos sin que su código cambie una sola línea — las propiedades CSS personalizadas se
resuelven por el árbol del DOM, no por dónde se definió el componente. `admin`, que queda fuera
del wrapper, sigue viendo los valores originales de `:root` sin ningún cambio, cumpliendo FR-015
sin bifurcar la librería de componentes compartida.

**Alternativas consideradas**:
- Cambiar `:root` directamente — descartado: cambiaría también `admin`, violando FR-015
  explícitamente.
- Duplicar `Button`/`Input` en versiones "con tema" — descartado: exactamente la complejidad
  innecesaria que el Principio I prohíbe cuando existe una alternativa más simple (redefinir
  las mismas variables en un wrapper).

**Tipografía**: Bricolage Grotesque se carga con `next/font/google` (nativo de Next.js 15, sin
`<link>` externo ni layout shift por fuente no precargada) y su clase se aplica en el mismo
wrapper `.tema-voz`, con el mismo razonamiento de alcance que D-005.

## Decisión explícitamente descartada: badges de conteo

El mockup usado para decidir visualmente esta spec incluía badges numéricos (ítems en el
carrito, pedidos pendientes del negocio) sobre los íconos de navegación. **Ninguna FR de
`spec.md` los pide** — fueron un elemento del ejercicio de diseño, no un requisito acordado. Se
documenta aquí en vez de en el código para que quede explícito que la ausencia es deliberada
(Principio III), no un olvido a corregir en una tarea futura.
