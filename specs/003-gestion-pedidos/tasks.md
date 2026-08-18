---
description: "Lista de tareas de implementación: E2 · Gestión de pedidos"
---

# Tareas: E2 · Gestión de pedidos

**Entrada**: documentos de diseño de `specs/003-gestion-pedidos/`

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Pruebas**: **sí se incluyen tareas de prueba**, y no como opción. El Principio XI de la
constitución las exige antes de programar, y las tres invariantes centrales de esta épica —la
doble confirmación (D-037), la carrera de aceptar/rechazar (D-038) y la revalidación de precio
(D-036)— **no se pueden comprobar con unitarios**: son de integración por definición.

**Organización**: por historia de usuario, en el orden de prioridad de la spec, que es también
el orden real en que el cliente las recorre — carrito → dirección → confirmar y ver el estado.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]** = HU-12 · Carrito editable manual (P1) · **[US2]** = HU-11 · Direcciones de entrega
  (P2) · **[US3]** = HU-01 · Gestión de pedidos con estado visible (P3)

## Convenciones de ruta

Monorepo pnpm ya existente: `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
rutas de cada tarea son las declaradas en [plan.md](./plan.md) § Estructura del Proyecto.

**Las pruebas de integración van en `services/api/test/`, con el sufijo
`.integration-spec.ts`**, un archivo por batería, como en E1/E3. `jest.integration.config.js` las
selecciona con `testRegex: 'test/.*\.integration-spec\.ts$'`; una batería fuera de ese patrón no
se ejecutaría y la suite pasaría en verde sin haberla corrido. Los unitarios usan Vitest en
`packages/shared` y `apps/web`, y Jest en `services/api`.

---

## Fase 1: Preparación

**Propósito**: dejar sitio a los tres módulos nuevos sin tocar nada de E1 ni de E3. No hay que
inicializar proyecto, ni instalar dependencias, ni configurar linters: E2 no incorpora **ninguna
dependencia nueva**.

- [ ] T001 [P] Crear el árbol de carpetas vacío de los módulos nuevos en `services/api/src/cart/`, `services/api/src/addresses/` y `services/api/src/orders/`
- [ ] T002 [P] Crear el árbol de carpetas vacío de las pantallas nuevas en `apps/web/src/app/cliente/carrito/`, `apps/web/src/app/cliente/direcciones/`, `apps/web/src/app/cliente/pedidos/` y `apps/web/src/app/negocio/pedidos/`
- [ ] T003 Comprobar que `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build` pasan en verde **antes** de tocar nada, para que cualquier fallo posterior sea atribuible a esta épica, según [quickstart.md](./quickstart.md) § Comprobaciones automáticas

---

## Fase 2: Cimientos (prerrequisito bloqueante)

**Propósito**: el contrato de estados ampliado, los esquemas Zod y el esquema de datos. Todo lo
demás depende de esta fase.

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esta fase esté completa.

### Contrato de estados ampliado — `packages/shared`

- [ ] T004 Añadir `RECHAZADO` a `OrderStatus` en `packages/shared/src/enums/order-status.ts`, actualizando su comentario para reflejar la enmienda 2.0.0 del Principio XII (D-035)
- [ ] T005 Añadir la rama `CREADO → RECHAZADO` a `SIGUIENTE` en `packages/shared/src/order-state/machine.ts`, sin tocar ninguna de las cinco transiciones existentes (FR-030)
- [ ] T006 [P] Actualizar `packages/shared/tests/order-state.test.ts` con los casos de `RECHAZADO`: alcanzable solo desde `creado`, terminal (`transicionesValidas(RECHAZADO)` vacío), y que ninguna transición existente cambió (RN-008)

### Contratos compartidos — `packages/shared`

- [ ] T007 [P] Crear `AddCartLineSchema` y `UpdateCartLineQuantitySchema` en `packages/shared/src/schemas/cart.ts` (FR-002, FR-003, contracts/shared.md)
- [ ] T008 [P] Escribir las pruebas unitarias de los esquemas de carrito en `packages/shared/src/schemas/cart.spec.ts`, incluida la cantidad `0`, negativa y no entera
- [ ] T009 [P] Crear `CreateAddressSchema`, `UpdateAddressSchema` y `ChangeAddressStatusSchema` en `packages/shared/src/schemas/address.ts`, con `.trim()` antes de `.min()` para que un texto de solo espacios se rechace igual que uno vacío (FR-013, contracts/shared.md)
- [ ] T010 [P] Escribir las pruebas unitarias de los esquemas de dirección en `packages/shared/src/schemas/address.spec.ts`, incluidos los límites 2/60 de la etiqueta y 10/500 del texto, y el texto compuesto solo de saltos de línea y espacios
- [ ] T011 [P] Crear `ConfirmOrderSchema` —con el refinamiento que exige `addressId` o `addressText`— y `RejectOrderSchema` en `packages/shared/src/schemas/order.ts` (FR-022, FR-033, contracts/shared.md)
- [ ] T012 [P] Escribir las pruebas unitarias de los esquemas de pedido en `packages/shared/src/schemas/order.spec.ts`, incluido el motivo de rechazo de solo espacios y la ausencia de ambos campos de dirección
- [ ] T013 Añadir `BusinessOrdersQuerySchema` a `packages/shared/src/schemas/query.ts` (FR-041, D-043)
- [ ] T014 Añadir a `packages/shared/src/messages/es.ts` los catorce mensajes fijos de E2 listados en `contracts/shared.md` § Mensajes nuevos
- [ ] T015 Modificar `ETIQUETA_ESTADO_PEDIDO` en `packages/shared/src/messages/etiquetas.ts`: cambiar `CREADO` de `'Creado'` a `'Pendiente'` y añadir `RECHAZADO: 'Rechazado'` (FR-037, D-041)
- [ ] T016 [P] Actualizar `packages/shared/tests/messages.test.ts` y las pruebas de `apps/web` que fijan el texto `'Creado'` para que esperen `'Pendiente'`, y añadir el caso de `'Rechazado'` (D-041)
- [ ] T017 Añadir `CartLineDto`, `CartDto`, `AddressDto`, `OrderLineDto` y `OrderSummaryDto` a `packages/shared/src/types/api.ts`, sin tocar `OrderDto` (data-model.md § Tipos)
- [ ] T018 Exportar toda la superficie nueva desde `packages/shared/src/index.ts` según `contracts/shared.md` § Superficie pública añadida

### Esquema de datos — `services/api`

- [ ] T019 Añadir `RECHAZADO` al enum `OrderStatus` de `services/api/prisma/schema.prisma` y los modelos `Cart`, `CartLine`, `Address`, `Order` y `OrderLine` con sus relaciones, índices y claves foráneas de `data-model.md` § Fragmento de `schema.prisma`
- [ ] T020 Generar la migración con `prisma migrate dev` y añadirle a mano las restricciones `CHECK (quantity >= 1)` de `cart_line` y `order_line`, que Prisma no expresa en el esquema (data-model.md § Restricciones SQL)
- [ ] T021 Comprobar sobre una base efímera que la migración aplica limpia y que los índices y restricciones únicas existen, en `services/api/test/orders-schema.integration-spec.ts`

**Punto de control**: los contratos compilan, la base tiene las cinco tablas y `RECHAZADO` existe
de punta a punta. Las historias pueden empezar.

---

## Fase 3: Historia de Usuario 1 — Carrito editable manual (HU-12, P1) 🎯 MVP

**Objetivo**: el cliente arma, corrige y vacía su carrito contra el catálogo real de E3, sin
dirección ni pedido.

**Prueba independiente**: con un usuario de rol cliente y el catálogo semilla de E3, se recorre
entera —agregar, rechazo de agotado/dado de baja, sumar cantidad, bajar a 0, quitar, persistencia
entre sesiones, marcado de no disponible, precio vigente, vaciar—. Corresponde a los pasos
**V-01 a V-09** de quickstart.md.

### Pruebas de la Historia 1

- [ ] T022 [P] [US1] Batería de integración de alta de línea en `services/api/test/cart-add.integration-spec.ts`: producto activo y disponible queda con cantidad 1 y precio vigente; agregar uno agotado y uno dado de baja se impide con `409 CART_HAS_UNAVAILABLE_LINES` (HU12-E01, E02, E03, FR-002)
- [ ] T023 [P] [US1] Batería de integración de suma de cantidad en `services/api/test/cart-add.integration-spec.ts` (mismo archivo que T022, distinto `describe`): agregar dos veces el mismo producto suma a la línea existente, sin crear una segunda (HU12-E, FR-004)
- [ ] T024 [P] [US1] Batería de integración de cantidad en `services/api/test/cart-quantity.integration-spec.ts`: cambiar a 3 actualiza el subtotal, bajar a 0 quita la línea, cantidad negativa o no entera se rechaza (HU12-E04, E05, FR-003)
- [ ] T025 [P] [US1] Batería de integración de eliminación en `services/api/test/cart-remove.integration-spec.ts`: quitar una línea con la acción de eliminar, sin importar su cantidad (HU12-E06, FR-005)
- [ ] T026 [P] [US1] Batería de integración de vaciado en `services/api/test/cart-clear.integration-spec.ts`: vaciar con varios productos deja el carrito vacío, e idempotente sobre uno ya vacío (HU12-E11, FR-010)
- [ ] T027 [P] [US1] Batería de integración de precio vigente en `services/api/test/cart-price-live.integration-spec.ts`: el carrito recalcula el precio en cada carga y refleja un cambio del negocio antes de confirmar, sin congelarlo (HU12-E10, FR-006, RN-003)
- [ ] T028 [P] [US1] Batería de integración de disponibilidad en `services/api/test/cart-unavailable.integration-spec.ts`: un producto que se agota o se da de baja estando en el carrito se marca `available: false` en el `CartDto` y **no se retira solo** (HU12-E09, FR-007, FR-008, RN-004)
- [ ] T029 [P] [US1] Batería de integración de persistencia en `services/api/test/cart-persistence.integration-spec.ts`: cerrar sesión y volver a iniciarla conserva los mismos productos y cantidades (HU12-E07, FR-011)
- [ ] T030 [P] [US1] Batería de integración de autorización en `services/api/test/cart-roles.integration-spec.ts`: cada endpoint de `/cart` invocado con sesión de negocio, repartidor y administrador devuelve `403` (RN-001, D-042)

### Implementación de la Historia 1

- [ ] T031 [US1] Implementar `CartService.obtener` en `services/api/src/cart/cart.service.ts`: si no existe fila `Cart`, devuelve `{ lines: [] }`; si existe, une contra `Product` vigente y marca `available` (D-046, FR-006, FR-007)
- [ ] T032 [US1] Implementar `CartService.agregarLinea` con `upsert` sobre `Cart` por `userId` (creación perezosa) y sobre `CartLine` por `(cartId, productId)` sumando cantidad, comprobando `active && available` antes de escribir, en `services/api/src/cart/cart.service.ts` (FR-002, FR-004, D-046)
- [ ] T033 [US1] Implementar `CartService.cambiarCantidad` (quitando la línea si `quantity === 0`) y `CartService.quitarLinea` en `services/api/src/cart/cart.service.ts` (FR-003, FR-005)
- [ ] T034 [US1] Implementar `CartService.vaciar`, idempotente, en `services/api/src/cart/cart.service.ts` (FR-010)
- [ ] T035 [US1] Implementar `CartController` con los cinco endpoints de `contracts/api.md`, `@Roles(CLIENTE)` en la clase, en `services/api/src/cart/cart.controller.ts` (D-042)
- [ ] T036 [US1] Registrar `CartModule` en `services/api/src/app.module.ts` y crear `services/api/src/cart/cart.module.ts`
- [ ] T037 [US1] Añadir el botón «Agregar» al carrito, visible solo para el rol `CLIENTE`, en el listado y la ficha del menú de E3 —`apps/web/src/app/menu/page.tsx` y `apps/web/src/app/menu/[id]/page.tsx`—, deshabilitado sobre productos agotados o dados de baja (FR-002, Clarification 2026-08-17: el clic es la confirmación exigida por el Principio IX, sin segundo paso)
- [ ] T038 [US1] Construir la pantalla de carrito con la lista de líneas, controles de cantidad, quitar y vaciar, en `apps/web/src/app/cliente/carrito/page.tsx` (FR-003, FR-005, FR-010)
- [ ] T039 [US1] Marcar visualmente las líneas no disponibles y bloquear el botón de confirmar mientras exista alguna, en `apps/web/src/app/cliente/carrito/page.tsx` (FR-007)
- [ ] T040 [US1] Mostrar el mensaje de carrito vacío y deshabilitar cualquier acción de confirmar cuando no hay líneas, en `apps/web/src/app/cliente/carrito/page.tsx` (FR-009, HU12-E08)
- [ ] T041 [US1] Deshabilitar cada control mientras espera respuesta, en `apps/web/src/app/cliente/carrito/page.tsx`, para que un doble clic no dispare dos veces (FR-026 de E3, mismo criterio)

**Punto de control**: HU-12 es demostrable por sí sola. Es el MVP de la épica.

---

## Fase 4: Historia de Usuario 2 — Direcciones de entrega etiquetadas (HU-11, P2)

**Objetivo**: el cliente registra, edita, activa/desactiva y marca como predeterminada una o
varias direcciones de solo texto, sin depender de ningún carrito ni pedido.

**Prueba independiente**: con un usuario de rol cliente, se recorre entera —alta con
predeterminada automática, segunda dirección, duplicado de etiqueta normalizado, campos vacíos,
cambiar predeterminada, editar, desactivar/reactivar en sus cuatro combinaciones, eliminar sin
rastro—. Corresponde a los pasos **V-10 a V-20**.

**Depende de**: la Fase 2 únicamente. Es independiente de la Fase 3 — ninguna prueba ni pantalla
de direcciones necesita que exista un carrito.

### Pruebas de la Historia 2

- [ ] T042 [P] [US2] Batería de integración de alta en `services/api/test/addresses-create.integration-spec.ts`: primera dirección queda predeterminada automáticamente; segunda no cambia la marca; etiqueta o texto vacíos (incluido solo espacios) se rechazan asociados al campo (HU11-E01, E02, E04, FR-012, FR-013, FR-015)
- [ ] T043 [P] [US2] Batería de integración de unicidad en `services/api/test/addresses-unique.integration-spec.ts`: "Casa" y "casa " colisionan vía `normalizarBusqueda`, incluida la colisión con una etiqueta ya desactivada (HU11-E03, FR-014, D-040)
- [ ] T044 [P] [US2] Batería de integración de predeterminada en `services/api/test/addresses-default.integration-spec.ts`: marcar otra como predeterminada quita la marca a la anterior, en una sola transacción (HU11-E05, FR-015)
- [ ] T045 [P] [US2] Batería de integración de edición en `services/api/test/addresses-edit.integration-spec.ts`: editar el texto no afecta ningún pedido ya confirmado con la dirección anterior (HU11-E06, E09, FR-016, RN-006) — este último caso puede sembrar un `Order` directamente por Prisma, sin pasar por `POST /orders`, ya que solo verifica que `address_text` no cambió
- [ ] T046 [P] [US2] Batería de integración de desactivación en `services/api/test/addresses-deactivate.integration-spec.ts`: desactivar la predeterminada con otra activa existente responde `409 ADDRESS_NEEDS_NEW_DEFAULT` sin aplicar nada; desactivar la única activa se permite y deja sin predeterminada (HU11-E11, E12, FR-018, FR-020)
- [ ] T047 [P] [US2] Batería de integración de reactivación en `services/api/test/addresses-reactivate.integration-spec.ts`: reactivar sin ninguna activa la vuelve predeterminada; reactivar con otra ya predeterminada no cambia la marca (HU11-E13, E14, FR-018)
- [ ] T048 [P] [US2] Batería de integración de eliminación en `services/api/test/addresses-delete.integration-spec.ts`: una dirección nunca usada se elimina sin dejar rastro; una con `usedInOrder = true` responde `409 ADDRESS_IN_USE` (FR-019, D-039)
- [ ] T049 [P] [US2] Batería de integración de autorización en `services/api/test/addresses-roles.integration-spec.ts`: cada endpoint de `/addresses` con sesión de negocio, repartidor y administrador devuelve `403` (D-042)

### Implementación de la Historia 2

- [ ] T050 [US2] Implementar `AddressesService.crear`, derivando `labelNormalized` con `normalizarBusqueda`, traduciendo la violación del índice único a `ADDRESS_LABEL_ALREADY_EXISTS`, y marcando `isDefault: true` cuando es la primera activa del cliente, en `services/api/src/addresses/addresses.service.ts` (FR-012, FR-014, FR-015, D-040)
- [ ] T051 [US2] Implementar `AddressesService.editar` (label y text, sin tocar `isDefault`/`active`/`usedInOrder`) en `services/api/src/addresses/addresses.service.ts` (FR-016)
- [ ] T052 [US2] Implementar `AddressesService.marcarPredeterminada`, dentro de una transacción que quita la marca a cualquier otra dirección del mismo cliente, en `services/api/src/addresses/addresses.service.ts` (FR-015)
- [ ] T053 [US2] Implementar `AddressesService.cambiarEstado`: al desactivar la predeterminada con otras activas, lanza `ADDRESS_NEEDS_NEW_DEFAULT`; al desactivar la última activa, la deja sin predeterminada; al reactivar, la marca predeterminada solo si no hay ninguna otra activa; petición sin efecto si ya tiene ese valor, en `services/api/src/addresses/addresses.service.ts` (FR-018, FR-020)
- [ ] T054 [US2] Implementar `AddressesService.eliminar`, rechazando con `ADDRESS_IN_USE` si `usedInOrder = true`, en `services/api/src/addresses/addresses.service.ts` (FR-019, D-039)
- [ ] T055 [US2] Implementar `AddressesController` con los seis endpoints de `contracts/api.md`, `@Roles(CLIENTE)` en la clase, en `services/api/src/addresses/addresses.controller.ts`
- [ ] T056 [US2] Registrar `AddressesModule` en `services/api/src/app.module.ts` y crear `services/api/src/addresses/addresses.module.ts`
- [ ] T057 [P] [US2] Construir el formulario de dirección con react-hook-form y el resolver de los esquemas compartidos, en `apps/web/src/app/cliente/direcciones/_components/formulario-direccion.tsx`, con solo campos de texto — ningún selector de mapa, pin o coordenadas (FR-021, HU11-E15)
- [ ] T058 [US2] Construir las pantallas de alta y edición en `apps/web/src/app/cliente/direcciones/nueva/page.tsx` y `apps/web/src/app/cliente/direcciones/[id]/editar/page.tsx`
- [ ] T059 [US2] Construir el listado con la marca de predeterminada, activas y desactivadas, y las acciones de marcar predeterminada, desactivar/reactivar y eliminar, en `apps/web/src/app/cliente/direcciones/page.tsx` (FR-015, FR-018, FR-019)
- [ ] T060 [US2] Presentar el rechazo `ADDRESS_NEEDS_NEW_DEFAULT` pidiendo elegir otra predeterminada antes de desactivar, en `apps/web/src/app/cliente/direcciones/page.tsx` (FR-020)
- [ ] T061 [US2] Deshabilitar cada control mientras espera respuesta, en las tres pantallas de `apps/web/src/app/cliente/direcciones/`

**Punto de control**: HU-11 es demostrable por sí sola, en paralelo a HU-12 si hay más de una
persona trabajando.

---

## Fase 5: Historia de Usuario 3 — Gestión de pedidos con estado visible (HU-01, P3)

**Objetivo**: el cliente confirma su carrito con una dirección como pedido, y el negocio lo
acepta o lo rechaza con motivo.

**Prueba independiente**: con un carrito armado (Fase 3) y una dirección elegida (Fase 4) ya
disponibles, se recorre entera —confirmar, precondiciones de carrito vacío y sin dirección,
bandeja del negocio, aceptar, rechazar con motivo, los cinco bloqueos de estado y rol, snapshot
de precio, inmutabilidad, paginación de la bandeja, revalidación de precio—. Corresponde a los
pasos **V-21 a V-36**.

**Depende de**: las Fases 3 y 4. FR-025 exige "carrito con al menos una línea y una dirección de
entrega elegida" — sin ambas construidas, no hay nada que confirmar.

### Pruebas de la Historia 3 — confirmación (lado cliente)

- [ ] T062 [P] [US3] Batería de integración de confirmación en `services/api/test/orders-confirm.integration-spec.ts`: carrito + dirección guardada crea un pedido `creado` con líneas y dirección congeladas, y vacía el carrito; con dirección puntual (`addressText`) crea el pedido sin tocar la lista de direcciones guardadas (HU01-E01, HU11-E07, E10, FR-025, FR-026, FR-027, FR-029)
- [ ] T063 [P] [US3] Batería de integración de precondiciones en `services/api/test/orders-preconditions.integration-spec.ts`: carrito vacío responde `409 CART_EMPTY`; carrito con productos y sin ninguna dirección responde `409 ADDRESS_REQUIRED`; en ambos casos no se crea nada (HU01-E02, E03, FR-009 vía pedidos, FR-022)
- [ ] T064 [P] [US3] Batería de integración de precio cambiado en `services/api/test/orders-price-changed.integration-spec.ts`: `expectedLines` con un precio desactualizado en **una sola línea entre varias** responde `409 PRICE_CHANGED`, no crea el pedido y el carrito conserva sus líneas (HU01-E16, FR-028, D-036)
- [ ] T065 [P] [US3] Batería de integración de disponibilidad en `services/api/test/orders-unavailable.integration-spec.ts`: un producto del carrito que se agota o se da de baja justo antes de confirmar responde `409 CART_HAS_UNAVAILABLE_LINES` y no crea nada (caso límite "condición de carrera", FR-028, D-045)
- [ ] T066 [P] [US3] Batería de integración de concurrencia en `services/api/test/orders-concurrency-confirm.integration-spec.ts`: dos confirmaciones simultáneas (`Promise.all`) del mismo carrito — exactamente una crea el pedido y vacía el carrito, la otra responde `409 CART_EMPTY` (caso límite "dos confirmaciones desde dos pestañas", FR-036, D-037)
- [ ] T067 [P] [US3] Batería de integración de inmutabilidad en `services/api/test/orders-immutable.integration-spec.ts`: cambiar el precio de un producto tras confirmar no altera el pedido ya creado, y no existe ningún endpoint que edite productos, cantidades o dirección de un pedido confirmado (HU01-E12, E13, FR-027, FR-035, RN-009)

### Pruebas de la Historia 3 — bandeja del negocio

- [ ] T068 [P] [US3] Batería de integración de aceptación en `services/api/test/orders-accept.integration-spec.ts`: aceptar un pedido `creado` lo pasa a `en_preparacion`; aceptar uno ya `rechazado` o `en_preparacion` responde `409 ORDER_NOT_PENDING` (HU01-E05, E08, FR-031, FR-032)
- [ ] T069 [P] [US3] Batería de integración de rechazo en `services/api/test/orders-reject.integration-spec.ts`: rechazar con motivo lo pasa a `rechazado` con el motivo visible; sin motivo o con motivo de solo espacios responde `400 VALIDATION_ERROR`; rechazar uno ya `en_preparacion` responde `409 ORDER_NOT_PENDING` (HU01-E06, E07, E09, FR-031, FR-033)
- [ ] T070 [P] [US3] Batería de integración de concurrencia en `services/api/test/orders-concurrency-accept-reject.integration-spec.ts`: aceptar y rechazar el mismo pedido `creado` simultáneamente — exactamente una tiene efecto, la otra responde `409 ORDER_NOT_PENDING`, sin duplicar el efecto (caso límite "el negocio intenta aceptar y rechazar casi al mismo tiempo", FR-036, D-038)
- [ ] T071 [P] [US3] Batería de integración de autorización en `services/api/test/orders-roles.integration-spec.ts`: un cliente que intenta aceptar/rechazar recibe `403`; un negocio que intenta `POST /orders` recibe `403` — no tiene carrito (HU01-E10, E11, RN-001)
- [ ] T072 [P] [US3] Batería de integración de paginación en `services/api/test/orders-queue-pagination.integration-spec.ts`: sin pedidos pendientes devuelve lista vacía; con 21 pedidos `creado`/`en_preparacion` intercalados en el tiempo, la bandeja los reparte 20/1, del más antiguo al más reciente, sin repetidos ni omitidos entre páginas (HU01-E14, E15, FR-040, FR-041, D-043)
- [ ] T073 [P] [US3] Batería de integración de consulta de rechazados en `services/api/test/orders-rejected-list.integration-spec.ts`: el negocio ve los pedidos que él mismo rechazó con su motivo, y ningún pedido aceptado o pendiente aparece ahí (FR-039)

### Implementación de la Historia 3

- [ ] T074 [US3] Implementar `OrdersService.confirmar` en `services/api/src/orders/orders.service.ts`: abre transacción, bloquea la fila de `Cart` con `SELECT … FOR UPDATE` (`tx.$queryRaw`), valida líneas no vacías, dirección presente, `expectedLines` contra precio y disponibilidad vigentes producto a producto, crea `Order`+`OrderLine` con snapshot, marca `Address.usedInOrder` si aplica, y borra las líneas del carrito (D-036, D-037, D-045, FR-025 a FR-029)
- [ ] T075 [US3] Implementar `OrdersService.listarDelCliente` (sin paginar, más reciente primero) en `services/api/src/orders/orders.service.ts` (D-044)
- [ ] T076 [US3] Implementar `OrdersService.listarBandejaNegocio`, combinando `creado`/`en_preparacion` con el filtro `status` opcional, paginado `PAGE_SIZE` y ordenado `created_at ASC, id ASC`, en `services/api/src/orders/orders.service.ts` (FR-038, FR-041, D-043)
- [ ] T077 [US3] Implementar `OrdersService.listarRechazados` (sin paginar) en `services/api/src/orders/orders.service.ts` (FR-039)
- [ ] T078 [US3] Implementar `OrdersService.aceptar` y `OrdersService.rechazar` con `updateMany({ where: { id, status: CREADO } })` condicionado, lanzando `ORDER_NOT_PENDING` si `count === 0`, en `services/api/src/orders/orders.service.ts` (FR-031, FR-032, FR-033, D-038)
- [ ] T079 [US3] Implementar `OrdersController` (`POST /orders`, `GET /orders`) con `@Roles(CLIENTE)`, en `services/api/src/orders/orders.controller.ts`
- [ ] T080 [US3] Implementar `BusinessOrdersController` (`GET /business/orders`, `GET /business/orders/rejected`, `PUT /business/orders/:id/accept`, `PUT /business/orders/:id/reject`) con `@Roles(NEGOCIO)`, en `services/api/src/orders/business-orders.controller.ts`
- [ ] T081 [US3] Registrar `OrdersModule` (los dos controladores) en `services/api/src/app.module.ts` y crear `services/api/src/orders/orders.module.ts`
- [ ] T082 [US3] Construir la pantalla de confirmación —resumen del carrito, elegir dirección guardada o escribir una puntual, envío de `expectedLines` con los precios que la pantalla mostró— en `apps/web/src/app/cliente/pedidos/confirmar/page.tsx` (FR-022, FR-024, D-036)
- [ ] T083 [US3] Reaccionar a `409 PRICE_CHANGED` recargando el carrito y mostrando el aviso en español antes de permitir reintentar, en `apps/web/src/app/cliente/pedidos/confirmar/page.tsx` (FR-028)
- [ ] T084 [US3] Construir el listado "mis pedidos" del cliente con la etiqueta de estado y, cuando corresponda, el motivo de rechazo, en `apps/web/src/app/cliente/pedidos/page.tsx` (FR-037)
- [ ] T085 [US3] Construir la bandeja del negocio, paginada, con productos/cantidades/precios/dirección de cada pedido y las acciones aceptar/rechazar en dos clics, en `apps/web/src/app/negocio/pedidos/page.tsx` (FR-038, FR-041, SC-005)
- [ ] T086 [US3] Construir el diálogo de rechazo que exige el motivo antes de habilitar el envío, en `apps/web/src/app/negocio/pedidos/_components/dialogo-rechazo.tsx` (FR-033)
- [ ] T087 [US3] Mostrar el mensaje de bandeja sin pedidos pendientes y el listado de rechazados propios, en `apps/web/src/app/negocio/pedidos/page.tsx` y `apps/web/src/app/negocio/pedidos/rechazados/page.tsx` (FR-039, FR-040)
- [ ] T088 [US3] Deshabilitar cada control mientras espera respuesta, en `apps/web/src/app/cliente/pedidos/` y `apps/web/src/app/negocio/pedidos/`, para que un doble clic no dispare dos veces (FR-036)

**Punto de control**: las tres historias funcionan juntas — el flujo de punta a punta que E2
existe para crear queda completo.

---

## Fase 6: Cierre y validación

**Propósito**: lo transversal. **No es un trámite**: en E1 y E3, la mitad de los defectos que
la validación manual encontró no los detectaba ninguna prueba automática.

- [ ] T089 Recorrer las nueve pantallas nuevas comprobando que todo texto visible está en español y que ningún mensaje suelto aparece sin asociar a su campo (Principio II, Principio IV)
- [ ] T090 Recorrer y operar las nueve pantallas solo con teclado, verificando foco visible y etiqueta asociada en cada campo, incluido el diálogo de rechazo (FR-037 de E3, mismo criterio)
- [ ] T091 Comprobar las nueve pantallas a 360 píxeles de ancho, en particular la bandeja del negocio y el carrito
- [ ] T092 Ejecutar desde la raíz del repositorio `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`, y dejarlas en verde ([quickstart.md](./quickstart.md) § Comprobaciones automáticas)
- [ ] T093 Ejecutar los 36 pasos de [quickstart.md](./quickstart.md) § Validación funcional con las sesiones de cliente y negocio abiertas a la vez, anotando el resultado de cada uno. Es la única cobertura de los criterios sin automatización — SC-001, SC-005, SC-009 y SC-011 (cronómetro y conteo de clics)
- [ ] T094 Registrar el resultado de la validación en `specs/003-gestion-pedidos/verificacion.md`, con el mismo formato que E1 y E3, declarando explícitamente los criterios sin cobertura automática
- [ ] T095 Actualizar `CLAUDE.md` y `specs/README.md` con el estado de E2 una vez verificada

---

## Dependencias y orden de ejecución

### Entre fases

- **Fase 1 · Preparación**: sin dependencias.
- **Fase 2 · Cimientos**: depende de la Fase 1. **Bloquea todo lo demás.**
- **Fase 3 · US1 (Carrito)**: depende de la Fase 2 únicamente.
- **Fase 4 · US2 (Direcciones)**: depende de la Fase 2 únicamente — **no** de la Fase 3. Las dos
  historias P1 y P2 son independientes entre sí, a diferencia de E3 (donde HU-02 necesitaba
  HU-14): nada en `spec.md` hace depender el carrito de las direcciones ni viceversa.
- **Fase 5 · US3 (Pedidos)**: depende de las Fases 3 **y** 4 — FR-025 exige ambas construidas.
- **Fase 6 · Cierre**: depende de todo lo anterior.

### Dentro de `packages/shared` (Fase 2)

El enum y la máquina de estados (T004, T005) antes que cualquier esquema o tipo que los use. Los
tres archivos de esquemas (T007, T009, T011) son independientes entre sí. Los mensajes (T014) y
las etiquetas (T015) tocan archivos distintos y pueden ir en paralelo entre sí, pero cada uno
depende de que los esquemas que los citan ya existan solo por claridad de lectura, no por
compilación. El índice (T018) al final.

### Dentro de cada historia

Pruebas → servicio → controlador → módulo → pantallas — mismo orden que E3. El servicio antes que
el controlador porque este último solo valida y delega; las pantallas al final, cuando hay API
contra la que trabajar.

### Oportunidades de paralelismo

- **Fase 2**: T006, T008, T010, T012 (pruebas unitarias) en paralelo entre sí y con T007/T009/T011 respectivos. T014 y T015 tocan los dos archivos de mensajes, así que **no** son paralelizables entre sí.
- **Fase 3**: las **nueve** baterías T022 a T030 en paralelo, cada una en su propio archivo (T022 y T023 comparten `cart-add.integration-spec.ts` en dos `describe` distintos y se escriben juntas).
- **Fase 4**: las **ocho** baterías T042 a T049 en paralelo. Puede ejecutarse en paralelo con toda la Fase 3, si hay más de una persona.
- **Fase 5**: las **doce** baterías T062 a T073 en paralelo.
- **Fase 6**: T089, T090 y T091 son recorridos independientes de las mismas pantallas y pueden repartirse.

Las tareas del mismo archivo **nunca** se marcan como paralelas: T031 a T034 tocan las cuatro
`cart.service.ts` y van una tras otra; lo mismo T050 a T054 sobre `addresses.service.ts` y T074 a
T078 sobre `orders.service.ts`.

## Ejemplo de ejecución paralela: Historia 1 y 2 a la vez

```bash
# Equipo A — Historia 1 (Carrito), todas sus baterías:
Tarea: "Batería de alta en services/api/test/cart-add.integration-spec.ts"
Tarea: "Batería de cantidad en services/api/test/cart-quantity.integration-spec.ts"
Tarea: "Batería de eliminación en services/api/test/cart-remove.integration-spec.ts"
Tarea: "Batería de vaciado en services/api/test/cart-clear.integration-spec.ts"
Tarea: "Batería de precio vigente en services/api/test/cart-price-live.integration-spec.ts"
Tarea: "Batería de disponibilidad en services/api/test/cart-unavailable.integration-spec.ts"
Tarea: "Batería de persistencia en services/api/test/cart-persistence.integration-spec.ts"
Tarea: "Batería de autorización en services/api/test/cart-roles.integration-spec.ts"

