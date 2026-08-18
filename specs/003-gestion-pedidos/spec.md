# Especificación de Funcionalidad: E2 · Gestión de pedidos

**Rama de funcionalidad**: `003-gestion-pedidos` (el directorio de la spec es `specs/003-gestion-pedidos`)

**Creada**: 2026-08-17

**Estado**: Borrador

**Épica**: E2 · Gestión de pedidos — HU-12 (Carrito editable manual), HU-11 (Registro de direcciones de entrega etiquetadas), HU-01 (Gestión de pedidos con estado visible)

**Entrada**: Descripción del usuario: borrador consolidado de la épica E2 de FoodVoice, con escenarios Gherkin, reglas de negocio, criterios de éxito, casos límite y alcance excluido para HU-12, HU-11 y HU-01, incluida la decisión de ampliar la máquina de estados del pedido con un sexto estado `rechazado`.

## Contexto y motivación

Hasta E3 el producto solo tenía catálogo: nada se podía pedir todavía. E2 es la épica que crea la entidad **Pedido** y con ella el primer flujo de punta a punta del producto — el cliente arma un carrito, le pone una dirección, confirma, y el negocio decide si lo acepta o lo rechaza. Las tres historias se leen y se especifican en ese orden porque es el orden real en que el cliente las recorre: **HU-12** (carrito) → **HU-11** (dirección) → **HU-01** (confirmar y ver el estado).

**E2 no incluye voz.** El carrito y su API de mutación (agregar, quitar, cambiar cantidad) se construyen aquí de forma manual, como una operación server-side clara — no como estado que solo vive en el navegador — precisamente porque **E6/HU-13** se apoyará en esa misma API para agregar productos por voz más adelante, sin rediseñarla. Mezclar voz en esta épica haría crecer su alcance sin control (Principio III).

**E2 tampoco incluye pago.** Es una decisión de alcance de v1 (`docs/epicas-hu/EPICS.md`): no hay pasarela de cobro en el producto. El pedido se confirma y el negocio decide si lo prepara; el cobro ocurre fuera del sistema.

**El contrato de estados se amplía en esta épica, y es una decisión tomada, no una ambigüedad.** La máquina de estados del pedido se construyó en E1 dentro de `packages/shared/src/order-state/machine.ts`, junto con el enum `OrderStatus`, como una secuencia estrictamente lineal de cinco estados y **sin** estado de rechazo — así lo dice el propio comentario del código. Esa decisión se tomó antes de que existiera un pedido real que rechazar: en la práctica el negocio puede recibir un pedido que no puede cumplir (falta un ingrediente, el local está desbordado) y necesita poder decirlo, con una razón, en vez de dejarlo pendiente para siempre. E2 corrige esa omisión agregando `rechazado` como sexto estado, terminal, alcanzable únicamente desde `creado`:

```text
creado ─┬─→ en_preparacion → asignado_repartidor → entregado → cerrado
        └─→ rechazado   (terminal, sin transiciones salientes)
```

Esto modifica un contrato ya construido en E1. El **Principio XII** de la constitución ya fue enmendado a la versión 2.0.0 para declarar esta rama, su motivo obligatorio y el historial inmutable de cada cambio de estado. E2 debe cumplir esa versión vigente tanto al crear el pedido como al ejecutar las dos transiciones que le corresponden.

**Qué entra en E2 y qué no**: E2 crea el `Pedido` (nace en `creado`) y permite al negocio disparar exactamente dos transiciones desde `creado`: aceptar (`→ en_preparacion`) o rechazar (`→ rechazado`, con motivo obligatorio). E2 registra en un historial de solo-agregar la creación y cada una de esas transiciones, con sus estados, actor y fecha, en la misma operación indivisible que produce el cambio. Las transiciones siguientes —`en_preparacion → asignado_repartidor` (E5), `asignado_repartidor → entregado` y `entregado → cerrado` (E7)— no se construyen aquí. "Estado visible" en HU-01 significa que el cliente puede ver el estado actual del pedido sea cual sea, no que E2 construya las pantallas de esas épicas futuras. Consultar o mostrar el historial sigue siendo HU-03 (E4); E2 solo expone el estado **actual** y, cuando corresponde, el motivo de rechazo.

## Clarifications

### Session 2026-08-17

- Q: ¿Qué debe ocurrir cuando el cliente intenta desactivar o eliminar su única dirección activa y predeterminada? → A: Se permite dejar cero direcciones activas; si fue usada se desactiva y si nunca fue usada puede eliminarse. La próxima dirección guardada será automáticamente la predeterminada.
- Q: ¿Debe el cliente poder reactivar una dirección guardada que había desactivado? → A: Sí; al reactivarla será predeterminada solo si no existe otra dirección activa.
- Q: ¿Cómo debe ordenarse y dividirse la bandeja del negocio cuando haya muchos pedidos pendientes? → A: En páginas de 20 pedidos, del más antiguo al más reciente, con orden estable.
- Q: ¿El clic manual en “Agregar” sobre un producto conocido cuenta como la confirmación previa exigida por el Principio IX? → A: Sí; el clic confirma la acción y no se exige un segundo paso.
- Q: ¿Qué debe ocurrir si el precio de un producto cambia después de que el cliente revisó el carrito pero antes de confirmar el pedido? → A: Se bloquea ese intento, se actualiza el carrito y el cliente debe revisar y confirmar nuevamente.
- Q: ¿Qué parte del historial de estados pertenece a E2 y cuál permanece en E4? → A: E2 registra de forma inmutable y atómica la creación y las transiciones `creado → en_preparacion` y `creado → rechazado`; E4 incorpora la consulta del historial y las transiciones de épicas posteriores.

