# HU-07 · Controles de flujos críticos

**Épica**: E8 · Controles y administración
**Estado**: sin especificar (este documento es la base para `/speckit.specify`,
no reemplaza la spec que generará ese comando)

## Historia

> Como **administrador**, quiero **intervenir manualmente sobre un pedido que
> quedó atascado o sobre una operación crítica del servicio**, para destrabar
> el flujo cuando el camino normal entre cliente, negocio y repartidor no
> avanza por sí solo.

## Qué ya existe en el sistema (2026-08-30)

Antes de especificar, esto es lo que E1/E2/E4/E5/E7 ya construyeron y sobre lo
que HU-07 se apoya — no hay que redefinirlo, solo consumirlo y extenderlo:

- **La máquina de estados está completa**, a diferencia de cuando se
  especificaron E5 y E7: las seis transiciones del Principio XII (v3.0.0) ya
  tienen un camino normal construido —
  `creado → en_preparacion → asignado_repartidor → entregado → cerrado`, más
  `rechazado` (terminal, solo desde `creado`)—. **HU-07 no llena ningún hueco
  de la máquina de estados**; a diferencia de E5 y E7, no agrega ninguna
  transición nueva al contrato. Su función es dar un camino *alternativo*,
  administrativo, sobre transiciones que ya existen — o decidir que no hace
  falta ninguno.
- **El panel del administrador es de solo lectura desde E1** (RN-004,
  `specs/001-acceso-y-usuarios/spec.md:530`): "desde el reporte del panel un
  administrador puede ver que un pedido quedó atascado en un estado, pero
  para forzar su avance debe usar HU-07, no HU-10". Esa frase, escrita en E1
  antes de que existiera E2, es la declaración fundacional de esta HU: define
  la frontera (HU-10 mira, HU-07 actúa) pero no dice **qué** puede hacer el
  administrador, solo que puede.
- **`GET /admin/dashboard/orders/:id`** (E4) ya arma el `OrderDetailDto` con
  la línea de tiempo completa de cualquier pedido, sin restricción de
  propietario — es la vista sobre la que un administrador detectaría hoy, a
  ojo, que un pedido lleva demasiado tiempo en `creado` o en
  `asignado_repartidor`. No existe ningún indicador automático de "atascado":
  ver el problema hoy depende de que alguien abra el pedido y lo note.
- **Ya existe un mecanismo de bitácora administrativa**
  (`services/api/src/audit/audit.service.ts`, `AdminAuditLog`), pero está
  **acotado a acciones sobre usuarios**: el enum `AdminAction` tiene
  exactamente seis valores (`CREAR`, `EDITAR`, `CAMBIAR_ROL`, `DESACTIVAR`,
  `REACTIVAR`, `RESTABLECER_PASSWORD`) y ninguno cubre una acción sobre un
  pedido u otra operación crítica. Extenderlo o crear una bitácora paralela
  para las acciones de HU-07 es una decisión de diseño de esta épica, no un
  hecho ya resuelto.
- **El "vacío que llena HU-07" ya está señalado, no inventado ahora**: el
  Supuesto 6 de E2 (`specs/003-gestion-pedidos/spec.md:288`) dice
  explícitamente que "en v1 el pedido queda pendiente indefinidamente, sin
  aviso de antigüedad ni escalamiento" si el negocio nunca responde un pedido
  en `creado`, y que "una intervención sobre pedidos estancados, si hace
  falta, es HU-07 (E8)". Es el caso de uso más concreto que el resto de las
  specs le atribuyen a esta épica.
- **El helper transaccional de transición de estado** (generalizado por E5 y
  reutilizado por E7 para `entregar`/`cerrar`) es el patrón a seguir si HU-07
  decide forzar una transición ya existente: cambio de estado + entrada de
  `OrderStatusEvent` en una sola operación atómica, nunca una sin la otra.
- **`RN-001` de E3** (`specs/002-administracion-menu-productos/spec.md:542`)
  deja dicho que "un administrador que ve en el menú un producto mal descrito
  no puede corregirlo; debe pedírselo al negocio. La acción administrativa
  sobre flujos críticos es HU-07, en E8" — una frase que **sugiere**, sin
  decidir, que HU-07 podría incluir una intervención sobre el catálogo además
  de sobre pedidos. Es una de las preguntas abiertas de más abajo, no un
  requisito ya aceptado.

## Qué falta (alcance de HU-07 / E8)

1. **Decidir qué significa "estado atascado".** `EPICS.md` habla de
   "supervisión" y las specs anteriores solo dan un ejemplo (un pedido en
   `creado` sin respuesta del negocio). Falta decidir si existe algún criterio
   objetivo (por ejemplo, tiempo transcurrido) que el sistema señale, o si la
   detección sigue siendo enteramente manual — el administrador abre el
   detalle de un pedido (E4) y decide por su cuenta que algo no avanza.
