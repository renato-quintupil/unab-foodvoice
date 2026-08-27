# Plan de Implementación: E7 · Cierre del servicio (Cierre digital del servicio)

**Rama**: `008-cierre-servicio` | **Fecha**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/008-cierre-servicio/spec.md`

## Resumen

E7 llena las dos últimas transiciones de la máquina de estados del pedido —
`asignado_repartidor → entregado` y `entregado → cerrado` — que hoy no
tienen ningún camino para dispararse. A diferencia de E5, **ninguna
enmienda constitucional hace falta**: ambas ya estaban declaradas en el
Principio XII desde su redacción original.

El modelo, ya resuelto con el usuario antes de escribir la spec: el
repartidor marca "Entregado" sobre el pedido que tiene en curso; el cliente,
sobre un pedido propio en `entregado`, confirma sin comentarios o reclama
con un motivo de texto libre — ambos caminos cierran el pedido, y el
reclamo es feedback registrado (`Order.complaintReason`, nulable, mismo
patrón que `rejectionReason` de E2), no un bloqueo del cierre.

Las cinco decisiones que gobiernan el diseño:

1. **`complaintReason` es una columna nulable más en `Order`, sin tabla
   aparte** (D-073): mismo molde que `rejectionReason`.
2. **`entregar()` y `cerrar()` son métodos propios de `OrdersService`, no
   una generalización de `transicionar()`** (D-074): el helper privado que
   ya usan aceptar/rechazar está hardcodeado a `desde: CREADO` y
   `actorRole: NEGOCIO` — mismo criterio que llevó a E5 a escribir
   `tomar`/`soltar` como métodos propios en vez de forzar ese helper.
3. **El fallo de "entregar" reutiliza el error de E5**
   (`DELIVERY_ORDER_NOT_YOURS`/`pedidoNoAsignadoATi()`, D-075): mismo
   significado exacto — el pedido no está asignado a este repartidor en el
   estado esperado — así que no hace falta un código de error nuevo para el
   repartidor.
4. **Un solo método de servicio, dos rutas HTTP, para confirmar y
   reclamar** (D-077): `cerrar(id, clienteId, complaintReason)` con
   `complaintReason: null` para confirmar — mismo criterio que
   `aceptar`/`rechazar` comparten `transicionar` en E2.
5. **El reclamo se muestra reutilizando `HistorialPedido`** (D-078, E4):
   una condición más junto a la que ya muestra `rejectionReason`, sin tocar
   las tres páginas de detalle (cliente/negocio/admin).

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios.

**Dependencias principales**: las ya presentes en el monorepo. **E7 no incorpora ninguna
dependencia nueva.**

**Almacenamiento**: PostgreSQL 16. **Una migración nueva**: una columna
nulable en `order` (`complaint_reason`). Sin índice nuevo — no hay ninguna
consulta que filtre por ella (a diferencia de `delivery_user_id` en E5, que
sí necesitaba servir la lista de disponibles).

**Pruebas**: se hereda la disposición de E1–E6. Unitarios con Vitest/Jest
según paquete. Integración con Jest en `services/api/test/`, contra
PostgreSQL efímera en Docker — aquí es donde se prueba la condición de
carrera de confirmar/reclamar simultáneos (FR-013), que un test unitario
con mocks no puede demostrar.

**Plataforma objetivo**: navegador desde 360 px de ancho y contenedores Linux, igual que las
épicas anteriores.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` como BFF frente
a `services/api`. Sin cambios de arquitectura.

**Objetivos de rendimiento**: SC-001/SC-002 (1 clic) y SC-003 (reclamar en
menos de 1 minuto) son objetivos de interfaz, no de sistema; ninguno exige
un SLO técnico nuevo — cada transición es una escritura condicionada de una
fila, sin sondeo en tiempo real (mismo criterio ya establecido desde E2).

**Restricciones**: mono-local (Principio VIII); sin geolocalización,
notificaciones push, calificación numérica ni clasificación de productos a
partir del feedback; sin bandeja de reclamos dedicada — el reclamo se ve en
el detalle de pedido que E4 ya construyó.