## Roles de usuario en esta épica

- **Cliente**: arma su carrito, registra y elige direcciones de entrega, y confirma pedidos. Único rol con carrito y con capacidad de confirmar.
- **Negocio**: ve los pedidos entrantes (`creado`) y en preparación, y decide aceptarlos o rechazarlos. No confirma pedidos ni tiene carrito.
- **Repartidor**: no tiene acciones en esta épica; entra en E5 cuando exista la transición a `asignado_repartidor`.
- **Administrador**: no tiene acciones en esta épica; sigue siendo de solo lectura desde E1 (HU-10) y no vuelve a tocar pedidos hasta HU-07 (E8).

Los cuatro roles y el mecanismo que los reconoce provienen de E1 (`specs/001-acceso-y-usuarios/spec.md`). Esta épica los consume, no los redefine.

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Carrito editable manual (HU-12) (Prioridad: P1)

Como cliente, quiero armar mi pedido agregando productos, cambiando cantidades y quitando lo que no quiero, para revisar y corregir todo antes de que el negocio lo reciba.

El carrito es la etapa **previa** al pedido: vive mientras el cliente decide y se vacía cuando confirma (pasa a ser un `Pedido`, Historia 3). No es un historial ni un borrador editable después de confirmado — una vez confirmado, ya no es carrito, es pedido, y un pedido confirmado no se edita (FR-035).

En el flujo manual, seleccionar un producto visible y pulsar «Agregar» es la confirmación explícita de esa acción exigida por el Principio IX. Como no existe una interpretación de voz que validar en E2, el sistema no pide una segunda confirmación antes de agregarlo.

**Por qué esta prioridad**: sin carrito no hay nada que confirmar; es la base sobre la que se apoyan las otras dos historias y, más adelante, la búsqueda por voz de E6/HU-13.

**Prueba independiente**: se puede probar por completo agregando, quitando y cambiando cantidades de productos del catálogo de E3, sin necesitar ninguna dirección ni llegar a confirmar nada — entrega valor por sí sola como el lugar donde el cliente decide qué quiere.

**Escenarios de Aceptación**:

1. **Dado** que inicié sesión con rol "cliente", **Cuando** agrego un producto activo y disponible al carrito, **Entonces** aparece con cantidad 1 y el precio vigente.
2. **Dado** un producto marcado como agotado, **Cuando** intento agregarlo al carrito, **Entonces** el sistema lo impide y muestra un mensaje en español explicando que no está disponible.
3. **Dado** un producto dado de baja, **Cuando** intento agregarlo al carrito, **Entonces** el sistema lo impide.
4. **Dado** un producto ya en mi carrito con cantidad 1, **Cuando** cambio la cantidad a 3, **Entonces** el carrito muestra 3 unidades y el subtotal de esa línea actualizado.
5. **Dado** un producto en mi carrito con cantidad 1, **Cuando** bajo la cantidad a 0, **Entonces** el producto desaparece del carrito.
6. **Dado** un producto en mi carrito, **Cuando** lo quito con la acción de eliminar, **Entonces** ya no aparece en mi carrito.
7. **Dado** que agregué productos a mi carrito, **Cuando** cierro sesión y vuelvo a iniciar sesión, **Entonces** mi carrito conserva los mismos productos y cantidades.
8. **Dado** que no he agregado ningún producto, **Cuando** reviso mi carrito, **Entonces** veo un mensaje en español indicando que está vacío y no puedo confirmarlo como pedido.
9. **Dado** un producto en mi carrito disponible al agregarlo, **Cuando** el negocio lo marca como agotado antes de que yo confirme, **Entonces** mi carrito lo muestra marcado como no disponible y no puedo confirmar el pedido hasta quitarlo o esperar a que vuelva.
10. **Dado** un producto en mi carrito a $5.000, **Cuando** el negocio cambia su precio a $6.000, **Entonces** mi carrito muestra $6.000 en la siguiente carga, antes de confirmar.
11. **Dado** varios productos en mi carrito, **Cuando** uso la acción de vaciar carrito, **Entonces** queda vacío.

---

### Historia de Usuario 2 - Registro de direcciones de entrega etiquetadas (HU-11) (Prioridad: P2)

Como cliente, quiero registrar más de una dirección y ponerle una etiqueta que yo elijo (Casa, Departamento de mi papá, Trabajo), para no tener que volver a escribirla cada vez y elegir rápido la que corresponde a cada pedido.

Las direcciones son **solo texto libre** (Principio X): no hay mapa, selector de pin, geocodificación ni validación contra un servicio externo. La etiqueta la escribe el cliente, no se elige de una lista fija — mismo criterio que la descripción de producto de E3. El cliente puede tener varias direcciones, marcar una como predeterminada, y elegir cuál usar en cada pedido.

**Por qué esta prioridad**: confirmar un pedido exige una dirección (Historia 3, FR-022); registrarla antes agiliza el flujo, pero la funcionalidad de direcciones por sí sola (crear, editar, elegir predeterminada) ya entrega valor sin que exista todavía ningún pedido.

**Prueba independiente**: se puede probar por completo registrando, editando, desactivando y marcando como predeterminada una o varias direcciones, sin necesitar ningún carrito ni pedido.

**Escenarios de Aceptación**:

