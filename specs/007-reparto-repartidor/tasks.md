---
description: "Lista de tareas de implementación: E5 · Reparto"
---

# Tareas: E5 · Reparto (Asignación de pedido a repartidor)

**Entrada**: documentos de diseño de `specs/007-reparto-repartidor/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).
Requiere la constitución en versión **3.0.0** (ya ratificada, Principio XII con la transición de
retroceso `asignado_repartidor → en_preparacion`).

**Pruebas**: se incluyen obligatoriamente, igual que en E1–E4/E6. El Principio XI exige
especificar antes de programar; la condición de carrera (SC-002, SC-003) y "un repartidor, un
pedido a la vez" (SC-004) son la lógica real de esta épica y se prueban con integración real
contra PostgreSQL, no con mocks. En cada fase se escriben las pruebas y se comprueba que fallen
antes de implementar.

**Organización**: una fase por historia, en orden de prioridad: repartidor toma un pedido (P1) →
repartidor consulta su pedido en curso (P2) → repartidor suelta un pedido (P3). E5 sí tiene fase
de migración: dos columnas nuevas en `Order` y un índice único parcial (D-066, D-069).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: Historia 1 · Repartidor toma un pedido disponible (P1).
- **[US2]**: Historia 2 · Repartidor consulta el pedido que tiene en curso (P2).
- **[US3]**: Historia 3 · Repartidor suelta un pedido que no puede completar (P3).

## Convenciones de ruta

El monorepo existente usa `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
pruebas de integración viven en `services/api/test/*.integration-spec.ts` contra PostgreSQL; las
de componente en `apps/web/tests/*.test.tsx`. Sin variable de entorno nueva.

---

## Fase 1: Preparación

**Propósito**: obtener una línea base verificable sin alterar E1–E4/E6/E9, antes de tocar el
esquema.

