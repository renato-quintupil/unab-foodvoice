# Plan de Implementación: E2 · Gestión de pedidos

**Rama**: `003-gestion-pedidos` | **Fecha**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/003-gestion-pedidos/spec.md`

## Resumen

E2 crea la primera entidad transaccional del producto: el `Pedido`. Tres historias, en el orden
en que el cliente las recorre — **carrito** (HU-12) → **direcciones** (HU-11) → **confirmar y
ver el estado** (HU-01) — y cinco tablas nuevas (`Cart`, `CartLine`, `Address`, `Order`,
`OrderLine`) sobre el mismo stack que E1 y E3 dejaron construido y verificado. No hay tecnología
nueva.

Las cuatro decisiones que gobiernan todo lo demás:

1. **El contrato de estados ya se amplió antes de este plan.** La constitución se enmendó a
   2.0.0 (Principio XII) el 2026-08-17, agregando `rechazado` como sexto estado, terminal,
   alcanzable únicamente desde `creado`. Este plan solo lo traduce a código (D-035).
2. **La revalidación de precio compara contra lo último que el cliente vio, no contra un reloj**
   (D-036): `POST /orders` recibe los precios que el carrito mostró en su última carga y los
   compara con los vigentes dentro de la misma transacción que crea el pedido. Si no coinciden,
   no se crea nada.
3. **La concurrencia se resuelve con dos mecanismos distintos, cada uno el más simple para su
   problema**: un bloqueo de fila (`SELECT … FOR UPDATE`) sobre el carrito para la doble
   confirmación (D-037), y una escritura condicionada (`UPDATE … WHERE status = 'creado'`) para
   aceptar/rechazar (D-038). Ninguno de los dos necesita reintentos ni un código de error nuevo
   para el caso de carrera: el perdedor recibe el mismo error que ya existía para "el estado no
   es el que esperabas".
4. **El pedido guarda un snapshot de texto de la dirección, nunca una referencia** (RN-006), lo
   que deja al sistema sin forma de saber si una dirección "se usó alguna vez" mirando solo
   `Order` — por eso `Address` necesita su propia bandera, `usedInOrder` (D-039), para decidir
   entre eliminarla sin dejar rastro y solo poder desactivarla (FR-018, FR-019).

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios
respecto de E1/E3.

**Dependencias principales**: las ya presentes en el monorepo — Next.js 15 (App Router), React
19, TailwindCSS 4, shadcn/ui, react-hook-form con resolver de Zod, NestJS 11, Prisma 6, Zod.
**E2 no incorpora ninguna dependencia nueva.**

**Almacenamiento**: PostgreSQL 16, con `prisma migrate`. Cinco tablas nuevas (`cart`,
`cart_line`, `address`, `order`, `order_line`) y una ampliación del enum `OrderStatus` con
`RECHAZADO`. Ninguna tabla existente de E1 o E3 cambia de forma; `product` gana relaciones
entrantes desde `cart_line` y `order_line`.

**Pruebas**: se hereda íntegra la disposición de E1/E3. Unitarios con **Vitest** en
`packages/shared` y `apps/web`, y con **Jest** en `services/api`. Integración con **Jest** en
`services/api/test/`, archivos `<dominio>-<aspecto>.integration-spec.ts`, contra PostgreSQL
efímera en Docker — el `testRegex` de `jest.integration.config.js` no cambia.

La atomicidad de la confirmación (D-036, D-037, D-045), la carrera de aceptar/rechazar (D-038) y
la unicidad normalizada de la etiqueta de dirección (D-040) **no se cubren con unitarios**: son
de integración por definición, mismo criterio que E1 aplicó a su contador de intentos y E3 a la
unicidad de nombre.

**Plataforma objetivo**: navegador (desde 360 px de ancho) y contenedores Linux, igual que E1/E3.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` actuando de
BFF frente a `services/api`.

**Objetivos de rendimiento**: confirmar un pedido en menos de 2 segundos con un carrito de hasta
10 líneas (extrapolado de SC-001, sin instrumentación de carga — mismo criterio de medición a
ojo/cronómetro que E1 y E3 usaron para sus propios objetivos de tiempo).

**Restricciones**: mono-local; sin pago ni pasarela de cobro; sin voz; texto visible en español;
sin geolocalización en el registro de direcciones (Principio X, FR-021); ningún borrado físico
de pedidos, líneas de pedido ni direcciones usadas.

