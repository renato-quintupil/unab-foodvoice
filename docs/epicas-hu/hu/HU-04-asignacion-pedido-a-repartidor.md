# HU-04 · Asignación pedido a repartidor

**Épica**: E5 · Reparto
**Estado**: sin especificar (este documento es la base para `/speckit.specify`,
no reemplaza la spec que generará ese comando)

## Historia

> Como **repartidor**, quiero **ver los pedidos listos para repartir y tomar
> uno**, para saber qué debo retirar del local y a dónde llevarlo.
>
> Como **negocio**, quiero **que un pedido que terminé de preparar quede
> disponible para que un repartidor lo tome**, para dejar de tener que
> coordinar la entrega por fuera del sistema.

## Qué ya existe en el sistema (2026-08-27)

Antes de especificar, esto es lo que E1/E2/E4 ya construyeron y sobre lo que
HU-04 se apoya — no hay que redefinirlo, solo consumirlo y extenderlo:

- **La máquina de estados es de seis estados**, constitución (Principio XII,
  v2.0.0). La transición que le corresponde a esta épica es
  `en_preparacion → asignado_repartidor`, la única que sale de
  `en_preparacion`:

  ```
  creado ─┬─→ en_preparacion → asignado_repartidor → entregado → cerrado
          └─→ rechazado   (terminal, sin transiciones salientes)
  ```

  Vive en `packages/shared/src/order-state/machine.ts`. **No existe hoy
  ningún camino para llegar a `asignado_repartidor`**: es exactamente el
  vacío que HU-04 llena. `entregado` y `cerrado` (E7) quedan fuera de esta
  historia.
- **El rol `REPARTIDOR` ya existe** en `packages/shared/src/enums/role.ts` y
  en el enum `Role` de Prisma, con su guard (`@Roles(Role.REPARTIDOR)`) listo
  para usarse igual que en los otros tres roles. Su pantalla de inicio hoy es
  un placeholder: `apps/web/src/app/repartidor/page.tsx` solo renderiza
  `InicioDeRol` sin ninguna acción — es el punto exacto donde arranca HU-04.
- **`Order` no tiene ninguna columna de repartidor todavía**
  (`services/api/prisma/schema.prisma:374`). No hay `assignedTo`,
  `deliveredBy` ni ninguna relación con `User` más allá de `userId` (el
  cliente que lo confirmó). Agregar esa columna, con su migración, es tarea
  de esta épica.
- **El helper transaccional de transición de estado** vive privado en
  `orders.service.ts` (`aceptar`/`rechazar`), y ya escribe en la misma
  transacción el cambio de estado y su entrada de `OrderStatusEvent`
  (append-only, protegido por trigger). HU-04 dispara una transición nueva
  sobre el mismo pedido y debería reusar ese mecanismo, no reinventar la
  atomicidad ya resuelta — E4 dejó esto anotado como decisión de diseño
  pendiente para las épicas que siguieran agregando transiciones.
- **`GET /orders/:id`, `GET /business/orders/:id` y
  `GET /admin/dashboard/orders/:id`** (E4) ya arman `OrderDetailDto` con la
  línea de tiempo completa del pedido, incluidas transiciones futuras — el
  contrato ya está preparado para que aparezca una entrada
  `en_preparacion → asignado_repartidor` en cuanto exista, sin cambio de
  contrato compartido.
- **`BusinessOrdersController`** (`business/orders`) es el patrón a seguir
  para un controlador de rol propio: guard de sesión + `@Roles(...)`, un
  servicio compartido (`OrdersService`) inyectado, y endpoints que devuelven
  `OrderSummaryDto`/`Paginated<OrderSummaryDto>`. Un `RepartidorOrdersController`
  análogo es la forma esperada, no una mezcla dentro de los controladores ya
  existentes (mismo criterio que separó `OrdersController` de
  `BusinessOrdersController` en E2: cada rol tiene sus propias acciones y
  mezclar las rutas obliga a decidir el rol endpoint por endpoint).
- **La bandeja paginada del negocio** (`bandejaDelNegocio`, FR-041 de E2, 20
  por página, del más antiguo al más reciente, orden estable) es el patrón de
  referencia para una eventual bandeja de pedidos disponibles para el
  repartidor.

