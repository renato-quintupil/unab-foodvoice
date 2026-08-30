# Guía de puesta en marcha y validación: E8 · Controles y administración

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer
los 8 criterios de éxito** uno por uno. E8 agrega una migración (columna
nueva en `order_status_event`, tabla nueva `service_status`, dos valores de
enum y dos columnas modificadas en `admin_audit_log`) pero ninguna variable
de entorno nueva.

## Requisitos previos

Los mismos de las épicas anteriores: Node.js 22 LTS, pnpm 9, Docker con
Compose. Hace falta, además del administrador de E1: **un pedido en
`creado`** sin que el negocio lo resuelva (para las Historias 1 y 2) y,
para el edge case de pausa, **un cliente con carrito y dirección listos
para confirmar**.

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # aplica la migración nueva de E8
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

Deben pasar antes de empezar la validación funcional.

## Validación funcional

### Preparación

Dos sesiones — **administrador** y **cliente**. Antes de empezar, el
cliente confirma un pedido (queda en `creado`) y no lo resuelve el negocio
(nadie inicia sesión como negocio durante esta validación, para simular el
atasco).

### A · Forzar el avance de un pedido atascado (Historia 1, SC-001)

Con la sesión del **administrador**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Desde `/admin/pedidos/[id]` del pedido en `creado`, usar "Forzar transición" eligiendo `en_preparacion` y escribiendo el motivo "El negocio no respondió en más de una hora" | En menos de 2 minutos (incluido escribir el motivo) el pedido pasa a `en_preparacion` (SC-001); el cliente lo ve como "En preparación" en su siguiente carga (SC-004) |
| **V-02** | Abrir la trazabilidad de ese pedido (E4) | La entrada `creado → en_preparacion` muestra al administrador como actor y el motivo escrito (SC-004, SC-007) |
| **V-02a** | Con la sesión del **negocio**, abrir el detalle de ese mismo pedido desde `/negocio/pedidos` | Ve el mismo motivo que vio el cliente en V-01, sin que su pantalla de detalle haya necesitado ningún cambio propio (SC-004) |
| **V-03** | Con un **segundo pedido** en `asignado_repartidor` (repetir confirmar → aceptar → tomar, E2/E5), intentar forzar la transición hacia `en_preparacion` | El sistema lo impide con `409 FORCE_TRANSITION_INVALID` — esa transición es la retroceso reservada al repartidor dueño del pedido, no al administrador |
| **V-03a** | Sobre el pedido de V-03, forzar la transición hacia `entregado` (destino sí forzable desde `asignado_repartidor`) con motivo, luego revisar `/repartidor` con la sesión de **ese mismo repartidor** | Ya no tiene ningún pedido en curso — vuelve a ver la lista de disponibles (FR-007). El repartidor no tiene pantalla de detalle en v1, así que no se espera ver el motivo ahí (FR-008) |

### B · Cerrar administrativamente un pedido atascado (Historia 2, SC-002)

Con la sesión del **administrador**, sobre un **tercer pedido** en
`en_preparacion` (confirmar → aceptar).

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-04** | Desde su detalle, usar "Cerrar administrativamente" con el motivo "Local cerrado por emergencia, pedido no se puede completar" | En menos de 2 minutos el pedido pasa a `cerrado` (SC-002), con el motivo visible en la trazabilidad |
| **V-04a** | Con la sesión del **negocio**, abrir el detalle de ese pedido desde su propia lista de cerrados | Ve el mismo motivo administrativo, en el mismo lugar donde ya ve el motivo de un reclamo del cliente (E7) — sin sección aparte (SC-004) |
| **V-05** | Intentar cerrar administrativamente el mismo pedido de nuevo | El sistema lo impide con `409 ORDER_ALREADY_TERMINAL` — ya es terminal |
| **V-06** | Intentar cualquiera de las dos acciones (forzar o cerrar) sin escribir motivo, o con motivo compuesto solo de espacios | El sistema lo impide con un mensaje en español, sin cambiar el estado del pedido |

### C · Pausar y reanudar el servicio (Historia 3, SC-003, SC-005, SC-006)

Con la sesión del **administrador** y, en paralelo, la del **cliente**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-07** | Desde `/admin/operaciones`, pausar el servicio con el motivo "Corte de luz en el local" | En menos de 1 minuto el servicio queda pausado (SC-003); `GET /admin/service/status` refleja `paused: true` con ese motivo |
| **V-08** | Con la sesión del **cliente**, con carrito y dirección listos, intentar confirmar un pedido | El sistema lo impide con `409 SERVICE_PAUSED` y un mensaje en español (SC-005); el carrito sigue intacto y editable |
| **V-09** | Con un pedido que ya estaba `en_preparacion` **antes** de la pausa, verificar que el negocio puede seguir aceptando/rechazando pedidos y el repartidor tomando los que ya estaban disponibles | Ninguna acción sobre pedidos ya en curso se ve afectada por la pausa (SC-005) |
| **V-10** | Desde `/admin/operaciones`, reanudar el servicio (1 clic, sin motivo) | El servicio queda activo de inmediato (SC-003) |
| **V-11** | Con la sesión del **cliente**, confirmar el pedido del paso V-08 | Se confirma sin ningún paso adicional de sincronización (SC-006) |

### D · Bitácora administrativa (SC-007)

Con la sesión del **administrador**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-12** | Revisar (por consulta directa a `admin_audit_log`, sin pantalla en v1) las entradas de `PAUSAR_SERVICIO`/`REANUDAR_SERVICIO` de los pasos V-07/V-10 | Cada una identifica al administrador, la acción, y el motivo (solo en `PAUSAR_SERVICIO`) — inmutables, sin ningún endpoint que permita editarlas o borrarlas |

### E · Catálogo fuera de alcance (SC-008)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-13** | Con la sesión del **administrador**, revisar el menú y `/admin` | No aparece ninguna acción para crear, editar o dar de baja un producto o categoría — sigue siendo exclusivo del rol `NEGOCIO` |
| **V-14** | Con la sesión del **administrador**, revisar `/admin/operaciones` y `/admin/pedidos/[id]` | No aparece ninguna acción para suspender a un repartidor individual, ni ningún bloqueo distinto de pausar la confirmación de pedidos nuevos (FR-018) |

## Trazabilidad criterio → pasos

| Criterio de éxito | Pasos |
|---|---|
| SC-001 (forzar transición en menos de 2 min) | V-01 |
| SC-002 (cerrar administrativamente en menos de 2 min) | V-04 |
| SC-003 (pausar en menos de 1 min, reanudar en 1 clic) | V-07, V-10 |
| SC-004 (motivo correcto visible al cliente y al negocio) | V-01, V-02, V-02a, V-04, V-04a |
| SC-005 (100% de confirmaciones bloqueadas en pausa; pedidos en curso no afectados) | V-08, V-09 |
| SC-006 (confirmar tras reanudar, sin pasos adicionales) | V-11 |
| SC-007 (bitácora con administrador, acción, objetivo y motivo correctos) | V-12 |
| SC-008 (ningún rol nuevo con acción sobre el catálogo) | V-13 |
