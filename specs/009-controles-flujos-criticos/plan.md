# Plan de Implementación: E8 · Controles y administración (Controles de flujos críticos)

**Rama**: `009-controles-flujos-criticos` | **Fecha**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/009-controles-flujos-criticos/spec.md`

## Resumen

E8 le da al administrador un camino manual para destrabar el flujo cuando
cliente, negocio y repartidor no avanzan por sí solos, y una acción nueva
—pausar el servicio— que no es una transición de pedido. Tres historias:

1. **Forzar la transición normal siguiente** sobre un pedido, en nombre del
   rol que no respondió (por ejemplo, `creado → en_preparacion` cuando el
   negocio nunca responde). Reutiliza transiciones ya declaradas en el
   Principio XII — **sin enmienda constitucional**.
2. **Cerrar administrativamente** un pedido en cualquier estado no
   terminal, fuera del camino normal. Esta sí exigió una enmienda: el
   Principio XII decía "no se permite ninguna otra transición", así que se
   amplió a **v4.0.0** agregando `{creado, en_preparacion,
   asignado_repartidor, entregado} → cerrado` como séptima transición
   declarada, disparable solo por `ADMINISTRADOR` — detectado en
   `/speckit.clarify`, resuelto antes de este plan.
3. **Pausar y reanudar el servicio**, impidiendo temporalmente la
   confirmación de pedidos nuevos sin afectar los ya en curso.

Las cinco decisiones que gobiernan el diseño (detalle completo en
`research.md`, D-082 a D-089):

1. **El motivo de una intervención vive en `OrderStatusEvent.reason`, no en
   `Order`** (D-082): a diferencia de `rejectionReason`/`complaintReason`
   (atados a un desenlace terminal único), un pedido puede recibir más de
   una intervención administrativa a lo largo de su vida.
2. **`machine.ts` gana dos funciones nuevas, sin tocar `SIGUIENTE`**
   (D-083): `transicionesForzablesPorAdmin()` (Historia 1, excluye la
   retroceso de E5) y `puedeCerrarseAdministrativamente()` (Historia 2).
   Meter las cuatro aristas nuevas dentro de `SIGUIENTE` colapsaría las dos
   historias en una sola.
3. **Bitácora dual, no una tabla polimórfica** (D-084): forzar/cerrar usan
   `OrderStatusEvent` (ya inmutable); pausar/reanudar extienden
   `AdminAuditLog` (de E1) con dos valores de `AdminAction` nuevos y
   `targetUserId` nulable.
4. **`ServiceStatus` es una tabla de una sola fila** (D-085): v1 es
   mono-local, no hay "el negocio pausado" por usuario.
5. **Un cuarto controlador en `OrdersModule`** (D-087), mismo criterio que
   ya usó E5 con `DeliveryOrdersController`; pausar/reanudar vive en un
   módulo propio y pequeño porque no involucra ningún `Order`.

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios.

**Dependencias principales**: las ya presentes en el monorepo. **E8 no incorpora ninguna
dependencia nueva.**

**Almacenamiento**: PostgreSQL 16. **Una migración nueva**: columna nulable
`reason` en `order_status_event`; tabla nueva `service_status` (una fila);
`target_user_id` nulable y columna `reason` nueva en `admin_audit_log`; dos
valores nuevos en el enum `AdminAction`. Sin índice nuevo — ninguna consulta
de esta épica filtra por las columnas nuevas.

**Pruebas**: se hereda la disposición de E1–E7. Unitarios con Vitest/Jest
según paquete (`transicionesForzablesPorAdmin`,
`puedeCerrarseAdministrativamente` en `packages/shared`). Integración con
Jest en `services/api/test/`, contra PostgreSQL efímera en Docker — ahí se
prueba la condición de carrera de dos intervenciones administrativas
simultáneas sobre el mismo pedido (FR-016), que un test unitario con mocks
no puede demostrar, y el efecto real de la pausa sobre `POST /orders`.

**Plataforma objetivo**: navegador desde 360 px de ancho y contenedores Linux, igual que las
épicas anteriores.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` como BFF frente
a `services/api`. Sin cambios de arquitectura.

**Objetivos de rendimiento**: SC-001/SC-002 (menos de 2 minutos) y SC-003
(pausar en menos de 1 minuto, reanudar en 1 clic) son objetivos de
interfaz, no de sistema; cada acción es una escritura condicionada de una
fila, sin sondeo en tiempo real (mismo criterio ya establecido desde E2).