1. **Dado** que inicié sesión con rol "cliente" y no tengo direcciones guardadas, **Cuando** registro una dirección con etiqueta "Casa" y un texto válido, **Entonces** queda guardada y marcada como predeterminada automáticamente.
2. **Dado** que ya tengo guardada la dirección "Casa", **Cuando** registro otra con etiqueta "Departamento de mi papá", **Entonces** ambas aparecen en mi lista de direcciones.
3. **Dado** que ya tengo una dirección con etiqueta "Casa", **Cuando** intento guardar otra con etiqueta "casa", **Entonces** el sistema lo rechaza con un mensaje en español asociado al campo.
4. **Cuando** intento guardar una dirección sin etiqueta o con el texto vacío, **Entonces** el sistema lo rechaza con un mensaje en español asociado al campo.
5. **Dado** dos direcciones guardadas, "Casa" como predeterminada, **Cuando** marco "Trabajo" como predeterminada, **Entonces** "Trabajo" queda predeterminada y "Casa" deja de estarlo.
6. **Dado** una dirección "Casa" ya guardada, **Cuando** edito su texto, **Entonces** mi lista muestra el texto nuevo bajo la misma etiqueta.
7. **Dado** que tengo guardadas "Casa" y "Trabajo", **Cuando** confirmo un pedido y elijo "Trabajo", **Entonces** el pedido queda con el texto de "Trabajo".
8. **Dado** que no tengo direcciones guardadas ni indico una puntual, **Cuando** intento confirmar mi pedido, **Entonces** el sistema lo impide y muestra un mensaje en español pidiendo una dirección de entrega.
9. **Dado** un pedido ya confirmado con la dirección "Casa" = "Los Aromos 123", **Cuando** edito el texto de "Casa" a "Los Aromos 456", **Entonces** el pedido confirmado sigue mostrando "Los Aromos 123" y mis pedidos nuevos con "Casa" usan "Los Aromos 456".
10. **Dado** que tengo guardada la dirección "Casa", **Cuando** confirmo un pedido indicando la dirección puntual "Oficina, Piso 4", **Entonces** ese pedido queda con "Oficina, Piso 4" y mi lista de direcciones guardadas no cambia.
11. **Dado** una dirección "Trabajo" usada en un pedido anterior, **Cuando** la desactivo, **Entonces** deja de ofrecerse para pedidos nuevos y el pedido anterior sigue mostrando su texto sin cambios.
12. **Dado** una sola dirección activa, marcada como predeterminada, **Cuando** la desactivo, **Entonces** queda desactivada, ya no tengo una dirección predeterminada y puedo registrar otra o usar una dirección puntual al confirmar.
13. **Dado** una dirección desactivada y ninguna dirección activa, **Cuando** la reactivo, **Entonces** vuelve a ofrecerse para pedidos nuevos y queda marcada como predeterminada.
14. **Dado** una dirección desactivada y otra dirección activa que ya es predeterminada, **Cuando** reactivo la primera, **Entonces** ambas quedan activas y la predeterminada no cambia.
15. **Dado** que estoy registrando una dirección, **Cuando** reviso el formulario, **Entonces** solo encuentro campos de texto para la etiqueta y la dirección, sin ningún selector de mapa, pin o coordenadas.

---

### Historia de Usuario 3 - Gestión de pedidos con estado visible (HU-01) (Prioridad: P3)

Como cliente, quiero ver en qué estado está mi pedido en todo momento, y como negocio, quiero ver los pedidos que llegan y decidir si los acepto o no, para saber qué se está preparando y no comprometerme a algo que no puedo cumplir.

Confirmar un pedido exige un carrito con al menos una línea (Historia 1) y una dirección de entrega elegida (Historia 2). El rechazo **siempre** lleva un motivo en texto libre, porque detrás hay un imprevisto real de cocina y el cliente necesita saber por qué.

**Por qué esta prioridad**: es la historia que entrega el valor final de la épica — el pedido real — pero depende de que existan carrito y dirección; por eso se construye y se prueba en tercer lugar, aunque sea el corazón de E2.

**Prueba independiente**: con un carrito armado (Historia 1) y una dirección elegida (Historia 2) ya disponibles, se puede probar por completo confirmando un pedido y ejerciendo su ciclo de aceptación o rechazo por el negocio, sin depender de ninguna otra épica.

**Escenarios de Aceptación**:

