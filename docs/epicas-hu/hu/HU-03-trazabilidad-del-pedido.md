# HU-03 — Trazabilidad del pedido

> Borrador de historia de usuario, preparatorio de la spec de **E4 · Trazabilidad
> del pedido**. Es material de entrada para `/speckit-specify`, no la spec en sí:
> los escenarios de esta ficha se incorporarán como criterios de aceptación
> dentro de `specs/00N-trazabilidad-del-pedido/spec.md`.

**Como** administrador, cliente, negocio o repartidor, **quiero** consultar el
historial completo de estados por los que pasó un pedido, con quién produjo cada
cambio y cuándo, **para** dar seguimiento al servicio y auditarlo sin depender de
la memoria de nadie.

| Campo | Valor |
| --- | --- |
| **Épica** | E4 · Trazabilidad del pedido |
| **Prioridad** | Alta |
| **MVP (web)** | Sí |
| **Story points** | 8 *(revisado desde 5; ver «Nota sobre la estimación»)* |
| **Causa raíz** | General — trazabilidad del servicio |
| **Depende de** | E1 (roles y sesión, máquina de estados en `packages/shared`), E2 (entidad Pedido), E3 (catálogo) |
| **Consumida por** | HU-01 (E2), HU-04 (E5), HU-05 (E7), HU-07 (E8), HU-10 (E1) |

**Justificación de prioridad**: es un objetivo central declarado del proyecto y
el Principio XII de la constitución lo exige de forma no ambigua. Además sustenta
la métrica de evaluación «100 % de pedidos con historial» y es el insumo de los
reportes de HU-10, cuya superficie ya está construida en E1 y hoy responde vacía.

---

## Alcance de esta HU

**Qué entra**: el registro append-only de cada cambio de estado y su consulta en
pantalla por los cuatro roles, sobre pedidos que ya existen.

**Qué no entra**: disparar las transiciones. HU-03 define *el contrato y el
registro*; quién pulsa el botón que produce cada cambio pertenece a otras HU:

| Transición | La dispara | HU |
| --- | --- | --- |
| — → `creado` | El cliente confirma el pedido | HU-01 (E2) |
| `creado` → `en_preparacion` | El negocio acepta el pedido | HU-01 (E2) |
| `en_preparacion` → `asignado_repartidor` | Asignación o toma del pedido | HU-04 (E5) |
| `asignado_repartidor` → `entregado` | El repartidor marca la entrega | HU-05 (E7) |
| `entregado` → `cerrado` | Cierre del servicio | HU-05 (E7) |

---

## Máquina de estados (contrato único)

Son **cinco** estados, estrictamente lineales, los del Principio XII, ya
implementados en `packages/shared/src/order-state/machine.ts` durante E1 (T109):

```
creado → en_preparacion → asignado_repartidor → entregado → cerrado
```

Tres precisiones que el borrador original dejaba abiertas y aquí quedan cerradas:

- **No existe un estado «aceptado»**. La aceptación del pedido por el negocio
  *es* la transición `creado → en_preparacion`; no añade un estado propio.
- **«En reparto» es `asignado_repartidor`**, el mismo estado con otro nombre. Se
  usa el nombre del principio para no duplicar vocabulario.
- **No hay cancelación ni rechazo en v1**, y no hay transiciones de retroceso.
  `cerrado` es terminal. Si el producto llegara a necesitarlos, corresponde
  enmendar la constitución y esta HU, no ampliar la máquina en el código.

---

## Qué se registra en cada entrada del historial

Cada entrada guarda, como mínimo:

1. **Estado alcanzado** y **estado anterior** (el anterior es nulo solo en la
   primera entrada).
2. **Fecha y hora** del cambio, almacenada en UTC y mostrada al usuario en la
   zona horaria local, con fecha y hora legibles (no marca técnica).
3. **Actor**: la identidad del usuario que lo produjo y **el rol que tenía en ese
   momento**, congelado en la entrada. Un cambio de rol posterior no reescribe el
   historial.
4. **Origen**: si el cambio lo produjo una persona o el sistema.

**El historial solo admite agregar entradas.** No se edita ni se borra, por
ninguna vía y por ningún rol, ni siquiera el administrador. Corregir un error
solo es posible avanzando el estado, nunca reescribiendo el pasado.

---

## Reglas de negocio

- **RN-01** — Todo pedido tiene al menos una entrada de historial desde el
  instante en que se crea. No existe pedido sin historial.
- **RN-02** — Una transición solo se acepta si el estado destino es alcanzable
  desde el estado actual según la máquina. Cualquier otra se rechaza sin efecto y
  sin dejar entrada.
- **RN-03** — El historial es append-only: no se expone ninguna operación de
  edición ni de borrado de entradas.
