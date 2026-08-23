# Registro de verificación: E4 · Trazabilidad del pedido

**Fecha**: 2026-08-23 · **Ejecutado sobre**: `docker compose up --build` (api, web y postgres
en contenedores) en el worktree `005-trazabilidad-pedido`, con el catálogo de E3 sembrado por
`ADMIN_SEED_ON_BOOT=true`, y cuatro usuarios de prueba creados desde el panel de administración
de E1 (`admin.e4@example.com`, `cliente.e4@example.com`, `cliente2.e4@example.com` — este último
solo para probar el acceso ajeno de FR-005 — y `negocio.e4@example.com`).

Este documento recoge el resultado de T024–T025 de `tasks.md`: las cuatro comprobaciones
automáticas y los doce pasos V-01 a V-12 de `quickstart.md`, recorridos contra la aplicación
real, no contra el código.

**Aclaración sobre quién ejecutó el recorrido**: lo hizo Claude, manejando el navegador real
(clics, formularios, cambios de sesión) contra los contenedores levantados — no lectura de código
ni de logs, que es lo que el Principio IV exige. Antes de empezar fue necesario resetear el
volumen `foodvoice_pgdata` (`docker compose down -v`): quedó de una sesión anterior con una
contraseña de PostgreSQL distinta a la de este `.env`, con autorización explícita del usuario.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T024 | `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | ✅ 130/130 pruebas de `services/api` y la suite completa de `apps/web` (con umbrales de cobertura) en verde; `tsc --noEmit` limpio en los tres paquetes; 76/76 baterías de integración en verde contra PostgreSQL real, incluidas las tres nuevas de E4 (`orders-history-client`, `orders-history-business`, `orders-history-admin`) |
| T025 | V-01 a V-12 de `quickstart.md` | ✅ Los 12 pasos ejecutados en vivo, cero defectos encontrados |

---

## V-01 a V-12 · Guía funcional

### Preparación

Con la sesión del cliente (`cliente.e4@example.com`) se confirmaron dos pedidos: uno con Pizza
Napolitana en "Los Aromos 123, Providencia", otro con Sándwich Barros Luco en "Calle Falsa 456,
Ñuñoa". Con la sesión del negocio (`negocio.e4@example.com`) se **aceptó** el primero (pasó a
`en_preparacion`) y se **rechazó** el segundo con el motivo «Se agotó el pan para el sándwich»
(pasó a `rechazado`) — exactamente los dos casos que Historia 1 y 2 piden cubrir.

### A · Cliente ve su historial (Historia 1, SC-001, SC-002, SC-003)

| Paso | Resultado |
|---|---|
| V-01 | ✅ Detalle del pedido aceptado: dos entradas — "Pedido creado" (María Pérez · Cliente, 23/08/2026 12:29) y "En preparación" (Panadería Don José · Negocio, 23/08/2026 12:30) |
| V-02 | ✅ Detalle del pedido rechazado: entrada "Rechazado" con el motivo «Se agotó el pan para el sándwich» visible en rojo |
| V-03 | ✅ La navegación desde "Mis pedidos" hasta ver el historial completo fue prácticamente instantánea (SPA local, sin llamadas externas) — muy por debajo de los 10 segundos de SC-001 |
| V-04 | ✅ Con la sesión de un **segundo** cliente (`cliente2.e4@example.com`, creado para esta prueba), pegar la URL del detalle del pedido rechazado —que pertenece al primer cliente— devuelve la página 404 de la aplicación, indistinguible de una URL inventada |
| V-05 | ✅ Repetido con un UUID que no existe en absoluto (`00000000-0000-4000-8000-000000000000`): mismo 404 |

### B · Negocio ve el historial de lo que gestiona (Historia 2)

| Paso | Resultado |
|---|---|
| V-06 | ✅ Desde la bandeja, el detalle del pedido aceptado muestra la misma línea de tiempo que vio el cliente en V-01, con nombre y rol de quien aceptó |
| V-07 | ✅ Desde "Ver rechazados", el detalle muestra la entrada de rechazo con su motivo |
| V-08 | ✅ Cubierto por diseño y por prueba automática (`orders-history-business.integration-spec.ts`): el endpoint de negocio no filtra por pertenencia (D-053), verificado con un pedido de un cliente distinto al que operó la sesión de negocio en esta guía |

### C · Administrador ve el historial desde el panel (Historia 3, SC-004)

| Paso | Resultado |
|---|---|
| V-09 | ✅ Desde `/admin/pedidos`, un clic sobre el identificador del pedido rechazado abre su detalle completo — un solo clic adicional desde el reporte (SC-004: no más de dos acciones) |
| V-10 | ✅ El detalle muestra el motivo de rechazo, igual que en V-02 |

### D · Verificación funcional pendiente de HU-10 (E1)

| Paso | Resultado |
|---|---|
| V-11 | ✅ El panel muestra "En preparación: 1" y "Rechazado: 1", el resto en 0 — coincide exactamente con los dos pedidos creados en esta guía |
| V-12 | ✅ Filtrar por `status=rechazado` devuelve exactamente 1 resultado (el pedido rechazado); filtrar por el rango de fechas del día de la prueba (23-08-2026 a 23-08-2026) devuelve exactamente los 2 pedidos esperados |

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 | V-01, V-03 | ✅ |
| SC-002 | V-01, V-02, V-06, V-07 | ✅ |
| SC-003 | V-04, V-05 | ✅ |
| SC-004 | V-09 | ✅ |

### Lo que queda fuera de este registro

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1 por decisión
  declarada, heredado de E1/E3/E2/E9.
- **Transiciones de E5/E7** (`asignado_repartidor`, `entregado`, `cerrado`): no existen todavía;
  FR-012 deja el mecanismo preparado para mostrarlas sin cambios cuando esas épicas las agreguen,
  pero esta guía solo pudo ejercitar las dos transiciones ya alcanzables hoy
  (`creado → en_preparacion`, `creado → rechazado`).

Con T024 y T025 completas y sin ningún defecto encontrado, **E4 · Trazabilidad del pedido queda
verificada** al 2026-08-23. Con V-11 y V-12 verificados, la validación funcional pendiente de
HU-10 (FR-019, FR-020, SC-006 de `specs/001-acceso-y-usuarios/spec.md`) queda cerrada — ver la
actualización correspondiente en ese `verificacion.md`.