1. **Dado** que inicié sesión con rol "cliente" y tengo productos en mi carrito y una dirección de entrega, **Cuando** confirmo el pedido, **Entonces** se crea un pedido en estado "creado" y mi carrito queda vacío.
2. **Dado** que mi carrito está vacío, **Cuando** intento confirmar un pedido, **Entonces** el sistema lo impide con un mensaje en español.
3. **Dado** que tengo productos en el carrito pero ninguna dirección, **Cuando** intento confirmar el pedido, **Entonces** el sistema lo impide y pide una dirección de entrega.
4. **Dado** un pedido recién confirmado, **Cuando** el negocio revisa sus pedidos pendientes, **Entonces** lo ve con sus productos, cantidades, precios y dirección de entrega.
5. **Dado** un pedido en estado "creado", **Cuando** el negocio lo acepta, **Entonces** el pedido pasa a "en_preparacion" y el cliente ve la etiqueta "En preparación" en la siguiente carga.
6. **Dado** un pedido en estado "creado", **Cuando** el negocio lo rechaza escribiendo el motivo "Se acabó el ingrediente principal", **Entonces** el pedido pasa a "rechazado", desaparece de la cola de pendientes del negocio, y el cliente lo ve etiquetado "Rechazado" junto con ese motivo.
7. **Dado** un pedido en estado "creado", **Cuando** el negocio intenta rechazarlo sin escribir ningún motivo, **Entonces** el sistema lo impide con un mensaje en español.
8. **Dado** un pedido en estado "rechazado", **Cuando** el negocio intenta aceptarlo, **Entonces** el sistema lo impide.
9. **Dado** un pedido en estado "en_preparacion", **Cuando** el negocio intenta rechazarlo, **Entonces** el sistema lo impide.
10. **Dado** que inicié sesión con rol "cliente", **Cuando** intento aceptar o rechazar un pedido, **Entonces** el sistema me lo impide con un mensaje en español.
11. **Dado** que inicié sesión con rol "negocio", **Cuando** intento confirmar un pedido a partir de un carrito, **Entonces** el sistema me lo impide.
12. **Dado** un pedido confirmado con un producto a $5.000, **Cuando** el negocio cambia después el precio de ese producto a $6.000, **Entonces** el pedido confirmado sigue mostrando $5.000.
13. **Dado** un pedido ya confirmado en cualquier estado, **Cuando** el cliente intenta cambiar sus productos o cantidades, **Entonces** el sistema no ofrece ninguna forma de editarlo.
14. **Dado** que el negocio no tiene pedidos pendientes, **Cuando** revisa su bandeja de pedidos, **Entonces** ve un mensaje en español explicando que no hay pedidos por ahora.
15. **Dado** que el negocio tiene 21 pedidos pendientes, **Cuando** recorre las dos páginas de su bandeja, **Entonces** ve 20 pedidos en la primera y 1 en la segunda, del más antiguo al más reciente, sin pedidos repetidos ni omitidos.
16. **Dado** que revisé mi carrito y el negocio cambió después el precio de un producto, **Cuando** intento confirmar con el precio anterior, **Entonces** no se crea ningún pedido ni se vacía el carrito, veo el precio actualizado y debo revisarlo antes de confirmar nuevamente.
17. **Dado** un carrito y una dirección válidos, **Cuando** el cliente confirma el pedido, **Entonces** el pedido nace en `creado` y queda una única entrada inmutable que registra su creación, el cliente que la realizó y la fecha.
18. **Dado** un pedido en `creado`, **Cuando** el negocio lo acepta o lo rechaza correctamente, **Entonces** el nuevo estado y una única entrada de historial con el estado anterior, el nuevo, el negocio que actuó y la fecha quedan registrados juntos.
19. **Dado** un intento de creación o transición que falla, incluida una acción que pierde una carrera concurrente, **Cuando** termina el intento, **Entonces** no queda ningún pedido, cambio de estado ni entrada de historial parcial correspondiente a ese intento.

---

### Casos Límite

- Confirmar el pedido justo cuando un producto del carrito se agota o se da de baja en el mismo instante (condición de carrera): el sistema vuelve a validar disponibilidad al confirmar, no solo al agregar (FR-028).
- Confirmar el pedido justo cuando cambia el precio de un producto: ese intento no crea el pedido ni vacía el carrito; muestra el precio actualizado y exige una nueva confirmación (FR-028–FR-029).
- Dos confirmaciones del mismo carrito desde dos pestañas a la vez: solo una produce un pedido (FR-036).
- El negocio intenta aceptar y rechazar el mismo pedido casi al mismo tiempo desde dos pestañas: gana solo una acción; la otra falla con un mensaje claro, sin duplicar el efecto (FR-036).
- La creación o una transición cambia el pedido pero no logra registrar su historial, o registra el historial pero no logra cambiar el pedido: ambos resultados se revierten; nunca queda uno sin el otro (FR-044).
- Un intento rechazado o que pierde una carrera concurrente no agrega una entrada al historial (FR-044).
- Cliente con productos en el carrito pero sin ninguna dirección guardada ni puntual: no llega a un botón de confirmar habilitado (FR-022).
- Carrito con el mismo producto agregado varias veces: suma cantidad en la misma línea, no crea líneas duplicadas (FR-004).
- Dirección con caracteres largos, saltos de línea o solo espacios en blanco: el texto en blanco se rechaza igual que uno vacío (FR-013).
- Negocio con muchos pedidos pendientes simultáneos: la bandeja muestra 20 por página, del más antiguo al más reciente, sin repetir ni omitir pedidos entre páginas (FR-041).
- Pedido con una sola línea vs. pedido con muchas líneas distintas: mismo camino de confirmación.
- El negocio escribe un motivo de rechazo compuesto solo de espacios en blanco: se trata igual que un motivo vacío (FR-033).
- El cliente con una sola dirección activa intenta retirarla: si ya fue usada se desactiva, si nunca fue usada puede eliminarse, y el cliente queda sin dirección predeterminada hasta registrar otra (FR-018–FR-020).
- El cliente elimina (no desactiva) una dirección que nunca usó en ningún pedido: no deja rastro, a diferencia de una que sí se usó (FR-019).
- Dos direcciones con etiquetas que solo difieren en tildes, mayúsculas o espacios ("Casa" vs. "casa "): la unicidad las pliega igual que el nombre de producto en E3 (FR-014).

## Requisitos *(obligatorio)*

### Requisitos Funcionales — HU-12 · Carrito editable manual

