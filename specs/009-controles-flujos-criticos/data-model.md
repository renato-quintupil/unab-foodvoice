# Fase 1 · Modelo de Datos: E8 · Controles y administración

## `OrderStatusEvent` — una columna nueva (migración requerida)

```text
services/api/prisma/schema.prisma (modelo OrderStatusEvent, línea ~444)
```

| Columna | Tipo | Uso |
|---|---|---|
| `reason` | `text?` | El motivo de una intervención administrativa (D-082). `NULL` en los eventos que ya existían (creación, aceptar/rechazar, tomar/soltar, entregar, confirmar/reclamar) y en cualquier evento nuevo cuyo `actor_role` no sea `ADMINISTRADOR`. |

```prisma
model OrderStatusEvent {
  // … columnas existentes (E2) …
  reason String? @map("reason")
}
```

**Migración** (`services/api/prisma/migrations/<timestamp>_controles_flujos_criticos/migration.sql`):

```sql
ALTER TABLE "order_status_event" ADD COLUMN "reason" TEXT;
```

Sin índice: ninguna consulta filtra por `reason`, igual criterio que
`complaint_reason` en E7.

## `ServiceStatus` — tabla nueva (D-085)

```prisma
model ServiceStatus {
  id             String    @id @default("singleton")
  paused         Boolean   @default(false)
  pauseReason    String?   @map("pause_reason")
  pausedAt       DateTime? @map("paused_at") @db.Timestamptz(3)
  pausedByUserId String?   @map("paused_by_user_id") @db.Uuid

  pausedBy User? @relation("servicePausedBy", fields: [pausedByUserId], references: [id], onDelete: SetNull)

  @@map("service_status")
}
```

Una sola fila, sembrada por la migración (`INSERT ... VALUES ('singleton', false, NULL, NULL, NULL)`),
`paused = false`. `OrdersService` y `ServiceStatusService` siempre leen y
escriben por `id: 'singleton'` — no hay ningún endpoint que cree o borre
filas de esta tabla.

## `AdminAuditLog` — dos columnas modificadas, dos valores de enum nuevos

```text
services/api/prisma/schema.prisma (modelo AdminAuditLog, línea ~184; enum AdminAction, línea ~43)
```

| Columna | Cambio | Uso |
|---|---|---|
| `target_user_id` | pasa de `NOT NULL` a nulable | `NULL` en `PAUSAR_SERVICIO`/`REANUDAR_SERVICIO` — no hay un usuario objetivo cuando la acción es sobre el servicio completo. Las seis acciones de E1 siguen escribiéndolo siempre. |
| `reason` (nueva) | `text?` | El motivo de pausar (siempre presente en `PAUSAR_SERVICIO`); `NULL` en `REANUDAR_SERVICIO` y en las seis acciones de E1, que nunca lo usaron. |

```prisma
enum AdminAction {
  CREAR
  EDITAR
  CAMBIAR_ROL
  DESACTIVAR
  REACTIVAR
  RESTABLECER_PASSWORD
  PAUSAR_SERVICIO      // ← nuevo (E8)
  REANUDAR_SERVICIO    // ← nuevo (E8)
}

model AdminAuditLog {
  id           String      @id @default(uuid()) @db.Uuid
  actorUserId  String      @map("actor_user_id") @db.Uuid
  targetUserId String?     @map("target_user_id") @db.Uuid // ← ahora nulable
  action       AdminAction
  reason       String?     @map("reason")                   // ← nuevo
  occurredAt   DateTime    @default(now()) @map("occurred_at") @db.Timestamptz(3)

  actor  User  @relation("actor", fields: [actorUserId], references: [id], onDelete: Restrict)
  target User? @relation("target", fields: [targetUserId], references: [id], onDelete: Restrict)

  @@map("admin_audit_log")
}
```

**Migración**:

```sql
ALTER TABLE "admin_audit_log" ALTER COLUMN "target_user_id" DROP NOT NULL;
ALTER TABLE "admin_audit_log" ADD COLUMN "reason" TEXT;
ALTER TYPE "AdminAction" ADD VALUE 'PAUSAR_SERVICIO';
ALTER TYPE "AdminAction" ADD VALUE 'REANUDAR_SERVICIO';
```

Forzar una transición y cerrar administrativamente **no** tocan esta tabla
(D-084): su registro inmutable es la entrada nueva de `OrderStatusEvent`.

## Tipos modificados · `packages/shared/src/types/api.ts`

### `OrderStatusEventDto` — un campo nuevo

```ts
export type OrderStatusEventDto = {
  previousStatus: OrderStatus | null;
  resultingStatus: OrderStatus;
  actorName: string;
  actorRole: Role;
  reason: string | null; // ← nuevo (E8). Presente solo en intervenciones administrativas.
  occurredAt: string;
};
```

`OrderDetailDto` (E4) lo hereda automáticamente — `history:
OrderStatusEventDto[]` ya viaja completo, sin cambio de contrato propio.

## Tipo nuevo · `ServiceStatusDto`

```ts
export type ServiceStatusDto = {
  paused: boolean;
  reason: string | null;
  pausedAt: string | null;
};
```

## Esquemas nuevos · `packages/shared/src/schemas/order.ts`

```ts
export const ForceOrderTransitionSchema = z.object({
  targetStatus: z.nativeEnum(OrderStatus),
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});
export type ForceOrderTransitionInput = z.infer<typeof ForceOrderTransitionSchema>;

export const AdminCloseOrderSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});
export type AdminCloseOrderInput = z.infer<typeof AdminCloseOrderSchema>;
```

## Esquema nuevo · `packages/shared/src/schemas/service-status.ts`

```ts
export const PauseServiceSchema = z.object({
  reason: z.string().trim().min(10, MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO).max(500),
});
export type PauseServiceInput = z.infer<typeof PauseServiceSchema>;
```

`targetStatus` se valida como forma (cualquier `OrderStatus` válido); **la
regla de negocio real** —si esa transición puntual es la que corresponde
forzar desde el estado actual del pedido— la decide
`transicionesForzablesPorAdmin()` (D-083) en tiempo de ejecución, no el
esquema.

## Mensajes nuevos · `packages/shared/src/messages/es.ts`

| Constante | Texto | Productor |
|---|---|---|
| `MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO` | "Escribe el motivo de esta acción administrativa." | Validación de `ForceOrderTransitionSchema`, `AdminCloseOrderSchema`, `PauseServiceSchema` (400, motivo vacío o muy corto — D-086) |
| `MSG_TRANSICION_ADMINISTRATIVA_INVALIDA` | "Esta transición no es válida para el estado actual del pedido." | `PUT /admin/orders/:id/force-transition` (409, destino fuera de las transiciones forzables desde el estado actual, o carrera perdida) |
| `MSG_PEDIDO_YA_ES_TERMINAL` | "Este pedido ya está en un estado final y no admite intervenciones administrativas." | `PUT /admin/orders/:id/close` (409, el pedido ya está en `cerrado` o `rechazado`, o perdió la carrera) |
| `MSG_SERVICIO_PAUSADO` | "El servicio está temporalmente pausado. Intenta confirmar tu pedido más tarde." | `POST /orders` (409, D-088, mientras `ServiceStatus.paused = true`) |

## Diagrama de flujo de escritura

```text
PUT /admin/orders/:id/force-transition → OrdersService.forzarTransicion(id, adminId, hacia, motivo)   (administrador)
PUT /admin/orders/:id/close            → OrdersService.cerrarAdministrativamente(id, adminId, motivo)  (administrador)
PUT /admin/service/pause               → ServiceStatusService.pausar(adminId, motivo)                  (administrador)
PUT /admin/service/resume              → ServiceStatusService.reanudar(adminId)                        (administrador)
```