- **RN-04** — El pedido se cierra únicamente después de que la entrega fue
  marcada como realizada (Principio XII).
- **RN-05** — Repetir una transición ya aplicada no crea una entrada duplicada.
- **RN-06** — Ante dos intentos simultáneos de la misma transición, solo uno
  produce entrada; el otro recibe la indicación de que el pedido ya avanzó.
- **RN-07** — Visibilidad por rol: el **cliente** ve el historial de sus propios
  pedidos; el **negocio**, el de los pedidos del local; el **repartidor**, el de
  los pedidos que le fueron asignados; el **administrador**, el de todos.
- **RN-08** — El historial se muestra siempre en orden cronológico ascendente
  (del más antiguo al más reciente), sin opción de alterar el orden.

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Trazabilidad del pedido

  Escenario: HU03-E01 · Todo pedido nace con historial
    Dado que un cliente confirma un pedido
    Cuando el pedido queda creado
    Entonces su historial muestra una entrada con el estado "creado"
    Y esa entrada indica la fecha, la hora y el nombre del cliente que lo creó

  Escenario: HU03-E02 · Cada cambio de estado deja registro
    Dado un pedido en estado "creado"
    Cuando el negocio lo acepta y pasa a "en preparación"
    Entonces el historial muestra una segunda entrada
    Y esa entrada indica el estado alcanzado, la fecha y hora, y el nombre y el
      rol de quien produjo el cambio

  Escenario: HU03-E03 · Historial completo en orden cronológico
    Dado un pedido que recorrió los cinco estados hasta "cerrado"
    Cuando consulto su historial
    Entonces veo cinco entradas
    Y aparecen ordenadas del cambio más antiguo al más reciente
    Y puedo reconstruir la secuencia completa leyendo solo la pantalla

  Escenario: HU03-E04 · Transición fuera de orden rechazada
    Dado un pedido en estado "creado"
    Cuando se intenta llevarlo directamente a "entregado"
    Entonces el sistema lo impide
    Y muestra un mensaje en español indicando que la transición no es válida
    Y el historial del pedido no incorpora ninguna entrada nueva

  Escenario: HU03-E05 · No se puede retroceder de estado
    Dado un pedido en estado "entregado"
    Cuando se intenta devolverlo a "en preparación"
    Entonces el sistema lo impide
    Y el historial no incorpora ninguna entrada nueva

  Escenario: HU03-E06 · El estado cerrado es terminal
    Dado un pedido en estado "cerrado"
    Cuando se intenta aplicarle cualquier cambio de estado
    Entonces el sistema lo impide
    Y muestra un mensaje en español indicando que el pedido ya está cerrado

  Escenario: HU03-E07 · El historial no se puede editar ni borrar
    Dado que inicié sesión con rol "administrador"
    Cuando consulto el historial de cualquier pedido
    Entonces no existe ninguna acción para modificar ni eliminar una entrada
    Y las entradas anteriores se mantienen idénticas tras nuevos cambios de estado

  Escenario: HU03-E08 · El rol del actor queda congelado en la entrada
    Dado un pedido cuyo cambio a "en preparación" lo produjo un usuario con rol "negocio"
    Cuando el administrador cambia después el rol de ese usuario
    Y vuelvo a consultar el historial del pedido
    Entonces la entrada sigue mostrando el rol "negocio" que tenía al producir el cambio

  Escenario: HU03-E09 · El actor desactivado sigue siendo identificable
    Dado un pedido con entradas producidas por un repartidor
    Cuando el administrador desactiva a ese repartidor
    Y consulto el historial del pedido
    Entonces las entradas siguen mostrando su nombre y su rol

  Escenario: HU03-E10 · Doble envío de la misma transición
    Dado un pedido en estado "creado"
    Cuando el negocio pulsa dos veces seguidas la acción de aceptar el pedido
    Entonces el historial incorpora una sola entrada de "en preparación"

  Escenario: HU03-E11 · Dos actores intentan la misma transición a la vez
    Dado un pedido en estado "en preparación"
    Cuando dos repartidores intentan tomarlo simultáneamente
    Entonces solo uno queda registrado en el historial como actor del cambio
    Y el otro recibe un mensaje en español indicando que el pedido ya fue tomado

  Escenario: HU03-E12 · El cliente ve el historial de su propio pedido
    Dado que inicié sesión con rol "cliente"
    Cuando consulto uno de mis pedidos
    Entonces veo su historial completo de estados

  Escenario: HU03-E13 · El cliente no ve pedidos ajenos
    Dado que inicié sesión con rol "cliente"
    Cuando intento consultar el historial de un pedido de otro cliente
    Entonces el sistema me lo impide
    Y muestra un mensaje en español explicando que no tengo permiso

  Escenario: HU03-E14 · El administrador ve el historial de cualquier pedido
    Dado que inicié sesión con rol "administrador"
    Cuando consulto cualquier pedido de la plataforma
    Entonces veo su historial completo de estados
