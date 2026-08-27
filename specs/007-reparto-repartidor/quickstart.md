# Guía de puesta en marcha y validación: E5 · Reparto

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer los 7 criterios de
éxito** uno por uno. E5 agrega una migración (dos columnas en `order` + un índice único parcial)
pero ninguna variable de entorno nueva.

## Requisitos previos

Los mismos de las épicas anteriores: Node.js 22 LTS, pnpm 9, Docker con Compose. Hace falta,
además del administrador de E1 y el catálogo de E3: **al menos un pedido en `en_preparacion`**
(un cliente lo confirma y el negocio lo acepta, E2) y **al menos dos usuarios con rol
`REPARTIDOR`** (los crea el administrador desde E1, igual que cualquier otro usuario).

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # aplica la migración nueva de E5 (delivery_user_id, assigned_at)
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

Deben pasar antes de empezar la validación funcional. La condición de carrera de SC-002/SC-003
**no se puede verificar solo con estos comandos**: exige la prueba de integración específica que
dispara dos escrituras concurrentes reales contra PostgreSQL (`plan.md`, Fase F).

## Validación funcional

### Preparación

Cuatro sesiones — **administrador**, **cliente**, **negocio** y **dos repartidores** (Repartidor
A y Repartidor B). Antes de empezar:

1. El administrador crea dos usuarios con rol `REPARTIDOR` (si no existen ya).
2. El cliente confirma tres pedidos.
3. El negocio **acepta** los tres (quedan en `en_preparacion`, sin repartidor asignado).

### A · Repartidor toma un pedido disponible (Historia 1, SC-001, SC-002, SC-004)

Con la sesión del **Repartidor A**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Abrir la pantalla de repartidor | Se ven los tres pedidos `en_preparacion` en la lista de disponibles, ninguno marcado como propio |
| **V-02** | Tomar uno de los tres pedidos | En 1 clic el pedido pasa a "en curso"; desaparece de la lista de disponibles (SC-001) |
| **V-03** | Iniciar sesión como **Repartidor B** y abrir su pantalla | Ve solo los dos pedidos restantes — el que tomó A ya no aparece (SC-002) |
| **V-04** | Con el Repartidor B, intentar tomar un segundo pedido después de ya haber tomado uno (repetir V-02 con B y luego intentar tomar otro) | El sistema no ofrece ninguna acción para tomar un segundo pedido mientras B tenga uno en curso (SC-004, FR-004) |

### B · Condición de carrera (Historia 1, SC-003)

Requiere dos solicitudes casi simultáneas — se verifica con la prueba de integración de
`plan.md` Fase F, no manualmente. Documentar aquí el resultado esperado para la persona que
valide:

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-05** | Ejecutar la prueba de integración de concurrencia (dos repartidores tomando el mismo pedido) | Exactamente una de las dos solicitudes tiene éxito; la otra recibe `409 DELIVERY_ORDER_ALREADY_ASSIGNED` con el mensaje `MSG_PEDIDO_YA_NO_DISPONIBLE`, sin que el pedido quede con dos repartidores ni ninguno |

### C · Repartidor consulta su pedido en curso (Historia 2, SC-006, SC-007)

Con la sesión del **Repartidor A** (que tomó un pedido en V-02).

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-06** | Abrir la sección "mi pedido en curso" | Se ven los productos, cantidades, la dirección de entrega y el teléfono del cliente |
| **V-07** | Volver a la lista de pedidos disponibles | El teléfono del cliente no aparece en ninguna fila de la lista (SC-007) |
| **V-08** | Con la sesión del **cliente** o del **negocio**, abrir la trazabilidad del pedido que tomó el Repartidor A (E4) | Aparece la entrada `en_preparacion → asignado_repartidor` con el nombre del Repartidor A y la fecha, sin que la pantalla de trazabilidad haya requerido ningún cambio (SC-006) |

### D · Repartidor suelta un pedido (Historia 3, SC-005)

Con la sesión del **Repartidor A**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-09** | Usar la acción de soltar el pedido en curso | El pedido vuelve a `en_preparacion`; la pantalla del Repartidor A ya no muestra ningún pedido en curso |
| **V-10** | Cronometrar desde que se soltó hasta que reaparece en la lista de disponibles de cualquier repartidor (recargar la pantalla del Repartidor B) | Menos de 10 segundos (SC-005) |
| **V-11** | Con el mismo Repartidor A, tomar de nuevo el pedido que acaba de soltar | El sistema lo permite — un pedido soltado no queda vetado para quien lo soltó (FR-009) |
| **V-12** | Con la sesión del **cliente** o del **negocio**, abrir la trazabilidad de ese pedido (E4) | Aparecen ambas entradas nuevas: `en_preparacion → asignado_repartidor` y `asignado_repartidor → en_preparacion`, en orden cronológico |

### E · Lo que el negocio no puede hacer (Edge Cases)

Con la sesión del **negocio**.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-13** | Intentar aceptar o rechazar un pedido que ya está en `asignado_repartidor` | El sistema lo impide — el negocio solo actúa sobre pedidos en `creado` (RN-010, E2), sin cambios de esta épica |

## Trazabilidad criterio → pasos

| Criterio de éxito | Pasos |
|---|---|
| SC-001 (tomar en 1 clic) | V-02 |
| SC-002 (cada pedido a exactamente un repartidor) | V-01 a V-03 |
| SC-003 (carrera: exactamente 1 de 2 éxitos) | V-05 |
| SC-004 (sin acción para tomar un segundo pedido) | V-04 |
| SC-005 (pedido soltado disponible en <10 s) | V-09, V-10 |
| SC-006 (trazabilidad muestra la transición sin cambios) | V-08, V-12 |
| SC-007 (teléfono solo en el pedido en curso) | V-06, V-07 |
