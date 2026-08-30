# HU-01 — Gestión de pedidos con estado visible

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-13 y HU-14, esta HU **no se redactó como borrador previo a la spec**: E2
> se especificó directo con `/speckit.specify` sobre un borrador consolidado
> de la épica completa. Este documento se escribe después de que E2 · Gestión
> de pedidos ya está construida y verificada, a partir de
> `specs/003-gestion-pedidos/spec.md` (Historia de Usuario 3) y del código
> resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-11](./HU-11-registro-de-direccion-y-ubicacion-del-cliente.md) y
> [HU-12](./HU-12-carrito-editable-manual.md), las otras dos historias de la
> misma spec, de las que HU-01 depende directamente.

**Como** cliente, **quiero** ver en qué estado está mi pedido en todo momento,
**y como** negocio, **quiero** ver los pedidos que llegan y decidir si los
acepto o no, **para** saber qué se está preparando y no comprometerme a algo
que no puedo cumplir.

| Campo | Valor |
| --- | --- |
| **Épica** | E2 · Gestión de pedidos |
| **Prioridad** | P3 dentro de su spec (tercera en construirse, aunque es el corazón de la épica) |
| **MVP (web)** | Sí |
| **Causa raíz** | Hasta E3 el producto solo tenía catálogo: nada se podía pedir todavía. HU-01 crea la entidad `Pedido` y cierra el primer flujo de punta a punta. |
| **Depende de** | HU-12 (carrito con al menos una línea), HU-11 (dirección de entrega elegida), E1 (rol, sesión), E3 (catálogo vigente) |
| **Consumida por** | HU-03 (E4, consulta el historial que HU-01 empieza a escribir), HU-04 (E5, continúa la máquina de estados desde `en_preparacion`), HU-05 (E7, la termina), HU-07 (E8, intervención sobre pedidos estancados) |

---

## Alcance de esta HU

**Qué entra**: crear el `Pedido` a partir de un carrito con líneas y una
dirección elegida; las dos únicas transiciones que salen de `creado`
—aceptar (`→ en_preparacion`) o rechazar (`→ rechazado`, con motivo
obligatorio)—; el estado visible del pedido para el cliente; la bandeja
paginada de pedidos entrantes para el negocio; y el registro mínimo e
inmutable de historial que exige el Principio XII desde el primer pedido.

**Qué no entra**: armar o editar el carrito, eso es HU-12; registrar o elegir
direcciones, eso es HU-11; consultar o mostrar el historial completo de
transiciones, eso es HU-03 (E4) — HU-01 solo **escribe** ese historial, no lo
expone; las transiciones posteriores a `en_preparacion`
(`asignado_repartidor`, `entregado`, `cerrado`), eso es HU-04 (E5) y HU-05
(E7); cualquier intervención administrativa sobre un pedido pendiente sin
respuesta, eso es HU-07 (E8).

**Tampoco entra ningún módulo de pago.** Es una decisión de alcance de v1
(`docs/epicas-hu/EPICS.md`): el pedido se confirma y el negocio decide si lo
prepara; el cobro ocurre fuera del sistema.

---

## El contrato de estados se amplía en esta HU, y es una decisión tomada

La máquina de estados del pedido se construyó en E1 dentro de
`packages/shared/src/order-state/machine.ts` como una secuencia estrictamente
lineal de cinco estados y **sin** rama de rechazo. HU-01 corrige esa omisión
agregando `rechazado` como sexto estado, terminal, alcanzable únicamente desde
`creado`:

```text
creado ─┬─→ en_preparacion → asignado_repartidor → entregado → cerrado
        └─→ rechazado   (terminal, sin transiciones salientes)
```

Esto modificó un contrato ya construido en E1: el Principio XII de la
constitución se enmendó a la versión 2.0.0 para declarar esta rama, su motivo
obligatorio y el historial inmutable de cada cambio de estado. No existe un
estado "aceptado" independiente — la aceptación del negocio **es** la
transición `creado → en_preparacion`.

---

## Reglas de negocio

- **RN-01 · El rechazo siempre lleva motivo**: no existe un botón de
  "rechazar" sin ese paso; el motivo es texto libre, no una lista fija de
  causas predefinidas (Principio I) — un local pequeño no tiene por qué
  encajar su realidad en categorías adivinadas de antemano.
