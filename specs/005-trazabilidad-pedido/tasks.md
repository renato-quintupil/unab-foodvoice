---
description: "Lista de tareas de implementación: E4 · Trazabilidad del pedido"
---

# Tareas: E4 · Trazabilidad del pedido

**Entrada**: documentos de diseño de `specs/005-trazabilidad-pedido/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).

**Pruebas**: se incluyen obligatoriamente, igual que en E1/E2/E3/E9. El Principio XI exige
especificar antes de programar; el control de acceso (cliente ajeno, mono-local, admin sin
restricción) y el orden cronológico de la secuencia son la única lógica real de esta épica y se
prueban con integración real, no con mocks. En cada fase se escriben las pruebas y se comprueba
que fallen antes de implementar.

**Organización**: una fase por historia, en orden de prioridad: cliente (P1) → negocio (P2) →
administrador (P3). E4 no tiene fase de migración: no hay esquema nuevo (D-051 a D-054).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: Historia 1 · Cliente consulta el historial de su pedido (P1).
- **[US2]**: Historia 2 · Negocio consulta el historial de un pedido que gestiona (P2).
- **[US3]**: Historia 3 · Administrador ve el historial desde el panel (P3).

## Convenciones de ruta

El monorepo existente usa `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
pruebas de integración viven en `services/api/test/*.integration-spec.ts` contra PostgreSQL; las
de componente en `apps/web/tests/*.test.tsx`. Sin dependencia ni variable de entorno nueva.

---

## Fase 1: Preparación

**Propósito**: crear las rutas nuevas y obtener una línea base verificable sin alterar E1/E2/E3/E9.

