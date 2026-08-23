# HU-03 · Trazabilidad del pedido

**Épica**: E4 · Trazabilidad del pedido
**Estado**: sin especificar (este documento es la base para `/speckit.specify`,
no reemplaza la spec que generará ese comando)

## Historia

> Como **cliente**, quiero **ver el historial de estados de mi pedido, no solo
> el estado actual**, para saber qué pasó y cuándo, sin tener que preguntarle
> al local.
>
> Como **negocio**, quiero **la misma trazabilidad sobre los pedidos que
> gestiono**, para responder consultas de un cliente con datos y no con
> memoria.

## Qué ya existe en el sistema (2026-08-23)

Antes de especificar, esto es lo que E1/E2 ya construyeron y sobre lo que
HU-03 se apoya — no hay que redefinirlo, solo consumirlo y exponerlo:

- **La máquina de estados es de seis estados**, constitución (Principio XII,
  v2.0.0, enmendada durante E2). `rechazado` **sí forma parte de la máquina**,
  como rama terminal desde `creado`:

  ```
  creado ─┬─→ en_preparacion → asignado_repartidor → entregado → cerrado
          └─→ rechazado   (terminal, sin transiciones salientes)
  ```

  Alcanzable únicamente desde `creado`, con motivo de texto obligatorio,
  inmutable y visible para el cliente. Vive en
  `packages/shared/src/order-state/machine.ts` y
  `packages/shared/src/enums/order-status.ts`. **No existe un estado
  "aceptado"** independiente: aceptar es la transición `creado →
  en_preparacion`.
- **El historial ya se escribe**, no se crea en E4. El modelo
  `OrderStatusEvent` (`services/api/prisma/schema.prisma:386`) es append-only
  —lo protege el mismo tipo de trigger `BEFORE UPDATE OR DELETE` que ya usan
  otras tablas del proyecto— y guarda por cada entrada: estado anterior
  (`NULL` solo en la primera), estado resultante, usuario actor, **rol que
  ejercía al actuar** (no su rol actual — se congela igual que la sesión) y
  fecha. E2 escribe ahí, en la misma transacción atómica que crea o cambia el
  pedido, dos casos: la creación (`creado`, sin estado anterior) y las dos
  transiciones que dispara (`→ en_preparacion`, `→ rechazado`).
- **Lo que E2 explícitamente no hizo, a propósito (RN-011 de su spec)**:
  ningún endpoint ni DTO expone `OrderStatusEvent`. La pantalla `/cliente/
  pedidos` (`apps/web/src/app/cliente/pedidos/page.tsx`) lo dice en su propio
  comentario: "estado actual y, si corresponde, el motivo de rechazo — **sin
  historial (RN-011, E4)**". Es el punto exacto donde arranca HU-03.
- **`GET /orders`** (cliente) y **`GET /orders`, `GET /orders/rejected`,
  `PUT /orders/:id/accept`, `PUT /orders/:id/reject`** (negocio,
  `business-orders.controller.ts`) ya existen y devuelven el estado actual.
  No hay `GET /orders/:id` ni ruta de detalle por pedido todavía — HU-03 la
  necesita para anclar el historial a un pedido concreto.
- **`GET /dashboard/orders`** (HU-10, `services/api/src/dashboard/
  dashboard.controller.ts`) ya existe: reporte paginado, filtrable por estado
  y rango de fechas, para el rol `ADMIN`. Su `OrderDto`
  (`packages/shared/src/types/api.ts:57`) hoy solo trae `id`, `status`,
  `createdAt` — a propósito, porque en E1 la lista era vacía por
  construcción. **HU-10 depende de HU-03/E4 para su verificación funcional**
  (así lo dice explícitamente `specs/001-acceso-y-usuarios/spec.md`, FR-019,
  FR-020, SC-006): las métricas y el reporte de pedidos existen en código
  desde E1 pero no se pudieron probar con datos reales hasta que hubiera
  pedidos. Definir si ese `OrderDto` se enriquece con el historial es una
  decisión de esta HU, no algo que HU-10 ya haya resuelto.
