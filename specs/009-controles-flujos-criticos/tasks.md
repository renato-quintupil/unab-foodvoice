---
description: "Lista de tareas de implementación: E8 · Controles y administración"
---

# Tareas: E8 · Controles y administración (Controles de flujos críticos)

**Entrada**: documentos de diseño de `specs/009-controles-flujos-criticos/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).
Requiere la constitución en **v4.0.0**: la enmienda del Principio XII (séptima transición,
cierre administrativo) ya se aplicó antes de este plan, durante `/speckit.clarify`.

**Pruebas**: se incluyen obligatoriamente, igual que en E1–E7. El Principio XI exige especificar
antes de programar; la condición de carrera de dos intervenciones administrativas simultáneas
sobre el mismo pedido (FR-016) es la única lógica realmente nueva de la Historia 2 y se prueba
con integración real contra PostgreSQL, no con mocks — mismo criterio que ya usó E2/E5/E7.

**Organización**: una fase por historia, en orden de prioridad: forzar transición (P1) → cerrar
administrativamente (P2) → pausar/reanudar el servicio (P3). E8 sí tiene fase de migración:
columna nueva en `order_status_event`, tabla nueva `service_status`, y dos columnas modificadas
más dos valores de enum nuevos en `admin_audit_log`.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: Historia 1 · Forzar el avance de un pedido atascado (P1).
- **[US2]**: Historia 2 · Cerrar administrativamente un pedido atascado (P2).
- **[US3]**: Historia 3 · Pausar y reanudar el servicio (P3).

## Convenciones de ruta

El monorepo existente usa `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
pruebas de integración viven en `services/api/test/*.integration-spec.ts` contra PostgreSQL; las
unitarias de `packages/shared` en `packages/shared/src/**/*.spec.ts`. Sin variable de entorno
nueva.

---

## Fase 1: Preparación

**Propósito**: obtener una línea base verificable sin alterar E1–E7, antes de tocar el esquema.