- **FR-001**: El sistema DEBE proveer un carrito por cliente, exclusivo del rol `CLIENTE`, persistido en el servidor.
- **FR-002**: El sistema DEBE impedir agregar al carrito cualquier producto que no esté `activo` y `disponible` en el catálogo vigente, mostrando un mensaje en español. En el flujo manual, pulsar «Agregar» sobre el producto visible DEBE bastar como confirmación explícita y el sistema NO DEBE exigir un segundo paso de confirmación.
- **FR-003**: El sistema DEBE aceptar solo cantidades enteras mayores o iguales a 1 por línea del carrito; bajar la cantidad a 0 DEBE quitar la línea.
- **FR-004**: Al agregar un producto ya presente en el carrito, el sistema DEBE sumar la cantidad a la línea existente, no crear una línea duplicada.
- **FR-005**: El sistema DEBE permitir al cliente quitar cualquier línea del carrito o cambiar su cantidad en cualquier momento antes de confirmar.
- **FR-006**: El sistema DEBE mostrar en el carrito el precio vigente de cada producto, recalculado en cada carga, no un precio congelado.
- **FR-007**: El sistema DEBE marcar visualmente cualquier línea del carrito cuyo producto haya pasado a agotado o dado de baja, y DEBE bloquear la confirmación del pedido mientras esa línea exista.
- **FR-008**: El sistema NO DEBE quitar por sí solo una línea del carrito cuyo producto se agotó o se dio de baja; solo el cliente puede quitarla.
- **FR-009**: El sistema DEBE impedir confirmar un carrito vacío como pedido.
- **FR-010**: El sistema DEBE permitir vaciar el carrito completo con una acción explícita.
- **FR-011**: El carrito del cliente DEBE persistir sin pérdida al cerrar sesión, recargar la página o volver a iniciar sesión.

### Requisitos Funcionales — HU-11 · Direcciones de entrega

- **FR-012**: El sistema DEBE permitir al cliente registrar una o más direcciones de entrega, cada una con una etiqueta de texto libre y un texto de dirección, ambos obligatorios.
- **FR-013**: El sistema DEBE rechazar el registro de una dirección con etiqueta o texto vacío (incluido un texto compuesto solo de espacios en blanco), con un mensaje en español asociado al campo.
- **FR-014**: El sistema DEBE impedir dos direcciones con la misma etiqueta para un mismo cliente, comparando en forma normalizada (mismo criterio que `normalizarBusqueda` de `packages/shared`).
- **FR-015**: Mientras el cliente tenga al menos una dirección activa, el sistema DEBE mantener exactamente una como predeterminada; la primera dirección que registre o reactive cuando no tenga ninguna activa DEBE quedar predeterminada automáticamente. Si ya existe una predeterminada, reactivar otra dirección NO DEBE cambiarla. Si no tiene direcciones activas, no tiene dirección predeterminada.
- **FR-016**: El sistema DEBE permitir editar el texto o la etiqueta de una dirección guardada en cualquier momento, sin alterar los pedidos ya confirmados con ella.
- **FR-017**: El sistema DEBE permitir al cliente escribir, al confirmar un pedido, una dirección puntual sin guardarla en su lista de direcciones.
- **FR-018**: El sistema DEBE permitir desactivar una dirección para dejar de ofrecerla en pedidos nuevos, conservándola si ya fue usada en algún pedido, incluso cuando sea la última dirección activa del cliente; también DEBE permitir al cliente reactivar una dirección desactivada.
- **FR-019**: El sistema DEBE permitir eliminar sin dejar rastro una dirección que nunca fue usada en ningún pedido.
- **FR-020**: Si el cliente retira su dirección predeterminada y existen otras direcciones activas, el sistema DEBE exigir que elija primero una nueva predeterminada, con un mensaje en español. Si retira su última dirección activa, el sistema DEBE permitirlo y dejarlo sin dirección predeterminada hasta que registre otra.
- **FR-021**: El sistema NO DEBE pedir, calcular ni inferir ninguna coordenada de geolocalización en el registro de direcciones.
- **FR-022**: El sistema DEBE exigir al menos una dirección de entrega —guardada o puntual— para confirmar un pedido, con un mensaje en español que la pida cuando falte.
- **FR-023**: Al confirmarse un pedido, el sistema DEBE copiar el texto de la dirección elegida en ese instante dentro del pedido (snapshot); cambios posteriores a la dirección guardada NO DEBEN alterar el pedido ya confirmado.
- **FR-024**: El sistema DEBE ofrecer al cliente con más de una dirección guardada una forma de elegir la que corresponde a un pedido en un solo paso, sin tener que reescribirla.

### Requisitos Funcionales — HU-01 · Gestión de pedidos con estado visible

