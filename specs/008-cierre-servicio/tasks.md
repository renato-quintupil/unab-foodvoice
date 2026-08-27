---
description: "Lista de tareas de implementación: E7 · Cierre del servicio"
---

# Tareas: E7 · Cierre del servicio (Cierre digital del servicio)

**Entrada**: documentos de diseño de `specs/008-cierre-servicio/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).
Sin requisito de versión de constitución nueva: E7 no necesita ninguna enmienda (a diferencia de
E5), las dos transiciones ya estaban declaradas en el Principio XII desde su redacción original.

**Pruebas**: se incluyen obligatoriamente, igual que en E1–E6. El Principio XI exige especificar
antes de programar; la condición de carrera de confirmar/reclamar simultáneos (FR-013) es la
única lógica realmente nueva de esta épica y se prueba con integración real contra PostgreSQL,
no con mocks.

**Organización**: una fase por historia, en orden de prioridad: repartidor marca entregado (P1) →
cliente confirma (P2) → cliente reclama (P3). E7 sí tiene fase de migración: una columna nulable
nueva en `Order` (`complaint_reason`).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: Historia 1 · Repartidor marca un pedido como entregado (P1).
- **[US2]**: Historia 2 · Cliente confirma que su pedido llegó bien (P2).
- **[US3]**: Historia 3 · Cliente reclama por un problema con su pedido (P3).

## Convenciones de ruta

El monorepo existente usa `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
pruebas de integración viven en `services/api/test/*.integration-spec.ts` contra PostgreSQL; las
de componente en `apps/web/tests/*.test.tsx`. Sin variable de entorno nueva.

---

## Fase 1: Preparación

**Propósito**: obtener una línea base verificable sin alterar E1–E6, antes de tocar el esquema.