**Escala/Alcance**: tres endpoints nuevos (`PUT /delivery/orders/:id/deliver`,
`PUT /orders/:id/confirm`, `PUT /orders/:id/complain`), una columna nueva en
`Order`, una extensión de `HistorialPedido` (E4), y dos extensiones de
pantalla (`/repartidor` de E5, `/cliente/pedidos` de E1/E2).

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Una columna nulable en la tabla que ya existe, no una tabla de reclamos nueva. Reutiliza el error de E5 para "entregar" en vez de inventar uno; un solo método de servicio para las dos acciones del cliente. |
| **II · Idioma: todo en español** | Dos mensajes nuevos (`MSG_MOTIVO_RECLAMO_REQUERIDO`, `MSG_PEDIDO_NO_ENTREGADO`) en `packages/shared/src/messages/es.ts`; ninguna pantalla introduce texto suelto fuera de esa fuente. |
| **III · Cero alcance fantasma** | Sin bandeja de reclamos, sin clasificación de productos a partir del feedback, sin calificación numérica — las tres exclusiones que la spec declara. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre las seis SC desde la UI: marcar entregado, confirmar, reclamar, y ver el reclamo en la trazabilidad de las tres pantallas de E4. |
| **V · Datos del usuario con respeto** | El reclamo es el único dato nuevo, y lo escribe el propio cliente de forma explícita y opcional — no hay recolección pasiva. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E7 no interpreta voz; toda acción (entregar, confirmar, reclamar) es un botón. |
| **VII · Entender la intención** | No aplica: sin lenguaje natural en esta épica. |
| **VIII · El catálogo y el stock son la única verdad, por local** | Sin cambios: E7 no toca catálogo ni stock. |
| **IX · Confirmar antes de actuar** | "Entregado" y "Todo bien" son acciones directas de un clic (no destructivas, SC-001/SC-002); "Reclamar" exige escribir un motivo dentro de un diálogo de confirmación, mismo patrón que el rechazo de E2. |
| **X · Privacidad y datos mínimos** | El reclamo es texto que el cliente decide escribir; sin dato nuevo recolectado de forma pasiva. |
| **XI · Calidad guiada por especificación (test-first)** | Los criterios de aceptación de las tres historias preceden al diseño; la condición de carrera (FR-013) se traza a una prueba de integración específica. |
| **XII · Trazabilidad del pedido de punta a punta** | Ambas transiciones ya estaban declaradas en la constitución vigente (v3.0.0) — **sin enmienda**. Cada transición nueva agrega su entrada de historial en la misma transacción, igual que E2 y E5. **PASS sin cambios constitucionales.** |

### Estado de la enmienda constitucional

Ninguna. `.specify/memory/constitution.md` permanece en **v3.0.0**: las dos
transiciones que esta épica construye ya estaban en el conjunto cerrado
desde la redacción original del Principio XII, a diferencia de la
transición de retroceso que E5 sí tuvo que agregar.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, contratos y
`quickstart.md`. **PASS: sin violaciones constitucionales.** Se comprobó
expresamente:

- `packages/shared/src/order-state/machine.ts` no necesita ningún cambio:
  `SIGUIENTE[ASIGNADO_REPARTIDOR]` y `SIGUIENTE[ENTREGADO]` ya incluyen
  `ENTREGADO` y `CERRADO` respectivamente desde antes de E5.
- `complaintReason` es una extensión aditiva de `OrderSummaryDto` (mismo
  nivel que `rejectionReason`, no anidada); ningún consumidor existente
  (E2, E4, E5, E9) se ve afectado por el campo nuevo.
- `HistorialPedido` (E4) muestra el reclamo con la misma condición
  estructural que ya usa para el motivo de rechazo, sin que las tres
  páginas de detalle que lo consumen necesiten saber que el campo existe.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/008-cierre-servicio/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D-073 a D-080
├── data-model.md         # Fase 1: columna nueva, migración, DTOs
├── quickstart.md         # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── api.md            # Tres endpoints nuevos de services/api
│   └── shared.md         # Tipos, esquemas y mensajes nuevos de packages/shared
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos y grupos que E7 crea o modifica.

