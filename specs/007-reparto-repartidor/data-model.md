# Fase 1 · Modelo de Datos: E5 · Reparto

## `Order` — dos columnas nuevas (migración requerida)

```text
services/api/prisma/schema.prisma (modelo Order, línea ~374)
```

| Columna | Tipo | Uso |
|---|---|---|
| `delivery_user_id` | `uuid?` (FK → `user.id`, `onDelete: Restrict`) | El repartidor que tiene el pedido asignado. `NULL` salvo cuando `status = 'asignado_repartidor'` — misma forma de invariante aplicada por el servicio, no por `CHECK`, que ya usa `rejection_reason` (D-024 de E3, D-024 style). |
| `assigned_at` | `timestamptz(3)?` | Cuándo se tomó el pedido. `NULL` en cualquier otro estado; se limpia (`NULL`) al soltar (FR-008). |

```prisma
model Order {
  // … columnas existentes (E2) …
  deliveryUserId String?   @map("delivery_user_id") @db.Uuid
  assignedAt     DateTime? @map("assigned_at") @db.Timestamptz(3)

  // … relaciones existentes …
  deliveryUser User? @relation("deliveryUser", fields: [deliveryUserId], references: [id], onDelete: Restrict)

  /// Garantiza a nivel de base de datos que un repartidor no tenga dos
  /// pedidos en `asignado_repartidor` a la vez (D-069, FR-004).
  @@index([status, deliveryUserId], map: "order_status_delivery_user_id_idx")
}
```

**Migración** (`services/api/prisma/migrations/<timestamp>_reparto/migration.sql`), en el mismo
estilo que la de E2 para la dirección predeterminada:

```sql
ALTER TABLE "order" ADD COLUMN "delivery_user_id" UUID;
ALTER TABLE "order" ADD COLUMN "assigned_at" TIMESTAMPTZ(3);

ALTER TABLE "order" ADD CONSTRAINT "order_delivery_user_id_fkey"
  FOREIGN KEY ("delivery_user_id") REFERENCES "user"("id") ON DELETE RESTRICT;

CREATE INDEX "order_status_delivery_user_id_idx" ON "order"("status", "delivery_user_id");

-- D-069: un repartidor no puede tener dos pedidos en asignado_repartidor a la vez.
CREATE UNIQUE INDEX "order_one_active_delivery_per_user_key"
  ON "order"("delivery_user_id")
  WHERE "status" = 'asignado_repartidor';
```

`onDelete: Restrict` es el mismo criterio que ya usa `userId` del propio `Order`: un repartidor
con pedidos asignados no puede eliminarse físicamente (el proyecto no borra usuarios, solo los
desactiva desde E1, así que en la práctica esta restricción nunca dispara).

## `User` — sin columnas nuevas, un campo existente por primera vez expuesto a otro rol

`User.phone` (E1) ya existe y ya se pide al registrar cualquier usuario. Esta épica no lo
modifica: solo lo lee y lo expone, únicamente en `DeliveryOrderDto` (ver más abajo), nunca en la
lista de pedidos disponibles.

## Tipos nuevos · `packages/shared/src/types/api.ts`

### `DeliveryOrderDto`

El pedido en curso del repartidor, con el teléfono de contacto del cliente que `OrderSummaryDto`
no lleva.

```ts
export type DeliveryOrderDto = OrderSummaryDto & {
  customerPhone: string;
};
```

Extiende `OrderSummaryDto` (E2) por composición, igual que `OrderDetailDto` (E4) — no lo
modifica ni le agrega campos condicionales.

## Qué no cambia

- `OrderSummaryDto`, `OrderDetailDto`, `OrderStatusEventDto`, `Paginated<T>` — sin modificar.
  `GET /delivery/orders/available` sigue devolviendo `OrderSummaryDto[]`, sin teléfono.
- `OrderStatus`, `Role` — mismos enums; ningún valor nuevo. La máquina de estados
  (`order-state/machine.ts`) sí cambia (ver abajo), pero no el enum de valores posibles.

## `packages/shared/src/order-state/machine.ts` — refleja la constitución v3.0.0

```ts
const SIGUIENTE: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.CREADO]: [OrderStatus.EN_PREPARACION, OrderStatus.RECHAZADO],
  [OrderStatus.EN_PREPARACION]: [OrderStatus.ASIGNADO_REPARTIDOR],
  [OrderStatus.ASIGNADO_REPARTIDOR]: [OrderStatus.EN_PREPARACION, OrderStatus.ENTREGADO], // ← D-066: agrega el retroceso
  [OrderStatus.ENTREGADO]: [OrderStatus.CERRADO],
  [OrderStatus.CERRADO]: [],
  [OrderStatus.RECHAZADO]: [],
};
```

El comentario del archivo ("no hay transiciones de retroceso en el resto de la máquina") debe
actualizarse para declarar la única excepción, citando la enmienda 3.0.0 — no basta con cambiar
el `Record`, el comentario es la documentación que el resto del equipo lee primero.

## Mensajes nuevos · `packages/shared/src/messages/es.ts`

| Constante | Texto | Productor |
|---|---|---|
| `MSG_SIN_PEDIDOS_DISPONIBLES` | "No hay pedidos disponibles por ahora." | `GET /delivery/orders/available` (lista vacía, FR-006) |
| `MSG_PEDIDO_YA_NO_DISPONIBLE` | "Este pedido ya no está disponible." | `PUT /delivery/orders/:id/take` (409, FR-005) |
| `MSG_REPARTIDOR_YA_TIENE_PEDIDO` | "Ya tienes un pedido en curso. Complétalo o suéltalo antes de tomar otro." | `PUT /delivery/orders/:id/take` (409, FR-004) |
| `MSG_PEDIDO_NO_ASIGNADO_A_TI` | "Este pedido ya no está asignado a ti." | `PUT /delivery/orders/:id/release` (409) |

## Diagrama de flujo de escritura

```text
GET /delivery/orders/available   → OrdersService.disponiblesParaRepartidor()         (solo lectura)
GET /delivery/orders/current     → OrdersService.enCursoDelRepartidor(userId)        (solo lectura)
PUT /delivery/orders/:id/take    → OrdersService.tomar(id, userId)     ─┐
PUT /delivery/orders/:id/release → OrdersService.soltar(id, userId)    ─┴─→ transacción: updateMany condicionado + registrarEvento(actorRole: REPARTIDOR)
```

`tomar` y `soltar` comparten la misma forma que `transicionar()` de E2 (D-068): una escritura
condicionada dentro de una transacción, seguida de `registrarEvento`. No se introduce un tercer
patrón de escritura para esta épica.