- [ ] T001 Ejecutar la línea base de `specs/009-controles-flujos-criticos/quickstart.md` —`pnpm
  test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el
  resultado y detener la implementación si existe un fallo preexistente

---

## Fase 2: Cimientos bloqueantes

**Propósito**: el esquema, las funciones de máquina de estados, los esquemas Zod, los mensajes y
los DTOs compartidos que las tres historias necesitan. Ninguna historia puede empezar sin esto.

**⚠️ CRÍTICO**: ninguna historia empieza hasta completar esta fase.

- [ ] T002 Añadir `reason` (nullable, `text`) al modelo `OrderStatusEvent` en
  `services/api/prisma/schema.prisma` (D-082, según `data-model.md`)
- [ ] T003 Añadir el modelo `ServiceStatus` (`id` fijo `'singleton'`, `paused`, `pauseReason`,
  `pausedAt`, `pausedByUserId`) en `services/api/prisma/schema.prisma` (D-085)
- [ ] T004 En `services/api/prisma/schema.prisma`: hacer `targetUserId` nulable en
  `AdminAuditLog`, añadir su columna `reason` (nullable), y añadir `PAUSAR_SERVICIO` y
  `REANUDAR_SERVICIO` al enum `AdminAction` (D-084, depende de T002, T003 solo por orden de
  edición del mismo archivo)
- [ ] T005 Generar con `prisma migrate dev --create-only` el archivo
  `services/api/prisma/migrations/<timestamp>_controles_flujos_criticos/migration.sql` a partir
  de T002–T004, agregando manualmente el `INSERT` que siembra la fila única de
  `service_status` (`id = 'singleton'`, `paused = false`) (depende de T002, T003, T004)
- [ ] T006 [P] Añadir `MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO`,
  `MSG_TRANSICION_ADMINISTRATIVA_INVALIDA`, `MSG_PEDIDO_YA_ES_TERMINAL` y
  `MSG_SERVICIO_PAUSADO` en `packages/shared/src/messages/es.ts` (D-086)
- [ ] T007 [P] Añadir `transicionesForzablesPorAdmin(desde)` y
  `puedeCerrarseAdministrativamente(desde)` en `packages/shared/src/order-state/machine.ts`,
  sin modificar `SIGUIENTE` (D-083)
- [ ] T008 [P] Añadir `ForceOrderTransitionSchema` y `AdminCloseOrderSchema` en
  `packages/shared/src/schemas/order.ts` (depende de T006 por el mensaje que usan)
- [ ] T009 [P] Crear `packages/shared/src/schemas/service-status.ts` con `PauseServiceSchema`
  (depende de T006)
- [ ] T010 [P] Añadir `reason: string | null` a `OrderStatusEventDto` y crear `ServiceStatusDto`
  en `packages/shared/src/types/api.ts`
- [ ] T011 Exportar `transicionesForzablesPorAdmin`, `puedeCerrarseAdministrativamente`,
  `ForceOrderTransitionSchema`, `AdminCloseOrderSchema`, `PauseServiceSchema`,
  `ServiceStatusDto` y los cuatro mensajes nuevos desde `packages/shared/src/index.ts` (depende
  de T006, T007, T008, T009, T010)
- [ ] T012 Añadir `ErrorCode.FORCE_TRANSITION_INVALID`, `ErrorCode.ORDER_ALREADY_TERMINAL` y
  `ErrorCode.SERVICE_PAUSED` al catálogo cerrado de `services/api/src/common/errors.ts`, con sus
  funciones constructoras `transicionAdministrativaInvalida()`, `pedidoYaEsTerminal()` y
  `servicioPausado()` devolviendo `409` (depende de T006, T011)
- [ ] T013 Actualizar el helper `registrarEvento()` en `services/api/src/orders/orders.service.ts`
  para aceptar un `reason?: string | null` opcional y escribirlo en `OrderStatusEvent.create`;
  actualizar `aDetalleDto()` para incluir `reason: evento.reason` en el mapeo a
  `OrderStatusEventDto` (depende de T002, T010, T011)

**Punto de control**: `packages/shared` compila, la migración aplica en limpio
(`pnpm --filter api db:migrate`) y siembra la fila única de `service_status`, y
`OrderStatusEventDto.reason` viaja en cualquier respuesta existente (siempre `null` hasta que
exista una intervención administrativa). Las historias pueden comenzar.

---

## Fase 3: Historia de Usuario 1 — Forzar el avance de un pedido atascado (P1) 🎯 MVP

**Objetivo**: el administrador fuerza la transición normal siguiente de un pedido, en nombre del
rol que no respondió.

**Prueba independiente**: con un pedido en `creado` sin respuesta del negocio, se completan V-01
a V-03 de `quickstart.md`: forzar la transición a `en_preparacion`, ver el motivo en la
trazabilidad, y comprobar que no puede forzar la retroceso reservada al repartidor.

### Pruebas de US1

> **NOTA: escribir estas pruebas primero y comprobar que fallan antes de implementar.**

- [ ] T014 [P] [US1] Crear las pruebas fallidas de `PUT /admin/orders/:id/force-transition` en
  `services/api/test/admin-orders-force-transition.integration-spec.ts`: transiciona un pedido
  en `creado` a `en_preparacion` y registra el evento con el administrador como actor y el
  motivo (FR-001, FR-002); transiciona `asignado_repartidor` a `entregado` correctamente;
  `409 FORCE_TRANSITION_INVALID` al intentar `asignado_repartidor → en_preparacion` (retroceso
  reservada al repartidor, D-083) y al intentar cualquier transición sobre un pedido ya
  `cerrado`/`rechazado`; `404 NOT_FOUND` si no existe; `400 VALIDATION_ERROR` con motivo ausente
  o solo espacios; `403 FORBIDDEN` con sesión de `CLIENTE`, `NEGOCIO` o `REPARTIDOR`

### Implementación de US1

- [ ] T015 [US1] Añadir `forzarTransicion(id, adminId, hacia, reason)` en
  `services/api/src/orders/orders.service.ts`: lee el pedido, valida
  `transicionesForzablesPorAdmin(pedido.status).includes(hacia)` o lanza
  `transicionAdministrativaInvalida()`; dentro de una transacción, `updateMany({ where: { id,
  status: pedido.status }, data: { status: hacia } })`; si `count === 0`, relee y distingue
  `noEncontrado()` de `transicionAdministrativaInvalida()` (carrera perdida); llama a
  `registrarEvento` con `previousStatus: pedido.status, resultingStatus: hacia, actorRole:
  Role.ADMINISTRADOR, reason` (FR-001, FR-002, FR-005 a FR-007, depende de T007, T012, T013)
- [ ] T016 [US1] Crear `services/api/src/orders/admin-orders.controller.ts` con
  `@Controller('admin/orders')`, `@Roles(Role.ADMINISTRADOR)`, y `PUT :id/force-transition`
  validando el cuerpo con `ForceOrderTransitionSchema` y delegando a `forzarTransicion` (depende
  de T008, T015)
- [ ] T017 [US1] Registrar `AdminOrdersController` en
  `services/api/src/orders/orders.module.ts` como cuarto controlador del módulo (D-087, depende
  de T016)
- [ ] T018 [US1] Crear
  `apps/web/src/app/admin/pedidos/[id]/_components/forzar-transicion.tsx`: selector de estado
  destino (los que la interfaz ofrezca como razonables para el estado actual) + diálogo con
  campo de motivo obligatorio, mismo patrón que `dialogo-rechazo.tsx` de E2, llamando a `PUT
  /admin/orders/:id/force-transition` (depende de T017)
- [ ] T019 [US1] Integrar `ForzarTransicion` en `apps/web/src/app/admin/pedidos/[id]/page.tsx`,
  visible solo cuando el pedido no está en un estado terminal (depende de T018)

**Punto de control**: un administrador puede forzar el avance de un pedido atascado y ver el
motivo en su trazabilidad. US1 es demostrable por sí sola.

---

## Fase 4: Historia de Usuario 2 — Cerrar administrativamente un pedido atascado (P2)

**Objetivo**: el administrador cierra un pedido en cualquier estado no terminal, fuera del
camino normal, usando la séptima transición de la enmienda constitucional 4.0.0.

**Prueba independiente**: con un pedido atascado en `en_preparacion` o `asignado_repartidor`, se
completan V-04 a V-06 de `quickstart.md`: cerrar administrativamente, comprobar que un segundo
intento falla, y que el motivo es obligatorio.

### Pruebas de US2

- [ ] T020 [P] [US2] Crear las pruebas fallidas de `PUT /admin/orders/:id/close` en
  `services/api/test/admin-orders-close.integration-spec.ts`: cierra administrativamente un
  pedido en `creado`, `en_preparacion`, `asignado_repartidor` y `entregado`, cada uno a
  `cerrado`, con el motivo registrado en el historial (FR-003, FR-004); `409
  ORDER_ALREADY_TERMINAL` sobre un pedido ya `cerrado` o `rechazado`; `400 VALIDATION_ERROR` con
  motivo ausente o solo espacios; `403 FORBIDDEN` con sesión de `CLIENTE`, `NEGOCIO` o
  `REPARTIDOR`; y la condición de carrera real (FR-016): dos llamadas casi simultáneas —cerrar
  administrativamente y, en paralelo, una acción normal del rol correspondiente sobre el mismo
  pedido— dejan exactamente un ganador y ninguna entrada de historial duplicada ni inconsistente

### Implementación de US2

- [ ] T021 [US2] Añadir `cerrarAdministrativamente(id, adminId, reason)` en
  `services/api/src/orders/orders.service.ts`: lee el pedido, valida
  `puedeCerrarseAdministrativamente(pedido.status)` o lanza `pedidoYaEsTerminal()`; dentro de una
  transacción, `updateMany({ where: { id, status: pedido.status }, data: { status: CERRADO } })`;
  si `count === 0`, relee y distingue `noEncontrado()` de `pedidoYaEsTerminal()` (carrera
  perdida); llama a `registrarEvento` con `previousStatus: pedido.status, resultingStatus:
  CERRADO, actorRole: Role.ADMINISTRADOR, reason` (FR-003, FR-004, FR-006 a FR-007, depende de
  T007, T012, T013)
- [ ] T022 [US2] Añadir `PUT :id/close` en
  `services/api/src/orders/admin-orders.controller.ts`, validando el cuerpo con
  `AdminCloseOrderSchema` y delegando a `cerrarAdministrativamente` (depende de T008, T021)
- [ ] T023 [US2] Crear
  `apps/web/src/app/admin/pedidos/[id]/_components/cerrar-administrativamente.tsx`: diálogo con
  campo de motivo obligatorio, mismo patrón que `forzar-transicion.tsx`, llamando a `PUT
  /admin/orders/:id/close` (depende de T022)
- [ ] T024 [US2] Integrar `CerrarAdministrativamente` en
  `apps/web/src/app/admin/pedidos/[id]/page.tsx`, junto a `ForzarTransicion`, visible solo
  cuando el pedido no está en un estado terminal (depende de T019, T023)

**Punto de control**: un administrador puede cerrar administrativamente un pedido atascado en
cualquier estado no terminal. US1 y US2 funcionan de forma independiente.

---

## Fase 5: Historia de Usuario 3 — Pausar y reanudar el servicio (P3)

**Objetivo**: el administrador pausa el servicio completo, impidiendo confirmar pedidos nuevos
sin afectar los ya en curso, y lo reanuda cuando corresponde.

**Prueba independiente**: se completan V-07 a V-11 de `quickstart.md`: pausar, comprobar que un
cliente no puede confirmar, comprobar que los pedidos ya en curso siguen operables, y reanudar.

### Pruebas de US3

- [ ] T025 [P] [US3] Crear las pruebas fallidas de `services/api/test/service-status.integration-spec.ts`:
  `GET /admin/service/status` devuelve `paused: false` por defecto tras la migración; `PUT
  /admin/service/pause` con motivo deja `paused: true` con ese motivo y registra
  `PAUSAR_SERVICIO` en `AdminAuditLog`; `POST /orders` responde `409 SERVICE_PAUSED` mientras
  está pausado, sin alterar el carrito del cliente (FR-009 a FR-011); un pedido ya
  `en_preparacion` antes de la pausa sigue aceptándose/rechazándose con normalidad; `PUT
  /admin/service/resume` restablece `paused: false` sin exigir motivo y registra
  `REANUDAR_SERVICIO`; `400 VALIDATION_ERROR` al pausar sin motivo; `403 FORBIDDEN` con sesión
  distinta de `ADMINISTRADOR` en las tres rutas

### Implementación de US3

- [ ] T026 [US3] Crear `services/api/src/service-status/service-status.service.ts` con
  `estado()`, `pausar(adminId, reason)` y `reanudar(adminId)`, cada escritura dentro de una
  transacción que también llama a `AuditService.registrar` con `targetUserId: null` y la acción
  correspondiente (D-084, D-085, depende de T004, T005, T011)
- [ ] T027 [US3] Crear `services/api/src/service-status/service-status.controller.ts`
  (`admin/service`, `@Roles(Role.ADMINISTRADOR)`) con `GET status`, `PUT pause` (valida con
  `PauseServiceSchema`) y `PUT resume` (depende de T009, T026)
- [ ] T028 [US3] Crear `services/api/src/service-status/service-status.module.ts`, importando
  `AuditModule`, y registrarlo en `services/api/src/app.module.ts` (depende de T027)
- [ ] T029 [US3] En `OrdersService.confirmar()` (`services/api/src/orders/orders.service.ts`),
  añadir como primer paso de la transacción existente la lectura de `ServiceStatus` (`id:
  'singleton'`) y lanzar `servicioPausado()` si `paused = true`, antes de tocar el carrito
  (FR-010, FR-011, D-088, depende de T003, T012)
- [ ] T030 [US3] Crear `apps/web/src/app/admin/operaciones/page.tsx`: muestra el estado actual
  (`GET /admin/service/status`) y el botón de pausar (abre
  `_components/dialogo-pausa.tsx`, con motivo obligatorio) o reanudar (acción directa de un
  clic, sin diálogo) según corresponda (depende de T028)
- [ ] T031 [US3] Añadir el tercer destino "Operaciones" (con su ícono) a
  `apps/web/src/app/admin/_components/navegacion.tsx`, junto a "Panel" y "Usuarios" (D-089,
  depende de T030)

**Punto de control**: las tres historias funcionan de forma independiente y completa.

---

## Fase Final: Bitácora, trazabilidad, validación funcional y cierre

**Propósito**: mostrar el motivo administrativo donde ya se muestra el historial del pedido,
verificar la exclusión de acciones fuera de alcance, cerrar la épica con la validación manual y
actualizar el estado del producto.

- [ ] T032 [P] Extender `apps/web/src/components/historial-pedido.tsx` (E4, D-051): cuando
  `evento.reason` exista, mostrar "Motivo (intervención administrativa): {motivo}" junto a ese
  evento —sin condicionarlo a que sea el último evento, a diferencia de `rejectionReason`/
  `complaintReason` (FR-008, depende de T013)
- [ ] T033 [P] Crear pruebas unitarias de `transicionesForzablesPorAdmin` y
  `puedeCerrarseAdministrativamente` en
  `packages/shared/src/order-state/machine.spec.ts`: cubrir los seis estados, la exclusión
  explícita de la retroceso, y que ambas funciones devuelven vacío/`false` para `cerrado` y
  `rechazado` (depende de T007)
- [ ] T034 [P] Crear `services/api/test/admin-orders-catalog-exclusion.integration-spec.ts`:
  ningún endpoint de `categories`/`products` admite al rol `ADMINISTRADOR` (FR-017, SC-008)
- [ ] T035 Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm
  build`; deben pasar en verde antes de la validación manual