- **RN-02 · `rechazado` es terminal**: no se puede aceptar después ni el
  cliente puede reabrirlo o editarlo; para reintentar, arma un pedido nuevo.
  Es la única rama del contrato de estados: en el resto, la máquina sigue
  siendo estrictamente lineal.
- **RN-03 · Un pedido confirmado no se edita, en ningún estado, por ningún
  rol**: si algo está mal antes de aceptarlo, el camino es que el negocio lo
  rechace con su motivo (o, cuando exista HU-07 en E8, una intervención
  administrativa; eso es de otra épica).
- **RN-04 · El negocio solo actúa desde `creado`**: aceptar o rechazar un
  pedido que ya salió de `creado` (aceptado o rechazado) se impide, sin
  excepción.
- **RN-05 · El historial se escribe, pero todavía no se consulta**: HU-01 deja
  trazada la creación y las dos transiciones que ejecuta porque el Principio
  XII lo exige desde el primer pedido. HU-03 (E4) añade la forma de
  consultarlo y sigue registrando las transiciones que incorporen otras
  épicas.
- **RN-06 · Precio y catálogo son un snapshot, no una referencia viva**: al
  confirmar, cada línea del pedido copia el nombre y el precio vigentes del
  producto (herencia de RN-09 de E3/HU-02); un cambio posterior en el
  catálogo no altera un pedido ya confirmado.
- **RN-07 · Concurrencia resuelta por atomicidad, no por bloqueo de
  interfaz**: dos acciones que compiten sobre el mismo pedido o el mismo
  carrito (aceptar/rechazar simultáneos, o dos confirmaciones del mismo
  carrito) se resuelven de forma que solo una tenga efecto y la otra falle
  con un mensaje claro.

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Gestión de pedidos con estado visible

  Escenario: HU01-E01 · Confirmar un pedido válido
    Dado que inicié sesión con rol "cliente"
    Y tengo productos en mi carrito y una dirección de entrega elegida
    Cuando confirmo el pedido
    Entonces se crea un pedido en estado "creado"
    Y mi carrito queda vacío

  Escenario: HU01-E02 · Carrito vacío no se puede confirmar
    Dado que mi carrito está vacío
    Cuando intento confirmar un pedido
    Entonces el sistema lo impide con un mensaje en español

  Escenario: HU01-E03 · Sin dirección no se puede confirmar
    Dado que tengo productos en el carrito pero ninguna dirección
    Cuando intento confirmar el pedido
    Entonces el sistema lo impide y pide una dirección de entrega

  Escenario: HU01-E04 · El negocio ve el pedido entrante completo
    Dado un pedido recién confirmado
    Cuando el negocio revisa sus pedidos pendientes
    Entonces lo ve con sus productos, cantidades, precios y dirección de entrega

  Escenario: HU01-E05 · Aceptar un pedido
    Dado un pedido en estado "creado"
    Cuando el negocio lo acepta
    Entonces el pedido pasa a "en_preparacion"
    Y el cliente ve la etiqueta "En preparación" en la siguiente carga

  Escenario: HU01-E06 · Rechazar un pedido con motivo
    Dado un pedido en estado "creado"
    Cuando el negocio lo rechaza escribiendo el motivo "Se acabó el ingrediente principal"
    Entonces el pedido pasa a "rechazado"
    Y desaparece de la cola de pendientes del negocio
    Y el cliente lo ve etiquetado "Rechazado" junto con ese motivo

  Escenario: HU01-E07 · El rechazo exige motivo
    Dado un pedido en estado "creado"
    Cuando el negocio intenta rechazarlo sin escribir ningún motivo
    Entonces el sistema lo impide con un mensaje en español

  Escenario: HU01-E08 · No se puede aceptar un pedido ya rechazado
    Dado un pedido en estado "rechazado"
    Cuando el negocio intenta aceptarlo
    Entonces el sistema lo impide

  Escenario: HU01-E09 · No se puede rechazar un pedido que ya está en preparación
    Dado un pedido en estado "en_preparacion"
    Cuando el negocio intenta rechazarlo
    Entonces el sistema lo impide

  Escenario: HU01-E10 · El cliente no puede aceptar ni rechazar
    Dado que inicié sesión con rol "cliente"
    Cuando intento aceptar o rechazar un pedido
    Entonces el sistema me lo impide con un mensaje en español

  Escenario: HU01-E11 · El negocio no confirma pedidos
    Dado que inicié sesión con rol "negocio"
    Cuando intento confirmar un pedido a partir de un carrito
    Entonces el sistema me lo impide

  Escenario: HU01-E12 · El precio queda congelado al confirmar
    Dado un pedido confirmado con un producto a $5.000
    Cuando el negocio cambia después el precio de ese producto a $6.000
    Entonces el pedido confirmado sigue mostrando $5.000

  Escenario: HU01-E13 · Un pedido confirmado no se edita
    Dado un pedido ya confirmado en cualquier estado
    Cuando el cliente intenta cambiar sus productos o cantidades
    Entonces el sistema no ofrece ninguna forma de editarlo

  Escenario: HU01-E14 · Bandeja vacía
    Dado que el negocio no tiene pedidos pendientes
    Cuando revisa su bandeja de pedidos
    Entonces ve un mensaje en español explicando que no hay pedidos por ahora

  Escenario: HU01-E15 · Bandeja paginada
    Dado que el negocio tiene 21 pedidos pendientes
    Cuando recorre las dos páginas de su bandeja
    Entonces ve 20 pedidos en la primera y 1 en la segunda
    Y del más antiguo al más reciente, sin pedidos repetidos ni omitidos

  Escenario: HU01-E16 · El precio cambia justo antes de confirmar
    Dado que revisé mi carrito y el negocio cambió después el precio de un producto
    Cuando intento confirmar con el precio anterior
    Entonces no se crea ningún pedido ni se vacía el carrito
    Y veo el precio actualizado
    Y debo revisarlo antes de confirmar nuevamente

  Escenario: HU01-E17 · La creación queda registrada en el historial
    Dado un carrito y una dirección válidos
    Cuando el cliente confirma el pedido
    Entonces el pedido nace en "creado"
    Y queda una única entrada inmutable que registra su creación, el cliente que la realizó y la fecha

  Escenario: HU01-E18 · Cada transición queda registrada en el historial
    Dado un pedido en "creado"
    Cuando el negocio lo acepta o lo rechaza correctamente
    Entonces el nuevo estado y una única entrada de historial con el estado anterior, el nuevo, el negocio que actuó y la fecha quedan registrados juntos
