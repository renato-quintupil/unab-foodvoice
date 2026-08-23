# Guía de puesta en marcha y validación: E4 · Trazabilidad del pedido

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer los 4 criterios de
éxito** uno por uno. E4 no agrega migración ni variable de entorno: reutiliza exactamente el
entorno de E1+E2+E3.

## Requisitos previos

Los mismos de las épicas anteriores: Node.js 22 LTS, pnpm 9, Docker con Compose. **E4 no
introduce ninguna variable de entorno nueva.** Hace falta, además del administrador de E1 y el
catálogo de E3, **al menos un pedido con historial real**: un cliente que confirmó un pedido, y
el negocio que lo aceptó y rechazó otro (E2).

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # sin cambios nuevos respecto de E2 — E4 no migra
pnpm --filter api db:seed          # administrador de E1 + catálogo de E3, idempotente
pnpm dev                           # api :3001 · web :3000
```

Alternativa íntegra en contenedores: `docker compose up --build`.

## Comprobaciones automáticas

```bash
pnpm test              # unitarios; falla si no se cumplen los umbrales de cobertura
pnpm test:integration  # API contra PostgreSQL efímera en Docker
pnpm lint && pnpm typecheck && pnpm build
```

Deben pasar antes de empezar la validación funcional. Las épicas anteriores encontraron
defectos reales que solo la validación manual detectó (`CLAUDE.md` § Estado del código): que
estas comprobaciones pasen no basta por sí solo.

## Validación funcional

### Preparación

Tres sesiones — **cliente**, **negocio** y **administrador**. Antes de empezar, con la sesión
del cliente y la del negocio (E2):

1. El cliente confirma un pedido (queda en `creado`).
2. El negocio **acepta** ese pedido (pasa a `en_preparacion`).
3. El cliente confirma un segundo pedido.
4. El negocio **rechaza** ese segundo pedido con un motivo de texto (pasa a `rechazado`).

Con esto hay un pedido con dos entradas de historial (`creado → en_preparacion`) y otro con dos
entradas distintas (`creado → rechazado`) — los dos casos que Historia 1 y 2 piden cubrir.

### A · Cliente ve su historial (Historia 1, SC-001, SC-002, SC-003)

Con la sesión del **cliente**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Abrir "Mis pedidos" y entrar al detalle del pedido aceptado | Se ve una línea de tiempo con dos entradas: creación y aceptación, cada una con fecha y hora |
| **V-02** | Entrar al detalle del pedido rechazado | Se ve la entrada de rechazo con el motivo de texto que escribió el negocio |
| **V-03** | Cronometrar desde que se abre "Mis pedidos" hasta ver el historial completo de un pedido | Menos de 10 segundos (SC-001) |
| **V-04** | Copiar la URL del detalle de un pedido propio, cerrar sesión, iniciar sesión como **otro** cliente, y pegar esa URL | El sistema responde como si el pedido no existiera — no se distingue de un identificador inventado (SC-003, FR-005) |
| **V-05** | Repetir V-04 con un identificador de pedido que no existe en absoluto | Misma respuesta que V-04 |

### B · Negocio ve el historial de lo que gestiona (Historia 2)

Con la sesión del **negocio**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-06** | Desde la bandeja, abrir el detalle del pedido que este negocio aceptó | Se ve la misma línea de tiempo que vio el cliente en V-01, con el nombre y rol de quien aceptó |
| **V-07** | Desde "Ver rechazados", abrir el detalle del pedido rechazado | Se ve la línea de tiempo con la entrada de rechazo y su motivo |
| **V-08** | Abrir el detalle de un pedido hecho por **cualquier** cliente (no solo los que el negocio gestionó activamente) | Se ve correctamente — v1 es mono-local, no hay restricción de "negocio propietario" (D-053) |

### C · Administrador ve el historial desde el panel (Historia 3, SC-004)

Con la sesión del **administrador**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-09** | Abrir el reporte de pedidos (`/admin/pedidos`) y hacer clic en cualquier fila | En un solo clic adicional se llega al detalle con el historial completo (SC-004: no más de dos acciones desde el reporte) |
| **V-10** | Repetir V-09 sobre el pedido rechazado | Se ve el motivo de rechazo en el historial, igual que en V-02 |

### D · Verificación funcional pendiente de HU-10 (E1)

Con datos reales ya cargados por los pasos anteriores:

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-11** | Abrir el panel de administrador y comparar las métricas de pedidos por estado con los pedidos creados en esta guía | Las cifras coinciden — cierra la verificación pendiente de FR-019, FR-020, SC-006 de `specs/001-acceso-y-usuarios/spec.md`, condicionada a que existieran pedidos con historial real |
| **V-12** | Filtrar el reporte de pedidos por estado y por rango de fechas que incluya los pedidos de esta guía | Aparecen exactamente los pedidos esperados |

## Trazabilidad criterio → pasos

| Criterio de éxito | Pasos |
|---|---|
| SC-001 (ver historial en menos de 10 s) | V-01, V-03 |
| SC-002 (100% de pedidos con transición muestran motivo/fecha) | V-01, V-02, V-06, V-07 |
| SC-003 (acceso ajeno indistinguible) | V-04, V-05 |
| SC-004 (detalle en ≤2 acciones desde el reporte de admin) | V-09 |