- **FR-025**: El sistema DEBE crear un pedido únicamente a partir del carrito de un cliente con al menos una línea y una dirección de entrega elegida, y únicamente disparado por el rol `CLIENTE`.
- **FR-026**: El pedido DEBE nacer en el estado `creado`.
- **FR-027**: Al confirmarse, cada línea del pedido DEBE copiar el nombre y el precio del producto vigentes en ese instante (snapshot); cambios posteriores al catálogo NO DEBEN alterar un pedido ya confirmado.
- **FR-028**: El sistema DEBE volver a validar, en el instante de la confirmación, que cada producto del carrito sigue activo y disponible y que su precio vigente coincide con el último precio presentado al cliente para confirmar. Si algún precio cambió, ese intento NO DEBE crear un pedido; el sistema DEBE actualizar el carrito, informar el cambio en español y exigir que el cliente lo revise y confirme nuevamente.
- **FR-029**: Solo una confirmación exitosa DEBE vaciar el carrito del cliente que la realizó; cualquier intento rechazado DEBE conservar sus líneas.
- **FR-030**: El sistema DEBE ampliar la máquina de estados del pedido con un sexto estado `rechazado`, alcanzable únicamente desde `creado` y terminal, sin transiciones salientes.
- **FR-031**: El sistema DEBE permitir únicamente al rol `NEGOCIO` decidir, sobre un pedido en estado `creado`, aceptarlo (`creado → en_preparacion`) o rechazarlo (`creado → rechazado`).
- **FR-032**: El sistema DEBE impedir aceptar o rechazar un pedido que no está en estado `creado`.
- **FR-033**: El sistema DEBE exigir un motivo en texto libre no vacío para rechazar un pedido; no DEBE existir ningún camino para rechazar sin escribirlo.
- **FR-034**: El sistema DEBE mostrar al cliente, junto al estado `rechazado` de su pedido, el motivo escrito por el negocio.
- **FR-035**: El sistema NO DEBE ofrecer, en ningún estado, ninguna forma de editar los productos, cantidades, dirección o cualquier otro dato de un pedido ya confirmado.
- **FR-036**: El sistema DEBE garantizar que, si dos acciones concurrentes compiten sobre el mismo pedido o el mismo carrito (aceptar/rechazar simultáneos, o dos confirmaciones del mismo carrito), solo una tenga efecto y la otra falle con un mensaje en español claro, sin duplicar el efecto.
- **FR-037**: El sistema DEBE mostrar al cliente el estado actual de cada uno de sus pedidos con una etiqueta en español clara: "Pendiente" (`creado`), "En preparación" (`en_preparacion`), "Rechazado" junto con el motivo, y las etiquetas de los estados de épicas futuras cuando existan.
- **FR-038**: El sistema DEBE mostrar al negocio sus pedidos pendientes (`creado`) y en preparación (`en_preparacion`), con sus productos, cantidades, precios y dirección de entrega.
- **FR-039**: El sistema DEBE permitir al negocio consultar los pedidos que él mismo rechazó, con su motivo, como registro propio.
- **FR-040**: El sistema DEBE mostrar un mensaje en español cuando el negocio no tiene pedidos pendientes, en lugar de una lista vacía sin explicación.
- **FR-041**: El sistema DEBE paginar la bandeja de pedidos pendientes del negocio en páginas de 20, ordenadas de forma estable del pedido más antiguo al más reciente, sin repetir ni omitir pedidos al cambiar de página.
- **FR-042**: Al crear exitosamente un pedido, el sistema DEBE agregar exactamente una entrada inmutable a su historial que identifique el estado inicial `creado`, el cliente que confirmó y la fecha de creación.
- **FR-043**: Al aceptar o rechazar exitosamente un pedido, el sistema DEBE agregar exactamente una entrada inmutable a su historial que identifique el estado anterior, el nuevo estado, el negocio que actuó y la fecha de la transición.
- **FR-044**: La creación o transición del pedido y su entrada de historial DEBEN producirse como un único resultado indivisible: ambas quedan registradas o ninguna queda registrada. Un intento fallido o que pierde una carrera concurrente NO DEBE agregar entradas al historial. El historial NO DEBE permitir editar ni eliminar entradas existentes.

### Reglas de Negocio

- **RN-001 · Solo el cliente tiene carrito**: ningún otro rol lo tiene ni lo necesita. *Ejemplo*: el negocio no ve "su" carrito porque no existe; ve pedidos, que son de otra entidad.
- **RN-002 · Un producto solo se agrega si está activo y disponible**: el sistema nunca ofrece agregar lo que no se puede preparar (Principio VIII, herencia de HU-02 RN-03 de E3). En el flujo manual, la acción «Agregar» sobre un producto visible constituye la confirmación previa del Principio IX.
- **RN-003 · El precio del carrito es siempre el vigente y debe revisarse antes de confirmar**: no se congela hasta confirmar. *Ejemplo*: si el negocio sube el precio de una pizza mientras está en el carrito de un cliente, ese cliente debe ver y aceptar el precio nuevo antes de que se cree el pedido; el que ya confirmó conserva el precio anterior.
- **RN-004 · Un producto que se agota o se da de baja no se quita solo del carrito**: se marca y bloquea la confirmación, para no sorprender al cliente con un carrito distinto al que dejó (Principio IX).
- **RN-005 · No hay borrado físico de direcciones usadas**: mismo criterio de baja lógica que usuarios (E1) y catálogo (E3); solo una dirección que nunca se usó puede eliminarse sin dejar rastro.
- **RN-006 · La dirección del pedido es un snapshot, no una referencia viva**: igual patrón que el precio (HU-02 RN-09 de E3). Editar o desactivar una dirección guardada después no altera un pedido ya confirmado con ella.
- **RN-007 · El rechazo siempre lleva motivo**: no existe un botón de "rechazar" sin ese paso; el motivo es texto libre, no una lista fija de causas predefinidas (Principio I) — un local pequeño no tiene por qué encajar su realidad en categorías adivinadas de antemano.
- **RN-008 · `rechazado` es terminal**: no se puede aceptar después ni el cliente puede reabrirlo o editarlo; para reintentar, arma un pedido nuevo. Es la única rama del contrato de estados: en el resto, la máquina sigue siendo estrictamente lineal.
- **RN-009 · Un pedido confirmado no se edita, en ningún estado, por ningún rol**: si algo está mal antes de aceptarlo, el camino es que el negocio lo rechace con su motivo (o, cuando exista HU-07 en E8, una intervención administrativa; eso es de otra épica).
- **RN-010 · El negocio solo actúa desde `creado`**: aceptar o rechazar un pedido que ya salió de `creado` (aceptado o rechazado) se impide, sin excepción.
- **RN-011 · El historial se escribe, pero todavía no se consulta**: E2 deja trazada la creación y las transiciones que ejecuta porque el Principio XII lo exige desde el primer pedido. E4 añadirá la forma de consultar esa trazabilidad y continuará registrando las transiciones que incorporen otras épicas.

### Entidades Clave