- **El rol `REPARTIDOR` ya existe** en `packages/shared/src/enums/role.ts`,
  aunque E5 (Reparto) todavía no construye ninguna pantalla ni endpoint para
  él.
- **El motivo del rechazo ya está resuelto en E2 y no es tarea de HU-03**:
  RN-007 de `specs/003-gestion-pedidos/spec.md` decide explícitamente que el
  motivo es **texto libre**, no una lista fija de causas predefinidas — "un
  local pequeño no tiene por qué encajar su realidad en categorías adivinadas
  de antemano". Si el negocio rechaza un pedido porque detectó un problema en
  cómo está armado el menú (precio o ingredientes mal cargados, por ejemplo),
  simplemente lo escribe como motivo (igual que "se acabó el ingrediente
  principal", el ejemplo ya usado en la spec de E2) — no hace falta un estado,
  un subtipo de rechazo ni ningún campo nuevo. HU-03 no toca el contenido del
  motivo: solo consulta y muestra la entrada de historial que E2 ya escribió,
  motivo incluido (FR-034).

## Qué falta (alcance de HU-03 / E4)

1. **Exponer el historial de un pedido por API.** Como mínimo una ruta de
   detalle por pedido (`GET /orders/:id` o equivalente) que incluya sus
   entradas de `OrderStatusEvent` ordenadas, respetando el mismo control de
   acceso por rol que ya existe: el cliente solo ve los suyos, el negocio los
   que gestiona.
2. **Mostrar el historial en la pantalla del cliente.** `/cliente/pedidos`
   pasa de "estado actual" a una línea de tiempo por pedido —qué estado, cuándo,
   y el motivo cuando fue rechazado—. Decidir en la spec si es la misma
   pantalla ampliada o una vista de detalle aparte.
3. **Extender (si corresponde) el reporte de HU-10** para que el
   administrador pueda ver el historial de un pedido desde el panel, no solo
   su estado puntual — a definir con criterios de aceptación propios, sin
   dar por sentado que HU-10 ya lo resolvió.
4. **Dejar preparado el mecanismo para que E5 y E7 sigan escribiendo al
   mismo historial.** E4 no dispara `→ asignado_repartidor`, `→ entregado` ni
   `→ cerrado` —esas transiciones nacen en E5 y E7, que todavía no existen—,
   pero si el helper transaccional que hoy vive privado en
   `orders.service.ts` conviene compartirse o generalizarse para que las
   épicas futuras lo reusen sin reinventar la atomicidad ya resuelta, es una
   decisión de diseño de esta HU (se documenta en su `plan.md` / `research.md`,
   no aquí).
5. **Verificación funcional pendiente de HU-10** (FR-019, FR-020, SC-006 de
   `specs/001-acceso-y-usuarios/spec.md`): una vez que HU-03 deje pedidos con
   historial real, corresponde volver a esa spec y completar su validación
   manual, que quedó condicionada a que existieran E4/E2.

## Explícitamente fuera de alcance (v1)

- Disparar `asignado_repartidor`, `entregado` o `cerrado` — pertenecen a E5 y
  E7. HU-03 solo puede verificarse funcionalmente sobre los estados que ya
  son alcanzables hoy: `creado`, `en_preparacion`, `rechazado`.
- Geolocalización o seguimiento en tiempo real del repartidor — descartado
  por decisión de alcance de v1 (`docs/epicas-hu/EPICS.md`, "Sin
  geolocalización").
- Notificaciones push o por correo ante cada cambio de estado — ninguna HU
  del mapa la pide; sería alcance fantasma (Principio III de la
  constitución).
- Auditoría de accesos a la trazabilidad — no confundir con
  `admin_audit_log`, que registra acciones administrativas sobre usuarios
  (HU-09), no consultas de historial de pedidos.

## Preguntas abiertas para `/speckit.clarify`

- ¿El historial se muestra siempre completo o se resume (p. ej. solo el
  último cambio + acceso a "ver más")?
- ¿El negocio necesita ver el historial de un pedido ya rechazado o
  entregado, o solo de los que sigue gestionando activamente?
- ¿`GET /dashboard/orders` (HU-10) se enriquece en esta épica o queda para
  cuando E5/E7 aporten más estados que reportar?
