# Feature Specification: Reparto (Asignación de pedido a repartidor)

**Feature Branch**: `007-reparto-repartidor`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Construir la asignación de pedidos a repartidor (HU-04): la transición en_preparacion → asignado_repartidor de la máquina de estados del pedido, que hoy no tiene ningún camino para dispararse. El rol REPARTIDOR ya existe desde E1 pero su pantalla es un placeholder sin ninguna acción. Order no tiene todavía ninguna columna que identifique al repartidor asignado. Debe incluir: una forma de que el repartidor vea los pedidos en_preparacion disponibles y tome uno; una columna nueva en Order que registre el repartidor asignado y cuándo; la transición en_preparacion → asignado_repartidor reutilizando el mecanismo transaccional de E2 (cambio de estado + entrada de historial atómica); resolver la condición de carrera de que dos repartidores tomen el mismo pedido; reemplazar el placeholder de /repartidor por una pantalla real. Fuera de esta épica: disparar asignado_repartidor → entregado o entregado → cerrado (E7), geolocalización, notificaciones push, zonas de reparto o turnos."

## Clarifications

### Session 2026-08-27 (previa a `/speckit.specify`, resuelta con el usuario antes de redactar esta spec)

`docs/epicas-hu/EPICS.md` describe la épica como "asignación **o** selección" de pedidos a repartidor, sin resolver cuál de las dos — ambigüedad real, no un detalle menor, porque cambia qué rol tiene la acción y qué pantallas hacen falta. Se resolvió con el usuario antes de escribir los escenarios de abajo:

- Q: ¿Cómo pasa un pedido de `en_preparacion` a `asignado_repartidor`? → A: Autoservicio — cualquier repartidor ve todos los pedidos `en_preparacion` sin repartidor asignado y toma el que quiera, sin que el negocio intervenga en la asignación.
- Q: ¿Puede un repartidor tener más de un pedido asignado a la vez? → A: No; mientras tenga un pedido en `asignado_repartidor` sin entregar, el sistema no le ofrece tomar otro. Debe esperar a que E7 (Cierre del servicio) lo marque como entregado.
- Q: ¿Puede un repartidor devolver (soltar) un pedido que ya tomó, antes de entregarlo? → A: Sí; una acción explícita libera el pedido, que vuelve a `en_preparacion` sin repartidor asignado y queda disponible para cualquier repartidor, incluido el mismo que lo soltó.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Repartidor toma un pedido disponible (Priority: P1)

Un repartidor que empieza su turno quiere ver qué pedidos del local ya están listos para retirar y comprometerse a llevar uno, sin que nadie tenga que asignárselo a mano.

**Why this priority**: Es el corazón de la épica — sin esta acción, `asignado_repartidor` sigue siendo un estado inalcanzable y el rol `REPARTIDOR` sigue siendo un placeholder sin ninguna función real.

**Independent Test**: Con al menos un pedido en `en_preparacion` sin repartidor asignado, un usuario con rol `REPARTIDOR` puede abrir su pantalla, ver ese pedido en la lista de disponibles, tomarlo, y verlo pasar a su propia lista de "pedidos en curso" con el estado `asignado_repartidor`.

**Acceptance Scenarios**:

1. **Given** un pedido en `en_preparacion` sin repartidor asignado, **When** un repartidor sin pedido en curso lo toma, **Then** el pedido pasa a `asignado_repartidor`, queda registrado que ese repartidor lo tomó y en qué momento, y desaparece de la lista de disponibles para los demás repartidores.
2. **Given** que no hay ningún pedido en `en_preparacion` sin repartidor asignado, **When** un repartidor abre su pantalla, **Then** ve un mensaje en español explicando que no hay pedidos disponibles por ahora, no una lista vacía sin explicación.
3. **Given** un repartidor que ya tiene un pedido en `asignado_repartidor` sin entregar, **When** revisa la lista de pedidos disponibles, **Then** el sistema no le ofrece ninguna acción para tomar otro pedido hasta que el que tiene se entregue (E7) o lo suelte (Historia 3).
4. **Given** dos repartidores que intentan tomar el mismo pedido casi al mismo tiempo, **When** ambas acciones se procesan, **Then** solo uno queda asignado al pedido y el otro recibe un mensaje en español indicando que ya no está disponible, sin que el pedido quede en un estado inconsistente.
5. **Given** un pedido recién asignado a un repartidor, **When** el cliente o el negocio consultan su trazabilidad (E4), **Then** ven una nueva entrada de historial con el estado anterior `en_preparacion`, el estado resultante `asignado_repartidor`, el repartidor que lo tomó y la fecha, sin que la pantalla de trazabilidad haya necesitado ningún cambio para mostrarla.

---

### User Story 2 - Repartidor consulta el pedido que tiene en curso (Priority: P2)

Un repartidor que ya tomó un pedido quiere ver sus datos completos — productos, dirección de entrega — para saber qué retirar del local y a dónde llevarlo, sin tener que volver a preguntar en el mostrador.

