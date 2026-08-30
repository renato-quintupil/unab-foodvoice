# Feature Specification: Controles de flujos críticos (E8 · Controles y administración)

**Feature Branch**: `009-controles-flujos-criticos`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Construir HU-07 · Controles de flujos críticos: la capacidad del administrador de intervenir manualmente cuando el flujo normal del servicio —cliente, negocio, repartidor— no avanza por sí solo. A diferencia de E5 y E7, esta épica no agrega ninguna transición nueva a la máquina de estados: las seis transiciones del Principio XII (v3.0.0) ya tienen un camino normal construido. E8 da un camino administrativo alternativo sobre ese contrato ya existente, y una acción nueva —pausar al negocio— que no es una transición de pedido. Detección discrecional, sin señal automática. Dos acciones administrativas sobre un pedido: forzar la transición normal siguiente en nombre del rol que no respondió, o cerrar/cancelar administrativamente un pedido atascado fuera del camino normal — ambas con motivo obligatorio. Pausar y reanudar al negocio para impedir pedidos nuevos temporalmente. La intervención es visible para los roles afectados. La bitácora existente (AdminAuditLog, E1) se extiende. El catálogo queda fuera de esta épica. Un solo nivel de permiso dentro de ADMINISTRADOR."

## Clarifications

### Session 2026-08-30 (previa a `/speckit.specify`, resuelta con el usuario antes de redactar esta spec)

`docs/epicas-hu/EPICS.md` describe la épica solo como "Controles de flujos críticos y supervisión" — insuficiente para especificar sin ambigüedad, con varias lecturas posibles del término "bloqueo/desbloqueo de operaciones" y ningún criterio declarado de qué cuenta como "atascado". Se resolvió con el usuario antes de escribir los escenarios de abajo (ver `docs/epicas-hu/hu/HU-07-controles-de-flujos-criticos.md` para el detalle completo de las preguntas):

- Q: ¿Qué acciones concretas puede ejecutar el administrador sobre un pedido atascado? → A: Ambas — forzar la transición normal siguiente en nombre del rol que no respondió, **y** cerrar/cancelar administrativamente fuera del camino normal cuando forzar la transición no sea lo adecuado.
- Q: ¿Qué significa "bloqueo/desbloqueo de operaciones"? → A: Pausar y reanudar al negocio (impedir que reciba pedidos nuevos temporalmente). No incluye suspender repartidores individuales ni ninguna otra forma de bloqueo.
- Q: ¿Cómo se detecta que un pedido está "atascado"? → A: De forma discrecional — sin ningún criterio automático de tiempo ni señal visual nueva; el administrador lo nota mirando el detalle de pedido que ya construyó E4.
- Q: ¿Las acciones administrativas exigen motivo obligatorio? → A: Sí, siempre, para las dos acciones sobre pedidos y para pausar el servicio (no para reanudarlo).
- Q: ¿Cómo se registra la bitácora de estas acciones? → A: Se extiende el `AdminAuditLog` existente de E1, no se duplica.
- Q: ¿La intervención se muestra a los roles afectados? → A: Sí, con el mismo criterio de paridad manual que ya usan HU-01 (motivo de rechazo) y HU-05 (motivo de reclamo).
- Q: ¿HU-07 incluye alguna corrección administrativa sobre el catálogo? → A: No; el catálogo sigue siendo exclusivo del rol `NEGOCIO` (RN-001 de E3), sin excepción en v1.

### Session 2026-08-30 (durante `/speckit.clarify`)

- Q: ¿Cómo debe tratarse constitucionalmente el cierre administrativo fuera del camino normal (Historia 2), dado que el Principio XII dice hoy "no se permite ninguna otra transición" fuera de las seis ya declaradas? → A: Enmendar el Principio XII para declarar explícitamente una transición administrativa de cualquier pedido no terminal a `cerrado`, disparable solo por `ADMINISTRADOR` y con motivo obligatorio — mismo patrón que las enmiendas ya hechas para E2 (v2.0.0, agregó `rechazado`) y E5 (v3.0.0, agregó la transición de retroceso).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Forzar el avance de un pedido atascado (Priority: P1)