```

---

## Casos límite cubiertos

- Confirmar el pedido justo cuando un producto del carrito se agota o se da
  de baja en el mismo instante (condición de carrera): se vuelve a validar
  disponibilidad al confirmar, no solo al agregar.
- Confirmar el pedido justo cuando cambia el precio de un producto: ese
  intento no crea el pedido ni vacía el carrito.
- Dos confirmaciones del mismo carrito desde dos pestañas a la vez: solo una
  produce un pedido.
- El negocio intenta aceptar y rechazar el mismo pedido casi al mismo tiempo
  desde dos pestañas: gana solo una acción; la otra falla con un mensaje
  claro, sin duplicar el efecto.
- La creación o una transición cambia el pedido pero no logra registrar su
  historial, o registra el historial pero no logra cambiar el pedido: ambos
  resultados se revierten; nunca queda uno sin el otro.
- Un intento rechazado o que pierde una carrera concurrente no agrega una
  entrada al historial.
- El negocio escribe un motivo de rechazo compuesto solo de espacios en
  blanco: se trata igual que un motivo vacío.
- Negocio con muchos pedidos pendientes simultáneos: la bandeja muestra 20
  por página, del más antiguo al más reciente, sin repetir ni omitir pedidos
  entre páginas.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-1 | Después de que el cliente confirma un pedido, el negocio lo ve al **abrir la bandeja o recargarla una vez**, sin repetir la confirmación ni realizar otra acción de sincronización. |
| SC-2 | Aceptar o rechazar un pedido se hace en **2 clics o menos** desde la bandeja del negocio (el conteo no incluye escribir el texto del motivo de rechazo). |
| SC-3 | En una validación con al menos **3 pedidos rechazados** por motivos distintos, los **3 aparecen** al cliente con la etiqueta "Rechazado" y el motivo correcto, sin aviso por otro medio. |
| SC-4 | Al revisar pedidos en `creado`, `en_preparacion` y `rechazado` con los cuatro roles existentes, **ningún rol encuentra una acción** para editar productos, cantidades o dirección después de la confirmación. |
| SC-5 | Los intentos de rechazo con motivo vacío y con motivo compuesto solo por espacios muestran un mensaje en español y son rechazados; en **2 de 2 casos** el pedido continúa visible como "Pendiente". |
| SC-6 | En una validación donde cambia el precio de una línea entre varias después de que el cliente la revisa, el primer intento **no crea ningún pedido**, conserva todas las líneas del carrito y exige una nueva confirmación con el precio actualizado. |

---

## Frontera con HU-03 (E4) — a respetar

HU-01 **escribe** el historial (`OrderStatusEvent`, append-only, con la
creación y sus dos transiciones) en la misma operación indivisible que
produce el cambio, porque el Principio XII lo exige desde el primer pedido —
pero **no lo expone**: no hay endpoint, DTO ni pantalla que lo consulte en
esta HU. HU-03 (E4) incorpora esa consulta sobre las entradas que HU-01 ya
dejó escritas, y dispone el mecanismo para que HU-04 (E5) y HU-05 (E7)
sigan agregando entradas cuando existan.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Pago o cualquier pasarela de cobro**: decisión de alcance de v1.
- **Un catálogo cerrado de motivos de rechazo** (por ejemplo, un desplegable
  con causas predefinidas): el motivo es texto libre.
- **Cancelación por el cliente** después de confirmado, o retiro de un pedido
  ya aceptado: el contrato de estados no gana ningún estado propio para
  esto.
- **Que el negocio pueda revertir un rechazo**: es terminal por diseño; si se
  rechazó por error, el camino es que el cliente cree un pedido nuevo.
- **Notificaciones push, SMS o email** al cambiar el estado o al rechazar un
  pedido: el cliente consulta el estado y el motivo en la aplicación
  (Principio VI, paridad manual).
- **Asignación a repartidor** (`en_preparacion → asignado_repartidor`): HU-04
  (E5).
- **Entrega y cierre** (`asignado_repartidor → entregado → cerrado`): HU-05
  (E7).
- **Consulta o visualización del historial de transiciones**: HU-03 (E4).
- **Intervención sobre un pedido pendiente sin respuesta del negocio**: nada
  automático en v1 (sin aviso de antigüedad ni escalamiento); si hace falta,
  es HU-07 (E8), no esta historia.
- **Múltiples locales**: v1 es mono-local.

---

## Qué construyó realmente (resumen de implementación)

- **`packages/shared`**: `RECHAZADO` agregado al enum `OrderStatus` y a
  `machine.ts`; esquemas de confirmación y rechazo de pedido; los mensajes
  fijos de motivo obligatorio y estado inválido; la etiqueta «Pendiente» /
  «Rechazado».
- **`services/api`**: el módulo `orders`, con dos controladores —cliente
  (`POST/GET /orders`) y negocio (bandeja, aceptar, rechazar, rechazados)—,
  ambos con `@Roles`. El historial (`OrderStatusEvent`) se escribe con un
  helper transaccional privado, sin endpoint ni DTO público — eso lo
  incorpora HU-03 (E4). Transacciones interactivas con `updateMany`
  condicionado garantizan que aceptar/rechazar tenga exactamente un ganador
  bajo carrera (RN-07), y un trigger `BEFORE UPDATE OR DELETE` vuelve el
  historial append-only.
- **`apps/web`**: `/cliente/pedidos` (con su confirmación) y
  `/negocio/pedidos` (con su bandeja paginada y los rechazados).
- **Verificación funcional**: 2026-08-18, 40 pasos manuales — encontró que el
  error de una dirección puntual demasiado corta al confirmar un pedido se
  mostraba en inglés (el mensaje por omisión de Zod, sin traducir), corregido
  antes de cerrar la épica. Detalle en
  `specs/003-gestion-pedidos/verificacion.md`.