**Why this priority**: Depende de que exista la Historia 1 (no hay nada que consultar sin haber tomado un pedido antes), pero es indispensable para que la asignación tenga utilidad real en la calle.

**Independent Test**: Con un repartidor que ya tomó un pedido, puede abrir una vista de "mi pedido en curso" y ver sus productos, cantidades y la dirección de entrega, igual que ya puede verlos el negocio en su propia bandeja.

**Acceptance Scenarios**:

1. **Given** un repartidor con un pedido en `asignado_repartidor`, **When** abre su pantalla, **Then** ve los productos, cantidades y la dirección de entrega de ese pedido.
2. **Given** un repartidor sin ningún pedido asignado, **When** abre su pantalla, **Then** no ve ninguna sección de "pedido en curso", solo la lista de pedidos disponibles para tomar.

---

### User Story 3 - Repartidor suelta un pedido que no puede completar (Priority: P3)

Un repartidor que tomó un pedido pero no puede salir a repartirlo (se le pinchó una rueda, tuvo un imprevisto) necesita devolverlo para que otro repartidor pueda tomarlo, en vez de dejarlo asignado indefinidamente a alguien que no va a entregarlo.

**Why this priority**: Es un caso de recuperación, no el camino feliz de la épica; el sistema es utilizable sin él siempre que los repartidores completen lo que toman, pero sin esta historia un pedido puede quedar bloqueado por un repartidor que no puede entregarlo.

**Independent Test**: Con un repartidor que tiene un pedido en `asignado_repartidor`, puede soltarlo con una acción explícita y verlo reaparecer inmediatamente en la lista de disponibles para cualquier repartidor.

**Acceptance Scenarios**:

1. **Given** un repartidor con un pedido en `asignado_repartidor`, **When** usa la acción de soltar el pedido, **Then** el pedido vuelve a `en_preparacion` sin repartidor asignado, y el repartidor que lo soltó ya no tiene ningún pedido en curso.
2. **Given** un pedido que un repartidor soltó, **When** otro repartidor (o el mismo) revisa la lista de disponibles, **Then** lo ve ahí de nuevo, sin ninguna marca que lo distinga de un pedido que nunca fue tomado.

---

### Edge Cases

- ¿Qué pasa si el negocio, por error, intenta aceptar o rechazar un pedido que ya está en `asignado_repartidor`? El sistema debe impedirlo — el negocio solo actúa sobre pedidos en `creado` (RN-010 de E2), y esta épica no le agrega ninguna acción nueva sobre pedidos ya asignados.
- ¿Qué pasa si un repartidor intenta tomar un pedido que ya no está en `en_preparacion` porque otro repartidor lo tomó un instante antes? El sistema lo rechaza con un mensaje claro, sin duplicar la asignación (Acceptance Scenario 4 de la Historia 1).
- ¿Qué pasa si un repartidor sin pedido en curso intenta soltar "su" pedido? No existe esa acción para él — la pantalla no la ofrece si no tiene ningún pedido asignado.
- Un pedido que un repartidor soltó y que nadie más toma nunca: queda en `en_preparacion` indefinidamente, igual que un pedido `creado` que el negocio nunca acepta ni rechaza (mismo criterio ya aceptado en E2, sin escalamiento automático en v1).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a cualquier usuario con rol `REPARTIDOR` ver la lista de pedidos en estado `en_preparacion` que no tienen repartidor asignado.
- **FR-002**: El sistema DEBE permitir a un repartidor sin ningún pedido en `asignado_repartidor` tomar cualquier pedido de esa lista, sin que el negocio deba realizar ninguna acción de asignación.
- **FR-003**: Al tomar un pedido, el sistema DEBE transicionarlo de `en_preparacion` a `asignado_repartidor` y registrar de forma inmutable, en la misma operación indivisible que el cambio de estado, el repartidor que lo tomó y la fecha y hora.
- **FR-004**: El sistema NO DEBE ofrecer a un repartidor con un pedido en `asignado_repartidor` sin entregar ninguna acción para tomar un segundo pedido.
- **FR-005**: El sistema DEBE garantizar que, si dos repartidores intentan tomar el mismo pedido de forma concurrente, solo uno tenga éxito y el otro reciba un mensaje en español indicando que el pedido ya no está disponible, sin duplicar la asignación ni dejar el pedido en un estado inconsistente.
- **FR-006**: El sistema DEBE mostrar un mensaje en español cuando no haya ningún pedido disponible para tomar, en lugar de una lista vacía sin explicación.
- **FR-007**: El sistema DEBE permitir al repartidor consultar los datos completos —productos, cantidades y dirección de entrega— del pedido que tiene actualmente en `asignado_repartidor`.
- **FR-008**: El sistema DEBE permitir a un repartidor con un pedido en `asignado_repartidor` devolverlo con una acción explícita, transicionándolo de vuelta a `en_preparacion` sin repartidor asignado.
- **FR-009**: Un pedido devuelto por un repartidor (FR-008) DEBE reaparecer en la lista de pedidos disponibles (FR-001) sin ninguna marca que lo distinga de un pedido que nunca fue tomado, y DEBE poder ser tomado por cualquier repartidor, incluido el que lo devolvió.
- **FR-010**: El sistema NO DEBE permitir al rol `NEGOCIO` ni a ningún otro rol distinto de `REPARTIDOR` tomar, asignar o devolver un pedido en el sentido de esta épica.
- **FR-011**: El sistema DEBE impedir que el negocio acepte o rechace un pedido que ya no está en `creado` (herencia de RN-010, E2); esta épica no agrega ninguna acción del negocio sobre pedidos en `asignado_repartidor`.
- **FR-012**: Cada transición que produzca esta épica (tomar o devolver un pedido) DEBE agregar exactamente una entrada inmutable al historial de estados del pedido, con el mismo formato que ya usan las transiciones de E2, de modo que la consulta de trazabilidad de E4 la muestre sin cambios de contrato.
- **FR-013**: El sistema DEBE reemplazar la pantalla actual de inicio del rol repartidor (sin ninguna acción) por una pantalla que muestre la lista de pedidos disponibles y, si corresponde, el pedido que el repartidor tiene en curso.