Las dos primeras comparten la forma ya establecida por E2/E5/E7: lectura del
estado actual, escritura condicionada (`updateMany` con `WHERE id, status =
<snapshot>`) dentro de una transacción, `registrarEvento` con el motivo. No
se introduce un quinto patrón de escritura.

### `forzarTransicion(id, adminId, hacia, reason)`

```text
1. pedido = findUnique({ id })                                  → 404 si no existe
2. si !transicionesForzablesPorAdmin(pedido.status).includes(hacia)
     → 409 MSG_TRANSICION_ADMINISTRATIVA_INVALIDA
3. updateMany({ where: { id, status: pedido.status }, data: { status: hacia } })
   count === 0 → releer; si sigue sin coincidir el estado esperado, 409 (carrera perdida)
4. registrarEvento({ orderId: id, previousStatus: pedido.status, resultingStatus: hacia,
                      actorUserId: adminId, actorRole: ADMINISTRADOR, reason })
```

### `cerrarAdministrativamente(id, adminId, reason)`

```text
1. pedido = findUnique({ id })                                  → 404 si no existe
2. si !puedeCerrarseAdministrativamente(pedido.status)
     → 409 MSG_PEDIDO_YA_ES_TERMINAL
3. updateMany({ where: { id, status: pedido.status }, data: { status: 'cerrado' } })
   count === 0 → releer; mismo 409 si perdió la carrera
4. registrarEvento({ orderId: id, previousStatus: pedido.status, resultingStatus: 'cerrado',
                      actorUserId: adminId, actorRole: ADMINISTRADOR, reason })
```

Ninguno de los dos limpia `deliveryUserId`: si el pedido estaba en
`asignado_repartidor`, el repartidor queda libre automáticamente porque
`enCursoDelRepartidor()` (E5) filtra por `status = 'asignado_repartidor'` —
al cambiar el estado, deja de aparecer, sin tocar la columna (FR-007,
mismo razonamiento que D-074 de E7 con `deliveryUserId` en `entregar()`).

### `ServiceStatusService.pausar(adminId, reason)` / `reanudar(adminId)`

```text
pausar:   update({ where: { id: 'singleton' },
                    data: { paused: true, pauseReason: reason, pausedAt: now(), pausedByUserId: adminId } })
          + AdminAuditLog.create({ actorUserId: adminId, targetUserId: null,
                                    action: PAUSAR_SERVICIO, reason })

reanudar: update({ where: { id: 'singleton' },
                    data: { paused: false, pauseReason: null, pausedAt: null, pausedByUserId: null } })
          + AdminAuditLog.create({ actorUserId: adminId, targetUserId: null,
                                    action: REANUDAR_SERVICIO, reason: null })
```

Ambas dentro de una única transacción (actualizar la fila + escribir la
bitácora), mismo criterio de atomicidad que el resto del proyecto.

### `OrdersService.confirmar()` — un paso nuevo al principio (D-088)

```text
0. estado = tx.serviceStatus.findUnique({ id: 'singleton' })
   si estado.paused → throw servicioPausado()   // antes de tocar el carrito
1–8. (sin cambios respecto de E2)
```

## Qué no cambia

- `SIGUIENTE` en `machine.ts` — sin cambios (D-083); las dos funciones
  nuevas se apoyan en la tabla existente o en el propio `OrderStatus`, sin
  redefinir ninguna transición ya declarada.
- `Order` — sin columnas nuevas. `rejectionReason`/`complaintReason` siguen
  siendo los únicos campos de motivo a nivel de pedido.
- `OrderSummaryDto` — sin cambios; el motivo administrativo vive en el
  historial (`OrderStatusEventDto`), no en el resumen.
- `DeliveryOrderDto`, `ComplainOrderSchema`, `RejectOrderSchema` — sin
  cambios.
- Los seis valores originales de `AdminAction` y su uso en `UsersService` —
  sin cambios; siguen escribiendo `targetUserId` siempre.