Un administrador nota, revisando el detalle de un pedido (E4), que lleva mucho tiempo en `creado` sin que el negocio lo acepte ni lo rechace. Quiere forzar su avance a `en_preparacion` (o a `rechazado`, si corresponde) en nombre del negocio, dejando un motivo que explique por qué intervino.

**Why this priority**: Es el caso de uso más concreto ya señalado desde E2 (Supuesto 6: "un pedido pendiente sin respuesta del negocio queda pendiente indefinidamente, sin escalamiento") — el vacío real que esta épica llena primero.

**Independent Test**: Con un pedido en `creado` sin ninguna acción del negocio, el administrador puede forzar su transición a `en_preparacion` (o a `rechazado` con motivo) desde el detalle de pedido, y el cliente lo ve reflejado con el nuevo estado en la siguiente carga.

**Acceptance Scenarios**:

1. **Given** un pedido en `creado` sin respuesta del negocio, **When** el administrador fuerza su transición a `en_preparacion` escribiendo un motivo, **Then** el pedido pasa a `en_preparacion`, queda una entrada de historial con el administrador como actor y el motivo, y el cliente lo ve como "En preparación" en la siguiente carga.
2. **Given** un pedido en `asignado_repartidor` sin que el repartidor lo marque entregado, **When** el administrador fuerza su transición a `entregado` con motivo, **Then** el pedido pasa a `entregado` y el repartidor deja de tenerlo como pedido en curso.
3. **Given** un pedido en cualquier estado no terminal, **When** el administrador intenta forzar una transición sin escribir ningún motivo, **Then** el sistema lo impide con un mensaje en español.
4. **Given** un pedido ya en `rechazado` o `cerrado`, **When** el administrador intenta forzar cualquier transición sobre él, **Then** el sistema lo impide — son estados terminales.
5. **Given** que inició sesión con un rol distinto de `ADMINISTRADOR`, **When** intenta forzar la transición de un pedido, **Then** el sistema lo impide.

---

### User Story 2 - Cerrar administrativamente un pedido atascado (Priority: P2)

Un administrador revisa un pedido que quedó atascado y para el que forzar la siguiente transición normal no resuelve el problema real (por ejemplo, el negocio ya no puede prepararlo y el cliente tampoco puede ser contactado por otra vía). Quiere cerrarlo administrativamente, fuera del camino normal de la máquina de estados, dejando un motivo.

**Why this priority**: Es un camino de excepción sobre la Historia 1 — cubre los casos donde avanzar el pedido paso a paso no tiene sentido y hace falta terminarlo directamente. Se prioriza después porque forzar la transición normal ya resuelve el caso más común.

**Independent Test**: Con un pedido atascado en cualquier estado no terminal, el administrador puede cerrarlo administrativamente con un motivo, y el pedido queda en un estado terminal visible como cerrado por decisión administrativa para todos los roles involucrados.

**Acceptance Scenarios**:

1. **Given** un pedido atascado en `en_preparacion`, **When** el administrador lo cierra administrativamente con el motivo "Local cerrado por emergencia, pedido no se puede completar", **Then** el pedido queda en un estado terminal, con ese motivo visible para el cliente, el negocio y (si correspondía) el repartidor.
2. **Given** un pedido atascado en `asignado_repartidor`, **When** el administrador lo cierra administrativamente con motivo, **Then** el pedido queda terminal y el repartidor que lo tenía asignado deja de tenerlo como pedido en curso.
3. **Given** un pedido en cualquier estado, **When** el administrador intenta cerrarlo administrativamente sin escribir ningún motivo, **Then** el sistema lo impide con un mensaje en español.
4. **Given** un pedido ya en un estado terminal (`rechazado` o `cerrado`), **When** el administrador intenta cerrarlo administrativamente de nuevo, **Then** el sistema lo impide.
5. **Given** que inició sesión con un rol distinto de `ADMINISTRADOR`, **When** intenta cerrar administrativamente un pedido, **Then** el sistema lo impide.

---

### User Story 3 - Pausar y reanudar el servicio (Priority: P3)

Un administrador necesita impedir temporalmente que el negocio reciba pedidos nuevos —por ejemplo, ante un imprevisto operativo declarado fuera del sistema—, sin afectar los pedidos que ya están en curso. Más tarde, cuando el imprevisto termina, quiere reanudar el servicio para que los clientes vuelvan a poder confirmar pedidos.