- [ ] T001 [P] Crear las carpetas de ruta dinámica vacías `apps/web/src/app/cliente/pedidos/[id]/`, `apps/web/src/app/negocio/pedidos/[id]/` y `apps/web/src/app/admin/pedidos/[id]/`
- [ ] T002 Ejecutar la línea base de `specs/005-trazabilidad-pedido/quickstart.md` —`pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el resultado y detener la implementación si existe un fallo preexistente

---

## Fase 2: Cimientos bloqueantes

**Propósito**: el tipo de detalle compartido que las tres historias consumen (D-051). Sin
migración: `order_status_event` ya existe desde E2.

**⚠️ CRÍTICO**: ninguna historia empieza hasta completar esta fase.

- [ ] T003 [P] Añadir `OrderStatusEventDto` y `OrderDetailDto` (extendiendo `OrderSummaryDto` por composición, D-051) en `packages/shared/src/types/api.ts`, según `contracts/shared.md`
- [ ] T004 Exportar los dos tipos nuevos desde `packages/shared/src/index.ts`

**Punto de control**: `packages/shared` compila con los tipos nuevos. Las historias pueden
comenzar.

---

## Fase 3: Historia de Usuario 1 — Cliente consulta el historial de su pedido (P1) 🎯 MVP

**Objetivo**: un cliente abre el detalle de un pedido propio y ve su línea de tiempo completa.

**Prueba independiente**: con un cliente que tiene un pedido en `en_preparacion` y otro en
`rechazado`, se completan V-01 a V-05 de `quickstart.md`: ver ambas líneas de tiempo, cronometrar
SC-001, y comprobar que un pedido ajeno o inexistente da la misma respuesta 404.

### Pruebas de US1

> **NOTA: escribir estas pruebas primero y comprobar que fallan antes de implementar.**

- [ ] T005 [P] [US1] Crear las pruebas fallidas de `GET /orders/:id` en `services/api/test/orders-history-client.integration-spec.ts`: devuelve `OrderDetailDto` con la secuencia en orden cronológico ascendente, `previousStatus` nulo solo en la primera entrada, `actorName`/`actorRole` correctos, `404 NOT_FOUND` para un pedido de otro cliente y para uno inexistente (misma forma de respuesta en ambos casos, FR-005)
- [ ] T006 [P] [US1] Crear las pruebas fallidas de la página de detalle en `apps/web/tests/pedidos-historial.test.tsx` (caso cliente): renderiza la línea de tiempo con fecha/hora de cada entrada y el motivo cuando la última es un rechazo

### Implementación de US1

- [ ] T007 [US1] Añadir `detalleParaCliente(id, userId)` en `services/api/src/orders/orders.service.ts`: consulta el pedido y su `OrderStatusEvent[]` ordenado por `occurredAt, id`, arma `OrderDetailDto` reutilizando `A_COMPARTIDO`, y lanza `noEncontrado()` si el pedido no existe o `order.userId !== userId` (FR-003, FR-005)
- [ ] T008 [US1] Añadir `GET /api/v1/orders/:id` en `services/api/src/orders/orders.controller.ts`, delegando a `detalleParaCliente` con el `userId` de la sesión (depende de T007)
- [ ] T009 [US1] Crear `apps/web/src/app/cliente/pedidos/[id]/page.tsx`: pide `GET /orders/:id` vía `pedirALaApi`, exige sesión de rol `CLIENTE`, y muestra la línea de tiempo (estado, fecha/hora, motivo si corresponde) usando `ETIQUETA_ESTADO_PEDIDO` y `ETIQUETA_ROL` (depende de T008)
- [ ] T010 [US1] Enlazar cada pedido de `apps/web/src/app/cliente/pedidos/page.tsx` al nuevo `/cliente/pedidos/[id]` (depende de T009)

**Punto de control**: un cliente puede ver el historial completo de cualquiera de sus pedidos y
recibe 404 ante uno ajeno o inexistente. US1 es demostrable por sí sola.

---

## Fase 4: Historia de Usuario 2 — Negocio consulta el historial de un pedido que gestiona (P2)

**Objetivo**: un negocio abre el detalle de cualquier pedido (mono-local, D-053) y ve la misma
línea de tiempo que el cliente.

**Prueba independiente**: con la sesión de negocio, se completan V-06 a V-08 de `quickstart.md`:
detalle desde la bandeja, desde rechazados, y de un pedido de cualquier cliente.

### Pruebas de US2

- [ ] T011 [P] [US2] Crear las pruebas fallidas de `GET /business/orders/:id` en `services/api/test/orders-history-business.integration-spec.ts`: devuelve `OrderDetailDto` para cualquier pedido existente sin restricción de pertenencia (D-053), `404 NOT_FOUND` solo si no existe
- [ ] T012 [P] [US2] Extender `apps/web/tests/pedidos-historial.test.tsx` (caso negocio): renderiza la misma línea de tiempo que el caso cliente, con nombre y rol del actor visibles

### Implementación de US2

- [ ] T013 [US2] Añadir `detalleParaNegocio(id)` en `services/api/src/orders/orders.service.ts`: misma consulta que `detalleParaCliente` sin el filtro de `userId` (D-053); reutiliza el mapeo a `OrderDetailDto` y lanza `noEncontrado()` si el pedido no existe (depende de T007)
- [ ] T014 [US2] Añadir `GET /api/v1/business/orders/:id` en `services/api/src/orders/business-orders.controller.ts`, delegando a `detalleParaNegocio` (depende de T013)
- [ ] T015 [US2] Crear `apps/web/src/app/negocio/pedidos/[id]/page.tsx`: pide `GET /business/orders/:id`, exige sesión de rol `NEGOCIO`, y muestra la misma línea de tiempo que T009 (puede compartir un componente de presentación con la Fase 3 si no introduce diferencias de datos) (depende de T014)
- [ ] T016 [US2] [P] Enlazar cada pedido de `apps/web/src/app/negocio/pedidos/page.tsx` al nuevo `/negocio/pedidos/[id]` (depende de T015)
- [ ] T017 [US2] [P] Enlazar cada pedido de `apps/web/src/app/negocio/pedidos/rechazados/page.tsx` al nuevo `/negocio/pedidos/[id]` (depende de T015)

**Punto de control**: un negocio ve el historial de cualquier pedido, incluidos los que no
gestionó activamente. US1 y US2 funcionan de forma independiente.

---

## Fase 5: Historia de Usuario 3 — Administrador ve el historial desde el panel (P3)

**Objetivo**: un administrador llega del reporte de pedidos (HU-10) al historial de un pedido
puntual en no más de dos acciones (SC-004).

**Prueba independiente**: con la sesión de administrador, se completan V-09 y V-10 de
`quickstart.md`: clic en una fila del reporte, ver el historial, incluido un motivo de rechazo.

### Pruebas de US3

- [ ] T018 [P] [US3] Crear las pruebas fallidas de `GET /admin/dashboard/orders/:id` en `services/api/test/orders-history-admin.integration-spec.ts`: devuelve `OrderDetailDto` para cualquier pedido sin restricción de pertenencia, `404 NOT_FOUND` solo si no existe
- [ ] T019 [P] [US3] Extender `apps/web/tests/pedidos-historial.test.tsx` (caso admin): la fila del reporte enlaza al detalle y el detalle no exige que el pedido pertenezca a ningún rol en particular

### Implementación de US3

- [ ] T020 [US3] Añadir `detalle(id)` en `services/api/src/dashboard/dashboard.service.ts`: misma consulta y mapeo que T007/T013, sin restricción de pertenencia (FR-006), y lanza `noEncontrado()` si el pedido no existe
- [ ] T021 [US3] Añadir `GET /api/v1/admin/dashboard/orders/:id` en `services/api/src/dashboard/dashboard.controller.ts`, delegando a `detalle` (depende de T020)
- [ ] T022 [US3] Crear `apps/web/src/app/admin/pedidos/[id]/page.tsx`: pide `GET /admin/dashboard/orders/:id`, y muestra la misma línea de tiempo que T009/T015 (depende de T021)
- [ ] T023 [US3] Enlazar cada fila de `apps/web/src/app/admin/pedidos/page.tsx` (columna "Pedido") al nuevo `/admin/pedidos/[id]` (depende de T022; cumple SC-004)

**Punto de control**: las tres historias funcionan de forma independiente y completa.

---

## Fase Final: Validación funcional y cierre

**Propósito**: cerrar la épica y la verificación pendiente de HU-10 que dependía de que existiera
E4.

- [ ] T024 Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`; deben pasar en verde antes de la validación manual
- [ ] T025 Recorrer V-01 a V-12 de `specs/005-trazabilidad-pedido/quickstart.md` con sesiones reales de cliente, negocio y administrador; registrar el resultado en `specs/005-trazabilidad-pedido/verificacion.md`
- [ ] T026 Con V-11/V-12 verificados, actualizar `specs/001-acceso-y-usuarios/spec.md` (o su `verificacion.md`) para cerrar la validación funcional pendiente de FR-019, FR-020 y SC-006 de HU-10
- [ ] T027 Actualizar `specs/README.md` y `CLAUDE.md` (§ Estado del código) para reflejar E4 como terminada, con el mismo nivel de detalle que E1/E2/E3/E9

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias — puede iniciar de inmediato.
- **Cimientos (Fase 2)**: depende de la Fase 1 — bloquea las tres historias.
- **Historias de usuario (Fase 3+)**: todas dependen de la Fase 2.
  - US2 y US3 reutilizan el mismo patrón de consulta que US1 (T007), pero **no dependen de que
    US1 esté en producción** — solo de que exista el método base, que puede escribirse una vez y
    reutilizarse. Si se prefiere paralelizar entre personas, T007/T013/T020 pueden implementarse
    como tres métodos independientes desde el inicio sin romper nada.
