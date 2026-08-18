# Plan de Implementación: E2 · Gestión de pedidos

**Rama**: `003-gestion-pedidos` | **Fecha**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/003-gestion-pedidos/spec.md`

## Resumen

E2 crea la primera entidad transaccional del producto: el `Pedido`. Tres historias, en el orden
en que el cliente las recorre — **carrito** (HU-12) → **direcciones** (HU-11) → **confirmar y
ver el estado** (HU-01)—, y seis tablas nuevas (`Cart`, `CartLine`, `Address`, `Order`,
`OrderLine`, `OrderStatusEvent`) sobre el mismo stack que E1 y E3 dejaron construido. No se
incorpora ninguna dependencia.

Las cinco decisiones que gobiernan el diseño son:

1. **El contrato de estados ya está vigente.** La constitución 2.0.0 agrega `rechazado` como
   sexto estado, terminal y alcanzable solo desde `creado`; E2 lo traduce a enum, máquina de
   estados, persistencia y presentación (D-035).
2. **La revalidación de precio compara contra lo último que el cliente vio** (D-036):
   `POST /orders` recibe cada precio esperado y lo contrasta con el catálogo vigente dentro de
   la transacción que crea el pedido.
3. **La concurrencia usa la mínima primitiva que conserva cada invariante**: bloqueo de carrito
   para doble confirmación (D-037), escritura condicionada para aceptar/rechazar (D-038) y
   bloqueo de la fila `User` para serializar cambios de dirección predeterminada y la carrera
   uso/eliminación (D-049).
4. **El pedido conserva snapshots, no referencias mutables**: copia producto, precio y dirección.
   `Address.usedInOrder` registra que una dirección guardada participó en una confirmación sin
   acoplar posteriormente el pedido a esa fila (D-039).
5. **E2 registra el historial mínimo exigido por el Principio XII** (D-047, D-048): creación,
   aceptación y rechazo agregan exactamente un `OrderStatusEvent` inmutable en la misma
   transacción del cambio. Consultarlo y continuar transiciones corresponde a E4; E2 no expone
   endpoint ni DTO de historial (D-050).

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios respecto
de E1/E3.

**Dependencias principales**: las ya presentes en el monorepo — Next.js 15 (App Router), React
19, TailwindCSS 4, shadcn/ui, react-hook-form con resolver de Zod, NestJS 11, Prisma 6 y Zod.
**E2 no incorpora ninguna dependencia nueva.**

**Almacenamiento**: PostgreSQL 16 con `prisma migrate`. Seis tablas nuevas (`cart`, `cart_line`,
`address`, `order`, `order_line`, `order_status_event`) y ampliación del enum `OrderStatus` con
`RECHAZADO`. Las restricciones que Prisma no expresa —índice único parcial de dirección
predeterminada, checks del evento y trigger append-only— se incorporan como SQL create-only en
la migración. `product` recibe relaciones entrantes desde `cart_line` y `order_line`; `user`
recibe relaciones desde `address`, `order` y `order_status_event`.

**Pruebas**: se hereda la disposición de E1/E3. Unitarios con **Vitest** en `packages/shared` y
`apps/web`, y con **Jest** en `services/api`. Integración con **Jest** en `services/api/test/`,
archivos `<dominio>-<aspecto>.integration-spec.ts`, contra PostgreSQL efímera en Docker.

Son pruebas de integración, no unitarias: la revalidación y atomicidad de confirmación
(D-036, D-037, D-045, D-048), las carreras aceptar/rechazar y dirección predeterminada
(D-038, D-049), la unicidad normalizada de etiqueta (D-040), el append-only del historial y el
rollback si falla su inserción (D-047, D-048). Las transacciones interactivas de Prisma agrupan
las operaciones y el bloqueo explícito se ejecuta dentro de ellas.

**Plataforma objetivo**: navegador desde 360 px de ancho y contenedores Linux, igual que E1/E3.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` como BFF frente
a `services/api`.

**Objetivos de rendimiento**: no se introduce un SLO técnico ni un límite de líneas inexistente
en la especificación. El único objetivo temporal vigente es SC-001: completar manualmente el
flujo definido en menos de dos minutos.

**Restricciones**: mono-local; sin pago ni pasarela; sin voz; texto visible en español; sin
geolocalización en direcciones (Principio X, FR-021); ningún borrado físico de pedidos, líneas
de pedido, direcciones usadas ni eventos de estado.