```text
packages/shared/src/
├── messages/
│   └── es.ts                         # MODIFICADO · dos mensajes nuevos (D-076)
├── schemas/
│   └── order.ts                      # MODIFICADO · ComplainOrderSchema (mismo molde que RejectOrderSchema)
├── types/
│   └── api.ts                        # MODIFICADO · OrderSummaryDto gana complaintReason
└── index.ts                          # MODIFICADO · superficie pública

services/api/prisma/
├── schema.prisma                     # MODIFICADO · columna complaint_reason
└── migrations/
    └── <timestamp>_cierre_servicio/  # NUEVO

services/api/src/
├── common/
│   └── errors.ts                     # MODIFICADO · ORDER_NOT_DELIVERED (D-076)
└── orders/
    ├── orders.service.ts             # MODIFICADO · entregar(), cerrar()
    ├── orders.controller.ts          # MODIFICADO · PUT :id/confirm, PUT :id/complain
    └── delivery-orders.controller.ts # MODIFICADO · PUT :id/deliver

apps/web/src/
├── components/
│   └── historial-pedido.tsx          # MODIFICADO · muestra el reclamo (D-078)
└── app/
    ├── repartidor/_components/
    │   ├── pedido-en-curso.tsx       # MODIFICADO · botón "Marcar como entregado"
    │   └── boton-entregar.tsx        # NUEVO
    └── cliente/pedidos/
        ├── page.tsx                  # MODIFICADO · acciones sobre pedidos "entregado"
        └── _components/
            ├── boton-confirmar-cierre.tsx  # NUEVO
            └── dialogo-reclamo.tsx         # NUEVO

services/api/test/
└── orders-cierre-*.integration-spec.ts  # NUEVO · entregar, confirmar, reclamar, concurrencia
```

**Decisión de estructura**: no se crea ningún módulo ni controlador nuevo —
las tres transiciones se agregan a los dos controladores que ya existen
(`OrdersController` para el cliente, `DeliveryOrdersController` para el
repartidor, ambos en `OrdersModule`). La pantalla del cliente reutiliza el
patrón de `apps/web/src/app/negocio/pedidos/_components/` (acciones +
diálogo con motivo) que E2 ya estableció, y la del repartidor extiende el
componente que E5 ya construyó.

## Fases de entrega

### Fase A · Cimientos (habilitante)

Migración de `Order` (columna `complaint_reason`), el esquema
`ComplainOrderSchema`, los dos mensajes nuevos y `complaintReason` en
`OrderSummaryDto`.

### Fase B · Historia 1 — Repartidor marca un pedido como entregado (P1, MVP)

`PUT /delivery/orders/:id/deliver`, `OrdersService.entregar()`, botón
"Marcar como entregado" en `pedido-en-curso.tsx`. Cubre FR-001 a FR-004.

### Fase C · Historia 2 — Cliente confirma que su pedido llegó bien (P2)

`PUT /orders/:id/confirm`, `OrdersService.cerrar()` (con
`complaintReason: null`), botón "Todo bien" en `/cliente/pedidos`. Cubre
FR-005, FR-006, FR-009 (parcial).

### Fase D · Historia 3 — Cliente reclama por un problema (P3)

`PUT /orders/:id/complain`, mismo `cerrar()` con el motivo, diálogo de
reclamo. Cubre FR-007, FR-008, FR-010 a FR-012.

### Fase E · Trazabilidad y validación funcional

Extender `HistorialPedido` para mostrar el reclamo (FR-014). Ejecutar
`quickstart.md` completo (SC-001 a SC-006) con un repartidor y un cliente
reales, incluida la condición de carrera de confirmar/reclamar
simultáneos.

## Complexity Tracking

La puerta constitucional pasa sin violaciones que justificar. No hay tabla de excepciones.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir el fallo de "entregar" con el de "tomar/soltar" de E5, reutilizando mal el código de error | Bajo: mensaje técnicamente correcto pero code review confuso | Documentar explícitamente en el código que `pedidoNoAsignadoATi()` sirve a las tres acciones del repartidor sobre su pedido asignado (tomar excluido, que usa su propio error) |
| Que `cerrar()` permita reclamar sobre un pedido ya `cerrado` por una carrera anterior | Alto: violaría FR-009 y el historial quedaría con una transición inválida | Escritura condicionada (`WHERE status = 'entregado'`) igual que el resto de las transiciones del proyecto; una prueba de integración específica de la carrera confirmar/reclamar |
| Olvidar propagar `complaintReason` a `OrderDetailDto` vía `OrderSummaryDto`, dejando la trazabilidad de E4 sin mostrarlo | Medio: FR-014/SC-006 no se cumplirían | `OrderDetailDto` extiende `OrderSummaryDto` por composición (D-051, E4) — agregar el campo ahí basta; prueba de integración que confirma que el detalle lo incluye |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Migración, `ComplainOrderSchema`, mensajes, `complaintReason` en el DTO | A |
| FR-001 a FR-004 | B |
| FR-005, FR-006, FR-009 | C |
| FR-007, FR-008, FR-010, FR-012 | D |
| FR-011, FR-013, FR-014; SC-001 a SC-006 | E |

Los seis criterios de éxito se trazan uno a uno en `quickstart.md`.