- [X] T001 Ejecutar la línea base de `specs/007-reparto-repartidor/quickstart.md` —`pnpm test`,
  `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el resultado
  y detener la implementación si existe un fallo preexistente
- [X] T002 [P] Crear la carpeta `apps/web/src/app/repartidor/_components/` vacía, lista para los
  componentes nuevos de la Fase 5

---

## Fase 2: Cimientos bloqueantes

**Propósito**: el esquema, la máquina de estados y los tipos/mensajes compartidos que las tres
historias necesitan. Ninguna historia puede empezar sin esto.

**⚠️ CRÍTICO**: ninguna historia empieza hasta completar esta fase.

- [X] T003 Añadir `deliveryUserId` (nullable, FK a `User`, `onDelete: Restrict`) y `assignedAt`
  (nullable, `timestamptz(3)`) al modelo `Order`, más la relación `deliveryUser` y el índice
  `@@index([status, deliveryUserId])`, en `services/api/prisma/schema.prisma` (según
  `data-model.md`)
- [X] T004 Generar con `prisma migrate dev --create-only` el archivo
  `services/api/prisma/migrations/<timestamp>_reparto/migration.sql` a partir de T003, y agregar
  manualmente el índice único parcial `order_one_active_delivery_per_user_key` sobre
  `delivery_user_id` `WHERE status = 'asignado_repartidor'` (D-069, depende de T003)
- [X] T005 [P] Actualizar `packages/shared/src/order-state/machine.ts`: agregar
  `OrderStatus.EN_PREPARACION` al arreglo de `SIGUIENTE[OrderStatus.ASIGNADO_REPARTIDOR]` y
  reescribir el comentario del archivo para declarar la única excepción de retroceso permitida
  por la constitución v3.0.0
- [X] T006 [P] Añadir `MSG_SIN_PEDIDOS_DISPONIBLES`, `MSG_PEDIDO_YA_NO_DISPONIBLE`,
  `MSG_REPARTIDOR_YA_TIENE_PEDIDO` y `MSG_PEDIDO_NO_ASIGNADO_A_TI` en
  `packages/shared/src/messages/es.ts` (según `contracts/shared.md`)
- [X] T007 [P] Añadir `DeliveryOrderDto = OrderSummaryDto & { customerPhone: string }` en
  `packages/shared/src/types/api.ts` (D-070)
- [X] T008 Exportar los cuatro mensajes nuevos y `DeliveryOrderDto` desde
  `packages/shared/src/index.ts` (depende de T006, T007)
- [X] T009 Añadir `ErrorCode.DELIVERY_ORDER_ALREADY_ASSIGNED`,
  `ErrorCode.DELIVERY_ALREADY_HAS_ORDER` y `ErrorCode.DELIVERY_ORDER_NOT_YOURS` al catálogo
  cerrado de `services/api/src/common/errors.ts`, con sus tres funciones constructoras
  (`pedidoYaNoDisponible()`, `repartidorYaTienePedido()`, `pedidoNoAsignadoATi()`) devolviendo
  `409` con el mensaje correspondiente (depende de T006 — usa sus constantes `MSG_*`)
- [X] T010 Confirmar (sin cambio de código) que `registrarEvento` en
  `services/api/src/orders/orders.service.ts` ya acepta `actorRole: Role` como parámetro
  genérico — E2 nunca lo restringió a `NEGOCIO` — y que admite `Role.REPARTIDOR` sin
  modificación; dejar una nota en el propio comentario del helper señalando que E5 es su primer
  llamador con un rol distinto (D-071)

**Punto de control**: `packages/shared` compila, la migración aplica en limpio
(`pnpm --filter api db:migrate`), y `machine.ts` acepta la transición de retroceso en una prueba
unitaria manual (`esTransicionValida(ASIGNADO_REPARTIDOR, EN_PREPARACION) === true`). Las
historias pueden comenzar.

---

## Fase 3: Historia de Usuario 1 — Repartidor toma un pedido disponible (P1) 🎯 MVP

**Objetivo**: un repartidor ve los pedidos `en_preparacion` sin repartidor asignado y toma uno,
sin que el negocio intervenga.

**Prueba independiente**: con al menos un pedido en `en_preparacion` y dos repartidores, se
completan V-01 a V-05 de `quickstart.md`: ver la lista, tomar un pedido, verificar que
desaparece para el otro repartidor, y comprobar la condición de carrera.

### Pruebas de US1

> **NOTA: escribir estas pruebas primero y comprobar que fallan antes de implementar.**

- [X] T011 [P] [US1] Crear las pruebas fallidas de `GET /delivery/orders/available` en
  `services/api/test/delivery-orders-available.integration-spec.ts`: devuelve solo pedidos
  `en_preparacion` con `deliveryUserId IS NULL`, `items: []` cuando no hay ninguno, `403` para
  roles distintos de `REPARTIDOR`
- [X] T012 [P] [US1] Crear las pruebas fallidas de `PUT /delivery/orders/:id/take` en
  `services/api/test/delivery-orders-take.integration-spec.ts`: transiciona a
  `asignado_repartidor` y registra el evento de historial; `404 NOT_FOUND` si no existe;
  `409 DELIVERY_ORDER_ALREADY_ASSIGNED` si ya no está disponible; `409
  DELIVERY_ALREADY_HAS_ORDER` si el repartidor ya tiene uno en curso; `403 FORBIDDEN` con
  sesión de `NEGOCIO` o `CLIENTE` (FR-010)
- [X] T013 [P] [US1] Crear la prueba fallida de concurrencia real en
  `services/api/test/delivery-orders-race.integration-spec.ts`: dos solicitudes `PUT
  .../:id/take` simultáneas de dos repartidores distintos sobre el mismo pedido — exactamente
  una tiene éxito (SC-003); y dos solicitudes simultáneas del mismo repartidor sobre dos pedidos
  distintos — exactamente una tiene éxito, respaldada por el índice único parcial de T004 (SC-004)

### Implementación de US1

- [X] T014 [US1] Añadir `disponiblesParaRepartidor()` en
  `services/api/src/orders/orders.service.ts`: `findMany` con `status: EN_PREPARACION,
  deliveryUserId: null`, mapeado a `OrderSummaryDto[]` (FR-001, depende de T003)
- [X] T015 [US1] Añadir `tomar(id, repartidorId)` en `services/api/src/orders/orders.service.ts`:
  dentro de una transacción, `updateMany({ where: { id, status: EN_PREPARACION, deliveryUserId:
  null }, data: { status: ASIGNADO_REPARTIDOR, deliveryUserId: repartidorId, assignedAt: new
  Date() } })`; si `count === 0`, relee para distinguir `noEncontrado()` de
  `pedidoYaNoDisponible()`; antes de la escritura, si el repartidor ya tiene un pedido en
  `asignado_repartidor`, lanza `repartidorYaTienePedido()` sin llegar al `updateMany`; llama a
  `registrarEvento` con `actorRole: Role.REPARTIDOR` (FR-002 a FR-005, FR-012, depende de T009,
  T010, T014)
- [X] T016 [US1] Crear `services/api/src/orders/delivery-orders.controller.ts`:
  `@Controller('delivery/orders')`, `@UseGuards(SessionGuard, RolesGuard)`,
  `@Roles(Role.REPARTIDOR)`; `GET /` → `disponiblesParaRepartidor` (ruta `available`); `PUT
  /:id/take` → `tomar` con el `userId` de la sesión (depende de T014, T015)
- [X] T017 [US1] Registrar `DeliveryOrdersController` en
  `services/api/src/orders/orders.module.ts` (depende de T016)
- [X] T018 [US1] Crear `apps/web/src/app/repartidor/_components/pedidos-disponibles.tsx`: pide
  `GET /delivery/orders/available` vía `pedirALaApi`, muestra la lista con botón "Tomar" por
  fila, y `MSG_SIN_PEDIDOS_DISPONIBLES` cuando está vacía (depende de T016)
- [X] T019 [US1] Reemplazar `apps/web/src/app/repartidor/page.tsx`: exige sesión de rol
  `REPARTIDOR` y renderiza `PedidosDisponibles` (depende de T018)

**Punto de control**: un repartidor ve los pedidos disponibles y puede tomar uno; dos
repartidores no pueden terminar con el mismo pedido; un repartidor no puede tomar un segundo
mientras tenga uno en curso. US1 es demostrable por sí sola.

---

## Fase 4: Historia de Usuario 2 — Repartidor consulta el pedido que tiene en curso (P2)

**Objetivo**: el repartidor ve los datos completos —incluido el teléfono del cliente— del
pedido que tomó en la Historia 1.

**Prueba independiente**: con un repartidor que ya tomó un pedido (US1), se completan V-06 y
V-07 de `quickstart.md`: ver el pedido en curso con teléfono, y comprobar que ese teléfono no
aparece en la lista de disponibles.

### Pruebas de US2

- [X] T020 [P] [US2] Crear las pruebas fallidas de `GET /delivery/orders/current` en
  `services/api/test/delivery-orders-current.integration-spec.ts`: devuelve `{ order: null }`
  sin pedido en curso; devuelve `{ order: DeliveryOrderDto }` con `customerPhone` cuando lo hay;
  `403` para roles distintos de `REPARTIDOR`
- [X] T021 [P] [US2] Extender `services/api/test/delivery-orders-available.integration-spec.ts`
  (T011): confirmar que la respuesta de `available` **nunca** incluye `customerPhone` (SC-007)

### Implementación de US2

- [X] T022 [US2] Añadir `enCursoDelRepartidor(repartidorId)` en
  `services/api/src/orders/orders.service.ts`: busca el pedido con `deliveryUserId: repartidorId,
  status: ASIGNADO_REPARTIDOR`, incluye `user: { select: { phone: true } }`, y mapea a
  `DeliveryOrderDto` (o `null`) (FR-007, depende de T003, T007)
- [X] T023 [US2] Añadir `GET /` en `delivery-orders.controller.ts` bajo la ruta `current`,
  delegando a `enCursoDelRepartidor` (depende de T022)
- [X] T024 [US2] Crear `apps/web/src/app/repartidor/_components/pedido-en-curso.tsx`: pide `GET
  /delivery/orders/current`, y si hay pedido muestra productos, cantidades, dirección y teléfono
  (depende de T023)
- [X] T025 [US2] Integrar `PedidoEnCurso` en `apps/web/src/app/repartidor/page.tsx`, sobre
  `PedidosDisponibles` (depende de T019, T024)

**Punto de control**: el repartidor ve su pedido en curso con el teléfono del cliente; la lista
de disponibles nunca lo muestra. US1 y US2 funcionan de forma independiente.

---

## Fase 5: Historia de Usuario 3 — Repartidor suelta un pedido que no puede completar (P3)

**Objetivo**: un repartidor devuelve un pedido tomado, que vuelve a estar disponible para
cualquiera, incluido él mismo.

**Prueba independiente**: con un repartidor que tiene un pedido en curso (US1/US2), se completan
V-09 a V-12 de `quickstart.md`: soltarlo, verlo reaparecer, volver a tomarlo, y comprobar ambas
entradas de historial en E4.

### Pruebas de US3

- [X] T026 [P] [US3] Crear las pruebas fallidas de `PUT /delivery/orders/:id/release` en
  `services/api/test/delivery-orders-release.integration-spec.ts`: transiciona de vuelta a
  `en_preparacion` sin repartidor y registra el evento; `404 NOT_FOUND` si no existe; `409
  DELIVERY_ORDER_NOT_YOURS` si no está asignado al repartidor autenticado; el pedido vuelto a
  soltar reaparece en `GET /delivery/orders/available` (FR-008, FR-009); `403 FORBIDDEN` con
  sesión de `NEGOCIO` o `CLIENTE` (FR-010)
- [X] T027 [P] [US3] Extender `services/api/test/orders-history-client.integration-spec.ts` (E4,
  `specs/005-trazabilidad-pedido`) o crear una prueba equivalente en E5: tras tomar y soltar un
  pedido, `GET /orders/:id` muestra ambas entradas nuevas en orden cronológico, sin ningún
  cambio de contrato de E4 (SC-006)

### Implementación de US3

- [X] T028 [US3] Añadir `soltar(id, repartidorId)` en
  `services/api/src/orders/orders.service.ts`: dentro de una transacción, `updateMany({ where:
  { id, status: ASIGNADO_REPARTIDOR, deliveryUserId: repartidorId }, data: { status:
  EN_PREPARACION, deliveryUserId: null, assignedAt: null } })`; si `count === 0`, relee para
  distinguir `noEncontrado()` de `pedidoNoAsignadoATi()`; llama a `registrarEvento` con
  `previousStatus: ASIGNADO_REPARTIDOR, resultingStatus: EN_PREPARACION, actorRole:
  Role.REPARTIDOR` (FR-008, FR-009, FR-012, depende de T009, T010, T015)
- [X] T029 [US3] Añadir `PUT /:id/release` en `delivery-orders.controller.ts`, delegando a
  `soltar` con el `userId` de la sesión (depende de T028)
- [X] T030 [US3] Añadir el botón "Soltar pedido" a
  `apps/web/src/app/repartidor/_components/pedido-en-curso.tsx`, con confirmación previa
  (Principio IX) antes de llamar a `PUT /delivery/orders/:id/release` (depende de T024, T029)

**Punto de control**: las tres historias funcionan de forma independiente y completa.

---

## Fase Final: Validación funcional y cierre

**Propósito**: cerrar la épica con la validación manual y actualizar el estado del producto.

- [X] T031 Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm
  build`; deben pasar en verde antes de la validación manual