**Restricciones**: mono-local (Principio VIII); sin escalamiento
automático, notificaciones push, niveles de permiso dentro de
`ADMINISTRADOR`, ni corrección administrativa sobre el catálogo (RN-001 de
E3 se mantiene sin excepción).

**Escala/Alcance**: cinco endpoints nuevos (`PUT
/admin/orders/:id/force-transition`, `PUT /admin/orders/:id/close`, `GET
/admin/service/status`, `PUT /admin/service/pause`, `PUT
/admin/service/resume`), un caso de error nuevo en `POST /orders`, una
columna nueva en `OrderStatusEvent`, una tabla nueva de una fila, dos
columnas modificadas en `AdminAuditLog`, una extensión de `HistorialPedido`
(E4), dos pantallas nuevas o extendidas en `apps/web`
(`/admin/pedidos/[id]` con acciones nuevas, `/admin/operaciones` nueva).

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Bitácora dual en vez de una tabla polimórfica (D-084); `ServiceStatus` de una fila en vez de un mecanismo de configuración más elaborado (D-085); un mensaje de motivo compartido entre las tres acciones (D-086); ningún módulo ni controlador nuevo más allá de lo estrictamente necesario (D-087). |
| **II · Idioma: todo en español** | Cuatro mensajes nuevos en `packages/shared/src/messages/es.ts`; ninguna pantalla introduce texto suelto fuera de esa fuente. |
| **III · Cero alcance fantasma** | Sin escalamiento automático, sin niveles de permiso, sin corrección de catálogo, sin bandeja de "pedidos atascados" (la detección sigue discrecional) — las cuatro exclusiones que la spec declara. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre los 8 SC desde la UI: forzar, cerrar, pausar, reanudar, y ver el motivo en la trazabilidad. |
| **V · Datos del usuario con respeto** | El motivo administrativo es el único dato nuevo, y lo escribe el propio administrador de forma explícita — sin recolección pasiva. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E8 no interpreta voz; toda acción (forzar, cerrar, pausar, reanudar) es un formulario o un botón. |
| **VII · Entender la intención** | No aplica: sin lenguaje natural en esta épica. |
| **VIII · El catálogo y el stock son la única verdad, por local** | Sin cambios: E8 no toca catálogo ni stock; RN-001 de E3 se mantiene sin excepción administrativa (FR-017). `ServiceStatus` es coherente con mono-local: una sola fila para todo el servicio. |
| **IX · Confirmar antes de actuar** | Las tres acciones que exigen motivo (forzar, cerrar, pausar) usan el mismo patrón de diálogo con campo de texto obligatorio que el rechazo de E2; reanudar es un clic directo sin efecto que deba explicarse. |
| **X · Privacidad y datos mínimos** | El motivo es texto que el administrador decide escribir; `AdminAuditLog` sigue sin copiar datos personales (mismo criterio de E1). |
| **XI · Calidad guiada por especificación (test-first)** | Los criterios de aceptación de las tres historias preceden al diseño; la condición de carrera (FR-016) se traza a una prueba de integración específica. |
| **XII · Trazabilidad del pedido de punta a punta** | Historia 1 reutiliza transiciones ya declaradas — sin cambio. Historia 2 requirió la enmienda **v4.0.0**, ya aplicada antes de este plan (séptima transición: `{creado, en_preparacion, asignado_repartidor, entregado} → cerrado`, solo `ADMINISTRADOR`, motivo obligatorio). Cada transición nueva agrega su entrada de historial en la misma transacción, igual que E2/E5/E7. **PASS con la enmienda ya vigente.** |

### Estado de la enmienda constitucional

Aplicada **antes** de este plan, durante `/speckit.clarify` de esta misma
spec: `.specify/memory/constitution.md` pasó de **v3.0.0** a **v4.0.0**.
Único principio modificado: XII. Ver el Sync Impact Report al inicio de ese
archivo para el detalle completo. Este plan no propone ninguna enmienda
adicional.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, contratos y
`quickstart.md`. **PASS: sin violaciones constitucionales.** Se comprobó
expresamente:

- `SIGUIENTE` en `machine.ts` no se modifica: las dos funciones nuevas
  (D-083) son capas de lectura sobre la tabla existente y sobre el enum
  `OrderStatus`, no una redeclaración de transiciones.
- La séptima transición de la enmienda 4.0.0 solo la usa
  `cerrarAdministrativamente()`, y solo tras verificar
  `puedeCerrarseAdministrativamente(pedido.status)` — ningún otro código
  del proyecto puede alcanzar `cerrado` por esa vía.