- **Carrito**: por cliente, exclusivo del rol `CLIENTE`, vive server-side mientras el cliente decide. No es historial ni borrador editable después de confirmado — al confirmar, se vacía y pasa a ser un `Pedido`.
- **Línea de carrito**: producto de referencia y cantidad (entero ≥ 1). No congela nombre ni precio: usa siempre los vigentes del catálogo (FR-006).
- **Dirección de entrega (guardada)**: pertenece a un cliente. Atributos: etiqueta (texto libre, única en forma normalizada dentro de las direcciones del mismo cliente), texto de la dirección, predeterminada (booleano; exactamente una entre las activas cuando existe al menos una) y estado (activa/desactivada, reversible por el cliente). Puede no haber ninguna activa ni predeterminada. Nunca se borra si fue usada en algún pedido.
- **Pedido**: nace del carrito de un cliente. Atributos: cliente, estado (`OrderStatus`, ahora con seis valores), dirección de entrega (texto congelado al confirmar), motivo de rechazo (solo presente cuando el estado es `rechazado`) y fecha de creación. Nunca se edita después de confirmado (FR-035).
- **Línea de pedido**: producto de referencia, nombre y precio **congelados** al confirmar (snapshot, FR-027), y cantidad. A diferencia de la línea de carrito, no cambia aunque el catálogo cambie.
- **Estado del pedido (`OrderStatus`)**: enum de `packages/shared/src/order-state/machine.ts`, ampliado en esta épica de cinco a seis valores. `rechazado` es el sexto: alcanzable únicamente desde `creado`, terminal, sin transiciones salientes — la única rama del contrato, que en el resto sigue siendo lineal.
- **Entrada de historial del pedido**: registro inmutable asociado a un pedido. Identifica el estado resultante, el estado anterior cuando existe, el usuario y rol que produjo el evento, y la fecha. La primera entrada representa la creación en `creado`; las siguientes representan cambios de estado. Solo se agregan entradas y E2 no ofrece todavía una forma de consultarlas.

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: El cliente arma un carrito, le agrega una dirección y confirma un pedido en **menos de 2 minutos**, sin ayuda técnica.
- **SC-002**: En una validación con al menos **3 pedidos** cuyos productos cambian de nombre o precio después de confirmarse, los **3 conservan** los datos que tenían al confirmar.
- **SC-003**: En una validación con al menos **3 pedidos** cuyas direcciones guardadas se editan o desactivan después de confirmarse, los **3 conservan** el texto de entrega original.
- **SC-004**: Después de que el cliente confirma un pedido, el negocio lo ve al **abrir la bandeja o recargarla una vez**, sin repetir la confirmación ni realizar otra acción de sincronización.
- **SC-005**: Aceptar o rechazar un pedido se hace en **2 clics o menos** desde la bandeja del negocio.
- **SC-006**: En una validación con un producto agotado y otro dado de baja, **ninguno de los 2** puede confirmarse dentro de un pedido.
- **SC-007**: En una validación con al menos **3 pedidos rechazados** por motivos distintos, los **3 aparecen** al cliente con la etiqueta "Rechazado" y el motivo correcto, sin aviso por otro medio.
- **SC-008**: Al revisar pedidos en `creado`, `en_preparacion` y `rechazado` con los cuatro roles existentes, **ningún rol encuentra una acción** para editar productos, cantidades o dirección después de la confirmación.
- **SC-009**: El cliente sin voz completa el flujo completo —armar carrito, elegir dirección, confirmar— usando solo clics y formularios (Principio VI).
- **SC-010**: Los intentos de rechazo con motivo vacío y con motivo compuesto solo por espacios muestran un mensaje en español y son rechazados; en **2 de 2 casos** el pedido continúa visible como "Pendiente".
- **SC-011**: El cliente con más de una dirección guardada elige la que corresponde a un pedido en **1 clic**, sin tener que reescribirla.
- **SC-012**: En una validación donde cambia el precio de una línea entre varias después de que el cliente la revisa, el primer intento **no crea ningún pedido**, conserva todas las líneas del carrito y exige una nueva confirmación con el precio actualizado.

### Qué se guarda, y qué frase o acción habilita cada dato

Ningún campo entra al modelo sin una necesidad concreta de esta épica (Principio III).

| Dato | Por qué existe |
| --- | --- |
| Línea de pedido: producto, cantidad, nombre y precio congelados | lo que el cliente pidió, tal como lo pidió, para siempre (FR-027) |
| Dirección de entrega del pedido (texto, congelada) | a dónde llevarlo; no depende de que la dirección guardada cambie después (FR-023) |
| Direcciones guardadas del cliente: etiqueta + texto + predeterminada | evita reescribir la dirección en cada pedido y permite elegir entre varias (FR-012, FR-024) |
| Estado del pedido (`OrderStatus`, ahora con `rechazado`) | contrato de E1, ampliado en esta épica para poder decir "no" con causa (FR-030) |
| Motivo del rechazo | el cliente necesita saber por qué, porque detrás hay un imprevisto real de cocina (FR-033) |
| Carrito: producto, cantidad | lo que el cliente está decidiendo, antes de comprometerse (FR-001) |
| Historial del pedido: estado anterior, estado resultante, actor y fecha | demostrar de forma inmutable quién creó o cambió el pedido y cuándo, como exige el Principio XII (FR-042–FR-044) |

## Supuestos

Decisiones tomadas al redactar esta especificación, con la alternativa descartada cuando la hubo. Se declaran como decisiones, no como preguntas abiertas.