- [ ] T036 Recorrer V-01 a V-13 de `specs/009-controles-flujos-criticos/quickstart.md` con una
  sesión real de administrador y una de cliente; registrar el resultado en
  `specs/009-controles-flujos-criticos/verificacion.md`
- [ ] T037 Actualizar `specs/README.md` y `CLAUDE.md` (§ Estado del código) para reflejar E8 como
  terminada, con el mismo nivel de detalle que E1–E7

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias — puede iniciar de inmediato.
- **Cimientos (Fase 2)**: depende de la Fase 1 — bloquea las tres historias. Incluye la
  migración: sin ella no hay dónde escribir `reason` ni existe `service_status`.
- **Historias de usuario (Fase 3+)**: todas dependen de la Fase 2.
  - US1 y US2 son independientes entre sí en código (`forzarTransicion` y
    `cerrarAdministrativamente` no se llaman una a la otra), pero comparten el mismo controlador
    nuevo (`admin-orders.controller.ts`) — US2 agrega una ruta al archivo que US1 creó, así que
    en la práctica se implementan en ese orden.
  - US3 no depende de US1 ni US2 en código (módulo y tabla propios), pero se implementa después
    por prioridad (P3) y porque su punto de control final integra las tres en la misma pantalla
    de administrador.
- **Fase Final**: depende de que las tres historias estén completas — T032 necesita que
  `reason` ya se esté escribiendo (US1 o US2), y T036 recorre las tres.