- `OrderDetailDto` no cambia de forma propia: `reason` es un campo aditivo
  de `OrderStatusEventDto`, que ya viaja completo dentro de `history` desde
  E4 (D-051) — ningún consumidor existente (cliente, negocio, admin) se ve
  afectado.
- `ServiceStatus` no introduce ninguna columna en `User` ni en `Order`: es
  la única tabla nueva de la épica, con exactamente una fila.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/009-controles-flujos-criticos/
├── plan.md              # Este archivo
├── research.md           # Fase 0: decisiones D-082 a D-089
├── data-model.md         # Fase 1: columnas nuevas, tabla nueva, migración, DTOs
├── quickstart.md         # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── api.md            # Cinco endpoints nuevos de services/api
│   └── shared.md         # Tipos, esquemas, funciones y mensajes nuevos de packages/shared
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos y grupos que E8 crea o modifica.

```text
packages/shared/src/
├── messages/
│   └── es.ts                          # MODIFICADO · cuatro mensajes nuevos (D-086)
├── schemas/
│   ├── order.ts                       # MODIFICADO · ForceOrderTransitionSchema, AdminCloseOrderSchema
│   └── service-status.ts              # NUEVO · PauseServiceSchema
├── types/
│   └── api.ts                         # MODIFICADO · OrderStatusEventDto gana reason; ServiceStatusDto nuevo
├── order-state/
│   └── machine.ts                     # MODIFICADO · transicionesForzablesPorAdmin, puedeCerrarseAdministrativamente (D-083)
└── index.ts                           # MODIFICADO · superficie pública

services/api/prisma/
├── schema.prisma                      # MODIFICADO · OrderStatusEvent.reason, ServiceStatus, AdminAuditLog
└── migrations/
    └── <timestamp>_controles_flujos_criticos/  # NUEVO

services/api/src/
├── common/
│   └── errors.ts                      # MODIFICADO · FORCE_TRANSITION_INVALID, ORDER_ALREADY_TERMINAL, SERVICE_PAUSED
├── orders/
│   ├── orders.service.ts              # MODIFICADO · forzarTransicion(), cerrarAdministrativamente(), chequeo de pausa en confirmar()
│   ├── admin-orders.controller.ts     # NUEVO · cuarto controlador del módulo (D-087)
│   └── orders.module.ts               # MODIFICADO · registra AdminOrdersController, importa AuditModule
└── service-status/
    ├── service-status.service.ts      # NUEVO
    ├── service-status.controller.ts   # NUEVO · admin/service
    └── service-status.module.ts       # NUEVO

apps/web/src/
├── components/
│   └── historial-pedido.tsx           # MODIFICADO · muestra evento.reason cuando existe
└── app/
    └── admin/
        ├── _components/
        │   └── navegacion.tsx         # MODIFICADO · tercer destino "Operaciones"
        ├── pedidos/[id]/
        │   ├── page.tsx               # MODIFICADO · pasa el pedido a las acciones nuevas
        │   └── _components/
        │       ├── forzar-transicion.tsx    # NUEVO · selector de destino + diálogo con motivo
        │       └── cerrar-administrativamente.tsx  # NUEVO · diálogo con motivo
        └── operaciones/
            ├── page.tsx               # NUEVO · estado del servicio + pausar/reanudar
            └── _components/
                └── dialogo-pausa.tsx  # NUEVO

services/api/test/
├── admin-orders-force-transition.integration-spec.ts  # NUEVO
├── admin-orders-close.integration-spec.ts              # NUEVO · incluye la carrera de FR-016
└── service-status.integration-spec.ts                  # NUEVO · incluye el bloqueo de POST /orders
```

**Decisión de estructura**: `AdminOrdersController` se agrega como cuarto
controlador de `OrdersModule` (D-087), mismo patrón que
`DeliveryOrdersController` en E5 — ninguna transición nueva sobre `Order`
justifica un módulo propio. `service-status` es un módulo nuevo porque no
hay ningún `Order` involucrado en pausar/reanudar. La pantalla de
`/admin/pedidos/[id]` reutiliza `HistorialPedido` (E4, D-051) sin tocar su
estructura para las tres pantallas de detalle: solo agrega, dentro de la
misma página del administrador, los dos componentes de acción nuevos.

## Fases de entrega

### Fase A · Cimientos (habilitante)

