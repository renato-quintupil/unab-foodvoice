# HU-12 — Carrito editable manual

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E2 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E2 · Gestión de pedidos ya está construida y verificada, a partir de
> `specs/003-gestion-pedidos/spec.md` (Historia de Usuario 1) y del código
> resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-11](./HU-11-registro-de-direccion-y-ubicacion-del-cliente.md) y
> [HU-01](./HU-01-gestion-de-pedidos-con-estado-visible.md), las otras dos
> historias de la misma spec: HU-01 depende de HU-12 para poder confirmar un
> pedido, y E6/HU-13 se apoya después en la misma API de mutación para
> agregar productos por voz.

**Como** cliente, **quiero** armar mi pedido agregando productos, cambiando
cantidades y quitando lo que no quiero, **para** revisar y corregir todo
antes de que el negocio lo reciba.

| Campo | Valor |
| --- | --- |
| **Épica** | E2 · Gestión de pedidos |
| **Prioridad** | P1 dentro de su spec (primera en construirse; es la base de las otras dos) |
| **MVP (web)** | Sí |
| **Causa raíz** | Sin carrito no hay nada que confirmar; es la etapa previa al `Pedido` que crea HU-01. |
| **Depende de** | E1 (rol cliente, sesión), E3 (catálogo activo y disponible) |
| **Consumida por** | HU-01 (E2, confirma a partir del carrito), HU-13 (E6, agrega productos por voz reutilizando esta misma API de mutación sin rediseñarla) |

---

## Alcance de esta HU

**Qué entra**: un carrito por cliente, persistido en el servidor; agregar un
producto activo y disponible con un clic (sin segundo paso de
confirmación); sumar cantidad a una línea existente en vez de duplicarla;
cambiar cantidades y quitar líneas; recalcular el precio vigente en cada
carga, sin congelarlo; marcar y bloquear la confirmación de una línea cuyo
producto se agotó o se dio de baja, sin quitarla por sí solo; vaciar el
carrito completo; y que persista sin pérdida entre sesiones.

**Qué no entra**: confirmar el pedido en sí, ni la máquina de estados que
sigue — eso es HU-01; registrar o elegir direcciones — eso es HU-11; agregar
productos por voz — eso es HU-13 (E6), que reutiliza esta misma API sin
rediseñarla.

---

## Por qué el carrito es server-side y no solo estado del navegador

El carrito y su API de mutación (agregar, quitar, cambiar cantidad) se
construyen aquí de forma manual, como una operación server-side clara — no
como estado que solo vive en el navegador — precisamente porque **E6/HU-13**
se apoyará en esa misma API para agregar productos por voz más adelante, sin
rediseñarla. Mezclar voz en esta épica habría hecho crecer su alcance sin
control (Principio III). El carrito es la etapa **previa** al pedido: vive
mientras el cliente decide y se vacía cuando confirma (pasa a ser un
`Pedido`, HU-01). No es un historial ni un borrador editable después de
confirmado.

En el flujo manual, seleccionar un producto visible y pulsar «Agregar» es la
confirmación explícita de esa acción que exige el Principio IX. Como no
existe todavía una interpretación de voz que validar en E2, el sistema no
pide una segunda confirmación antes de agregarlo.

---

## Reglas de negocio

- **RN-001 · Solo el cliente tiene carrito**: ningún otro rol lo tiene ni lo
  necesita; el negocio ve pedidos, que son de otra entidad.
- **RN-002 · Un producto solo se agrega si está activo y disponible**: el
  sistema nunca ofrece agregar lo que no se puede preparar (herencia de
  RN-03 de E3/HU-02). El clic en «Agregar» sobre un producto visible
  constituye la confirmación previa del Principio IX.
- **RN-003 · El precio del carrito es siempre el vigente y debe revisarse
  antes de confirmar**: no se congela hasta confirmar; el que ya confirmó
  conserva el precio anterior (HU-01, RN-06).
