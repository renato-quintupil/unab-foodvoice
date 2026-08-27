# Feature Specification: Cierre del servicio (Cierre digital del servicio)

**Feature Branch**: `008-cierre-servicio`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Construir el cierre digital del servicio (HU-05): las dos últimas transiciones de la máquina de estados del pedido, asignado_repartidor → entregado y entregado → cerrado, que hoy no tienen ningún camino para dispararse. El repartidor marca como entregado el pedido que tiene en curso. El cliente, sobre un pedido propio en entregado, elige entre confirmar que todo estuvo bien o reclamar con un motivo de texto libre — ambos caminos cierran el pedido; el reclamo es feedback registrado (Order.complaintReason, nulable), no un bloqueo del cierre. El reclamo es texto libre, visible al negocio, sin categorías ni flujo de resolución."

## Clarifications

### Session 2026-08-27 (previa a `/speckit.specify`, resuelta con el usuario antes de redactar esta spec)

`docs/epicas-hu/EPICS.md` describe la épica solo como "confirmación digital de entrega y conformidad/reclamo entrega de feedback" — insuficiente para especificar sin ambigüedad, con pistas contradictorias entre la constitución (que atribuye el cierre al repartidor) y el guion de la presentación del proyecto (que atribuye la confirmación al cliente). Se resolvió con el usuario antes de escribir los escenarios de abajo:

- Q: ¿Quién dispara `asignado_repartidor → entregado`? → A: El repartidor, marcando "Entregado" sobre el pedido que tiene en curso — simétrico con "Tomar"/"Soltar" de E5.
- Q: ¿Cómo funciona la "conformidad/reclamo" del cliente (`entregado → cerrado`)? → A: El cliente confirma o reclama, y ambos caminos cierran el pedido — el reclamo es feedback registrado, no un bloqueo del cierre ni un estado nuevo.
- Q: ¿Qué tan lejos llega el reclamo en v1? → A: Solo texto libre, visible al negocio — sin clasificación de productos ni flujo de resolución.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Repartidor marca un pedido como entregado (Priority: P1)

Un repartidor que acaba de dejar un pedido en la puerta del cliente quiere marcarlo como entregado desde la misma pantalla donde lo tomó, para que quede registrado y para quedar libre de tomar otro.

**Why this priority**: Sin esta acción, `entregado` sigue siendo un estado inalcanzable y ninguna de las otras dos historias tiene nada sobre qué operar — es el mismo tipo de vacío que llenó la Historia 1 de HU-04 (E5) para `asignado_repartidor`.

**Independent Test**: Con un repartidor que tiene un pedido en `asignado_repartidor`, puede marcarlo "Entregado" desde `/repartidor` y verlo desaparecer de "su pedido en curso", quedando libre para tomar otro pedido disponible.

**Acceptance Scenarios**:

1. **Given** un repartidor con un pedido en `asignado_repartidor`, **When** marca "Entregado", **Then** el pedido pasa a `entregado`, queda registrada una entrada de historial con el repartidor como actor y la fecha, y el repartidor ya no tiene ningún pedido en curso.
2. **Given** un repartidor sin ningún pedido en curso, **When** revisa su pantalla, **Then** no existe ninguna acción de "marcar entregado" disponible — no hay nada sobre qué marcarla.
3. **Given** que inició sesión con un rol distinto de `REPARTIDOR`, **When** intenta marcar un pedido como entregado, **Then** el sistema lo impide.
4. **Given** un pedido que ya está en `entregado` o `cerrado`, **When** el repartidor que lo tenía asignado intenta marcarlo entregado de nuevo, **Then** el sistema lo impide — no hay forma de repetir la transición.

---

### User Story 2 - Cliente confirma que su pedido llegó bien (Priority: P2)

Un cliente que recibió su pedido y no tiene ningún problema quiere confirmarlo con un clic, para cerrar el ciclo sin tener que escribir nada.

**Why this priority**: Es el camino feliz de la Historia 3 (reclamar) y depende de que exista la Historia 1 — un pedido no puede confirmarse antes de estar `entregado`. Se prioriza por encima del reclamo porque es la acción esperable en la mayoría de los pedidos.

**Independent Test**: Con un cliente que tiene un pedido en `entregado`, puede confirmarlo con una acción de un clic desde "Mis pedidos" y verlo pasar a `cerrado`, sin ningún motivo de reclamo asociado.

**Acceptance Scenarios**:

1. **Given** un cliente con un pedido propio en `entregado`, **When** confirma que todo estuvo bien, **Then** el pedido pasa a `cerrado`, sin `complaintReason`, y queda una entrada de historial con el cliente como actor y la fecha.
2. **Given** un pedido ya `cerrado`, **When** el mismo cliente vuelve a "Mis pedidos", **Then** no encuentra ninguna acción de confirmar ni reclamar sobre ese pedido — ya está cerrado.
3. **Given** un pedido que pertenece a otro cliente, **When** un cliente intenta confirmarlo, **Then** el sistema lo impide.
4. **Given** un pedido propio que todavía no está en `entregado` (por ejemplo, `en_preparacion` o `asignado_repartidor`), **When** el cliente intenta confirmarlo o reclamarlo, **Then** el sistema lo impide — la acción solo existe sobre pedidos entregados.

---

### User Story 3 - Cliente reclama por un problema con su pedido (Priority: P3)

Un cliente que recibió su pedido pero encontró un problema —le faltó algo, llegó frío, no era lo que pidió— quiere dejarlo por escrito al cerrar, para que el negocio lo sepa.

**Why this priority**: Es un camino de excepción de la Historia 2, no el camino feliz; el sistema es utilizable sin él siempre que los pedidos lleguen bien, pero sin esta historia un cliente insatisfecho no tiene ninguna forma de decirlo dentro de la aplicación.

**Independent Test**: Con un cliente que tiene un pedido en `entregado`, puede reclamar escribiendo un motivo y verlo pasar a `cerrado` con ese motivo visible, en vez de confirmarlo sin comentarios.

**Acceptance Scenarios**:

1. **Given** un cliente con un pedido propio en `entregado`, **When** reclama escribiendo el motivo "Llegó frío y sin las papas", **Then** el pedido pasa a `cerrado` con ese motivo guardado, visible para el propio cliente.
2. **Given** un cliente que intenta reclamar sin escribir ningún motivo, **When** envía el reclamo, **Then** el sistema lo impide con un mensaje en español.
3. **Given** un pedido cerrado por reclamo, **When** el negocio consulta el detalle de ese pedido (E4), **Then** ve el motivo del reclamo junto al resto de la trazabilidad, sin que la pantalla de detalle haya necesitado ningún cambio de contrato.
4. **Given** un pedido cerrado por reclamo, **When** cualquiera —cliente, negocio o administrador— intenta editar o borrar el motivo del reclamo, **Then** el sistema no ofrece ninguna forma de hacerlo — es inmutable, igual que el motivo de rechazo de E2.

---

### Edge Cases

- ¿Qué pasa si el repartidor que soltó un pedido (Historia 3 de E5) intenta marcarlo entregado igual? No puede: al soltarlo dejó de estar asignado a él, así que ya no cumple la condición de "su propio pedido en curso" (RN heredada de E5).
- ¿Qué pasa si dos intentos de cerrar el mismo pedido llegan casi al mismo tiempo (por ejemplo, dos pestañas del cliente, una confirmando y otra reclamando)? Solo uno tiene efecto; el otro falla con un mensaje claro, sin dejar el pedido en un estado ni un historial inconsistente — mismo criterio de concurrencia que ya resolvió E2 para aceptar/rechazar.
- Un motivo de reclamo compuesto solo de espacios en blanco se trata igual que uno vacío: se rechaza.
- Un pedido `entregado` que el cliente nunca confirma ni reclama queda así indefinidamente, sin cierre automático por tiempo — mismo criterio ya aceptado en E2 para pedidos `creado` sin respuesta del negocio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a un usuario con rol `REPARTIDOR` marcar como entregado el pedido que tiene actualmente en `asignado_repartidor`.
- **FR-002**: Al marcar un pedido como entregado, el sistema DEBE transicionarlo a `entregado` y registrar, en la misma operación indivisible, una entrada de historial con el repartidor como actor y la fecha y hora.
- **FR-003**: Tras marcar un pedido como entregado, el repartidor que lo tenía asignado DEBE quedar sin ningún pedido en curso, pudiendo tomar otro disponible (consistente con "un repartidor, un pedido a la vez" de HU-04).
- **FR-004**: El sistema NO DEBE permitir a ningún rol distinto de `REPARTIDOR` marcar un pedido como entregado, ni permitir a un repartidor marcar como entregado un pedido que no es el que tiene asignado.
- **FR-005**: El sistema DEBE permitir a un usuario con rol `CLIENTE`, sobre un pedido propio en `entregado`, elegir entre confirmar sin comentarios o reclamar con un motivo de texto libre no vacío.
- **FR-006**: Cualquiera de las dos acciones del cliente (confirmar o reclamar) DEBE transicionar el pedido a `cerrado` y registrar, en la misma operación indivisible, una entrada de historial con el cliente como actor y la fecha y hora.
- **FR-007**: El sistema DEBE exigir un motivo en texto libre no vacío para reclamar; no DEBE existir ningún camino para reclamar sin escribirlo. Un motivo compuesto solo de espacios en blanco se trata igual que uno vacío.
- **FR-008**: El sistema DEBE guardar el motivo del reclamo (`complaintReason`) únicamente cuando el cliente reclamó; cuando confirmó sin comentarios, ese campo DEBE quedar vacío.
- **FR-009**: El sistema NO DEBE permitir a ningún cliente confirmar ni reclamar un pedido que no es propio, ni uno que no está en `entregado` (incluidos los que ya están en `cerrado`).
- **FR-010**: El sistema DEBE mostrar al cliente el motivo de su propio reclamo, con el mismo criterio visual que ya usa el motivo de rechazo de E2.
- **FR-011**: El sistema DEBE mostrar el motivo del reclamo en el detalle de pedido que el negocio y el administrador ya pueden consultar (E4), sin exigir una pantalla ni un endpoint nuevo dedicado a reclamos.
- **FR-012**: El sistema NO DEBE ofrecer, en ninguna pantalla, una forma de editar o eliminar el motivo de un reclamo ya registrado — es inmutable, igual que el motivo de rechazo.
- **FR-013**: El sistema DEBE garantizar que, si dos acciones concurrentes compiten sobre el mismo pedido (por ejemplo, confirmar y reclamar desde dos pestañas a la vez), solo una tenga efecto y la otra falle con un mensaje en español claro, sin duplicar el efecto.
- **FR-014**: Las transiciones que agrega esta épica DEBEN aparecer en la consulta de trazabilidad existente (E4, `GET /orders/:id` y análogos) sin que esa consulta ni su contrato necesiten ningún cambio.