- [ ] T032 Recorrer V-01 a V-14 de `specs/007-reparto-repartidor/quickstart.md` con sesiones
  reales de administrador, cliente, negocio y dos repartidores; registrar el resultado en
  `specs/007-reparto-repartidor/verificacion.md`
- [ ] T033 Actualizar `specs/README.md` y `CLAUDE.md` (§ Estado del código) para reflejar E5
  como terminada, con el mismo nivel de detalle que E1–E4/E6/E9, incluida una mención explícita
  de la enmienda constitucional 3.0.0

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias — puede iniciar de inmediato.
- **Cimientos (Fase 2)**: depende de la Fase 1 — bloquea las tres historias. Incluye la
  migración: sin ella no hay dónde escribir `deliveryUserId`.
- **Historias de usuario (Fase 3+)**: todas dependen de la Fase 2.
  - US2 depende de que exista un pedido en `asignado_repartidor`, que solo produce US1 — por eso
    se implementa después, aunque su propio endpoint (`GET .../current`) sea de solo lectura y no
    reutilice código de escritura de US1.
  - US3 depende de `tomar()` (T015) para tener algo que soltar, y reutiliza el mismo patrón de
    escritura condicionada — no depende de que la pantalla de US1/US2 esté terminada, solo del
    servicio.
