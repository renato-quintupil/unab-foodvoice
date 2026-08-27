# HU-05 · Cierre digital del servicio

**Épica**: E7 · Cierre del servicio
**Estado**: sin especificar (este documento es la base para `/speckit.specify`,
no reemplaza la spec que generará ese comando)

## Historia

> Como **repartidor**, quiero **marcar un pedido como entregado cuando
> termino de dejarlo**, para que el cliente y el negocio sepan que ya está
> hecho, sin tener que avisar por fuera del sistema.
>
> Como **cliente**, quiero **confirmar que recibí mi pedido conforme, o
> avisar si algo salió mal**, para cerrar el ciclo y dejar constancia si
> hubo un problema.

## Qué ya existe en el sistema (2026-08-27)

Antes de especificar, esto es lo que E1/E2/E4/E5 ya construyeron y sobre lo
que HU-05 se apoya — no hay que redefinirlo, solo consumirlo y extenderlo:

- **La máquina de estados ya tiene las dos transiciones exactas que esta
  épica necesita**, sin que haga falta ninguna enmienda constitucional (a
  diferencia de E5): el Principio XII (v3.0.0) ya declara
  `asignado_repartidor → entregado` y `entregado → cerrado` como parte del
  conjunto cerrado de transiciones permitidas, desde la redacción original
  de la constitución. **`entregado` y `cerrado` son, hoy, los dos únicos
  estados que ningún endpoint puede alcanzar** — es exactamente el vacío que
  HU-05 llena, simétrico al vacío que llenó HU-04 con
  `asignado_repartidor`.
- **`packages/shared/src/order-state/machine.ts`** ya declara
  `SIGUIENTE[ASIGNADO_REPARTIDOR] = [EN_PREPARACION, ENTREGADO]` y
  `SIGUIENTE[ENTREGADO] = [CERRADO]`. `transicionesValidas`/
  `esTransicionValida` ya aceptan ambas transiciones — no hay que tocar este
  archivo.
- **El repartidor ya tiene una pantalla real** (`/repartidor`, E5): ve su
  pedido en curso (`asignado_repartidor`) con dirección, teléfono del
  cliente y productos, con un botón "Soltar pedido". HU-05 le agrega, sobre
  ese mismo pedido, la acción de marcarlo entregado — no una pantalla nueva.
- **El cliente ya tiene una pantalla real** (`/cliente/pedidos`, E1/E2): ve
  sus pedidos con estado y, si corresponde, el motivo de rechazo
  (`pedido.rejectionReason`). HU-05 le agrega, sobre un pedido en
  `entregado`, la acción de confirmar o reclamar — mismo patrón visual que
  ya usa el motivo de rechazo.
- **El patrón de motivo de texto libre nulable ya existe dos veces**:
  `Order.rejectionReason` (E2, `NULL` salvo en `rechazado`) es exactamente el
  molde para el reclamo de esta épica — un campo nulable en la misma fila,
  no una tabla aparte, presente solo cuando el cliente reclamó.
- **El helper transaccional de transición de estado** (`OrdersService`,
  generalizado por E5 sin necesitar cambios de firma) ya acepta cualquier
  `Role` como actor — `Role.REPARTIDOR` para la transición del repartidor,
  `Role.CLIENTE` para la del cliente.
- **`GET /orders/:id`, `GET /business/orders/:id` y
  `GET /admin/dashboard/orders/:id`** (E4) ya arman `OrderDetailDto` con la
  línea de tiempo completa — las dos transiciones nuevas de HU-05
  aparecerán ahí sin ningún cambio de contrato, exactamente como ya pasó
  con la transición de E5 (verificado en `specs/007-reparto-repartidor/
  verificacion.md`, V-08 y V-12).
- **Las etiquetas visibles ya existen**: `ETIQUETA_ESTADO_PEDIDO[ENTREGADO]
  = 'Entregado'` y `ETIQUETA_ESTADO_PEDIDO[CERRADO] = 'Cerrado'`
  (`packages/shared/src/messages/etiquetas.ts`) — sin cambios.

## Decisiones ya resueltas con el usuario (antes de escribir la spec)

El mapa de épicas (`docs/epicas-hu/EPICS.md`) describe E7 solo como
"Confirmación digital de entrega y conformidad/reclamo entrega de feedback"
— insuficiente para especificar sin ambigüedad, y con pistas contradictorias
entre la constitución (que atribuye el cierre al repartidor) y el guion de
la presentación del proyecto (que atribuye la confirmación al cliente). Se
resolvió lo siguiente antes de redactar la spec:

1. **`asignado_repartidor → entregado` la dispara el repartidor**, marcando
   "Entregado" sobre el pedido que tiene en curso — simétrico con
   "Tomar"/"Soltar" de HU-04. El cliente no interviene en esta transición.
2. **`entregado → cerrado` la dispara el cliente**, con dos caminos posibles
   sobre el mismo pedido: confirmar que todo estuvo bien, o reclamar con un
   motivo de texto libre. **Ambos caminos cierran el pedido** — el reclamo
   es feedback que queda registrado, no un bloqueo del cierre ni un estado
   nuevo.
3. **El reclamo es texto libre, visible al negocio, sin clasificación ni
   flujo de resolución** — mismo alcance que el motivo de rechazo de E2
   (RN-007 de su spec: "un local pequeño no tiene por qué encajar su
   realidad en categorías adivinadas de antemano"). No hay bandeja de
   reclamos, no hay respuesta dentro del sistema, y no se vincula a la
   "clasificación de productos o servicio mediante feedback" que menciona
   el contexto de producto de la constitución — eso queda fuera de v1 por
   no tener ninguna HU que lo pida todavía.

## Qué falta (alcance de HU-05 / E7)

1. **Agregar `complaintReason` a `Order`** (con su migración): nulable,
   presente únicamente cuando el cliente reclamó al cerrar — mismo patrón
   que `rejectionReason`.
2. **Construir la transición `asignado_repartidor → entregado`**, disparada
   por el repartidor sobre el pedido que tiene en curso, reutilizando el
   mecanismo transaccional ya generalizado por E5.
3. **Construir la transición `entregado → cerrado`**, en sus dos variantes
   (confirmar / reclamar), disparada por el cliente sobre un pedido propio
   en `entregado`.
4. **Extender la pantalla del repartidor** (`/repartidor`,
   `pedido-en-curso.tsx`) con la acción "Marcar como entregado" — tras
   marcarlo, el repartidor deja de tener ningún pedido en curso, igual que
   tras soltarlo.
5. **Extender la pantalla de "Mis pedidos" del cliente**
   (`/cliente/pedidos`) para que un pedido en `entregado` ofrezca "Todo
   bien" y "Reclamar" (con un campo de motivo, mismo patrón de diálogo que
   el rechazo del negocio en E2).
6. **Mostrar el motivo del reclamo** donde ya se muestra el de rechazo — la
   propia lista del cliente, y el detalle de negocio/admin vía E4, una vez
   que `complaintReason` viaje en `OrderSummaryDto`.
7. **Decidir si el negocio necesita alguna vista adicional del reclamo**
   más allá de verlo en el detalle del pedido que ya puede consultar desde
   E4 — pregunta abierta para `/speckit.clarify`, no asumir que hace falta
   una bandeja nueva.

## Explícitamente fuera de alcance (v1)

- **Cualquier estado nuevo para "reclamo pendiente de resolución"**: un
  reclamo no bloquea el cierre ni crea una rama nueva de la máquina de
  estados — decisión ya tomada arriba, no una pregunta abierta.
- **Clasificación de productos o del servicio a partir del feedback**: la
  constitución la menciona como parte de la visión del producto, pero
  ninguna HU del mapa la pide todavía; construirla aquí sería alcance
  fantasma (Principio III).
- **Notificaciones push o por correo** cuando el pedido se marca entregado
  o se cierra — ninguna HU del mapa la pide.
- **Calificación numérica o reseña del repartidor/negocio** — no está en el
  mapa de HU; el reclamo es texto libre sin escala de puntaje.
- **Reabrir un pedido cerrado** — `cerrado` sigue siendo terminal, sin
  excepción (Principio XII).
- **Geolocalización o confirmación por proximidad** (por ejemplo, que el
  repartidor solo pueda marcar entregado si su posición coincide con la
  dirección) — descartado por decisión de alcance de v1 ("Sin
  geolocalización").

## Preguntas abiertas para `/speckit.clarify`

- ¿El negocio necesita alguna vista propia de "reclamos recibidos", o le
  basta con verlos dentro del detalle de cada pedido (ya construido por
  E4)?
- ¿Hay algún límite de longitud para el motivo del reclamo, o se reutiliza
  el mismo rango que el motivo de rechazo de E2 (10–500 caracteres)?
- ¿El cliente puede tardar indefinidamente en confirmar o reclamar un
  pedido `entregado`, sin ningún cierre automático por tiempo? (mismo
  criterio que ya aceptó E2 para pedidos `creado` sin respuesta del
  negocio, Supuesto 6 de su spec, o algo distinto amerita declararse aquí).