- [X] T001 Ejecutar la línea base de `specs/008-cierre-servicio/quickstart.md` —`pnpm test`,
  `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el resultado
  y detener la implementación si existe un fallo preexistente

---

## Fase 2: Cimientos bloqueantes

**Propósito**: el esquema, los mensajes y el DTO compartido que las tres historias necesitan.
Ninguna historia puede empezar sin esto.

**⚠️ CRÍTICO**: ninguna historia empieza hasta completar esta fase.

- [X] T002 Añadir `complaintReason` (nullable, `text`) al modelo `Order` en
  `services/api/prisma/schema.prisma` (según `data-model.md`)
- [X] T003 Generar con `prisma migrate dev --create-only` el archivo
  `services/api/prisma/migrations/<timestamp>_cierre_servicio/migration.sql` a partir de T002
  (depende de T002)
- [X] T004 [P] Añadir `ComplainOrderSchema` (mismo molde que `RejectOrderSchema`) en
  `packages/shared/src/schemas/order.ts` (según `contracts/shared.md`)
- [X] T005 [P] Añadir `MSG_MOTIVO_RECLAMO_REQUERIDO` y `MSG_PEDIDO_NO_ENTREGADO` en
  `packages/shared/src/messages/es.ts`
- [X] T006 [P] Añadir `complaintReason: string | null` a `OrderSummaryDto` en
  `packages/shared/src/types/api.ts` (D-073)
- [X] T007 Exportar `ComplainOrderSchema`, `ComplainOrderInput` y los dos mensajes nuevos desde
  `packages/shared/src/index.ts` (depende de T004, T005)
- [X] T008 Añadir `ErrorCode.ORDER_NOT_DELIVERED` al catálogo cerrado de
  `services/api/src/common/errors.ts`, con su función constructora `pedidoNoEntregado()`
  devolviendo `409` con `MSG_PEDIDO_NO_ENTREGADO` (D-076, depende de T005)
- [X] T009 Actualizar `aDto()` en `services/api/src/orders/orders.service.ts` para incluir
  `complaintReason: pedido.complaintReason` en el mapeo a `OrderSummaryDto` (depende de T006)

**Punto de control**: `packages/shared` compila, la migración aplica en limpio
(`pnpm --filter api db:migrate`), y `OrderSummaryDto` expone `complaintReason` en cualquier
respuesta existente (siempre `null` hasta que exista la Historia 3). Las historias pueden
comenzar.

---

## Fase 3: Historia de Usuario 1 — Repartidor marca un pedido como entregado (P1) 🎯 MVP

**Objetivo**: el repartidor marca como entregado el pedido que tiene en curso, quedando libre
para tomar otro.

**Prueba independiente**: con un repartidor que tiene un pedido en `asignado_repartidor`, se
completan V-01 y V-02 de `quickstart.md`: marcarlo entregado y comprobar que un segundo intento
sobre el mismo pedido falla.

### Pruebas de US1

> **NOTA: escribir estas pruebas primero y comprobar que fallan antes de implementar.**

- [X] T010 [P] [US1] Crear las pruebas fallidas de `PUT /delivery/orders/:id/deliver` en
  `services/api/test/delivery-orders-deliver.integration-spec.ts`: transiciona a `entregado` y
  registra el evento de historial con el repartidor como actor; el repartidor queda sin ningún
  pedido en curso tras la transición; `404 NOT_FOUND` si no existe; `409
  DELIVERY_ORDER_NOT_YOURS` si el pedido no está asignado a ese repartidor en
  `asignado_repartidor` (incluido un segundo intento sobre el mismo pedido ya entregado); `403
  FORBIDDEN` con sesión de `NEGOCIO` o `CLIENTE`

### Implementación de US1

- [X] T011 [US1] Añadir `entregar(id, repartidorId)` en
  `services/api/src/orders/orders.service.ts`: dentro de una transacción, `updateMany({ where:
  { id, status: ASIGNADO_REPARTIDOR, deliveryUserId: repartidorId }, data: { status: ENTREGADO }
  })` (sin limpiar `deliveryUserId`, D-074); si `count === 0`, relee para distinguir
  `noEncontrado()` de `pedidoNoAsignadoATi()` (reutilizado de E5, D-075); llama a
  `registrarEvento` con `previousStatus: ASIGNADO_REPARTIDOR, resultingStatus: ENTREGADO,
  actorRole: Role.REPARTIDOR` (FR-001 a FR-004, depende de T002)
- [X] T012 [US1] Añadir `PUT /:id/deliver` en
  `services/api/src/orders/delivery-orders.controller.ts`, delegando a `entregar` con el
  `userId` de la sesión (depende de T011)
- [X] T013 [US1] Crear `apps/web/src/app/repartidor/_components/boton-entregar.tsx`: acción
  directa de un clic (sin diálogo, D-080), llama a `PUT /delivery/orders/:id/deliver` y refresca
  (mismo patrón que `boton-tomar.tsx` de E5) (depende de T012)
- [X] T014 [US1] Integrar `BotonEntregar` en
  `apps/web/src/app/repartidor/_components/pedido-en-curso.tsx`, junto a `BotonSoltar` (depende
  de T013)

**Punto de control**: un repartidor puede marcar su pedido en curso como entregado y queda libre
de inmediato para tomar otro. US1 es demostrable por sí sola.

---

## Fase 4: Historia de Usuario 2 — Cliente confirma que su pedido llegó bien (P2)

**Objetivo**: el cliente cierra sin comentarios un pedido propio en `entregado`.

**Prueba independiente**: con un cliente que tiene un pedido en `entregado` (Historia 1 ya
completada sobre él), se completan V-03, V-08 y V-09 de `quickstart.md`: confirmar, y comprobar
que no puede hacerlo sobre un pedido que no está entregado o que no es suyo.

### Pruebas de US2

- [X] T015 [P] [US2] Crear las pruebas fallidas de `PUT /orders/:id/confirm` en
  `services/api/test/orders-close-confirm.integration-spec.ts`: transiciona de `entregado` a
  `cerrado` sin `complaintReason` y registra el evento con el cliente como actor; `404 NOT_FOUND`
  si no existe o no es del cliente autenticado; `409 ORDER_NOT_DELIVERED` si el pedido no está en
  `entregado` (incluido uno ya `cerrado`); `403 FORBIDDEN` con sesión de `NEGOCIO` o
  `REPARTIDOR`

### Implementación de US2

- [X] T016 [US2] Añadir `cerrar(id, clienteId, complaintReason)` en
  `services/api/src/orders/orders.service.ts`: dentro de una transacción, `updateMany({ where:
  { id, status: ENTREGADO, userId: clienteId }, data: { status: CERRADO, complaintReason } })`;
  si `count === 0`, relee — si no existe o `userId` no coincide, `noEncontrado()` (mismo criterio
  de FR-005 de E4); si existe y es del cliente pero no está en `entregado`, `pedidoNoEntregado()`
  (D-076); llama a `registrarEvento` con `previousStatus: ENTREGADO, resultingStatus: CERRADO,
  actorRole: Role.CLIENTE` (FR-005, FR-006, FR-009, depende de T008, T009)
- [X] T017 [US2] Añadir `PUT /:id/confirm` en `services/api/src/orders/orders.controller.ts`,
  delegando a `cerrar(id, peticion.sesion.userId, null)` (depende de T016)
- [X] T018 [US2] Crear
  `apps/web/src/app/cliente/pedidos/_components/boton-confirmar-cierre.tsx`: acción directa de
  un clic (sin diálogo, D-080), llama a `PUT /orders/:id/confirm` y refresca (depende de T017)
- [X] T019 [US2] En `apps/web/src/app/cliente/pedidos/page.tsx`, mostrar `BotonConfirmarCierre`
  cuando `pedido.status === 'entregado'` (depende de T018)

**Punto de control**: un cliente puede confirmar un pedido entregado en 1 clic y verlo cerrado.
US1 y US2 funcionan de forma independiente.

---

## Fase 5: Historia de Usuario 3 — Cliente reclama por un problema con su pedido (P3)

**Objetivo**: el cliente cierra un pedido propio en `entregado` dejando un motivo de reclamo.

**Prueba independiente**: con un cliente que tiene un pedido en `entregado`, se completan V-05 a
V-07 y V-10 de `quickstart.md`: reclamar con motivo, rechazar el reclamo sin motivo, ver el
reclamo en la trazabilidad del negocio, y comprobar la condición de carrera con la confirmación.

### Pruebas de US3

- [X] T020 [P] [US3] Crear las pruebas fallidas de `PUT /orders/:id/complain` en
  `services/api/test/orders-close-complain.integration-spec.ts`: transiciona de `entregado` a
  `cerrado` con el `complaintReason` guardado y registra el evento; `400 VALIDATION_ERROR` si el
  motivo está ausente, es demasiado corto o es solo espacios en blanco; `404 NOT_FOUND` si no
  existe o no es del cliente; `409 ORDER_NOT_DELIVERED` si no está en `entregado`; `403
  FORBIDDEN` con sesión de `NEGOCIO` o `REPARTIDOR`
- [X] T021 [P] [US3] Crear la prueba fallida de concurrencia real en
  `services/api/test/orders-close-race.integration-spec.ts`: confirmar y reclamar el mismo
  pedido en `entregado` casi al mismo tiempo — exactamente una de las dos acciones tiene éxito,
  la otra recibe `409 ORDER_NOT_DELIVERED`, sin duplicar el efecto ni dejar dos entradas de
  historial para la misma transición (FR-013, SC-005)

### Implementación de US3

- [X] T022 [US3] Añadir `PUT /:id/complain` en `services/api/src/orders/orders.controller.ts`,
  validando el cuerpo con `ComplainOrderSchema` y delegando a `cerrar(id,
  peticion.sesion.userId, datos.reason)` (FR-007, FR-008, depende de T004, T016)
- [X] T023 [US3] Crear `apps/web/src/app/cliente/pedidos/_components/dialogo-reclamo.tsx`: el
  motivo se exige dentro del mismo diálogo de confirmación, mismo patrón que
  `dialogo-rechazo.tsx` de E2, llamando a `PUT /orders/:id/complain` con `{ reason }` (depende de
  T022)
- [X] T024 [US3] En `apps/web/src/app/cliente/pedidos/page.tsx`, mostrar `DialogoReclamo` junto a
  `BotonConfirmarCierre` cuando `pedido.status === 'entregado'` (FR-010, depende de T019, T023)

**Punto de control**: las tres historias funcionan de forma independiente y completa.

---

## Fase Final: Visibilidad del negocio, trazabilidad, validación funcional y cierre

**Propósito**: mostrar el reclamo donde ya se muestra el motivo de rechazo, darle al negocio un
camino hasta un pedido `cerrado` (hallazgo C1 de `/speckit.analyze` — sin él, FR-011/SC-004 no
eran verificables), cerrar la épica con la validación manual y actualizar el estado del
producto.

- [X] T025 [P] Extender `apps/web/src/components/historial-pedido.tsx` (E4, D-051): cuando el
  último evento sea `CERRADO` y `pedido.complaintReason` exista, mostrar "Reclamo: {motivo}",
  simétrico a la condición ya existente para `rejectionReason` (FR-011, D-078, depende de T009)
- [X] T026 [P] Extender `apps/web/src/app/cliente/pedidos/page.tsx`: mostrar
  `pedido.complaintReason` con el mismo bloque condicional que ya muestra `pedido.rejectionReason`
  (FR-010, hallazgo C2 de `/speckit.analyze`, depende de T009)
- [X] T027 [P] Añadir `MSG_SIN_PEDIDOS_CERRADOS` en `packages/shared/src/messages/es.ts` y
  exportarla desde `packages/shared/src/index.ts` (D-081, hallazgo C1)
- [X] T028 Añadir `cerradosDelNegocio()` en `services/api/src/orders/orders.service.ts`: mismo
  molde que `rechazadosDelNegocio()` — `findMany({ where: { status: CERRADO }, orderBy: {
  createdAt: 'desc' } })`, sin paginar (D-081, depende de T009)
- [X] T029 Añadir `GET /closed` en `services/api/src/orders/business-orders.controller.ts`,
  delegando a `cerradosDelNegocio` (D-081, depende de T028)
- [X] T030 Crear `apps/web/src/app/negocio/pedidos/cerrados/page.tsx`: mismo patrón que
  `apps/web/src/app/negocio/pedidos/rechazados/page.tsx` — pide `GET /business/orders/closed`,
  muestra `MSG_SIN_PEDIDOS_CERRADOS` si está vacía, y enlaza cada pedido a
  `/negocio/pedidos/:id` (D-081, depende de T027, T029)
- [X] T031 Añadir el enlace "Ver cerrados" en `apps/web/src/app/negocio/pedidos/page.tsx`, junto
  al que ya existe hacia "Ver rechazados" (D-081, depende de T030)
- [X] T032 [P] Crear `services/api/test/business-orders-closed.integration-spec.ts`: `GET
  /business/orders/closed` devuelve solo pedidos `cerrado`, `items: []` cuando no hay ninguno, y
  `403` para roles distintos de `NEGOCIO` (D-081, depende de T029)
- [X] T033 [P] Crear `services/api/test/orders-close-trazabilidad.integration-spec.ts`: tras
  entregar y cerrar (confirmando o reclamando) un pedido, `GET /orders/:id` y `GET
  /business/orders/:id` muestran ambas entradas nuevas en orden cronológico y, cuando
  corresponde, el motivo del reclamo — sin ningún cambio de contrato de E4 (FR-014, SC-006)
- [X] T034 Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm
  build`; deben pasar en verde antes de la validación manual