- **Validación funcional (Fase Final)**: depende de que las tres historias estén completas.

### Dependencias dentro de cada historia

- Pruebas antes que implementación (deben fallar primero).
- Servicio antes que controlador; controlador antes que página; página antes que enlace desde la
  pantalla existente.

### Oportunidades de paralelismo

- T001 (tres carpetas) es una sola tarea con tres rutas independientes.
- T003/T004 pueden ejecutarse justo después de revisar `contracts/shared.md`, sin esperar nada más
  que la Fase 1.
- Las pruebas de cada historia (T005+T006, T011+T012, T018+T019) son paralelizables entre sí.
- Los dos enlaces de US2 (T016, T017) tocan archivos distintos y son paralelizables.

---

## Ejemplo de ejecución en paralelo: Historia 1

```bash
# Pruebas de US1 en paralelo:
Task: "Pruebas fallidas de GET /orders/:id en services/api/test/orders-history-client.integration-spec.ts"
Task: "Pruebas fallidas de la página de detalle en apps/web/tests/pedidos-historial.test.tsx (caso cliente)"
```

---

## Estrategia de implementación

### MVP primero (solo Historia 1)

1. Completar Fase 1: Preparación.
2. Completar Fase 2: Cimientos (bloqueante).
3. Completar Fase 3: Historia 1 (cliente).
4. **Detenerse y validar**: V-01 a V-05 de `quickstart.md` de forma independiente.
5. Demostrar si corresponde antes de continuar con negocio y administrador.

### Entrega incremental

1. Preparación + Cimientos → base lista.
2. Historia 1 (cliente) → validar de forma independiente → demostrar (MVP).
3. Historia 2 (negocio) → validar de forma independiente → demostrar.
4. Historia 3 (administrador) → validar de forma independiente → demostrar.
5. Fase Final → cerrar HU-10 y actualizar el estado del producto.

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
