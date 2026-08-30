# Registro de verificación: E8 · Controles y administración

**Fecha**: 2026-08-30 · **Ejecutado sobre**: `docker compose up --build` (api, web y postgres en
contenedores), con la migración de esta épica aplicada automáticamente al arrancar `api`
(`docker-entrypoint.sh`) sobre el volumen `foodvoice_pgdata` ya sembrado por épicas anteriores.
Usuarios nuevos creados desde `/admin/usuarios` para esta sesión: `cliente-e8@foodvoice.test`,
`negocio-e8@foodvoice.test`, `repartidor-e8@foodvoice.test` (los tres con la misma contraseña de
prueba), más el administrador semilla de E1.

Este documento recoge el resultado de T035–T036 de `tasks.md`: las cinco comprobaciones
automáticas y los catorce pasos V-01 a V-14 de `quickstart.md` (incluidos los agregados durante
`/speckit.analyze`: V-02a, V-03a, V-04a, V-14), recorridos contra la aplicación real, no contra el
código.

**Aclaración sobre quién ejecutó el recorrido**: lo hizo Claude, manejando el navegador real
(Claude in Chrome: clics, formularios, cambios de sesión entre los cuatro roles) contra los
contenedores reconstruidos con el código de esta épica. La condición de carrera de FR-016 (V-10
de `quickstart.md` de otras épicas; aquí cubierta dentro de T014/T020) se verifica con las
pruebas de integración de concurrencia real, no manualmente — disparar dos solicitudes HTTP
verdaderamente simultáneas no es algo que la interacción humana con un navegador pueda producir
de forma confiable. La bitácora administrativa (V-12) se revisó por consulta directa a
`admin_audit_log` vía `psql`, tal como el propio `quickstart.md` lo declara: no hay pantalla de
consulta en v1 (Assumptions de `spec.md`).

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T035 | `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ Unitarios en verde (con umbrales de cobertura) en `services/api`, `packages/shared` y `apps/web`; `tsc --noEmit` limpio en los tres paquetes; **95/95 baterías de integración en verde contra PostgreSQL real (681 pruebas)**, incluidas las tres nuevas de E8; `pnpm build` en verde |
| T036 | V-01 a V-14 de `quickstart.md` | ✅ Los 14 pasos ejecutados en vivo — **ningún defecto de comportamiento encontrado**; un hallazgo de spec corregido antes de la validación (ver abajo) |

---

## Un hallazgo real, encontrado y corregido antes de la validación funcional

Al preparar la guía de validación (no durante el recorrido en sí), se detectó que **FR-008 y las
Historias 1/2 de `spec.md` prometían mostrarle al repartidor el motivo de una intervención
administrativa**, pero el repartidor nunca tuvo, en ninguna épica anterior, una pantalla de
detalle o historial de pedido — E4 construyó esa pantalla únicamente para cliente, negocio y
administrador. Cumplir la promesa tal como estaba escrita habría exigido construir una pantalla
nueva para el repartidor, alcance que ninguna HU pide (Principio III).

Se corrigió **la spec, no el código**: FR-008, el Acceptance Scenario 1 de la Historia 2, la
entidad clave "Intervención administrativa" y SC-004 se ajustaron para declarar que la garantía
observable del repartidor es únicamente FR-007 (queda libre para tomar otro pedido), no ver el
motivo. El texto del diálogo "Cerrar administrativamente" en `apps/web` —que sí prometía
visibilidad al repartidor— se corrigió para que coincida. Mismo patrón que ya usaron E9 y E6:
una enmienda chica a la spec antes de cerrar la épica, no un hallazgo de la validación en sí.

Fuera de esa corrección, el recorrido de los 14 pasos **no encontró ningún defecto de
comportamiento**: cada acción hizo exactamente lo que su pantalla prometía.

---

## V-01 a V-14 · Guía funcional

### Preparación

Se crearon cinco pedidos nuevos con `cliente-e8@foodvoice.test`, llevados a los estados que cada
sección necesitaba mediante el flujo real (confirmar → aceptar → tomar → entregar), sin tocar la
base de datos salvo para leer IDs y verificar estados entre pasos.

### A · Forzar el avance de un pedido atascado (Historia 1, SC-001, SC-004)

| Paso | Resultado |
|---|---|
| V-01 | ✅ Con la sesión del administrador, "Forzar transición" sobre un pedido en `creado` (sin que el negocio actuara), eligiendo "En preparación" y escribiendo el motivo: el pedido pasó a `en_preparacion` de inmediato |
| V-02 | ✅ La trazabilidad del propio pedido, en la misma pantalla, muestra la entrada nueva con "Administrador · Administrador" como actor y el motivo escrito, en rojo, igual patrón que el motivo de rechazo |
| V-02a | ✅ Con la sesión del negocio, el mismo pedido (`/negocio/pedidos/:id`, sin ningún cambio de pantalla propio) muestra exactamente el mismo motivo |
| V-03 | ✅ Sobre un segundo pedido en `asignado_repartidor`, el selector "Nuevo estado" del diálogo **solo ofreció "Entregado"** — la retroceso hacia "En preparación" ni siquiera aparece como opción, coherente con `transicionesForzablesPorAdmin` excluyéndola en el propio cliente, no solo en el servidor |
| V-03a | ✅ Forzar ese mismo pedido a "Entregado" con motivo funcionó; al volver a `/repartidor` con la sesión del repartidor que lo tenía asignado, ya no mostraba ningún pedido en curso — vuelve a ver la lista de disponibles (FR-007) |

### B · Cerrar administrativamente un pedido atascado (Historia 2, SC-002, SC-004)

| Paso | Resultado |
|---|---|
| V-04 | ✅ "Cerrar administrativamente" sobre un tercer pedido en `creado`, con motivo: pasó a `cerrado` de inmediato; los dos botones de acción desaparecieron de la pantalla (correcto: el pedido ya es terminal) |
| V-04a | ✅ Con la sesión del negocio, el mismo pedido muestra el motivo administrativo en el mismo lugar donde se vería un reclamo del cliente |
| V-05 | ✅ Un segundo intento de cerrar administrativamente el mismo pedido (`PUT /admin/orders/:id/close` ejecutado desde la consola del propio navegador, ya autenticado) respondió `409 ORDER_ALREADY_TERMINAL`, `"Este pedido ya está en un estado final y no admite intervenciones administrativas."` |
| V-06 | ✅ Sobre un cuarto pedido en `creado`, confirmar el diálogo de cierre sin escribir motivo respondió con el mensaje en español "Escribe el motivo de esta acción administrativa.", el diálogo permaneció abierto y el pedido siguió `creado` |

### C · Pausar y reanudar el servicio (Historia 3, SC-003, SC-005, SC-006)

| Paso | Resultado |
|---|---|
| V-07 | ✅ Desde `/admin/operaciones`, pausar con motivo dejó la pantalla mostrando "Servicio pausado", el motivo y la fecha, con el botón cambiado a "Reanudar servicio" |
| V-08 | ✅ Con la sesión del cliente, intentar confirmar un pedido nuevo respondió "El servicio está temporalmente pausado. Intenta confirmar tu pedido más tarde.", **sin vaciar el carrito ni perder la dirección escrita** |
| V-09 | ✅ Mientras seguía pausado: el negocio aceptó sin problema un pedido que ya estaba en `creado` (pasó a `en_preparacion`), y el repartidor tomó sin problema un pedido que ya estaba `en_preparacion` (pasó a `asignado_repartidor`) — ninguna de las dos acciones se vio afectada por la pausa |
| V-10 | ✅ Reanudar fue un clic directo, sin motivo, volviendo de inmediato a "Servicio activo" |
| V-11 | ✅ El cliente confirmó el pedido que había quedado bloqueado en V-08, con el mismo carrito y dirección, sin ningún paso adicional |

### D · Bitácora administrativa (SC-007)

| Paso | Resultado |
|---|---|
| V-12 | ✅ `SELECT` directo sobre `admin_audit_log` mostró las dos entradas (`PAUSAR_SERVICIO` con el motivo, `REANUDAR_SERVICIO` sin motivo), cada una con su administrador actor y fecha — sin ningún endpoint que permita editarlas o borrarlas |

### E · Catálogo y otras exclusiones fuera de alcance (FR-017, FR-018, SC-008)

| Paso | Resultado |
|---|---|
| V-13 | ✅ La navegación del administrador (`Panel`, `Usuarios`, `Operaciones`) no ofrece ningún destino de catálogo; los endpoints de `categories`/`products` ya rechazan al rol `ADMINISTRADOR` (cubierto por las pruebas de integración de E3, `products-roles`/`categories-roles`, sin necesidad de duplicarlas — ver tasks.md T034) |
| V-14 | ✅ Ni `/admin/operaciones` ni el detalle de pedido del administrador ofrecen ninguna acción sobre un repartidor individual — las únicas dos acciones sobre pedidos son "Forzar transición" y "Cerrar administrativamente", y la única acción sobre el servicio es pausar/reanudar |

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 | V-01 | ✅ |
| SC-002 | V-04 | ✅ |
| SC-003 | V-07, V-10 | ✅ |
| SC-004 | V-01, V-02, V-02a, V-04, V-04a | ✅ |
| SC-005 | V-08, V-09 | ✅ |
| SC-006 | V-11 | ✅ |
| SC-007 | V-12 | ✅ |
| SC-008 | V-13 | ✅ |

### Lo que queda fuera de este registro

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1 por decisión
  declarada, heredado de E1/E3/E2/E9/E4/E6/E5/E7.
- **Cualquier señal automática de "pedido atascado", niveles de permiso dentro de
  `ADMINISTRADOR`, o corrección administrativa del catálogo**: fuera de alcance de v1, declarado
  desde la especificación de esta épica.

Con T035 y T036 completas, un hallazgo de spec corregido antes del cierre y sin ningún defecto de
comportamiento encontrado, **E8 · Controles y administración queda verificada** al 2026-08-30.