### Key Entities

- **Repartidor asignado (dato nuevo en `Pedido`)**: identifica qué usuario con rol `REPARTIDOR` tomó el pedido y cuándo. Presente únicamente mientras el pedido está en `asignado_repartidor`; conservado como parte del historial una vez que el pedido avanza (E7) o se libera (FR-008, en cuyo caso el pedido vuelve a no tener repartidor asignado).
- **Pedido disponible**: un pedido en `en_preparacion` sin repartidor asignado; visible para cualquier repartidor sin pedido en curso.
- **Pedido en curso (del repartidor)**: el único pedido en `asignado_repartidor` que un repartidor puede tener a la vez.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un repartidor sin pedido en curso puede pasar de ver la lista de pedidos disponibles a tener uno asignado en 1 clic o menos.
- **SC-002**: En una validación con al menos 3 pedidos en `en_preparacion` y 2 repartidores activos, cada pedido termina asignado a exactamente un repartidor, sin duplicados ni pedidos asignados a más de uno.
- **SC-003**: En una validación donde dos repartidores intentan tomar el mismo pedido casi al mismo tiempo, exactamente 1 de los 2 intentos tiene éxito y el otro recibe un mensaje claro, en el 100% de los casos probados.
- **SC-004**: Un repartidor con un pedido en curso no encuentra, en ningún momento, una acción para tomar un segundo pedido mientras el primero siga en `asignado_repartidor`.
- **SC-005**: Un pedido devuelto por un repartidor vuelve a estar disponible para cualquier repartidor en menos de 10 segundos desde que se soltó, sin intervención del negocio.
- **SC-006**: Al consultar la trazabilidad de un pedido asignado a un repartidor (E4), el 100% de las veces aparece la entrada `en_preparacion → asignado_repartidor` con el repartidor correcto, sin que la pantalla de trazabilidad haya requerido ningún cambio.

## Assumptions

- **Autoservicio sin intervención del negocio**: el mapa de épicas (`docs/epicas-hu/EPICS.md`) describe la épica como "asignación o selección" sin resolver cuál; se decidió autoservicio (el repartidor elige y toma) por ser el modelo más simple que cumple la historia (Principio I) y porque no hay ninguna HU que pida al negocio una pantalla de asignación manual — agregarla sería alcance fantasma (Principio III).
- **Un repartidor, un pedido a la vez**: sin esta restricción, un repartidor podría acumular pedidos sin salir a repartir ninguno; es la opción que evita ese abuso sin necesitar un límite configurable que ninguna HU pide.
- **Soltar un pedido es reversible sin penalización**: no hay ninguna HU que pida registrar o sancionar cuántas veces un repartidor suelta un pedido; un pedido soltado es indistinguible de uno recién llegado a `en_preparacion` sin repartidor.
- **Mono-local (Principio VIII)**: todos los repartidores ven la misma lista de pedidos disponibles del único local existente; no hay zonas, turnos ni filtros por cercanía.
- **Reutilización del mecanismo transaccional de E2/E4**: la transición y su entrada de historial se escriben como una sola operación atómica, con el mismo criterio de concurrencia que ya resolvió E2 para aceptar/rechazar un pedido.
- **Sin geolocalización, notificaciones push ni mapas**: decisiones de alcance de v1 ya declaradas en `docs/epicas-hu/EPICS.md` y heredadas por todas las épicas anteriores.
- **Fuera de esta épica**: las transiciones `asignado_repartidor → entregado` y `entregado → cerrado` pertenecen a E7 (Cierre del servicio, HU-05) y no se construyen aquí.