**Escala/Alcance**: **cuatro pantallas nuevas** —carrito, direcciones, confirmar pedido y "mis
pedidos" del cliente, más la bandeja del negocio— y **dieciocho endpoints nuevos** —cinco de
carrito, seis de direcciones y siete de pedidos—, detallados en § Estructura del Proyecto y en
`contracts/api.md`.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Cero dependencias nuevas. La concurrencia se resuelve con los dos mecanismos más simples posibles para cada problema (D-037, D-038), no con un framework de bloqueo optimista general. `Cart` se crea perezosamente (D-046); no hay endpoint de detalle de pedido separado del listado (D-044). |
| **II · Idioma: todo en español** | Los mensajes fijos nuevos se añaden a `packages/shared/src/messages/es.ts`; ninguna pantalla escribe texto suelto. `ETIQUETA_ESTADO_PEDIDO` se corrige para que "Pendiente" sea la única fuente de esa palabra (D-041). |
| **III · Cero alcance fantasma** | Cada endpoint, pantalla y regla de este plan se remite a un requisito de `spec.md` en § Trazabilidad. No hay voz, no hay pago, no hay cancelación por el cliente, no hay notificaciones — los cinco están declarados Fuera de Alcance en la spec y este plan no los construye. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre los 12 criterios de éxito con clics y pantallas, sobre dos sesiones simultáneas. Cuatro criterios de tiempo/clics (SC-001, SC-005, SC-009, SC-011) se declaran de cobertura manual, mismo criterio que E1/E3. |
| **V · Datos del usuario con respeto** | E2 no pide ningún dato nuevo fuera de lo que las tres historias necesitan explícitamente (dirección de texto libre, motivo de rechazo). Sin variables de entorno nuevas. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E2 **es** la mitad manual que E6/HU-13 usará: FR-002 exige que agregar al carrito sea "una operación server-side clara", y el propio contexto de la spec declara que la API de mutación se construye "sin rediseñarla" para la voz futura. SC-009 comprueba el flujo completo sin voz. |
| **VII · Entender la intención** | No aplica: E2 no interpreta lenguaje natural. Construye la API que E6 usará después de interpretar. |
| **VIII · El catálogo es la única verdad** | RN-002, FR-002, FR-007 y D-045 aplican la comprobación de `active && available` en dos instantes —al agregar y al confirmar—, ambos en la consulta/transacción, nunca solo en la pantalla. |
| **IX · Confirmar antes de actuar y poder deshacer** | El clic en «Agregar» sobre un producto visible **es** la confirmación exigida (FR-002, Clarification 2026-08-17); no hay una interpretación de voz que confirmar en E2. El carrito es editable en todo momento antes de confirmar (FR-005). Una vez confirmado, el pedido **no** se deshace por el cliente — es una decisión de alcance declarada (Fuera de Alcance § Cancelación), no un incumplimiento del principio: el "deshacer" de un pedido ya confirmado es rechazarlo, y esa acción es del negocio, con motivo. |
| **X · Privacidad y datos mínimos** | Las direcciones son solo texto libre, sin mapa, pin ni coordenadas (FR-021, escenario HU11-E15). Sin micrófono, sin audio. |
| **XI · Calidad guiada por especificación (test-first)** | Los 32 escenarios Gherkin de `spec.md` están escritos y trazados a requisito antes de este plan. Cada batería de integración se nombra por el escenario que ejerce. |
| **XII · Trazabilidad del pedido de punta a punta** | E2 construye exactamente las dos transiciones que le corresponden desde `creado` (FR-030, FR-031) y ninguna otra. El **historial** de transiciones que el principio exige ("cada cambio de estado DEBE registrarse...") es HU-03/E4, declarado como dependencia hacia adelante — E2 solo construye el `Pedido` y sus dos transiciones; grabar cada cambio en una tabla de historial de solo-agregar es responsabilidad de E4 y no se construye aquí. |

### La enmienda del Principio XII ya estaba resuelta antes de este plan

`.specify/memory/constitution.md` está en versión **2.0.0**, con el Sync Impact Report del
2026-08-17 documentando exactamente el cambio que `spec.md` § Contexto y motivación exige como
prerrequisito: `rechazado` como sexto estado, alcanzable únicamente desde `creado`, terminal, con
motivo obligatorio, inmutable y visible. Este plan verificó la versión antes de escribirse; no
hay ninguna enmienda pendiente que bloquee `/speckit-tasks`.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `data-model.md` y los contratos. **Sin violaciones nuevas.** Los dos
puntos que se revisaron expresamente:

- **¿Dos mecanismos de concurrencia distintos (D-037 y D-038) violan la simplicidad al no ser
  uno solo?** No: son dos problemas con distinta forma. La doble confirmación necesita leer
  varias filas relacionadas (carrito, sus líneas, el catálogo) de forma consistente antes de
  decidir — eso pide un bloqueo. Aceptar/rechazar es una sola escritura condicionada a una sola
  columna — un `UPDATE` con `WHERE` ya es atómico sin nada más. Forzar el mismo mecanismo en los
  dos casos habría sido más código para el segundo caso, no menos.