**Escala/Alcance**: ocho páginas nuevas —`cliente/carrito`, `cliente/direcciones`,
`cliente/direcciones/nueva`, `cliente/direcciones/[id]/editar`, `cliente/pedidos`,
`cliente/pedidos/confirmar`, `negocio/pedidos`, `negocio/pedidos/rechazados`— y diecisiete
endpoints —cinco de carrito, seis de direcciones y seis de pedidos—. El historial no añade
superficie HTTP en E2.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Cero dependencias nuevas. Se reutilizan transacciones Prisma y el patrón SQL append-only ya aplicado a `AdminAuditLog`. Cada carrera usa la mínima primitiva que protege su invariante (D-037, D-038, D-049); no se agrega un framework general de locking. |
| **II · Idioma: todo en español** | Los mensajes fijos nuevos se centralizan en `packages/shared/src/messages/es.ts`; ninguna pantalla escribe texto suelto. `ETIQUETA_ESTADO_PEDIDO` se corrige para que «Pendiente» tenga una sola fuente (D-041). |
| **III · Cero alcance fantasma** | Los endpoints, páginas y reglas se trazan a la spec. No se construyen las cuatro exclusiones declaradas: voz, pago, cancelación por el cliente ni notificaciones. Tampoco se inventan SLO, límite de líneas ni consulta de historial. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre los 12 criterios desde la UI con dos sesiones. SC-001, SC-005 y SC-011 se miden por tiempo/clics; SC-004 por apertura o una recarga; SC-009 es manual por su naturaleza. Las invariantes internas de atomicidad y append-only se demuestran con integración porque E4 aún no expone la consulta. |
| **V · Datos del usuario con respeto** | E2 solo solicita la dirección de texto libre y el motivo de rechazo que las historias requieren. El historial conserva el actor y su rol efectivos, no nuevos datos sensibles. Sin variables de entorno nuevas. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E2 construye la ruta manual y operaciones server-side que E6/HU-13 podrá invocar sin rediseño. SC-009 demuestra que todo el flujo funciona sin voz. |
| **VII · Entender la intención** | No aplica: E2 no interpreta lenguaje natural; entrega operaciones que E6 usará después de interpretar. |
| **VIII · El catálogo es la única verdad** | RN-002, FR-002, FR-007 y D-045 validan `active && available` al agregar y al confirmar, dentro del servidor y nunca solo en la pantalla. |
| **IX · Confirmar antes de actuar y poder deshacer** | El cliente confirma explícitamente al agregar el producto; mientras el pedido no se confirma, el carrito permanece editable (FR-005). E2 no interpreta voz. La cancelación posterior del pedido está fuera de alcance y no se equipara con el rechazo del negocio. |
| **X · Privacidad y datos mínimos** | Las direcciones son texto libre, sin mapa, pin ni coordenadas (FR-021, HU11-E15). Sin micrófono ni audio. |
| **XI · Calidad guiada por especificación (test-first)** | Los 45 escenarios Gherkin —11 de HU-12, 15 de HU-11 y 19 de HU-01— preceden al diseño y se trazan a pruebas o validaciones concretas. |
| **XII · Trazabilidad del pedido de punta a punta** | E2 registra el evento inicial y cada transición que ejecuta (`creado → en_preparacion`, `creado → rechazado`). Evento y mutación son atómicos; un trigger rechaza `UPDATE`/`DELETE`; la carrera perdedora no deja evento. E4 consultará el historial y continuará las transiciones, sin que E2 anticipe esa API. **PASS.** |

### Estado de la enmienda constitucional

`.specify/memory/constitution.md` está en versión **2.0.0**, con el Sync Impact Report del
2026-08-17. `rechazado` es el sexto estado, solo alcanzable desde `creado`, terminal, con motivo
obligatorio, inmutable y visible. El diseño de E2 satisface además la obligación de historial
append-only del Principio XII; no queda una enmienda pendiente antes de `/speckit-tasks`.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, contratos y `quickstart.md`.
**PASS: sin violaciones constitucionales.** Se comprobaron expresamente:

- La creación inserta `Order`, líneas, evento `NULL → CREADO`, marca la dirección usada y vacía
  el carrito en una sola transacción; cualquier fallo revierte el conjunto.
