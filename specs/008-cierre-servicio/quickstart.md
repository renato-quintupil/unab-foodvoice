# Guía de puesta en marcha y validación: E7 · Cierre del servicio

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer
los 6 criterios de éxito** uno por uno. E7 agrega una migración (una
columna nulable en `order`) pero ninguna variable de entorno nueva.

## Requisitos previos

Los mismos de las épicas anteriores: Node.js 22 LTS, pnpm 9, Docker con
Compose. Hace falta, además del administrador de E1 y el catálogo de E3:
**un pedido en `asignado_repartidor`** (un cliente lo confirma, el negocio
lo acepta, un repartidor lo toma — E2/E5) y **el mismo repartidor
disponible para marcarlo entregado**.

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # aplica la migración nueva de E7 (complaint_reason)
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

Tres sesiones — **cliente**, **negocio** y **repartidor**. Antes de
empezar:

1. El cliente confirma un pedido.
2. El negocio lo acepta (pasa a `en_preparacion`).
3. El repartidor lo toma (pasa a `asignado_repartidor`, E5).

### A · Repartidor marca el pedido como entregado (Historia 1, SC-001)

Con la sesión del **repartidor**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Desde `/repartidor`, con el pedido en curso, usar la acción "Marcar como entregado" | En 1 clic el pedido pasa a `entregado` (SC-001); el repartidor deja de tener ningún pedido en curso y vuelve a ver la lista de disponibles |
| **V-02** | Intentar marcar como entregado un pedido que ya no está a su cargo (por ejemplo, repitiendo la llamada tras V-01) | El sistema lo impide con `409 DELIVERY_ORDER_NOT_YOURS` |

### B · Cliente confirma que su pedido llegó bien (Historia 2, SC-002)

Con la sesión del **cliente**, sobre el pedido de la sección A.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-03** | Desde "Mis pedidos", con el pedido en `entregado`, usar la acción "Todo bien" | En 1 clic el pedido pasa a `cerrado` (SC-002), sin ningún motivo de reclamo |
| **V-04** | Con la sesión del **negocio** o del **cliente**, abrir la trazabilidad de ese pedido (E4) | Aparecen las entradas `asignado_repartidor → entregado` (repartidor) y `entregado → cerrado` (cliente), sin motivo de reclamo, sin que la pantalla de trazabilidad haya requerido ningún cambio (SC-006) |

### C · Cliente reclama por un problema (Historia 3, SC-003, SC-004)

Con un **segundo pedido**, repitiendo la preparación (confirmar → aceptar
→ tomar → marcar entregado), y la sesión del **cliente**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-05** | Con el pedido en `entregado`, usar la acción "Reclamar", escribiendo el motivo "Llegó frío y sin las papas" | En menos de 1 minuto el pedido pasa a `cerrado` (SC-003) con ese motivo guardado |
| **V-06** | Intentar reclamar sin escribir ningún motivo (o solo espacios) | El sistema lo impide con un mensaje en español, sin cerrar el pedido |
| **V-07** | Con la sesión del **negocio**, abrir la trazabilidad de ese pedido (E4) | Ve el motivo del reclamo junto a la entrada `entregado → cerrado`, sin que la pantalla de detalle del negocio haya requerido ningún cambio (SC-004, SC-006) |

### D · Casos límite (Edge Cases)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-08** | Con la sesión del **cliente**, intentar confirmar o reclamar un pedido propio que todavía no está en `entregado` (por ejemplo, uno en `en_preparacion`) | El sistema lo impide con `409 ORDER_NOT_DELIVERED` |
| **V-09** | Con la sesión de **otro cliente**, intentar confirmar o reclamar un pedido que no es suyo | El sistema responde `404`, indistinguible de un identificador inventado |
| **V-10** | Ejecutar la prueba de integración de concurrencia (confirmar y reclamar el mismo pedido casi al mismo tiempo, desde dos pestañas simuladas) | Exactamente una de las dos acciones tiene éxito; la otra recibe `409 ORDER_NOT_DELIVERED`, sin duplicar el efecto ni dejar historial inconsistente (SC-005) |

## Trazabilidad criterio → pasos

| Criterio de éxito | Pasos |
|---|---|
| SC-001 (marcar entregado en 1 clic) | V-01 |
| SC-002 (confirmar en 1 clic) | V-03 |
| SC-003 (reclamar en menos de 1 minuto) | V-05 |
| SC-004 (negocio ve el estado y el motivo correctos) | V-07 |
| SC-005 (carrera: exactamente 1 de 2 éxitos) | V-10 |
| SC-006 (trazabilidad muestra las transiciones sin cambios) | V-04, V-07 |
