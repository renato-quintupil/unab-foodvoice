# Feature Specification: Trazabilidad del pedido

**Feature Branch**: `005-trazabilidad-pedido`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Construir la trazabilidad del pedido (HU-03): la posibilidad de que un cliente vea el historial completo de estados de cada uno de sus pedidos —no solo el estado actual, que ya existe desde E2— y de que el negocio vea la misma trazabilidad sobre los pedidos que gestiona. El historial de estados ya se escribe desde E2 (OrderStatusEvent, append-only), pero no se expone: no hay endpoint, DTO ni pantalla que lo consulte. Esta épica agrega esa consulta, no la escritura que ya existe."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cliente consulta el historial de su pedido (Priority: P1)

Un cliente que ya hizo un pedido quiere saber qué pasó con él más allá del estado actual: cuándo se creó, cuándo el negocio lo aceptó (o lo rechazó y por qué), sin tener que llamar o escribir al local.

**Why this priority**: Es el escenario que da nombre a la épica y el que más valor entrega solo: sin él, la trazabilidad que ya se escribe en base de datos sigue siendo invisible para quien más la necesita.

**Independent Test**: Con un cliente que tiene al menos un pedido en `creado`, `en_preparacion` o `rechazado`, puede abrir ese pedido en `/cliente/pedidos` y ver una línea de tiempo con cada cambio de estado, su fecha/hora y, si fue un rechazo, el motivo.

**Acceptance Scenarios**:

1. **Given** un cliente con un pedido en estado `en_preparacion`, **When** abre el detalle de ese pedido, **Then** ve dos entradas de historial: la creación (`creado`) y la aceptación (`→ en_preparacion`), cada una con su fecha y hora.
2. **Given** un cliente con un pedido en estado `rechazado`, **When** abre el detalle de ese pedido, **Then** ve la entrada de rechazo con el motivo de texto que escribió el negocio.
3. **Given** un cliente autenticado, **When** intenta consultar el detalle de un pedido que pertenece a otro cliente, **Then** el sistema responde como si el pedido no existiera (ni el estado actual ni el historial son visibles).

---

### User Story 2 - Negocio consulta el historial de un pedido que gestiona (Priority: P2)

Un negocio quiere responder una consulta de un cliente ("¿cuándo aceptaron mi pedido?", "¿por qué lo rechazaron?") con datos concretos, sin depender de la memoria de quien atendió el mostrador ese día.

**Why this priority**: Reutiliza el mismo endpoint y la misma UI de trazabilidad que la Historia 1, pero depende de ella para el mecanismo de consulta — por eso es P2, no porque valga menos para el negocio.

**Independent Test**: Con un negocio que tiene pedidos en su bandeja o en su lista de rechazados, puede abrir el detalle de uno de ellos y ver la misma línea de tiempo que ve el cliente, incluyendo quién y con qué rol ejecutó cada cambio.

**Acceptance Scenarios**:

1. **Given** un negocio que aceptó un pedido, **When** abre el detalle de ese pedido, **Then** ve la entrada `→ en_preparacion` con el usuario y rol que la ejecutó.
2. **Given** un negocio, **When** intenta consultar el detalle de un pedido que no le pertenece (fue hecho a otro negocio), **Then** el sistema responde como si el pedido no existiera.

---

### User Story 3 - Administrador ve el historial desde el panel (Priority: P3)

Un administrador que ya usa el reporte de pedidos (`GET /dashboard/orders`, HU-10) quiere poder profundizar en un pedido puntual y ver su historial de estados, no solo su estado actual, para auditar o responder una escalación.

**Why this priority**: Es una extensión de un reporte que ya existe y que ya se puede usar sin esto (filtra y lista); el historial por pedido es una mejora, no la funcionalidad mínima viable de la épica.

**Independent Test**: Con un administrador autenticado, puede abrir el detalle de cualquier pedido del sistema (no está limitado a "propios" ni "gestionados") y ver su historial completo de estados.

**Acceptance Scenarios**:

1. **Given** un administrador, **When** abre el detalle de cualquier pedido existente, **Then** ve su historial completo de estados, sin restricción de pertenencia.

---

### Edge Cases