### Dependencias dentro de cada historia

- Pruebas antes que implementación (deben fallar primero).
- Servicio antes que controlador; controlador antes que componente de interfaz; componente antes
  de integrarlo en la página.

### Oportunidades de paralelismo

- T006, T007, T008, T009, T010 (mensajes, máquina de estados, esquemas, DTOs) tocan archivos
  distintos de `packages/shared` y son paralelizables entre sí, apenas termine T005.
- T012 (catálogo de errores en `services/api`) depende de T006/T011 (usa los mensajes nuevos ya
  exportados) — no se ejecuta en paralelo con ellos, mismo criterio que aplicó E7 (D-076).
- Las pruebas de cada historia (T014, T020, T025) son paralelizables entre sí si se abordan antes
  de empezar la implementación de todas las historias, aunque cada una bloquea solo la
  implementación de su propia fase.
- T032, T033 y T034 (interfaz de trazabilidad, pruebas unitarias de `machine.ts`, prueba de
  exclusión de catálogo) tocan archivos distintos y son paralelizables entre sí.

---

## Ejemplo de ejecución en paralelo: Fase 2 (Cimientos)

```bash
# Tras T005 (migración generada), en paralelo:
Task: "Añadir los cuatro mensajes nuevos en packages/shared/src/messages/es.ts"
Task: "Añadir transicionesForzablesPorAdmin y puedeCerrarseAdministrativamente en machine.ts"
Task: "Añadir ForceOrderTransitionSchema y AdminCloseOrderSchema en schemas/order.ts"
Task: "Crear schemas/service-status.ts con PauseServiceSchema"
Task: "Añadir reason a OrderStatusEventDto y crear ServiceStatusDto en types/api.ts"

# Recién después de exportar todo (T011):
Task: "Añadir FORCE_TRANSITION_INVALID, ORDER_ALREADY_TERMINAL, SERVICE_PAUSED en errors.ts"
```