### Key Entities

- **Motivo del reclamo (`complaintReason`, dato nuevo en `Pedido`)**: texto libre, nulo salvo cuando el cliente cerró el pedido reclamando. Inmutable una vez escrito, visible al propio cliente, al negocio y al administrador.
- **Pedido en `entregado`**: estado intermedio entre la entrega física (marcada por el repartidor) y el cierre (decidido por el cliente); no ofrece ninguna acción al repartidor ni al negocio, solo al cliente dueño del pedido.
- **Pedido en `cerrado`**: estado terminal de la rama aceptada del pedido, alcanzado con o sin reclamo asociado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un repartidor con un pedido en curso puede marcarlo como entregado en 1 clic o menos.
- **SC-002**: Un cliente con un pedido `entregado` puede confirmarlo sin reclamo en 1 clic.
- **SC-003**: Un cliente con un pedido `entregado` puede reclamarlo, incluido escribir el motivo, en menos de 1 minuto.
- **SC-004**: En una validación con al menos 3 pedidos cerrados —algunos confirmados, algunos reclamados—, el 100% muestra el estado y, cuando corresponde, el motivo del reclamo correctos al cliente y al negocio.
- **SC-005**: En una validación donde dos acciones compiten sobre el mismo pedido `entregado` (confirmar y reclamar casi al mismo tiempo), exactamente 1 de los 2 intentos tiene éxito, sin duplicar el efecto ni dejar historial inconsistente.
- **SC-006**: Al consultar la trazabilidad de un pedido cerrado por esta épica (E4), el 100% de las veces aparecen las entradas `asignado_repartidor → entregado` y `entregado → cerrado` con el actor correcto, sin que la pantalla de trazabilidad haya requerido ningún cambio.

## Assumptions

- **Sin bandeja de reclamos dedicada**: el negocio y el administrador ven el reclamo dentro del detalle de pedido que E4 ya construyó; no hay una pantalla nueva que liste reclamos por separado, porque ninguna HU la pide y agregarla sería alcance fantasma (Principio III).
- **Longitud del motivo de reclamo**: mismo rango que el motivo de rechazo de E2 (10–500 caracteres) — mismo criterio de "ni vacío disfrazado, ni ilimitado" que ya se aplicó ahí.
- **Sin cierre automático por tiempo**: un pedido `entregado` que el cliente nunca confirma ni reclama queda así indefinidamente en v1, mismo criterio ya aceptado para pedidos `creado` sin respuesta del negocio (Supuesto 6 de `specs/003-gestion-pedidos/spec.md`).
- **Sin clasificación de productos ni calificación numérica a partir del reclamo**: la constitución menciona esa idea como parte de la visión de producto, pero ninguna HU del mapa la pide todavía (Principio III); el reclamo es solo texto libre.
- **Ninguna enmienda constitucional requerida**: a diferencia de E5, las dos transiciones que esta épica construye (`asignado_repartidor → entregado`, `entregado → cerrado`) ya estaban declaradas en el Principio XII desde su redacción original.
- **Reutilización del mecanismo transaccional de E2/E5**: ambas transiciones se escriben como una sola operación atómica (cambio de estado + entrada de historial), con el mismo criterio de concurrencia que ya resolvió E2 para aceptar/rechazar y E5 para tomar/soltar.
- **Sin geolocalización, notificaciones push ni calificación del repartidor/negocio**: decisiones de alcance de v1 ya declaradas y heredadas por todas las épicas anteriores.