- ¿Qué ve el cliente o el negocio si el pedido solo tiene una entrada de historial (recién creado, sin ninguna transición todavía)? El sistema debe mostrar esa única entrada, no un estado vacío o un error.
- ¿Qué pasa si se consulta el detalle de un pedido con un identificador que no existe en absoluto (no solo que pertenece a otro usuario)? Misma respuesta que el caso "no me pertenece" — el sistema no distingue "no existe" de "no autorizado" (FR-005).
- El historial es append-only: no hay escenario de edición o eliminación de una entrada ya escrita; esta épica es de solo lectura sobre datos que E2 ya protege a nivel de base de datos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE exponer una consulta de detalle por pedido que incluya, además del estado actual, la secuencia completa y ordenada cronológicamente de sus cambios de estado.
- **FR-002**: Cada entrada de la secuencia de cambios de estado DEBE incluir: el estado anterior (vacío únicamente en la primera entrada), el estado resultante, quién ejecutó el cambio, con qué rol lo ejecutó, y en qué fecha y hora.
- **FR-003**: Un cliente autenticado únicamente DEBE poder consultar el detalle y el historial de pedidos propios.
- **FR-004**: Un negocio autenticado únicamente DEBE poder consultar el detalle y el historial de pedidos que gestiona (los hechos a ese negocio).
- **FR-005**: Al consultar el detalle de un pedido que no existe o que no pertenece al solicitante (según FR-003/FR-004), el sistema DEBE responder de forma indistinguible en ambos casos, sin revelar si el pedido existe.
- **FR-006**: Un administrador autenticado DEBE poder consultar el detalle y el historial de cualquier pedido del sistema, sin la restricción de pertenencia de FR-003/FR-004.
- **FR-007**: El cliente DEBE poder ver la trazabilidad de sus pedidos desde una pantalla accesible desde `/cliente/pedidos`, sin necesidad de contactar al negocio.
- **FR-008**: El negocio DEBE contar con una forma equivalente de consultar la trazabilidad de un pedido que gestiona, accesible desde sus pantallas existentes de gestión de pedidos.
- **FR-009**: El reporte de administrador existente (`GET /dashboard/orders`, HU-10) DEBE permitir acceder al historial de un pedido individual desde ese mismo reporte.
- **FR-010**: Cuando la última entrada del historial sea un rechazo, el sistema DEBE mostrar el motivo de texto asociado a esa entrada.
- **FR-011**: El sistema NO DEBE permitir modificar ni eliminar entradas del historial de estados a través de ninguna pantalla o consulta construida en esta épica — es una capa de solo lectura sobre un registro append-only.
- **FR-012**: El sistema DEBE registrar, para toda transición de estado que otras épicas agreguen en el futuro (asignación a repartidor, entrega, cierre), una entrada en el mismo historial y con la misma estructura que las transiciones ya existentes, de modo que la consulta de detalle no requiera cambios para mostrarlas.

### Key Entities

- **Historial de estados del pedido**: secuencia ordenada, append-only, de los cambios de estado de un pedido. Ya existe y se escribe desde E2; esta épica solo agrega su consulta y presentación. Cada entrada representa una transición (o la creación) e incluye estado anterior, estado resultante, actor, rol del actor al momento de actuar, y fecha/hora.
- **Detalle de pedido**: vista agregada de un pedido que combina su estado actual (ya existente) con su historial completo de estados (nuevo en esta épica).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente puede ver el historial completo de cualquiera de sus pedidos en menos de 10 segundos desde que entra a la sección de sus pedidos, sin necesidad de contactar al negocio.
- **SC-002**: El 100% de los pedidos con al menos una transición de estado (aceptado o rechazado) muestran su motivo o su fecha de cambio correctamente en la trazabilidad, verificado sobre los tres estados alcanzables hoy (`creado`, `en_preparacion`, `rechazado`).
- **SC-003**: Ningún cliente ni negocio puede acceder al historial de un pedido ajeno: el 100% de los intentos de acceso no autorizado reciben una respuesta que no distingue "no existe" de "no autorizado".
- **SC-004**: Un administrador puede llegar del reporte de pedidos al historial detallado de un pedido puntual en no más de dos acciones (por ejemplo, dos clics).

## Assumptions

- El historial que expone esta épica es el que ya escribe E2 (`OrderStatusEvent`); esta épica no agrega nuevas transiciones ni cambia la máquina de estados del Principio XII de la constitución.
- La verificación funcional de esta épica solo cubre las transiciones ya alcanzables (`creado → en_preparacion`, `creado → rechazado`); las que agreguen E5 (reparto) y E7 (cierre) se verifican cuando esas épicas existan, aunque el mecanismo de esta épica ya quede preparado para mostrarlas (FR-012).
- Geolocalización, seguimiento en tiempo real y notificaciones push o por correo ante cambios de estado quedan fuera de alcance de v1, ya decidido en el mapa de épicas del proyecto.
- El acceso del administrador (Historia 3, FR-006, FR-009) se resuelve como extensión del reporte HU-10 ya existente, y no requiere una pantalla nueva independiente.