---

## Estrategia de implementación

### MVP primero (solo Historia 1)

1. Completar Fase 1: Preparación.
2. Completar Fase 2: Cimientos (bloqueante, incluye la migración).
3. Completar Fase 3: Historia 1 (forzar transición).
4. **Detenerse y validar**: V-01 a V-03 de `quickstart.md` de forma independiente.
5. Demostrar si corresponde antes de continuar con cerrar administrativamente y pausar.

### Entrega incremental

1. Preparación + Cimientos → base lista.
2. Historia 1 (forzar transición) → validar de forma independiente → demostrar (MVP).
3. Historia 2 (cerrar administrativamente) → validar de forma independiente → demostrar.
4. Historia 3 (pausar/reanudar el servicio) → validar de forma independiente → demostrar.
5. Fase Final → trazabilidad, validación funcional y cierre de la épica.

---

## Notas

- [P] = archivos distintos, sin dependencias entre sí.
- [Historia] traza cada tarea a su historia de usuario.
- Cada historia debe quedar completable y verificable de forma independiente.
- Verificar que las pruebas fallen antes de implementar.
- Confirmar (commit) tras cada tarea o grupo lógico.
- Detenerse en cada punto de control para validar la historia de forma independiente.
- Evitar: tareas vagas, conflictos de archivo entre tareas paralelas, dependencias cruzadas entre
  historias que rompan su independencia.