```

---

## Casos límite a cubrir

- Pedido recién creado, sin más transiciones: el historial muestra una sola
  entrada y la pantalla no queda vacía ni con aspecto de error.
- Cambio de estado producido por el sistema y no por una persona: la entrada
  indica el origen sin inventar un actor humano.
- Consulta del historial de un pedido inexistente o de otro local.
- Pedido con muchas entradas: la pantalla sigue siendo legible desde 360 píxeles
  de ancho y recorrible por teclado.
- Dos cambios de estado en el mismo segundo: el orden cronológico mostrado sigue
  siendo determinista.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-1 | El **100 %** de los pedidos creados tiene al menos una entrada de historial, comprobable en el panel del administrador comparando total de pedidos contra pedidos con historial. |
| SC-2 | El **100 %** de los cambios de estado observados en pantalla aparece en el historial en la consulta inmediatamente posterior. |
| SC-3 | El **100 %** de los intentos de transición inválida se rechaza con un mensaje en español y sin dejar entrada. |
| SC-4 | Una persona no técnica reconstruye la secuencia completa de un pedido leyendo solo la pantalla, sin consultar la base de datos ni logs. |
| SC-5 | No existe en toda la interfaz ninguna acción que edite o elimine una entrada del historial, para ningún rol. |
| SC-6 | El historial de un pedido se alcanza en **3 clics o menos** desde el listado de pedidos del rol correspondiente. |

---

## Fuera de alcance de v1 (declarado, no omitido)

- Cancelación y rechazo de pedidos, y cualquier estado terminal distinto de
  `cerrado`.
- Retroceso o corrección de estados ya registrados.
- Exportación del historial (CSV, PDF) y notificaciones al cliente ante cada
  cambio de estado.
- Geolocalización del reparto (Principio X: direcciones como texto libre).
- Política de retención o purga del historial.

---

## Decisiones que quedan abiertas para `/speckit-clarify`

1. **Quién dispara `entregado → cerrado`** y si es automático. El Principio XII
   fija que el cierre ocurre solo tras la entrega, pero no dice si lo produce el
   repartidor, el negocio o el sistema tras la confirmación de conformidad de
   HU-05.
2. **Qué nombre visible se muestra al cliente** para el actor de cada cambio:
   nombre completo del repartidor, nombre de pila o solo el rol. Afecta al
   Principio X (datos mínimos).
3. **Si el historial se muestra igual para todos los roles** o el cliente ve una
   versión resumida sin detalle del actor interno del local.

---

## Nota sobre la estimación

Se sube de **5 a 8 SP**. El borrador original estimaba el registro de estados,
pero el trabajo real incluye además: garantía append-only a nivel de base de
datos, control de concurrencia e idempotencia en las transiciones (RN-05, RN-06),
visibilidad diferenciada para cuatro roles (RN-07) y la pantalla de historial
recorrible por teclado y desde 360 píxeles. La experiencia de E1 es explícita al
respecto: la unicidad, las transacciones y la atomicidad no se cubren con tests
unitarios, requieren la capa de integración.

---

## Cambios respecto del borrador original

| Punto del borrador | Qué se corrigió |
| --- | --- |
| «Estados soportados: creado, aceptado, en preparación, en reparto, entregado, cerrado» | Contradecía el Principio XII y `packages/shared`. Se alinea a los cinco estados reales y se explica dónde encaja «aceptado». |
| «actores del pedido» | Se nombran los cuatro roles y se define qué ve cada uno (RN-07). |
| Faltaba la inmutabilidad | El Principio XII exige historial append-only, no editable ni borrable. Ahora es RN-03 con su escenario. |
| Faltaba la regla de cierre | RN-04: el cierre solo ocurre tras la entrega marcada. |
| «fecha/hora» sin más | Se precisa almacenamiento en UTC, presentación en hora local y legible. |
| «actor que lo produjo» sin más | Se precisa identidad **más rol congelado**, y el comportamiento ante cambio de rol o desactivación posterior. |
| Criterios en forma de lista | Reescritos en Gherkin, como exige el Principio XI antes de programar. |
| Sin casos límite | Se añaden concurrencia, doble envío, estado terminal y pedido sin transiciones. |
| Métrica «100 % de pedidos con historial» sin forma de medirla | Traducida a SC-1, comprobable desde el panel del administrador. |
| «MPV» | Es **MVP**. |