- [X] T035 Recorrer V-01 a V-10 de `specs/008-cierre-servicio/quickstart.md` con sesiones reales
  de cliente, negocio y repartidor; registrar el resultado en
  `specs/008-cierre-servicio/verificacion.md`
- [X] T036 Actualizar `specs/README.md` y `CLAUDE.md` (§ Estado del código) para reflejar E7
  como terminada, con el mismo nivel de detalle que E1–E6

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias — puede iniciar de inmediato.
- **Cimientos (Fase 2)**: depende de la Fase 1 — bloquea las tres historias. Incluye la
  migración: sin ella no hay dónde escribir `complaint_reason`.
- **Historias de usuario (Fase 3+)**: todas dependen de la Fase 2.
  - US2 depende de que exista un pedido en `entregado`, que solo produce US1 — por eso se
    implementa después, aunque su propio servicio (`cerrar`) no reutilice código de escritura de
    US1.
  - US3 reutiliza `cerrar()` de US2 casi sin cambios (el mismo método, con `complaintReason` no
    nulo) — depende de T016, no solo de la Fase 2.
- **Fase Final**: depende de que las tres historias estén completas. T028–T031 (lista "cerrados"
  del negocio) solo necesitan que exista al menos un pedido `cerrado`, así que en la práctica
  dependen de que US2 o US3 hayan producido uno, no de que las tres estén "terminadas" en el
  sentido de código — pero se agrupan aquí porque nacieron como hallazgo de `/speckit.analyze`
  sobre el conjunto completo, no como parte de ninguna historia individual.