Migración (`reason` en `order_status_event`, tabla `service_status`, columnas
de `admin_audit_log`), las tres funciones/esquemas nuevos de
`packages/shared` (`transicionesForzablesPorAdmin`,
`puedeCerrarseAdministrativamente`, `ForceOrderTransitionSchema`,
`AdminCloseOrderSchema`, `PauseServiceSchema`), los cuatro mensajes nuevos y
`OrderStatusEventDto.reason`/`ServiceStatusDto`.

### Fase B · Historia 1 — Forzar el avance de un pedido atascado (P1, MVP)

`PUT /admin/orders/:id/force-transition`, `OrdersService.forzarTransicion()`,
`admin-orders.controller.ts`, componente `forzar-transicion.tsx` en
`/admin/pedidos/[id]`. Cubre FR-001, FR-002, FR-005 a FR-008.

### Fase C · Historia 2 — Cerrar administrativamente un pedido atascado (P2)

`PUT /admin/orders/:id/close`, `OrdersService.cerrarAdministrativamente()`,
componente `cerrar-administrativamente.tsx`. Cubre FR-003 a FR-008.

### Fase D · Historia 3 — Pausar y reanudar el servicio (P3)

Módulo `service-status` completo (servicio, controlador, tres endpoints),
pantalla `/admin/operaciones`, tercer destino en `NavegacionAdmin`, y el
chequeo nuevo al inicio de `OrdersService.confirmar()`. Cubre FR-009 a
FR-013, FR-018.

### Fase E · Bitácora, trazabilidad y validación funcional

Extensión de `AdminAuditLog`/`AdminAction` para `PAUSAR_SERVICIO`/
`REANUDAR_SERVICIO` (FR-014, FR-015), extensión de `HistorialPedido` para
mostrar `evento.reason` (FR-008 en la parte de visibilidad). Ejecutar
`quickstart.md` completo (SC-001 a SC-008) con un administrador y un
cliente reales, incluida la condición de carrera de dos intervenciones
administrativas simultáneas.

## Complexity Tracking

La puerta constitucional pasa sin violaciones que justificar más allá de la
enmienda ya aplicada y documentada en su propio Sync Impact Report. No hay
tabla de excepciones.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Que `forzarTransicion()` permita al administrador disparar la retroceso `asignado_repartidor → en_preparacion`, invadiendo una acción reservada al repartidor (Principio XII) | Alto: violaría la restricción de rol de la enmienda 3.0.0 | `transicionesForzablesPorAdmin()` excluye explícitamente esa arista (D-083); prueba unitaria dedicada que verifica la exclusión para ese par exacto |
| Que las cuatro aristas de la enmienda 4.0.0 se agreguen a `SIGUIENTE`, colapsando Historia 1 e Historia 2 | Alto: un administrador podría "forzar" directamente a `cerrado` saltándose pasos, sin pasar por `cerrarAdministrativamente()` | `SIGUIENTE` permanece sin cambios (D-083); revisión de código explícita en la Fase A antes de continuar |
| Que `confirmar()` no revierta nada si el chequeo de pausa se agrega después de alguna escritura ya realizada | Medio: un pedido parcial durante una pausa | El chequeo es el primer paso de la transacción existente (D-088), antes de tocar el carrito — mismo lugar que ya usan las demás validaciones de `confirmar()` |
| Que dos administradores forzando/cerrando el mismo pedido casi al mismo tiempo produzcan un historial inconsistente | Alto: violaría el historial íntegro del Principio XII | Escritura condicionada (`updateMany` con el estado exacto leído antes) igual que el resto de las transiciones del proyecto; prueba de integración específica de la carrera (FR-016) |
| Que `AdminAuditLog.targetUserId` nulable rompa alguna consulta existente que asuma `NOT NULL` (E1, HU-09) | Medio: `UsersService` no compilaría o fallaría en runtime | `UsersService` sigue escribiendo `targetUserId` siempre (nunca lo omite); revisar en la Fase A que ningún `select`/`include` existente dependa de la restricción `NOT NULL` a nivel de tipo |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Migración, funciones de `machine.ts`, esquemas, mensajes, DTOs nuevos | A |
| FR-001, FR-002, FR-005 a FR-008 (parcial, Historia 1) | B |
| FR-003 a FR-008 (parcial, Historia 2) | C |
| FR-009 a FR-013, FR-018 | D |
| FR-008 (visibilidad completa), FR-014, FR-015, FR-016, FR-017; SC-001 a SC-008 | E |

Los ocho criterios de éxito se trazan uno a uno en `quickstart.md`.
