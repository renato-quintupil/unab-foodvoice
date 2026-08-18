---
description: "Lista de tareas de implementación: E2 · Gestión de pedidos"
---

# Tareas: E2 · Gestión de pedidos

**Entrada**: documentos de diseño de `specs/003-gestion-pedidos/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).

**Pruebas**: se incluyen obligatoriamente. El Principio XI exige especificar antes de programar,
y el plan exige integración real para concurrencia, atomicidad, unicidad parcial y append-only.
En cada fase se escriben las pruebas y se comprueba que fallen antes de implementar.

**Organización**: una fase por historia, en el orden de prioridad y recorrido:
carrito → direcciones → pedidos.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: HU-12 · Carrito editable manual (P1).
- **[US2]**: HU-11 · Direcciones de entrega etiquetadas (P2).
- **[US3]**: HU-01 · Gestión de pedidos con estado visible (P3).

## Convenciones de ruta

El monorepo existente usa `packages/shared/src/`, `services/api/src/` y `apps/web/src/`.
Las pruebas de integración viven en `services/api/test/*.integration-spec.ts` y se ejecutan
contra PostgreSQL. No se añade ninguna dependencia ni variable de entorno.

---

## Fase 1: Preparación

**Propósito**: preparar las rutas nuevas y obtener una línea base verificable sin alterar E1/E3.

- [X] T001 [P] Crear los módulos vacíos en `services/api/src/cart/`, `services/api/src/addresses/` y `services/api/src/orders/`
- [X] T002 [P] Crear las ocho rutas de página en `apps/web/src/app/cliente/carrito/`, `apps/web/src/app/cliente/direcciones/`, `apps/web/src/app/cliente/direcciones/nueva/`, `apps/web/src/app/cliente/direcciones/[id]/editar/`, `apps/web/src/app/cliente/pedidos/`, `apps/web/src/app/cliente/pedidos/confirmar/`, `apps/web/src/app/negocio/pedidos/` y `apps/web/src/app/negocio/pedidos/rechazados/`
- [X] T003 Ejecutar la línea base de `specs/003-gestion-pedidos/quickstart.md` —`pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el resultado y detener la implementación si existe un fallo preexistente

---

## Fase 2: Cimientos bloqueantes

**Propósito**: contrato de estados, validación compartida, errores cerrados y persistencia de las
seis entidades, incluidas las garantías SQL de dirección predeterminada e historial.

**⚠️ CRÍTICO**: ninguna historia empieza hasta completar esta fase.

### Pruebas primero

- [X] T004 [P] Añadir casos fallidos para `RECHAZADO` en `packages/shared/tests/order-state.test.ts`: solo `CREADO → RECHAZADO` es válida, `RECHAZADO` es terminal y las transiciones anteriores no cambian
- [X] T005 [P] Crear pruebas fallidas de `AddCartLineSchema` y `UpdateCartLineQuantitySchema` en `packages/shared/tests/cart-schemas.test.ts`, cubriendo UUID, cero, negativos y no enteros
- [X] T006 [P] Crear pruebas fallidas de los esquemas de dirección en `packages/shared/tests/address-schemas.test.ts`, cubriendo límites 2/60 y 10/500, `trim` y texto compuesto solo por espacios o saltos
- [X] T007 [P] Crear pruebas fallidas de `ConfirmOrderSchema` y `RejectOrderSchema` en `packages/shared/tests/order-schemas.test.ts`, exigiendo XOR entre `addressId`/`addressText` y rechazando motivo vacío o de solo espacios
- [X] T008 [P] Añadir pruebas fallidas de `BusinessOrdersQuerySchema` en `packages/shared/tests/query.test.ts` para estados permitidos, estado ajeno a la bandeja y página mínima
- [X] T009 [P] Añadir pruebas fallidas de los catorce mensajes, `Pendiente` y `Rechazado` en `packages/shared/tests/messages.test.ts` y `apps/web/tests/panel.test.tsx`
- [X] T010 [P] Añadir pruebas fallidas de los ocho códigos y factories de error de E2 en `services/api/src/common/errors.spec.ts`, verificando HTTP, `code`, mensaje y asociación a campo cuando corresponda
- [X] T011 [P] Crear la prueba de esquema fallida en `services/api/test/orders-schema.integration-spec.ts` para seis tablas, enum de seis estados, FKs, índices, checks, único parcial de predeterminada, evento inicial único y trigger append-only

### Implementación de cimientos

- [X] T012 Añadir `RECHAZADO` al contrato compartido en `packages/shared/src/enums/order-status.ts` sin modificar los cinco valores existentes
- [X] T013 Añadir `CREADO → RECHAZADO` y la terminalidad de `RECHAZADO` en `packages/shared/src/order-state/machine.ts`
- [X] T014 Crear `AddCartLineSchema` y `UpdateCartLineQuantitySchema` con sus tipos inferidos en `packages/shared/src/schemas/cart.ts`
- [X] T015 Crear `CreateAddressSchema`, `UpdateAddressSchema` y `ChangeAddressStatusSchema` con sus tipos en `packages/shared/src/schemas/address.ts`
- [X] T016 Crear `ConfirmOrderSchema` con XOR de dirección y `RejectOrderSchema` con sus tipos en `packages/shared/src/schemas/order.ts`
- [X] T017 Añadir `BusinessOrdersQuerySchema` y `BusinessOrdersQuery` en `packages/shared/src/schemas/query.ts`
- [X] T018 Añadir los catorce mensajes fijos de E2 definidos en `specs/003-gestion-pedidos/contracts/shared.md` a `packages/shared/src/messages/es.ts`
- [X] T019 Cambiar la etiqueta de `CREADO` a “Pendiente” y añadir “Rechazado” en `packages/shared/src/messages/etiquetas.ts`
- [X] T020 Extender `ErrorCode` y sus factories con `CART_EMPTY`, `CART_HAS_UNAVAILABLE_LINES`, `PRICE_CHANGED`, `ADDRESS_REQUIRED`, `ADDRESS_LABEL_ALREADY_EXISTS`, `ADDRESS_NEEDS_NEW_DEFAULT`, `ADDRESS_IN_USE` y `ORDER_NOT_PENDING` en `services/api/src/common/errors.ts`
- [X] T021 Añadir `CartLineDto`, `CartDto`, `AddressDto`, `OrderLineDto` y `OrderSummaryDto` —sin DTO de historial— en `packages/shared/src/types/api.ts`
- [X] T022 Exportar esquemas, tipos, mensajes y DTO nuevos, sin exportar `OrderStatusEvent`, desde `packages/shared/src/index.ts`
- [X] T023 Añadir `OrderStatus` y los modelos `Cart`, `CartLine`, `Address`, `Order`, `OrderLine` y `OrderStatusEvent` con relaciones inversas e índices en `services/api/prisma/schema.prisma`
- [X] T024 Generar con `prisma migrate dev --create-only` el archivo `services/api/prisma/migrations/20260817000000_gestion_pedidos/migration.sql` con las seis tablas y agregar manualmente los checks de cantidades y dirección, el índice único parcial de predeterminada, el check/único inicial de eventos y el trigger `BEFORE UPDATE OR DELETE` de solo inserción

**Punto de control**: contratos compilables, catálogo de errores cerrado y migración limpia con
seis tablas. Las historias pueden comenzar.

---

## Fase 3: Historia de Usuario 1 — Carrito editable manual (HU-12, P1) 🎯 MVP

**Objetivo**: un cliente arma, corrige y vacía un carrito persistido contra el catálogo vigente.

**Prueba independiente**: con un cliente y el catálogo de E3 se completan V-01 a V-09: agregar,
sumar, cambiar cantidad, retirar, vaciar, persistir sesión y reflejar precio/disponibilidad.

### Pruebas de US1

- [X] T025 [P] [US1] Crear `services/api/test/cart-add.integration-spec.ts` para alta, suma sobre una única línea y rechazo de producto agotado, dado de baja o inexistente (HU12-E01–E03, FR-002, FR-004)
- [X] T026 [P] [US1] Crear `services/api/test/cart-quantity.integration-spec.ts` para cantidad 3, subtotal actualizado, cero que elimina y rechazo de negativo/no entero (HU12-E04–E05, FR-003)
- [X] T027 [P] [US1] Crear `services/api/test/cart-remove.integration-spec.ts` para quitar una línea sin depender de su cantidad (HU12-E06, FR-005)
- [X] T028 [P] [US1] Crear `services/api/test/cart-clear.integration-spec.ts` para vaciado con varias líneas e idempotencia sobre carrito vacío (HU12-E11, FR-010)
- [X] T029 [P] [US1] Crear `services/api/test/cart-price-live.integration-spec.ts` para recalcular el precio vigente en cada lectura sin congelarlo (HU12-E10, FR-006)
- [X] T030 [P] [US1] Crear `services/api/test/cart-unavailable.integration-spec.ts` para conservar y marcar no disponible una línea cuyo producto se agotó o dio de baja (HU12-E09, FR-007–FR-008)
- [X] T031 [P] [US1] Crear `services/api/test/cart-persistence.integration-spec.ts` para conservar productos y cantidades tras cerrar y reabrir sesión (HU12-E07, FR-011)
- [X] T032 [P] [US1] Crear `services/api/test/cart-roles.integration-spec.ts` para exigir `CLIENTE` en los cinco endpoints y devolver `403` a los otros tres roles (RN-001, D-042)
- [X] T033 [P] [US1] Crear `apps/web/tests/carrito.test.tsx` para estado vacío, controles de cantidad, línea no disponible, precio vigente y bloqueo de confirmación

### Implementación de US1

- [X] T034 [US1] Implementar `CartService.obtener` con carrito inexistente como lista vacía y unión al `Product` vigente en `services/api/src/cart/cart.service.ts`
- [X] T035 [US1] Implementar `CartService.agregarLinea` con creación perezosa y upsert por `(cartId, productId)`, validando `active && available` en `services/api/src/cart/cart.service.ts`
- [X] T036 [US1] Implementar cambio de cantidad —cero elimina— y eliminación explícita en `services/api/src/cart/cart.service.ts`
- [X] T037 [US1] Implementar vaciado idempotente en `services/api/src/cart/cart.service.ts`
- [X] T038 [US1] Implementar los cinco endpoints con `@Roles(Role.CLIENTE)` y validación compartida en `services/api/src/cart/cart.controller.ts`
- [X] T039 [US1] Crear `CartModule` y registrarlo en `services/api/src/cart/cart.module.ts` y `services/api/src/app.module.ts`
- [X] T040 [US1] Añadir la acción “Agregar” y acceso al carrito solo para cliente en `apps/web/src/app/menu/page.tsx`, `apps/web/src/app/menu/[id]/page.tsx` y `apps/web/src/app/cliente/page.tsx`
- [X] T041 [US1] Construir lista, subtotales, cantidades, quitar y vaciar en `apps/web/src/app/cliente/carrito/page.tsx`
- [X] T042 [US1] Marcar líneas no disponibles y bloquear confirmación mientras exista alguna en `apps/web/src/app/cliente/carrito/page.tsx`
- [X] T043 [US1] Mostrar el mensaje de carrito vacío y ocultar/deshabilitar confirmación sin líneas en `apps/web/src/app/cliente/carrito/page.tsx`
- [X] T044 [US1] Deshabilitar controles durante cada mutación para impedir doble envío en `apps/web/src/app/cliente/carrito/page.tsx`

**Punto de control**: HU-12 funciona sola y constituye el MVP.

---

## Fase 4: Historia de Usuario 2 — Direcciones etiquetadas (HU-11, P2)

**Objetivo**: un cliente registra y administra direcciones textuales con una predeterminada
consistente incluso bajo concurrencia.

**Prueba independiente**: con un cliente se completan V-10 a V-20 sin carrito: alta, unicidad
normalizada, edición, predeterminada, desactivación, reactivación y eliminación.

**Depende de**: solo Fase 2; puede desarrollarse en paralelo con US1.

### Pruebas de US2

- [X] T045 [P] [US2] Crear `services/api/test/addresses-create.integration-spec.ts` para primera predeterminada, segunda no predeterminada y validaciones de campos (HU11-E01, E02, E04)
- [X] T046 [P] [US2] Crear `services/api/test/addresses-unique.integration-spec.ts` para colisiones normalizadas entre activas y desactivadas (HU11-E03, FR-014)
- [X] T047 [P] [US2] Crear `services/api/test/addresses-default.integration-spec.ts` para cambiar la predeterminada atómicamente y conservar exactamente una (HU11-E05, FR-015)
- [X] T048 [P] [US2] Crear `services/api/test/addresses-concurrency.integration-spec.ts` para dos primeras altas y dos reactivaciones simultáneas: ambas solicitudes válidas terminan con exactamente una predeterminada activa
- [X] T049 [P] [US2] Crear `services/api/test/addresses-edit.integration-spec.ts` para editar etiqueta/texto sin alterar flags ni snapshots de pedidos sembrados, y para rechazar la edición cuando la nueva etiqueta colisiona normalizada con otra existente del mismo cliente (HU11-E06, E09, FR-016, `409 ADDRESS_LABEL_ALREADY_EXISTS`)
- [X] T050 [P] [US2] Crear `services/api/test/addresses-deactivate.integration-spec.ts` para impedir retirar la predeterminada si hay otra activa y permitir desactivar la última activa (HU11-E11–E12, FR-018, FR-020)
- [X] T051 [P] [US2] Crear `services/api/test/addresses-reactivate.integration-spec.ts` para reactivar como predeterminada solo cuando no existe otra activa (HU11-E13–E14)
- [X] T052 [P] [US2] Crear `services/api/test/addresses-delete.integration-spec.ts` para borrar solo una nunca usada, impedir borrar una usada y no dejar sin predeterminada si quedan activas (FR-019, D-039, D-049)
- [X] T053 [P] [US2] Crear `services/api/test/addresses-roles.integration-spec.ts` para exigir `CLIENTE` en los seis endpoints (D-042)
- [X] T054 [P] [US2] Crear `apps/web/tests/direcciones.test.tsx` para formulario textual, estados activa/desactivada, predeterminada y errores asociados al campo

### Implementación de US2

- [X] T055 [US2] Implementar un helper transaccional que bloquee `User` con `FOR UPDATE` y usarlo en `AddressesService.crear` para serializar primeras altas, normalizar etiqueta y elegir predeterminada en `services/api/src/addresses/addresses.service.ts`
- [X] T056 [US2] Implementar edición de etiqueta/texto sin tocar `isDefault`, `active` ni `usedInOrder` en `services/api/src/addresses/addresses.service.ts`
- [X] T057 [US2] Implementar cambio de predeterminada bajo el bloqueo de `User`, quitando la anterior y fijando la nueva en una transacción en `services/api/src/addresses/addresses.service.ts`
- [X] T058 [US2] Implementar desactivación/reactivación bajo el bloqueo de `User`, releyendo el estado y aplicando FR-015/FR-020 en `services/api/src/addresses/addresses.service.ts`
- [X] T059 [US2] Implementar eliminación bajo el bloqueo de `User`: rechazar `usedInOrder` y proteger la predeterminada si quedan activas en `services/api/src/addresses/addresses.service.ts`
- [X] T060 [US2] Implementar los seis endpoints con `@Roles(Role.CLIENTE)` y validación compartida en `services/api/src/addresses/addresses.controller.ts`
- [X] T061 [US2] Crear `AddressesModule` y registrarlo en `services/api/src/addresses/addresses.module.ts` y `services/api/src/app.module.ts`
- [X] T062 [P] [US2] Construir el formulario react-hook-form con solo etiqueta y texto en `apps/web/src/app/cliente/direcciones/_components/formulario-direccion.tsx`
- [X] T063 [US2] Construir alta y edición reutilizando el formulario en `apps/web/src/app/cliente/direcciones/nueva/page.tsx` y `apps/web/src/app/cliente/direcciones/[id]/editar/page.tsx`
- [X] T064 [US2] Construir el listado, navegación y acciones de predeterminada/estado/eliminación en `apps/web/src/app/cliente/direcciones/page.tsx` y `apps/web/src/app/cliente/page.tsx`
- [X] T065 [US2] Asociar `ADDRESS_NEEDS_NEW_DEFAULT`, duplicado y dirección en uso a su control/acción en `apps/web/src/app/cliente/direcciones/page.tsx`
- [X] T066 [US2] Deshabilitar controles durante cada mutación en `apps/web/src/app/cliente/direcciones/page.tsx` y `apps/web/src/app/cliente/direcciones/_components/formulario-direccion.tsx`

**Punto de control**: HU-11 funciona independientemente y la invariante de predeterminada resiste
carreras reales.

---

## Fase 5: Historia de Usuario 3 — Pedidos con estado visible (HU-01, P3)

**Objetivo**: confirmar un pedido, mostrarlo y permitir que el negocio lo acepte o rechace,
registrando creación y transición de forma atómica y append-only.

**Prueba independiente**: con carrito y dirección sembrados se completan V-21 a V-40:
confirmación, snapshots, bandeja, roles, estados, rechazo, concurrencia e historial interno.

**Depende de**: US1 y US2 completas.

### Pruebas de US3

- [X] T067 [P] [US3] Crear `services/api/test/orders-confirm.integration-spec.ts` para dirección guardada/puntual, snapshots, vaciado de carrito y marca `usedInOrder` (HU01-E01, HU11-E07, E10, FR-025–FR-027)
- [X] T068 [P] [US3] Crear `services/api/test/orders-preconditions.integration-spec.ts` para carrito vacío, dirección ausente, ambas fuentes de dirección a la vez, `addressId` ajeno o inexistente (`404 NOT_FOUND`), `addressId` desactivado (se acepta), y `expectedLines` con productos/cantidades distintos del carrito real (`400 VALIDATION_ERROR`, distinto de `PRICE_CHANGED`) — sin efectos parciales en ningún caso
- [X] T069 [P] [US3] Crear `services/api/test/orders-price-changed.integration-spec.ts` para diferencia de una línea entre varias: `PRICE_CHANGED`, carrito intacto y ningún pedido (HU01-E16, FR-028)
- [X] T070 [P] [US3] Crear `services/api/test/orders-unavailable.integration-spec.ts` para producto agotado o dado de baja justo antes de confirmar, sin pedido ni vaciado (FR-028, D-045)
- [X] T071 [P] [US3] Crear `services/api/test/orders-concurrency-confirm.integration-spec.ts` para dos confirmaciones simultáneas: un pedido, un evento inicial, un carrito consumido y perdedora `CART_EMPTY` (FR-036, FR-042, D-037)
- [X] T072 [P] [US3] Crear `services/api/test/orders-immutable.integration-spec.ts` para snapshots de tres pedidos y ausencia de operaciones que editen productos, cantidades o dirección (HU01-E12–E13, SC-002, SC-003)
- [X] T073 [P] [US3] Crear `services/api/test/orders-accept.integration-spec.ts` para `creado → en_preparacion` y rechazo de estados no pendientes (HU01-E05, E08)
- [X] T074 [P] [US3] Crear `services/api/test/orders-reject.integration-spec.ts` para tres motivos distintos, motivo vacío y solo espacios, terminalidad y visibilidad del motivo (HU01-E06–E09, SC-007, SC-010)
- [X] T075 [P] [US3] Crear `services/api/test/orders-concurrency-accept-reject.integration-spec.ts` para un único ganador, un único evento nuevo y ningún evento de la perdedora (FR-036, FR-044, D-038)
- [X] T076 [P] [US3] Crear `services/api/test/orders-roles.integration-spec.ts` para la matriz de cuatro roles en confirmación, aceptación/rechazo y ausencia de edición (HU01-E10–E11, SC-008)
- [X] T077 [P] [US3] Crear `services/api/test/orders-queue-pagination.integration-spec.ts` para bandeja vacía y 21 pedidos intercalados, reparto 20/1 y orden total `createdAt ASC, id ASC` (HU01-E14–E15, FR-041)
- [X] T078 [P] [US3] Crear `services/api/test/orders-rejected-list.integration-spec.ts` para listar solo rechazados, con motivo y orden descendente (FR-039)
- [X] T079 [P] [US3] Crear `services/api/test/orders-history-create.integration-spec.ts` para exactamente un evento `NULL → CREADO` con actor cliente, rol y fecha (HU01-E17, FR-042)
- [X] T080 [P] [US3] Crear `services/api/test/orders-history-transition.integration-spec.ts` para exactamente un evento por aceptación/rechazo con estados, actor negocio, rol y fecha (HU01-E18, FR-043)
- [X] T081 [P] [US3] Crear `services/api/test/orders-history-atomicity.integration-spec.ts` con un trigger temporal de fallo de inserción y limpieza en `finally`, verificando rollback completo de creación, aceptación y rechazo (HU01-E19, FR-044)
- [X] T082 [P] [US3] Crear `services/api/test/orders-history-append-only.integration-spec.ts` para rechazar `UPDATE`/`DELETE` directos, conservar entradas y rechazar evento inicial duplicado o de forma inválida (FR-044, D-047)
- [X] T083 [P] [US3] Crear `services/api/test/orders-address-concurrency.integration-spec.ts` para la carrera confirmar/eliminar: si confirma primero queda usada; si elimina primero no nace pedido y el carrito queda intacto (D-049)
- [X] T084 [P] [US3] Crear `apps/web/tests/pedidos.test.tsx` para confirmación, `PRICE_CHANGED`, etiquetas, motivos, bandeja vacía, paginación y controles permitidos por rol

### Implementación de US3

- [X] T085 [US3] Implementar el helper privado de inserción de `OrderStatusEvent` que recibe el cliente transaccional, sin `HistoryService` ni DTO público, en `services/api/src/orders/orders.service.ts`
- [X] T086 [US3] Implementar `OrdersService.confirmar` en una transacción: bloquear `Cart`, validar líneas/precios/disponibilidad, bloquear `User` si usa dirección guardada, releerla, crear pedido/líneas/evento inicial, marcar `usedInOrder` y vaciar carrito en `services/api/src/orders/orders.service.ts`
- [X] T087 [US3] Implementar listado del cliente con pedidos completos, más reciente primero y sin eventos en la respuesta en `services/api/src/orders/orders.service.ts`
- [X] T088 [US3] Implementar bandeja combinada `creado`/`en_preparacion`, filtro opcional, tamaño 20 y orden estable en `services/api/src/orders/orders.service.ts`
- [X] T089 [US3] Implementar listado de rechazados con motivo y orden descendente en `services/api/src/orders/orders.service.ts`
- [X] T090 [US3] Implementar aceptar/rechazar con transacción interactiva, `updateMany` condicionado, evento solo tras `count = 1` y rollback ante fallo en `services/api/src/orders/orders.service.ts`
- [X] T091 [US3] Implementar `POST /orders` y `GET /orders` con `@Roles(Role.CLIENTE)` en `services/api/src/orders/orders.controller.ts`
- [X] T092 [US3] Implementar los cuatro endpoints de negocio con `@Roles(Role.NEGOCIO)` en `services/api/src/orders/business-orders.controller.ts`
- [X] T093 [US3] Crear `OrdersModule` con ambos controladores y registrarlo en `services/api/src/orders/orders.module.ts` y `services/api/src/app.module.ts`
- [X] T094 [US3] Construir resumen, XOR de dirección guardada/puntual y envío de `expectedLines` en `apps/web/src/app/cliente/pedidos/confirmar/page.tsx`
- [X] T095 [US3] Manejar `PRICE_CHANGED` recargando el carrito, mostrando el aviso y exigiendo nueva confirmación en `apps/web/src/app/cliente/pedidos/confirmar/page.tsx`
- [X] T096 [US3] Construir “mis pedidos” con estados actuales y motivo de rechazo, sin historial ni edición, en `apps/web/src/app/cliente/pedidos/page.tsx`
- [X] T097 [US3] Construir bandeja paginada, navegación desde negocio, datos completos y aceptar/rechazar en dos clics en `apps/web/src/app/negocio/pedidos/page.tsx` y `apps/web/src/app/negocio/page.tsx`
- [X] T098 [P] [US3] Construir el diálogo que exige motivo antes de rechazar en `apps/web/src/app/negocio/pedidos/_components/dialogo-rechazo.tsx`
- [X] T099 [US3] Mostrar bandeja vacía y rechazados propios con motivo en `apps/web/src/app/negocio/pedidos/page.tsx` y `apps/web/src/app/negocio/pedidos/rechazados/page.tsx`
- [X] T100 [US3] Deshabilitar controles durante confirmación y transiciones en `apps/web/src/app/cliente/pedidos/` y `apps/web/src/app/negocio/pedidos/`

**Punto de control**: las tres historias forman el flujo completo y cada mutación de estado de E2
tiene exactamente un evento atómico e inmutable.

---

## Fase 6: Cierre y validación transversal

**Propósito**: demostrar la experiencia visible y ejecutar las invariantes internas no expuestas
por E2.

- [X] T101 [P] Recorrer las ocho páginas de `apps/web/src/app/cliente/carrito/`, `apps/web/src/app/cliente/direcciones/`, `apps/web/src/app/cliente/pedidos/` y `apps/web/src/app/negocio/pedidos/` verificando texto visible íntegramente en español y errores asociados a su campo/acción
- [X] T102 [P] Operar con teclado las ocho páginas bajo `apps/web/src/app/cliente/` y `apps/web/src/app/negocio/pedidos/`, verificando foco visible, etiquetas y diálogo de rechazo — completado a mano por el usuario tras la limitación de la automatización de esta sesión
- [X] T103 [P] Verificar a 360 px las ocho páginas bajo `apps/web/src/app/cliente/` y `apps/web/src/app/negocio/pedidos/`, especialmente carrito, formularios y bandeja — completado a mano por el usuario tras la limitación de la automatización de esta sesión
- [X] T104 Ejecutar y dejar en verde todos los comandos de la sección «Comprobaciones automáticas» de `specs/003-gestion-pedidos/quickstart.md`
- [X] T105 Ejecutar V-01 a V-36 de `specs/003-gestion-pedidos/quickstart.md` con dos sesiones, midiendo SC-001/SC-005/SC-011 y comprobando SC-004 con apertura o una sola recarga
- [X] T106 Ejecutar V-37 a V-40 de `specs/003-gestion-pedidos/quickstart.md` mediante las baterías de historial y conservar su salida como evidencia
- [X] T107 Registrar los 12 criterios, 45 escenarios y FR-042–FR-044 en `specs/003-gestion-pedidos/verificacion.md`, separando cobertura automática de validación manual
- [X] T108 Actualizar el estado verificado de E2 en `CLAUDE.md` y `specs/README.md` sin declarar E4 ni funcionalidades fuera de alcance como implementadas

---

## Dependencias y orden de ejecución

### Grafo de fases

```text
Fase 1 · Preparación
        ↓
Fase 2 · Cimientos
        ├──────────────┐
        ↓              ↓
Fase 3 · US1       Fase 4 · US2
        └──────┬───────┘
               ↓
        Fase 5 · US3
               ↓
        Fase 6 · Cierre
```

- US1 y US2 dependen solo de Cimientos y pueden desarrollarse en paralelo.
- US3 depende de US1 y US2 porque confirmar requiere carrito y dirección.
- Cierre depende de las historias que se pretendan entregar; para E2 completa, depende de las tres.

### Dentro de cada fase

- Cimientos: T004–T011 se escriben y deben fallar antes de T012–T024.
- US1: T025–T033 fallan antes de T034–T044.
- US2: T045–T054 fallan antes de T055–T066.
- US3: T067–T084 fallan antes de T085–T100.
- Dentro de un servicio, las tareas se ejecutan en orden porque modifican el mismo archivo.
- Migración: T023 define el esquema Prisma y T024 genera/completa SQL; T011 prueba el resultado.
- Ninguna tarea añade endpoint o DTO de consulta del historial.

### Oportunidades de paralelismo

- T001 y T002 pueden ejecutarse a la vez.
- Las pruebas fundacionales T004–T011 usan archivos distintos.
- Las nueve pruebas de US1 T025–T033 son paralelizables.
- Las diez pruebas de US2 T045–T054 son paralelizables; toda US2 puede avanzar junto con US1.
- Las dieciocho pruebas de US3 T067–T084 son paralelizables por archivo.
- El formulario T062 y el diálogo T098 pueden construirse contra contratos estables mientras avanza su API.
- Las validaciones T101–T103 pueden repartirse entre personas.

---

## Ejemplos de ejecución paralela

### US1 y US2 en paralelo

```text
Equipo A: T025 cart-add · T026 cart-quantity · T029 cart-price-live · T033 carrito web
Equipo B: T045 addresses-create · T048 addresses-concurrency · T052 addresses-delete · T054 direcciones web
```

### US3: invariantes críticas en paralelo

```text
T071 doble confirmación
T075 carrera aceptar/rechazar
T079 evento inicial
T080 eventos de transición
T081 rollback por fallo del evento
T082 append-only
T083 carrera usar/eliminar dirección
```

La escritura de baterías puede paralelizarse; `jest.integration.config.js` mantiene su ejecución
serial contra la base compartida.

---

## Estrategia de implementación

### MVP primero

1. Completar Preparación y Cimientos.
2. Completar US1.
3. Parar y validar V-01 a V-09.
4. Demostrar un carrito persistente y editable sin anticipar direcciones ni pedidos.

### Entrega incremental

1. Cimientos → contratos y base protegida.
2. US1 → carrito demostrable.
3. US2 → direcciones demostrables y consistentes bajo carrera.
4. US3 → pedido completo con historial atómico.
5. Cierre → evidencia manual y automática completa.

### Equipo paralelo

Tras Cimientos, un equipo puede implementar US1 y otro US2. Ambos convergen antes de US3.
Dentro de US3, API, interfaz y baterías se separan por los contratos ya definidos.

## Notas

- `[P]` significa archivos distintos y ausencia de dependencias pendientes.
- No hay endpoint, DTO ni pantalla de historial en E2; E4 los incorporará.
- `OrderStatusEvent` no tiene `updatedAt` ni operaciones de edición/borrado.
- Los triggers temporales de fallo usados en pruebas se eliminan siempre en `finally`.
- Cada tarea debe cerrar con su prueba correspondiente en verde.
- Si aparece comportamiento no escrito, primero se modifica la spec; no se amplía esta lista.

## Resumen

| Fase | Tareas | Historia |
|---|---:|---|
| 1 · Preparación | T001–T003 (3) | — |
| 2 · Cimientos | T004–T024 (21) | — |
| 3 · Carrito | T025–T044 (20) | US1 (P1) |
| 4 · Direcciones | T045–T066 (22) | US2 (P2) |
| 5 · Pedidos | T067–T100 (34) | US3 (P3) |
| 6 · Cierre | T101–T108 (8) | — |
| **Total** | **108** | |