### Dependencias dentro de cada historia

- Pruebas antes que implementación (deben fallar primero).
- Servicio antes que controlador; controlador antes que componente de interfaz; componente antes
  de integrarlo en la página.

### Oportunidades de paralelismo

- T004, T005, T006 (esquema, mensajes, DTO) tocan archivos distintos de `packages/shared` y son
  paralelizables entre sí, apenas termine T003.
- T008 (catálogo de errores en `services/api`) depende de T005 (usa `MSG_PEDIDO_NO_ENTREGADO`) —
  no se ejecuta en paralelo con ella, mismo criterio que aplicó E5 (F1 de su `/speckit.analyze`).
- Las pruebas de cada historia (T015, T020+T021) son paralelizables entre sí dentro de su fase.
- T025, T026 y T027 (interfaz de trazabilidad del cliente, interfaz de la lista del negocio,
  mensaje nuevo) tocan archivos distintos y son paralelizables entre sí.
- T032 y T033 (pruebas de integración de la lista "cerrados" y de trazabilidad) son
  paralelizables entre sí.

---

## Ejemplo de ejecución en paralelo: Fase 2 (Cimientos)

```bash
# Tras T003 (migración generada), en paralelo:
Task: "Añadir ComplainOrderSchema en packages/shared/src/schemas/order.ts"
Task: "Añadir los dos mensajes nuevos en packages/shared/src/messages/es.ts"
Task: "Añadir complaintReason a OrderSummaryDto en packages/shared/src/types/api.ts"

# Recién después de que termine el mensaje anterior (T005):
Task: "Añadir ORDER_NOT_DELIVERED en services/api/src/common/errors.ts"
```

---

## Estrategia de implementación

### MVP primero (solo Historia 1)

1. Completar Fase 1: Preparación.
2. Completar Fase 2: Cimientos (bloqueante, incluye la migración).
3. Completar Fase 3: Historia 1 (repartidor marca entregado).
4. **Detenerse y validar**: V-01 y V-02 de `quickstart.md` de forma independiente.
5. Demostrar si corresponde antes de continuar con confirmar y reclamar.

### Entrega incremental

1. Preparación + Cimientos → base lista.
2. Historia 1 (repartidor entrega) → validar de forma independiente → demostrar (MVP).
3. Historia 2 (cliente confirma) → validar de forma independiente → demostrar.
4. Historia 3 (cliente reclama) → validar de forma independiente → demostrar.
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