## Qué falta (alcance de HU-04 / E5)

1. **Decidir y construir el modelo de asignación.** `EPICS.md` describe la
   épica como "Asignación **o selección** de pedidos a repartidor" — ambigüedad
   real que hay que resolver en `/speckit.clarify`, no asumir: ¿el repartidor
   elige libremente cualquier pedido `en_preparacion` disponible (autoservicio,
   sin intervención del negocio), o el negocio asigna explícitamente un pedido
   a un repartidor concreto? Los datos que hay hoy (mono-local, sin lógica de
   turnos ni zonas) sugieren autoservicio como la opción más simple (Principio
   I), pero es una decisión a tomar con el usuario, no a dar por sentada.
2. **Agregar la columna de repartidor asignado al `Order`** (con su
   migración), guardando quién tomó el pedido y cuándo — necesario para que
   HU-03 (E4) pueda mostrarlo en el historial y para que E7 sepa quién debe
   marcar la entrega.
3. **Exponer una bandeja de pedidos disponibles** (`en_preparacion` sin
   repartidor asignado) para el rol `REPARTIDOR`, con el mismo criterio de
   paginación/orden que ya usa el negocio si el volumen lo justifica.
4. **Construir la transición `en_preparacion → asignado_repartidor`**,
   reutilizando (o generalizando, si hace falta) el helper transaccional
   existente para que la entrada de historial se escriba en la misma
   operación atómica.
5. **Definir qué pasa si dos repartidores intentan tomar el mismo pedido a la
   vez** (condición de carrera, mismo problema que ya resolvió E2 con
   aceptar/rechazar): solo uno debe ganar.
6. **Construir la pantalla del repartidor** que reemplace el placeholder de
   `apps/web/src/app/repartidor/page.tsx`: ver pedidos disponibles, tomar uno,
   ver los que ya tomó.
7. **Decidir si el repartidor puede "soltar" un pedido ya tomado** (arrepentirse
   antes de retirarlo del local) o si la asignación es irreversible hasta E7 —
   pregunta abierta, no asumir ninguna de las dos.
8. **Decidir si un repartidor puede tener varios pedidos asignados a la vez**
   o si debe cerrar (entregar, ya en E7) el que tiene antes de tomar otro —
   también pregunta abierta.

## Explícitamente fuera de alcance (v1)

- Disparar `asignado_repartidor → entregado` o `entregado → cerrado` —
  pertenecen a E7 (Cierre del servicio, HU-05). HU-04 termina en el pedido
  asignado, no en su entrega.
- Geolocalización, mapas, ruteo o tiempo estimado de entrega — descartado por
  decisión de alcance de v1 (`docs/epicas-hu/EPICS.md`, "Sin
  geolocalización").
- Notificaciones push o por correo cuando un pedido queda disponible o es
  tomado — ninguna HU del mapa la pide; sería alcance fantasma (Principio III
  de la constitución).
- Zonas de reparto, turnos o cualquier lógica de balanceo de carga entre
  repartidores — no hay ninguna HU que lo exija y el producto es mono-local.
- Calificación o evaluación del repartidor — no está en el mapa de HU.

## Preguntas abiertas para `/speckit.clarify`

- ¿Autoservicio (el repartidor elige y toma un pedido disponible) o
  asignación explícita por el negocio a un repartidor concreto?
- ¿Un repartidor puede tener más de un pedido asignado a la vez, o debe
  completar (entregar, en E7) el que tiene antes de tomar otro?
- ¿Puede el repartidor devolver un pedido ya tomado sin haberlo entregado
  (por ejemplo, no puede salir a repartir), volviéndolo disponible para otro
  repartidor?
- ¿El negocio necesita ver quién tomó cada pedido, o eso queda reservado a
  la trazabilidad de HU-03 (E4)?
- ¿Existe algún límite de tiempo esperado entre `en_preparacion` y
  `asignado_repartidor` que el sistema deba señalar, o queda —igual que la
  demora del negocio en E2 (Supuesto 6)— sin escalamiento automático en v1?