**Why this priority**: Es la única acción de esta épica que no actúa sobre un pedido puntual sino sobre el servicio completo; se prioriza al final porque, a diferencia de las dos historias anteriores, no depende de que exista ya ningún pedido atascado — puede probarse en cualquier momento.

**Independent Test**: Con el servicio activo, el administrador puede pausarlo con un motivo, verificar que un cliente no puede confirmar un pedido nuevo mientras está pausado, y luego reanudarlo para que la confirmación vuelva a funcionar.

**Acceptance Scenarios**:

1. **Given** el servicio activo, **When** el administrador lo pausa escribiendo el motivo "Corte de luz en el local", **Then** el servicio queda pausado y queda una entrada de bitácora con el administrador, la acción y el motivo.
2. **Given** el servicio pausado, **When** un cliente con carrito y dirección válidos intenta confirmar un pedido, **Then** el sistema lo impide y muestra un mensaje en español explicando que el servicio está temporalmente pausado.
3. **Given** el servicio pausado y un pedido que ya estaba `en_preparacion` antes de la pausa, **When** el negocio, el repartidor o el cliente actúan sobre ese pedido según su rol, **Then** ninguna de esas acciones se ve afectada por la pausa.
4. **Given** el administrador intenta pausar el servicio sin escribir ningún motivo, **When** envía la acción, **Then** el sistema lo impide con un mensaje en español.
5. **Given** el servicio pausado, **When** el administrador lo reanuda, **Then** el servicio queda activo de inmediato y un cliente puede confirmar un pedido nuevo en su siguiente intento, sin exigir que el administrador escriba ningún motivo para reanudar.
6. **Given** que inició sesión con un rol distinto de `ADMINISTRADOR`, **When** intenta pausar o reanudar el servicio, **Then** el sistema lo impide.

---

### Edge Cases