- Aceptar o rechazar realiza la escritura condicionada y agrega el evento correspondiente en una
  sola transacción; `count = 0` o un fallo al insertar impide todo efecto parcial.
- `order_status_event` carece de ruta de actualización/borrado y un trigger de base rechaza ambas
  operaciones, de modo que append-only no depende de disciplina de aplicación.
- El índice parcial de dirección predeterminada protege la unicidad incluso bajo concurrencia; el
  bloqueo de `User` ordena altas, reactivaciones, cambios y la carrera entre usar y eliminar.
- No se agregó API de lectura de historial: esa experiencia sigue siendo responsabilidad de E4.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/003-gestion-pedidos/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D-034 a D-050
├── data-model.md        # Fase 1: entidades, invariantes y esquema Prisma
├── quickstart.md        # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── README.md
│   ├── api.md           # 17 endpoints públicos de services/api
│   └── shared.md        # Superficie pública de packages/shared
└── tasks.md             # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos y grupos que E2 crea o modifica.

```text
packages/shared/src/
├── enums/
│   └── order-status.ts               # MODIFICADO · agrega RECHAZADO
├── order-state/
│   └── machine.ts                    # MODIFICADO · CREADO → RECHAZADO
├── schemas/
│   ├── cart.ts                       # NUEVO
│   ├── address.ts                    # NUEVO
│   ├── order.ts                      # NUEVO
│   └── query.ts                      # MODIFICADO · BusinessOrdersQuery
├── messages/
│   ├── es.ts                         # MODIFICADO · mensajes fijos de E2
│   └── etiquetas.ts                  # MODIFICADO · estados visibles
├── types/
│   └── api.ts                        # MODIFICADO · DTO públicos; sin historial
└── index.ts                          # MODIFICADO · superficie pública

services/api/
├── prisma/
│   ├── schema.prisma                 # MODIFICADO · seis modelos y relaciones
│   └── migrations/                   # NUEVO · restricciones y trigger append-only
└── src/
    ├── cart/                          # NUEVO · HU-12
    ├── addresses/                     # NUEVO · HU-11
    ├── orders/                        # NUEVO · HU-01; escribe eventos internos
    │   ├── orders.controller.ts
    │   ├── business-orders.controller.ts
    │   ├── orders.service.ts
    │   └── orders.module.ts
    └── app.module.ts                  # MODIFICADO · registra tres módulos

apps/web/src/app/
├── cliente/
│   ├── carrito/page.tsx
│   ├── direcciones/page.tsx
│   ├── direcciones/nueva/page.tsx
│   ├── direcciones/[id]/editar/page.tsx
│   ├── pedidos/page.tsx
│   └── pedidos/confirmar/page.tsx
└── negocio/
    ├── pedidos/page.tsx
    └── pedidos/rechazados/page.tsx

services/api/test/
├── cart-*.integration-spec.ts
├── addresses-*.integration-spec.ts   # incluye unicidad y carreras
├── orders-confirm-*.integration-spec.ts
├── orders-transition-*.integration-spec.ts
├── orders-history-*.integration-spec.ts  # atomicidad, append-only y carreras
└── orders-roles|queue|rejected-*.integration-spec.ts
```

**Decisión de estructura**: se conserva el monorepo de E1/E3 —`packages/shared`, API modular
NestJS y App Router por rol—. Los controladores permanecen delgados; reglas y transacciones
viven en servicios. `orders` tiene dos controladores dentro del mismo módulo:
`orders.controller.ts` para cliente y `business-orders.controller.ts` para negocio. El historial
es una relación interna del dominio, no un cuarto módulo ni una superficie pública.

## Fases de entrega

Cada fase termina con sus pruebas en verde. El orden conserva el recorrido real
carrito → dirección → confirmación.

### Fase A · Cimientos (habilitante)

Ampliar `OrderStatus`, la máquina de estados, esquemas Zod, mensajes y etiquetas. Crear la
migración de las seis tablas, relaciones, índices, checks, índice único parcial de dirección
predeterminada y trigger append-only de `order_status_event`. Esta fase no entrega pantallas.

### Fase B · HU-12 · Carrito (P1)

Implementar módulo y página de carrito. Cubre FR-001 a FR-011 y HU12-E01 a E11. Es demostrable
con un cliente y el catálogo de E3, sin dirección ni pedido.