2. **Decidir el catálogo de acciones administrativas concretas.** Candidatas,
   ninguna descartada ni confirmada todavía:
   - Forzar el avance de un pedido a la siguiente transición normal (por
     ejemplo, empujar un `creado` sin respuesta a `en_preparacion` en nombre
     del negocio, o a `rechazado` con un motivo administrativo).
   - Cancelar/cerrar administrativamente un pedido atascado en cualquier
     estado, fuera del camino normal de la máquina de estados.
   - Bloquear o desbloquear una operación — término de `EPICS.md` que no está
     definido: ¿pausar que el negocio siga recibiendo pedidos nuevos?
     ¿suspender temporalmente a un repartidor? ¿otra cosa?
3. **Decidir si estas acciones exigen motivo obligatorio**, con el mismo
   criterio que el rechazo de E2 (RN-007) — parece consistente con el
   Principio I (nunca una acción irreversible sin dejar rastro de por qué),
   pero no está declarado todavía para HU-07.
4. **Diseñar el registro de estas intervenciones.** El `AdminAuditLog`
   existente está acotado a acciones sobre usuarios (`targetUserId`); no
   registra pedidos. Decidir si se extiende ese mismo mecanismo con un nuevo
   tipo de objetivo, o si se crea una bitácora paralela específica de
   operaciones — y si esta sí necesita ser consultable (a diferencia de la de
   E1, que en v1 no tiene pantalla).
5. **Decidir si la intervención administrativa se avisa a los roles
   afectados** (cliente, negocio, repartidor) dentro de la aplicación —
   coherente con el criterio de paridad manual (Principio VI) que ya usan
   HU-01/HU-04/HU-05 para mostrar estado y motivo, no para notificar por otro
   canal.
6. **Decidir el alcance exacto de "supervisión"** de `EPICS.md`: si además de
   actuar sobre pedidos, HU-07 cubre alguna corrección puntual sobre el
   catálogo (ver la frase de RN-001 de E3 arriba) o sobre cualquier otra
   entidad operativa, o si queda exclusivamente acotada a pedidos.
7. **Construir la pantalla o extensión de pantalla del administrador** donde
   viven estas acciones — hoy `/admin` solo tiene Panel (HU-10, solo lectura)
   y Usuarios (E1); no existe ningún destino de "Operaciones" o similar en la
   navegación (`NavegacionAdmin`, E9).

## Explícitamente fuera de alcance (v1, salvo que `/speckit.clarify` decida lo
contrario)

- **Escalamiento o alerta automática** por antigüedad de un pedido sin
  respuesta: ninguna HU lo pide todavía; convertirlo en requisito sería
  alcance fantasma (Principio III) a menos que se decida explícitamente al
  especificar.
- **Multi-local, zonas o turnos**: v1 es mono-local (decisión de alcance ya
  tomada).
- **Notificaciones push, SMS o email** ante una intervención administrativa:
  ninguna épica anterior las construyó; mismo criterio de paridad manual.
- **Reabrir un pedido `cerrado` o `rechazado`** a un estado anterior: ambos
  son terminales por diseño (RN-002 de HU-01, y el propio Principio XII); si
  hiciera falta revertir eso sería una enmienda constitucional nueva, no algo
  que HU-07 decida por su cuenta.
- **Edición de datos personales de usuarios** vía esta HU: eso ya lo cubre
  HU-09 (gestión de usuarios y roles, E1), con su propio `AdminAuditLog`.

## Preguntas abiertas para `/speckit.clarify`

- ¿Qué acciones concretas puede ejecutar el administrador sobre un pedido
  atascado: forzar la transición normal siguiente, forzar un cierre/rechazo
  administrativo fuera del camino normal, ambas, u otra?
- ¿Qué significa exactamente "bloqueo/desbloqueo de operaciones" en
  `EPICS.md`? ¿Pausar que el negocio reciba pedidos nuevos, suspender a un
  repartidor, otra cosa?
- ¿Existe algún criterio objetivo (tiempo transcurrido en un estado) que el
  sistema deba señalar, o la detección de "atascado" es 100 % discrecional
  del administrador mirando el panel?
- ¿Las acciones administrativas de esta HU exigen un motivo obligatorio en
  texto libre, igual que el rechazo de E2?
- ¿Se extiende el `AdminAuditLog` existente (nuevo tipo de objetivo, hoy
  acotado a usuarios) o se construye una bitácora paralela para estas
  acciones? ¿Esta bitácora necesita pantalla de consulta, a diferencia de la
  de E1?
- ¿La intervención administrativa se muestra dentro de la aplicación a los
  roles afectados (cliente, negocio, repartidor), o queda invisible para
  ellos?
- ¿HU-07 incluye alguna corrección puntual sobre el catálogo (la frase de
  RN-001 de E3 lo sugiere) o queda exclusivamente acotada a pedidos y
  operaciones del servicio?
- ¿Cualquier administrador tiene estos permisos, o hace falta un nivel de
  permiso adicional dentro del mismo rol (por ejemplo, un administrador
  "senior")? — `EPICS.md` menciona "permisos" como parte de la épica, sin
  precisar si es sobre el rol `ADMINISTRADOR` mismo o sobre otra cosa.