- **¿`Address.usedInOrder` es un campo derivado que debería calcularse en lugar de guardarse?**
  No se puede calcular: al no existir una clave foránea entre `Order` y `Address` (RN-006 lo
  prohíbe expresamente), no hay ninguna consulta que reconstruya "se usó alguna vez" a partir de
  otras tablas. Es información genuina que solo el evento de confirmar puede producir.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/003-gestion-pedidos/
├── plan.md              # Este archivo
├── research.md           # Fase 0: decisiones D-034 a D-046
├── data-model.md          # Fase 1: entidades, invariantes y esquema Prisma
├── quickstart.md          # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── README.md
│   ├── api.md            # Superficie HTTP de services/api
│   └── shared.md         # Superficie pública de packages/shared
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos que E2 **crea o modifica**. Todo lo demás del monorepo permanece
intacto.

```text
packages/shared/src/
├── enums/
│   └── order-status.ts               # MODIFICADO · agrega RECHAZADO
├── order-state/
│   └── machine.ts                    # MODIFICADO · agrega la rama CREADO → RECHAZADO
├── schemas/
│   ├── cart.ts                       # NUEVO
│   ├── address.ts                    # NUEVO
│   ├── order.ts                      # NUEVO
│   └── query.ts                      # MODIFICADO · BusinessOrdersQuery
├── messages/
│   ├── es.ts                         # MODIFICADO · mensajes fijos de E2
│   └── etiquetas.ts                  # MODIFICADO · ETIQUETA_ESTADO_PEDIDO (D-041)
├── types/
│   └── api.ts                        # MODIFICADO · CartDto, AddressDto, OrderSummaryDto
└── index.ts                          # MODIFICADO · superficie pública

services/api/
├── prisma/
│   ├── schema.prisma                 # MODIFICADO · Cart, CartLine, Address, Order, OrderLine
│   └── migrations/                   # NUEVO · una migración
└── src/
    ├── cart/                         # NUEVO · módulo de carrito (HU-12)
    │   ├── cart.controller.ts
    │   ├── cart.service.ts
    │   └── cart.module.ts
    ├── addresses/                    # NUEVO · módulo de direcciones (HU-11)
    │   ├── addresses.controller.ts
    │   ├── addresses.service.ts
    │   └── addresses.module.ts
    ├── orders/                       # NUEVO · módulo de pedidos (HU-01)
    │   ├── orders.controller.ts      # /orders — rol cliente
    │   ├── business-orders.controller.ts  # /business/orders — rol negocio
    │   ├── orders.service.ts
    │   └── orders.module.ts
    └── app.module.ts                 # MODIFICADO · registra los tres módulos

apps/web/src/
├── app/
│   ├── cliente/
│   │   ├── carrito/                  # NUEVO
│   │   ├── direcciones/              # NUEVO
│   │   ├── pedidos/                  # NUEVO · confirmar + listado propio
│   │   └── _components/              # NUEVO
│   └── negocio/
│       ├── pedidos/                  # NUEVO · bandeja y rechazados
│       └── _components/              # MODIFICADO · reutiliza patrones de categorías/productos
└── components/ui/                    # MODIFICADO · solo si falta alguna primitiva

services/api/test/                      # baterías de integración, junto a las de E1/E3
├── cart-add|quantity|remove|clear|price-live|unavailable|persistence.integration-spec.ts  # NUEVO
├── addresses-create|unique|default|edit|deactivate|reactivate|delete.integration-spec.ts   # NUEVO
├── orders-confirm|empty-cart|missing-address|price-changed|unavailable|concurrency.integration-spec.ts  # NUEVO
└── orders-accept|reject|roles|queue-pagination|rejected-list.integration-spec.ts  # NUEVO
```

**Decisión de estructura**: se conserva íntegra la de E1/E3 — tres espacios de trabajo, monolito
modular en NestJS, App Router agrupado por rol en Next.js—. Tres módulos nuevos, cada uno
delgado en el controlador y con la lógica y las transacciones en el servicio, siguiendo el patrón
de `products`/`categories`. `orders` se divide en **dos controladores** dentro del mismo módulo
—`orders.controller.ts` (rol cliente) y `business-orders.controller.ts` (rol negocio)— porque su
control de acceso es opuesto, el mismo criterio que separó `menu` de `products` en E3 (§
Estructura del Proyecto de E3): fundirlos obligaría a decidir el rol endpoint por endpoint dentro
de un mismo controlador.

## Fases de entrega

Cada fase termina con sus pruebas en verde. El orden no es negociable en los dos primeros
saltos: sin `packages/shared` no hay validación, y sin carrito no hay nada que confirmar
(§ Contexto y motivación de la spec: "carrito → dirección → confirmar y ver el estado" es el
orden real en que el cliente lo recorre).

### Fase A · Cimientos (habilitante)