### Fase C · HU-11 · Direcciones (P2)

Implementar módulo y cuatro páginas de direcciones. Cubre FR-012 a FR-024 y HU11-E01 a E15.
Incluye transacciones y bloqueo de `User` para alta, reactivación, cambio de predeterminada y
eliminación, más pruebas concurrentes del índice parcial (D-049).

### Fase D · HU-01 · Pedidos (P3)

Implementar los dos controladores de `orders`, confirmación y listado del cliente, bandeja y
rechazados del negocio. Cubre FR-025 a FR-044 y HU01-E01 a E19. La creación y las dos
transiciones de E2 insertan su `OrderStatusEvent` dentro de la misma transacción; no se crea API
de consulta del historial.

### Fase E · Concurrencia, atomicidad y validación funcional

Ejecutar las baterías de D-036 a D-049: precio cambiado, doble confirmación, aceptar/rechazar
concurrente, dirección predeterminada concurrente, carrera usar/eliminar, una entrada inicial
exacta, una por transición, rollback si falla el evento, rechazo de `UPDATE`/`DELETE` y ausencia
de evento para la carrera perdedora. Completar V01 a V40 de `quickstart.md` con dos sesiones.

## Complexity Tracking

La puerta constitucional pasa. Estas decisiones agregan implementación porque son necesarias
para proteger invariantes explícitas:

| Decisión | Trabajo que añade | Por qué se acepta |
|---|---|---|
| `Address.usedInOrder` (D-039) | Columna y actualización dentro de confirmación | RN-006 prohíbe una referencia mutable desde `Order`; sin la bandera no puede distinguirse una dirección nunca usada |
| Bloqueo de carrito `FOR UPDATE` (D-037) | Consulta SQL dentro de la transacción | Evita dos pedidos creados desde las mismas líneas bajo `READ COMMITTED` |
| Índice parcial y bloqueo de `User` (D-049) | SQL de migración y protocolo transaccional compartido | La regla «exactamente una predeterminada activa» y uso/eliminación deben sobrevivir carreras |
| Trigger append-only (D-047) | Función y trigger SQL create-only | FR-044 exige impedir actualización y borrado aun fuera del servicio |
| Evento dentro de cada mutación (D-048) | Inserción adicional y pruebas de rollback | Principio XII y FR-042–FR-044 exigen historia completa y atómica |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Comparar solo el total de `expectedLines` | Alto: cambios compensados pasarían inadvertidos | D-036 compara por producto; integración altera una línea entre varias |
| Omitir el bloqueo de carrito | Alto: doble confirmación crea dos pedidos | Prueba realmente concurrente contra PostgreSQL con dos solicitudes |
| Actualizar el pedido y luego insertar el evento fuera de la transacción | Crítico: estado sin trazabilidad | D-048 agrupa ambas operaciones y fuerza rollback ante fallo; pruebas para creación, aceptación y rechazo |
| Confiar append-only solo al servicio | Crítico: SQL o código futuro podría alterar historia | Trigger `BEFORE UPDATE OR DELETE` y prueba directa que ambas operaciones son rechazadas |
| Resolver predeterminada solo con `updateMany` | Alto: dos solicitudes concurrentes pueden dejar dos predeterminadas | Índice único parcial, bloqueo de `User` y pruebas concurrentes |
| La carrera perdedora inserta un evento | Alto: historial describe una transición inexistente | Insertar solo después de `updateMany.count = 1`, dentro de la misma transacción |
| Paginar bandeja por estado antes que por antigüedad | Medio: rompe FR-041/SC-004 | Índice y consulta por `created_at, id` sobre ambos estados; prueba con estados intercalados |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Enum, máquina, mensajes, seis modelos y restricciones de base | A |
| FR-001 a FR-011; HU12-E01 a E11 | B |
| FR-012 a FR-024; HU11-E01 a E15; concurrencia D-049 | C |
| FR-025 a FR-044; HU01-E01 a E19; eventos D-047/D-048 | D |
| Concurrencia, atomicidad, append-only y V01 a V40 | E |

Los doce criterios de éxito se trazan uno a uno en `quickstart.md`. Allí se distingue la
validación desde la aplicación de las invariantes internas que, mientras E4 no exponga el
historial, se demuestran mediante integración.