1. **La enmienda constitucional ya está vigente**: la versión 2.0.0 del Principio XII declara `rechazado` como sexto estado y exige un historial inmutable para cada cambio. E2 registra desde el inicio los eventos que produce; no aplaza esa obligación a E4.
2. **Longitud máxima de campos**: motivo de rechazo 10–500 caracteres, etiqueta de dirección 2–60 (mismo rango que el nombre de categoría en E3), texto de dirección 10–500 caracteres, con saltos de línea permitidos (para indicaciones adicionales tipo "tocar el segundo timbre"). Los mínimos evitan textos vacíos disfrazados de contenido; los máximos son valores de sentido común, igual criterio que E3 aplicó a sus propios campos de texto.
3. **Sin tope explícito de direcciones por cliente en v1**: no hay ninguna historia que lo pida (Principio I, Principio III); si el listado llegara a crecer lo suficiente para necesitar paginación, sería un requisito propio con su propio criterio.
4. **El motivo de rechazo no se puede editar después de escrito**: mismo criterio de inmutabilidad que el resto del pedido (RN-009, FR-035) — aunque el motivo nace después de la confirmación, se trata como parte del registro fijo del pedido, no como un campo del negocio.
5. **El negocio puede ver los pedidos que él mismo rechazó, con su motivo**: no desaparecen de su vista al resolverse (FR-039); es su propio registro de lo que decidió.
6. **Nada automático si el negocio no responde a tiempo un pedido pendiente**: en v1 el pedido queda pendiente indefinidamente, sin aviso de antigüedad ni escalamiento. Una intervención sobre pedidos estancados, si hace falta, es HU-07 (E8), no esta historia.
7. **Concurrencia resuelta por atomicidad de la transición de estado, no por bloqueo de interfaz**: dos acciones que compiten (aceptar/rechazar, o dos confirmaciones del mismo carrito) se resuelven de forma que solo una tenga efecto (FR-036); cuál de las dos gana no está definido por esta spec, solo que el resultado sea consistente y la perdedora reciba un mensaje claro.
8. **Mono-local**: v1 no contempla múltiples locales, de acuerdo con la decisión de alcance de `docs/epicas-hu/EPICS.md`; un pedido pertenece implícitamente al único local existente.
9. **Sin voz ni pago en E2**: ambos son decisiones de alcance ya tomadas (§ Contexto y motivación) y no se reabren aquí.
10. **Quién confirma y quién gestiona**: los cuatro roles de E1 se reutilizan sin cambios; `CLIENTE` confirma, `NEGOCIO` decide, `REPARTIDOR` y `ADMINISTRADOR` no actúan en esta épica.
11. **El evento inicial forma parte de la trazabilidad mínima**: aunque crear un pedido en `creado` no sea una transición entre dos estados existentes, se registra como primera entrada sin estado anterior para identificar quién inició el pedido y cuándo.
12. **E4 consulta y amplía; no repara el pasado**: E4 podrá mostrar el historial y añadirá los eventos de transiciones futuras, pero parte de las entradas ya creadas correctamente por E2.

## Fuera de Alcance (v1)

- **Pago o cualquier pasarela de cobro**: decisión de alcance de v1 en `docs/epicas-hu/EPICS.md`.
- **Geolocalización, mapas, selección de pin o distancia estimada**: Principio X, HU-11.
- **Un catálogo cerrado de motivos de rechazo** (por ejemplo, un desplegable con causas predefinidas): el motivo es texto libre; una taxonomía de causas queda para si el negocio la necesita más adelante y hay evidencia de qué categorías usar.
- **Agregar productos al carrito por voz**: es HU-13 (E6); E2 solo deja la API lista para que E6 la use.
- **Cancelación por el cliente** después de confirmado, o retiro de un pedido ya aceptado: el contrato de estados no gana ningún estado propio para esto (solo se agregó `rechazado`, disparado por el negocio y únicamente desde `creado`); si se necesita, es una enmienda aparte a la constitución y a HU-03.
- **Que el negocio pueda revertir un rechazo**: es terminal por diseño; si se rechazó por error, el camino es que el cliente cree un pedido nuevo.
- **Notificaciones push, SMS o email** al cambiar el estado o al rechazar un pedido: el cliente consulta el estado y el motivo en la aplicación (Principio VI, paridad manual); avisar por otro canal es una historia aparte, no declarada.
- **Asignación a repartidor** (`en_preparacion → asignado_repartidor`): E5.
- **Entrega y cierre** (`asignado_repartidor → entregado → cerrado`): E7.
- **Consulta o visualización del historial de transiciones**: HU-03 (E4). E2 sí registra la creación y sus propias transiciones; solo queda fuera de alcance exponerlas a usuarios.
- **Múltiples locales**: v1 es mono-local.

## Dependencias

- **Hacia atrás**:
  - **E1 · Acceso y usuarios**, ya construida y verificada. E2 consume de ella los cuatro roles, el mecanismo de autenticación y sesión, y el `OrderStatus`/máquina de estados original que aquí se amplía.
  - **E3 · Administración de menú**, ya construida y verificada. E2 consume su catálogo (`activo`, `disponible`, precio vigente) y la función de normalización de `packages/shared` sobre la que se apoya FR-014.
  - **Constitución 2.0.0**, ya ratificada: E2 debe cumplir el Principio XII registrando su historial mínimo desde la creación del primer pedido.
- **Hacia adelante**:
  - **E4 · Trazabilidad del pedido** (HU-03) consume el historial iniciado por E2, incorpora su consulta y lo continúa con las transiciones de épicas posteriores.
  - **E5 · Reparto** consume la transición `en_preparacion → asignado_repartidor`, que E2 no construye.
  - **E6 · Búsqueda por voz** (HU-13) se apoya en la API de mutación del carrito que E2 construye de forma manual, sin rediseñarla.
  - **E7 · Cierre del servicio** consume `asignado_repartidor → entregado → cerrado`, que E2 no construye.
  - **E8 · Controles y administración** (HU-07) es el lugar declarado para una eventual intervención sobre pedidos pendientes sin respuesta (§ Supuesto 6).