`OrderStatus` ampliado, la rama nueva de `order-state/machine.ts`, los esquemas Zod de carrito,
dirección y pedido, los mensajes fijos y `ETIQUETA_ESTADO_PEDIDO` corregida (D-041). Migración de
Prisma con las cinco tablas, sus índices y sus restricciones `CHECK`. **No entrega ninguna
pantalla**: entrega la base sobre la que las tres historias se construyen sin duplicar reglas.

### Fase B · HU-12 · Carrito (P1)

Módulo `cart` completo y la pantalla de carrito del cliente. Cubre FR-001 a FR-011 y los
escenarios HU12-E01 a E11. Al terminar, la historia es demostrable por sí sola con un cliente y
el catálogo de E3, sin ninguna dirección ni pedido, tal como la spec exige de una P1.

### Fase C · HU-11 · Direcciones (P2)

Módulo `addresses` y la pantalla de direcciones del cliente. Cubre FR-012 a FR-024 y los
escenarios HU11-E01 a E15. Demostrable por sí sola, sin carrito ni pedido.

### Fase D · HU-01 · Pedidos (P3)

Módulo `orders` —los dos controladores—, la pantalla de confirmación y "mis pedidos" del
cliente, y la bandeja del negocio con aceptar/rechazar. Cubre FR-025 a FR-041 y los escenarios
HU01-E01 a E16. Es la fase que depende de B y C ya construidas (§ Por qué esta prioridad de HU-01
en la spec).

### Fase E · Concurrencia y validación funcional

Las baterías de integración de D-036 a D-038 (doble confirmación, carrera de aceptar/rechazar,
precio cambiado) y el recorrido completo de `quickstart.md` con las dos sesiones simultáneas.
**No es un trámite**: en E1 y E3, la mitad de los defectos que la validación manual encontró no
los detectaba ninguna prueba automática (`CLAUDE.md` § Estado del código).

## Complexity Tracking

Ninguna violación de la constitución que justificar. Se registran, en cambio, las dos decisiones
que **aumentan** el trabajo respecto de la solución mínima concebible, con lo que se compra a
cambio.

| Decisión | Trabajo que añade | Por qué se acepta |
|---|---|---|
| `Address.usedInOrder` (D-039) | Una columna más y la obligación de ponerla en `true` dentro de la transacción de confirmación | Es la única forma de que FR-018/FR-019 se cumplan sin reintroducir una referencia de `Order` a `Address`, que RN-006 prohíbe expresamente |
| Bloqueo de fila explícito (`FOR UPDATE`) en `POST /orders` (D-037) | Una consulta cruda adicional dentro de la transacción, en vez de confiar en el aislamiento por defecto de PostgreSQL | El aislamiento `READ COMMITTED` por defecto no basta: dos transacciones podrían leer el mismo carrito con líneas antes de que ninguna de las dos comprometa nada, y las dos crearían un pedido — exactamente lo que FR-036 prohíbe |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La comprobación de `expectedLines` se implementa comparando solo el total, no línea por línea | Alto: un cambio de precio en una línea podría compensarse con otra y pasar inadvertido | D-036 y `contracts/api.md` exigen la comparación **por producto**; la batería de integración de precio cambiado prueba el caso de una sola línea entre varias |
| El bloqueo de fila de D-037 se omite y la doble confirmación se prueba solo con una petición a la vez | Alto: SC-012 y el caso límite de doble confirmación fallarían en producción sin que ningún test unitario lo note | La batería de integración de concurrencia dispara dos confirmaciones realmente simultáneas (`Promise.all`) contra la misma base efímera, no secuenciales |
| `usedInOrder` se olvida de marcar en el camino de `addressText` puntual | Bajo: una dirección puntual nunca es una fila de `Address`, así que no hay nada que marcar — pero es fácil confundir los dos caminos al escribir el servicio | La prueba de integración de HU11-E10 confirma explícitamente que una dirección puntual **no** aparece en la lista de direcciones guardadas del cliente |
| La paginación de la bandeja del negocio (D-043) combina mal `creado` y `en_preparacion`, mostrando unos antes que otros por estado en vez de por antigüedad | Medio: rompería SC-004 y el orden de FR-041 | El índice `order_status_created_at_id_idx` ordena por `created_at, id` sin distinguir estado dentro del `WHERE status IN (...)`; la prueba de paginación siembra pedidos de ambos estados intercalados en el tiempo |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Ampliación de `OrderStatus`, mensajes, etiquetas | A |
| FR-001 a FR-011 | B |
| FR-012 a FR-024 | C |
| FR-025 a FR-041 | D |
| Concurrencia (D-036 a D-038) y validación funcional | E |

Los doce criterios de éxito se trazan uno a uno en `quickstart.md` § Cobertura de los criterios
de éxito, que es donde se declara además cuáles no tienen cobertura automática.
