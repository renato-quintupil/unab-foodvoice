# Registro de verificación: E7 · Cierre del servicio

**Fecha**: 2026-08-27 · **Ejecutado sobre**: `docker compose up --build` (api, web y postgres en
contenedores), con el catálogo y los pedidos de épicas anteriores ya sembrados en el volumen
`foodvoice_pgdata`. Usuarios reutilizados de la validación de E5 (contraseña restablecida desde el
panel de administración para esta sesión): `cliente-reparto@foodvoice.cl`,
`negocio-reparto@foodvoice.cl`, `repartidor-a@foodvoice.cl`, y `cliente-e6@foodvoice.cl` como
segundo cliente para el caso límite de "pedido ajeno" (V-09).

Este documento recoge el resultado de T034–T035 de `tasks.md`: las cinco comprobaciones
automáticas y los diez pasos V-01 a V-10 de `quickstart.md`, recorridos contra la aplicación real,
no contra el código.

**Aclaración sobre quién ejecutó el recorrido**: lo hizo Claude, manejando el navegador real
(Claude in Chrome: clics, formularios, cambios de sesión) contra los contenedores reconstruidos
con el código de esta épica. Los tres casos límite que requieren una llamada directa a la API
(V-02, V-08, V-09) se verificaron con `fetch` ejecutado en la consola del propio navegador, sobre
la sesión real ya autenticada — no con lectura de código ni de logs, que es lo que el Principio IV
exige. La condición de carrera de confirmar/reclamar simultáneos (V-10, SC-005) se verifica con la
prueba de integración de concurrencia real (`orders-close-race.integration-spec.ts`), no
manualmente — es lo que `quickstart.md` ya declara, porque disparar dos solicitudes HTTP
verdaderamente simultáneas no es algo que la interacción humana con un navegador pueda producir de
forma confiable.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T034 | `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ Unitarios en verde (con umbrales de cobertura) en `services/api`, `packages/shared` y `apps/web`; `tsc --noEmit` limpio en los tres paquetes; **92/92 baterías de integración en verde contra PostgreSQL real (657 pruebas)**, incluidas las seis nuevas de E7; `pnpm build` en verde |
| T035 | V-01 a V-10 de `quickstart.md` | ✅ Los 10 pasos ejecutados en vivo — **ningún defecto encontrado**, igual que E9 y E4 |

---

## Ningún defecto encontrado

A diferencia de E1, E3, E2 y E5 — y en línea con E9 y E4 —, el recorrido de los 10 pasos no
encontró ningún defecto. El alcance de E7 es acotado y de patrón ya probado dos veces: las dos
transiciones reutilizan exactamente el mismo mecanismo transaccional que tomar/soltar de E5
(`updateMany` condicionado + `registrarEvento` en una sola transacción), y el reclamo reutiliza el
mismo patrón exacto que `rejectionReason` de E2 (columna nulable, mostrada donde ya se muestra el
motivo de rechazo, sin estado nuevo). El único hallazgo real de la épica —la ausencia de un camino
del negocio hacia un pedido `cerrado`— se encontró y corrigió **antes** de programar, durante
`/speckit.analyze` (C1, ver `plan.md` y `data-model.md`, D-081), no durante esta validación
funcional.

---

## V-01 a V-10 · Guía funcional

### Preparación

Se reutilizaron dos pedidos que la validación de E5 había dejado en `asignado_repartidor`
(Ensalada de Quinoa y Palta → Repartidor A; Pizza Cuatro Quesos, sin tocar) y se creó un pedido
nuevo (Pizza de Champiñones y Rúcula) con el flujo completo confirmar → aceptar → tomar, también a
cargo de Repartidor A. Quedaron así **dos pedidos en `asignado_repartidor` a cargo del mismo
repartidor**, uno detrás del otro, listos para las secciones A y C.

### A · Repartidor marca el pedido como entregado (Historia 1, SC-001)

| Paso | Resultado |
|---|---|
| V-01 | ✅ Con la sesión de Repartidor A, un clic en "Marcar como entregado" sobre la Ensalada de Quinoa y Palta: pasó a `entregado` de inmediato; el repartidor dejó de tener pedido en curso y volvió a ver la lista de disponibles (siete pedidos, incluido el segundo que se preparó para la sección C) |
| V-02 | ✅ `PUT /delivery/orders/:id/deliver` repetido sobre el mismo pedido (ya no a su cargo) respondió `409 DELIVERY_ORDER_NOT_YOURS`, `"Este pedido ya no está asignado a ti."` |

### B · Cliente confirma que su pedido llegó bien (Historia 2, SC-002, SC-006)

| Paso | Resultado |
|---|---|
| V-03 | ✅ Con la sesión de Cliente Reparto, un clic en "Todo bien" sobre la Ensalada: pasó a `cerrado` de inmediato, sin motivo de reclamo, sin salir de "Mis pedidos" |
| V-04 | ✅ El detalle del propio pedido (E4, sin ningún cambio de pantalla) muestra `asignado_repartidor → entregado` (Repartidor A) y `entregado → cerrado` (Cliente Reparto) en orden cronológico, sin motivo de reclamo |

### C · Cliente reclama por un problema (Historia 3, SC-003, SC-004, SC-006)

Repartidor A marcó como entregada también la Pizza de Champiñones y Rúcula (el pedido nuevo de la
preparación), dejándola lista para reclamo.

| Paso | Resultado |
|---|---|
| V-05 | ✅ Con la sesión de Cliente Reparto, "Reclamar" con el motivo "Llegó frío y sin las papas": el pedido pasó a `cerrado` de inmediato con ese motivo, visible en la propia lista "Mis pedidos" junto al pedido (mismo patrón que el motivo de rechazo, FR-010) |
| V-06 | ✅ Confirmar el diálogo sin escribir nada respondió con el mensaje en español "Cuéntanos qué pasó para poder registrar tu reclamo.", asociado al campo, con el diálogo abierto y el pedido sin cerrar |
| V-07 | ✅ Con la sesión de Negocio Reparto, "Ver cerrados" (D-081, único camino existente del negocio hacia un pedido `cerrado`) mostró el reclamo en la lista; su detalle (E4, sin cambios) mostró el mismo motivo junto a la entrada `entregado → cerrado` |

### D · Casos límite (Edge Cases)

| Paso | Resultado |
|---|---|
| V-08 | ✅ `PUT /orders/:id/confirm` de Cliente Reparto sobre un pedido propio en `en_preparacion` (no `entregado`) respondió `409 ORDER_NOT_DELIVERED`, `"Este pedido no está entregado. Actualiza la página para ver su estado actual."` |
| V-09 | ✅ El mismo `PUT /orders/:id/confirm`, ahora desde la sesión de un segundo cliente (Cliente Prueba E6) sobre un pedido que no es suyo, respondió `404` con el mensaje genérico de "No pudimos completar la operación" — indistinguible de un identificador inventado (FR-005, mismo patrón de E4) |
| V-10 | ✅ Cubierto por `services/api/test/orders-close-race.integration-spec.ts` (parte de las 657 pruebas de integración en verde de T034): confirmar y reclamar el mismo pedido con `Promise.allSettled` — exactamente una de las dos acciones tiene éxito, la otra recibe `409 ORDER_NOT_DELIVERED`, sin duplicar el historial |

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 | V-01 | ✅ |
| SC-002 | V-03 | ✅ |
| SC-003 | V-05 | ✅ |
| SC-004 | V-07 | ✅ |
| SC-005 | V-10 | ✅ |
| SC-006 | V-04, V-07 | ✅ |

### Lo que queda fuera de este registro

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1 por decisión
  declarada, heredado de E1/E3/E2/E9/E4/E6/E5.
- Cualquier estado nuevo para "reclamo pendiente", clasificación del feedback, notificaciones,
  calificación numérica, reabrir un pedido cerrado o confirmación por proximidad: fuera de alcance
  de v1, declarado desde la especificación de esta épica.

Con T034 y T035 completas y sin ningún defecto encontrado, **E7 · Cierre del servicio queda
verificada** al 2026-08-27.