- **RN-004 · Un producto que se agota o se da de baja no se quita solo del
  carrito**: se marca y bloquea la confirmación, para no sorprender al
  cliente con un carrito distinto al que dejó (Principio IX).

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Carrito editable manual

  Escenario: HU12-E01 · Agregar un producto disponible
    Dado que inicié sesión con rol "cliente"
    Cuando agrego un producto activo y disponible al carrito
    Entonces aparece con cantidad 1 y el precio vigente

  Escenario: HU12-E02 · No se puede agregar un producto agotado
    Dado un producto marcado como agotado
    Cuando intento agregarlo al carrito
    Entonces el sistema lo impide y muestra un mensaje en español explicando que no está disponible

  Escenario: HU12-E03 · No se puede agregar un producto dado de baja
    Dado un producto dado de baja
    Cuando intento agregarlo al carrito
    Entonces el sistema lo impide

  Escenario: HU12-E04 · Cambiar la cantidad de una línea
    Dado un producto ya en mi carrito con cantidad 1
    Cuando cambio la cantidad a 3
    Entonces el carrito muestra 3 unidades y el subtotal de esa línea actualizado

  Escenario: HU12-E05 · Bajar la cantidad a cero quita la línea
    Dado un producto en mi carrito con cantidad 1
    Cuando bajo la cantidad a 0
    Entonces el producto desaparece del carrito

  Escenario: HU12-E06 · Quitar una línea explícitamente
    Dado un producto en mi carrito
    Cuando lo quito con la acción de eliminar
    Entonces ya no aparece en mi carrito

  Escenario: HU12-E07 · El carrito persiste entre sesiones
    Dado que agregué productos a mi carrito
    Cuando cierro sesión y vuelvo a iniciar sesión
    Entonces mi carrito conserva los mismos productos y cantidades

  Escenario: HU12-E08 · Carrito vacío
    Dado que no he agregado ningún producto
    Cuando reviso mi carrito
    Entonces veo un mensaje en español indicando que está vacío y no puedo confirmarlo como pedido

  Escenario: HU12-E09 · Un producto se agota estando en el carrito
    Dado un producto en mi carrito disponible al agregarlo
    Cuando el negocio lo marca como agotado antes de que yo confirme
    Entonces mi carrito lo muestra marcado como no disponible
    Y no puedo confirmar el pedido hasta quitarlo o esperar a que vuelva

  Escenario: HU12-E10 · El precio se actualiza en la siguiente carga
    Dado un producto en mi carrito a $5.000
    Cuando el negocio cambia su precio a $6.000
    Entonces mi carrito muestra $6.000 en la siguiente carga, antes de confirmar

  Escenario: HU12-E11 · Vaciar el carrito completo
    Dado varios productos en mi carrito
    Cuando uso la acción de vaciar carrito
    Entonces queda vacío
```

---

## Casos límite cubiertos

- Agregar el mismo producto varias veces suma cantidad en la misma línea,
  no crea líneas duplicadas (FR-004).
- Confirmar el pedido justo cuando un producto del carrito se agota o se da
  de baja en el mismo instante (condición de carrera): se vuelve a validar
  disponibilidad al confirmar, no solo al agregar (frontera con HU-01,
  FR-028).
- Pedido con una sola línea vs. pedido con muchas líneas distintas: mismo
  camino de confirmación.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-001 | El cliente arma un carrito, le agrega una dirección y confirma un pedido en menos de 2 minutos, sin ayuda técnica. |
| SC-006 | En una validación con un producto agotado y otro dado de baja, ninguno de los 2 puede confirmarse dentro de un pedido. |
| SC-009 | El cliente sin voz completa el flujo completo —armar carrito, elegir dirección, confirmar— usando solo clics y formularios (Principio VI). |

---

## Frontera con HU-01 y HU-13 (E6) — a respetar

HU-12 construye la API de mutación del carrito (agregar, quitar, cambiar
cantidad) como una operación server-side clara, precisamente para que E6
(HU-13) la reutilice tal cual al agregar productos por voz, sin rediseñarla.
HU-01 consume el carrito ya armado para confirmar un pedido, pero no lo
modifica: un pedido confirmado no se edita, en ningún estado, por ningún rol
(RN-009 de HU-01).

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Agregar productos al carrito por voz**: es HU-13 (E6); E2 solo deja la
  API lista para que E6 la use.
- **Pago o cualquier pasarela de cobro**: decisión de alcance de v1.
- **Un carrito compartido entre varios clientes** o entre varios
  dispositivos de forma simultánea con resolución de conflictos: cada
  cliente tiene el suyo.

---

## Qué construyó realmente (resumen de implementación)

- **`packages/shared`**: esquemas de mutación del carrito (agregar, cambiar
  cantidad, quitar); los mensajes fijos de producto no disponible y carrito
  vacío.
- **`services/api`**: el módulo `cart`, exclusivo del rol `CLIENTE`. El
  carrito recalcula precio y disponibilidad **en cada lectura**, sin
  congelarlos — la API que E6/HU-13 reutiliza después sin cambios para el
  agregado por voz.
- **`apps/web`**: `/cliente/carrito`, con las acciones de agregar (desde el
  catálogo de E3), cambiar cantidad, quitar línea y vaciar; el aviso visual
  de línea agotada o dada de baja que bloquea la confirmación.
- **Verificación funcional**: 2026-08-18, junto con HU-11 y HU-01 (40 pasos
  en total). Sin defectos propios de esta historia; el único hallazgo de la
  spec completa fue el mensaje de Zod sin traducir en HU-01. Detalle en
  `specs/003-gestion-pedidos/verificacion.md`.