- Dos administradores intentan forzar o cerrar administrativamente el mismo pedido casi al mismo tiempo, o una acción administrativa compite con una acción normal de otro rol sobre el mismo pedido (por ejemplo, el negocio acepta el pedido justo cuando el administrador lo está forzando): solo una tiene efecto; la otra falla con un mensaje claro, sin duplicar el efecto ni dejar historial inconsistente — mismo criterio de concurrencia ya resuelto en E2/E5/E7.
- Un motivo compuesto solo de espacios en blanco, en cualquiera de las tres acciones que lo exigen, se trata igual que uno vacío: se rechaza.
- El servicio se pausa mientras un cliente ya tiene el carrito abierto revisando el precio: puede seguir editando su carrito con normalidad; solo el paso final de confirmar queda bloqueado mientras dure la pausa.
- El administrador pausa el servicio y lo reanuda varias veces seguidas: cada pausa exige su propio motivo; cada reanudación no exige ninguno, y ambas quedan registradas por separado en la bitácora.
- Un pedido cerrado administrativamente (Historia 2) queda indistinguible, para el cliente y el negocio, del cierre motivado por el propio cliente (E7) salvo por el motivo mostrado: ambos usan el mismo lugar de la pantalla para mostrarlo, sin una sección aparte.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a un usuario con rol `ADMINISTRADOR` forzar, sobre un pedido en un estado no terminal, la transición hacia el siguiente estado del camino normal ya definido por la máquina de estados (incluida la rama a `rechazado` cuando el pedido está en `creado`), en nombre del rol que correspondería ejecutarla.
- **FR-002**: Forzar una transición DEBE exigir un motivo en texto libre no vacío, y DEBE registrar el cambio de estado y el motivo como una única operación indivisible, con el mismo mecanismo transaccional ya generalizado por E2/E5/E7.
- **FR-003**: El sistema DEBE permitir a un usuario con rol `ADMINISTRADOR` cerrar administrativamente un pedido en cualquier estado no terminal, llevándolo directamente a `cerrado` mediante la transición administrativa que esta épica declara explícitamente en el Principio XII (enmienda constitucional, mismo patrón que las de E2 v2.0.0 y E5 v3.0.0), para los casos en que forzar la transición normal no resuelva el problema.
- **FR-004**: Cerrar administrativamente un pedido DEBE exigir un motivo en texto libre no vacío, y DEBE registrarse en la misma operación indivisible que el cambio de estado, con el mismo criterio de historial inmutable que ya exige el Principio XII para el resto de las transiciones.
- **FR-005**: El sistema NO DEBE permitir a ningún rol distinto de `ADMINISTRADOR` forzar transiciones ni cerrar pedidos administrativamente.
- **FR-006**: El sistema NO DEBE permitir forzar una transición ni un cierre administrativo sobre un pedido que ya está en un estado terminal (`rechazado` o `cerrado`).
- **FR-007**: Cuando una intervención administrativa (forzar transición o cierre administrativo) deja a un repartidor sin el pedido que tenía en curso, el sistema DEBE dejarlo libre para tomar otro pedido disponible, con el mismo criterio de "un repartidor, un pedido a la vez" de HU-04.
- **FR-008**: El sistema DEBE mostrar la intervención administrativa y su motivo al cliente, al negocio y al repartidor del pedido afectado, en el mismo lugar donde ya ven el estado y el historial de su pedido — mismo criterio de paridad manual que el motivo de rechazo (HU-01) y el de reclamo (HU-05).
- **FR-009**: El sistema DEBE permitir a un usuario con rol `ADMINISTRADOR` pausar el servicio completo, con un motivo en texto libre no vacío obligatorio, impidiendo desde ese momento la confirmación de pedidos nuevos.
- **FR-010**: Mientras el servicio está pausado, el sistema DEBE impedir a cualquier cliente confirmar un pedido, mostrando un mensaje en español que explique que el servicio está temporalmente pausado, sin impedir que el cliente siga armando o editando su carrito.
- **FR-011**: Pausar el servicio NO DEBE afectar ningún pedido que ya estaba confirmado antes de la pausa: el negocio, el repartidor y el cliente correspondientes DEBEN poder seguir operando sobre esos pedidos con normalidad.
- **FR-012**: El sistema DEBE permitir a un usuario con rol `ADMINISTRADOR` reanudar un servicio pausado, sin exigir ningún motivo, restableciendo de inmediato la posibilidad de confirmar pedidos nuevos.
- **FR-013**: El sistema NO DEBE permitir a ningún rol distinto de `ADMINISTRADOR` pausar ni reanudar el servicio.
- **FR-014**: El sistema DEBE registrar cada una de las cuatro acciones administrativas de esta épica (forzar transición, cerrar administrativamente, pausar, reanudar) en una bitácora de solo-inserción, identificando al administrador que actuó, la acción ejecutada, el objetivo (pedido o servicio) y la fecha y hora — mismo criterio de inmutabilidad e higiene de datos personales que ya rige la bitácora administrativa de E1.
- **FR-015**: El sistema NO DEBE ofrecer ninguna forma de editar o eliminar una entrada de esta bitácora, ni el motivo de una intervención ya registrada.
- **FR-016**: El sistema DEBE garantizar que, si dos acciones administrativas compiten sobre el mismo pedido, o una acción administrativa compite con una acción normal de otro rol sobre el mismo pedido, solo una tenga efecto y las demás fallen con un mensaje en español claro, sin duplicar el efecto ni dejar historial inconsistente.
- **FR-017**: El sistema NO DEBE ofrecer al rol `ADMINISTRADOR` ninguna forma de crear, editar, dar de baja o reclasificar productos ni categorías del catálogo.
- **FR-018**: El sistema NO DEBE ofrecer ninguna forma de suspender a un repartidor individual, ni de bloquear ninguna operación distinta de la confirmación de pedidos nuevos durante una pausa del servicio.

### Key Entities