# Equipo B — Historia 2 (Direcciones), en paralelo, sin conflicto de archivos:
Tarea: "Batería de alta en services/api/test/addresses-create.integration-spec.ts"
Tarea: "Batería de unicidad en services/api/test/addresses-unique.integration-spec.ts"
```

Se ejecutan en serie de todos modos —`jest.integration.config.js` fija `maxWorkers: 1` porque
comparten una única base de datos—; lo que se paraleliza es escribirlas y ejecutar cada equipo su
implementación, no correr las baterías a la vez.

## Estrategia de implementación

### MVP primero

1. Fases 1 y 2 completas.
2. Fase 3 · HU-12 entera.
3. **Parar y validar**: pasos V-01 a V-09 con un usuario de rol cliente y el catálogo de E3.
4. Ya hay algo demostrable: el cliente arma su carrito, aunque todavía no pueda confirmarlo.

### Entrega incremental

1. Cimientos → contrato de estados y esquema listos.
2. + HU-12 → validar → demostrable (MVP).
3. + HU-11 → validar → el cliente administra sus direcciones, en paralelo o después de HU-12.
4. + HU-01 → validar → el flujo de punta a punta de la épica queda completo: carrito + dirección
   + confirmar + aceptar/rechazar.
5. + Cierre → E2 verificada.

### Con varias personas

A diferencia de E3, **HU-12 y HU-11 sí son paralelizables entre sí** — ninguna depende de la
otra. HU-01 es la única que espera a que ambas terminen. Dentro de cada fase, separar API e
interfaz es posible porque `contracts/api.md` es lo bastante preciso para trabajar contra él
antes de que exista.

## Notas

- `[P]` = archivos distintos, sin dependencias pendientes.
- Commit por tarea o por grupo lógico, con el asunto en español.
- Ninguna tarea introduce una dependencia nueva. Si alguna parece necesitarla, es señal de que
  hay que revisar el plan antes de instalarla.
- Cada tarea remite a un requisito o a un escenario. Si algo no está en la spec, no se
  construye: se enmienda la spec primero.

## Resumen

| Fase | Tareas | Historia |
|---|---|---|
| 1 · Preparación | T001–T003 (3) | — |
| 2 · Cimientos | T004–T021 (18) | — |
| 3 · Carrito | T022–T041 (20) | US1 (P1) |
| 4 · Direcciones | T042–T061 (20) | US2 (P2) |
| 5 · Pedidos | T062–T088 (27) | US3 (P3) |
| 6 · Cierre | T089–T095 (7) | — |
| **Total** | **95** | |