- **Validación funcional (Fase Final)**: depende de que las tres historias estén completas.

### Dependencias dentro de cada historia

- Pruebas antes que implementación (deben fallar primero).
- Servicio antes que controlador; controlador antes que componente de interfaz; componente antes
  de integrarlo en la página.

### Oportunidades de paralelismo

- T005, T006, T007 (máquina de estados, mensajes, DTO) tocan archivos distintos de
  `packages/shared` y son paralelizables entre sí, apenas termine T004.
- T009 (catálogo de errores en `services/api`) usa las constantes `MSG_*` de T006 — se ejecuta
  después de T006, no en paralelo con ella, aunque viva en un paquete distinto.
- Las pruebas de cada historia (T011+T012+T013, T020+T021, T026+T027) son paralelizables entre
  sí dentro de su fase.

---

## Ejemplo de ejecución en paralelo: Fase 2 (Cimientos)

```bash
# Tras T004 (migración generada), en paralelo:
Task: "Actualizar packages/shared/src/order-state/machine.ts con la transición de retroceso"
Task: "Añadir los cuatro mensajes nuevos en packages/shared/src/messages/es.ts"
Task: "Añadir DeliveryOrderDto en packages/shared/src/types/api.ts"

# Recién después de que termine el mensaje anterior (T006):
Task: "Añadir los tres códigos de error nuevos en services/api/src/common/errors.ts"
```

---

## Estrategia de implementación

### MVP primero (solo Historia 1)

1. Completar Fase 1: Preparación.
2. Completar Fase 2: Cimientos (bloqueante, incluye la migración).
3. Completar Fase 3: Historia 1 (tomar un pedido disponible).
4. **Detenerse y validar**: V-01 a V-05 de `quickstart.md`, incluida la condición de carrera.
5. Demostrar si corresponde antes de continuar con consultar-en-curso y soltar.

### Entrega incremental

1. Preparación + Cimientos → base lista, con la enmienda constitucional ya vigente.
2. Historia 1 (tomar) → validar de forma independiente → demostrar (MVP).
3. Historia 2 (consultar en curso, con teléfono) → validar de forma independiente → demostrar.
4. Historia 3 (soltar) → validar de forma independiente → demostrar.
5. Fase Final → cerrar la épica y actualizar el estado del producto.

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