- **Intervención administrativa sobre pedido**: acción (forzar transición o cierre administrativo), motivo en texto libre, administrador actor, pedido afectado, y fecha. Inmutable una vez registrada; visible al administrador, al cliente, al negocio y al repartidor del pedido.
- **Estado operativo del servicio**: un único indicador global (activo/pausado), coherente con que v1 es mono-local — no distingue entre negocios ni usuarios `NEGOCIO` individuales. Al pausar, lleva asociado el motivo escrito por el administrador; al reanudar, no.
- **Registro de acciones administrativas (bitácora)**: extiende el mecanismo ya existente de E1 (acciones sobre usuarios) para cubrir también estas cuatro acciones nuevas, con el mismo criterio de solo-inserción y sin copiar datos personales.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador puede forzar la transición de un pedido atascado, incluido escribir el motivo, en menos de 2 minutos.
- **SC-002**: Un administrador puede cerrar administrativamente un pedido atascado, incluido escribir el motivo, en menos de 2 minutos.
- **SC-003**: Un administrador puede pausar el servicio, incluido escribir el motivo, en menos de 1 minuto, y reanudarlo en 1 clic.
- **SC-004**: En una validación con al menos 3 pedidos intervenidos administrativamente (mezcla de transición forzada y cierre administrativo), el 100% muestra el motivo correcto al cliente y al negocio, y al repartidor cuando corresponde.
- **SC-005**: En una validación con el servicio pausado, el 100% de los intentos de confirmar un pedido nuevo son bloqueados con un mensaje en español, y el 100% de los pedidos que ya estaban en curso antes de la pausa siguen operables sin cambios.
- **SC-006**: Después de reanudar el servicio, un cliente puede confirmar un pedido nuevo en su siguiente intento, sin ninguna acción adicional de sincronización.
- **SC-007**: En una validación con al menos 3 intervenciones administrativas distintas (incluida al menos una pausa), el 100% queda registrado en la bitácora con el administrador, la acción, el objetivo y el motivo correctos.
- **SC-008**: Al revisar el catálogo con los cuatro roles existentes tras esta épica, ningún rol nuevo (en particular `ADMINISTRADOR`) encuentra una acción para crear, editar o dar de baja un producto o categoría.

## Assumptions

- **Detección discrecional, sin señal automática**: el sistema no calcula ni marca visualmente ningún "tiempo de espera" para considerar un pedido atascado; la decisión de intervenir es enteramente del administrador, mirando el detalle de pedido que ya construyó E4. Un indicador automático de antigüedad, si hiciera falta más adelante, sería una historia aparte con su propio criterio.
- **Un solo nivel de permiso**: cualquier usuario con rol `ADMINISTRADOR` puede ejercer las cuatro acciones de esta épica; no se introduce ninguna graduación dentro del rol.
- **El servicio es una única entidad global**: coherente con que v1 es mono-local, pausar/reanudar es un interruptor único, no algo por negocio o por usuario `NEGOCIO`.
- **Catálogo fuera de alcance, sin excepción**: RN-001 de E3 ("solo el negocio administra el catálogo") se mantiene sin ninguna excepción administrativa en v1, pese a que RN-001 de esa misma spec dejaba la puerta abierta a revisar esto en HU-07.
- **Bitácora extendida, no una consulta nueva**: esta épica agrega valores/objetivos nuevos al mecanismo de auditoría ya existente de E1; no se construye ninguna pantalla de consulta de esa bitácora en v1, mismo criterio ya vigente para las acciones sobre usuarios.
- **Sin escalamiento ni notificación por otro canal**: ninguna intervención administrativa dispara un aviso push, SMS o correo; se ve dentro de la aplicación, mismo criterio de paridad manual (Principio VI) que el resto del producto.
- **Requiere enmienda constitucional** (resuelto en `/speckit.clarify`, a diferencia de lo previsto en el borrador inicial): el Principio XII vigente (v3.0.0) dice "no se permite ninguna otra transición" fuera de las seis ya declaradas, así que el cierre administrativo de la Historia 2 no puede construirse sin enmendarlo. Antes de `/speckit.plan` corresponde ejecutar `/speckit.constitution` para agregar una séptima transición declarada — de cualquier estado no terminal a `cerrado`, disparable únicamente por `ADMINISTRADOR`, con motivo obligatorio — siguiendo el mismo procedimiento (Sync Impact Report, incremento MAJOR de versión) que ya se usó para las enmiendas de E2 (v2.0.0) y E5 (v3.0.0). Forzar la transición normal (Historia 1) no necesita esta enmienda: reutiliza transiciones que el principio ya declara.
- **Reutilización del mecanismo transaccional de E2/E5/E7**: forzar una transición se escribe como una sola operación atómica (cambio de estado + entrada de historial + motivo), con el mismo criterio de concurrencia ya resuelto en las épicas anteriores.
- **Sin geolocalización, notificaciones push ni multi-local**: decisiones de alcance de v1 ya declaradas y heredadas por todas las épicas anteriores.
