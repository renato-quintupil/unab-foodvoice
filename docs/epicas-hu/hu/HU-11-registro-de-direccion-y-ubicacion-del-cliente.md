# HU-11 — Registro de dirección y ubicación del cliente

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E2 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E2 · Gestión de pedidos ya está construida y verificada, a partir de
> `specs/003-gestion-pedidos/spec.md` (Historia de Usuario 2) y del código
> resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-12](./HU-12-carrito-editable-manual.md) y
> [HU-01](./HU-01-gestion-de-pedidos-con-estado-visible.md), las otras dos
> historias de la misma spec: HU-01 depende de HU-11 para poder confirmar un
> pedido.

**Como** cliente, **quiero** registrar más de una dirección y ponerle una
etiqueta que yo elijo (Casa, Departamento de mi papá, Trabajo), **para** no
tener que volver a escribirla cada vez y elegir rápido la que corresponde a
cada pedido.

| Campo | Valor |
| --- | --- |
| **Épica** | E2 · Gestión de pedidos |
| **Prioridad** | P2 dentro de su spec (segunda en construirse) |
| **MVP (web)** | Sí |
| **Causa raíz** | Confirmar un pedido exige una dirección (HU-01, FR-022); registrarla de antemano agiliza el flujo, aunque la funcionalidad de direcciones ya entrega valor sin que exista ningún pedido. |
| **Depende de** | E1 (rol cliente, sesión) |
| **Consumida por** | HU-01 (E2, exige una dirección —guardada o puntual— para confirmar; congela su texto en el pedido) |

---

## Alcance de esta HU

**Qué entra**: registrar una o más direcciones con etiqueta y texto libre;
impedir etiquetas duplicadas (normalizadas) para un mismo cliente; mantener
exactamente una predeterminada mientras haya alguna activa; editar el texto
o la etiqueta de una dirección guardada; desactivar y reactivar direcciones;
eliminar sin dejar rastro una dirección que nunca se usó; y escribir, al
confirmar un pedido, una dirección puntual sin guardarla.

**Qué no entra**: armar o confirmar el pedido en sí — eso es HU-12 y HU-01;
ningún mapa, selector de pin, geocodificación ni validación contra un
servicio externo — explícitamente fuera de alcance (Principio X).

---

## Direcciones solo de texto libre, y por qué

Las direcciones son **solo texto libre** (Principio X): no hay mapa,
selector de pin, geocodificación ni validación contra un servicio externo.
La etiqueta la escribe el cliente, no se elige de una lista fija — mismo
criterio que la descripción de producto de E3. El cliente puede tener
varias direcciones, marcar una como predeterminada, y elegir cuál usar en
cada pedido.

---

## Reglas de negocio

- **RN-005 · No hay borrado físico de direcciones usadas**: mismo criterio
  de baja lógica que usuarios (E1) y catálogo (E3); solo una dirección que
  **nunca** se usó puede eliminarse sin dejar rastro.
- **RN-006 · La dirección del pedido es un snapshot, no una referencia
  viva**: editar o desactivar una dirección guardada después no altera un
  pedido ya confirmado con ella.
- **Etiqueta única por cliente, en forma normalizada**: dos direcciones con
  etiquetas que solo difieren en tildes, mayúsculas o espacios se tratan
  como la misma etiqueta y se rechazan (FR-014), con el mismo criterio de
  `normalizarBusqueda` que ya usa E3.
- **Exactamente una predeterminada mientras haya alguna activa**: la primera
  dirección que se registre o reactive cuando no exista ninguna activa
  queda predeterminada automáticamente; si ya existe una predeterminada,
  reactivar otra no la cambia (FR-015).
- **Retirar la última dirección activa deja al cliente sin predeterminada,
  no sin poder operar**: puede seguir confirmando pedidos con una dirección
  puntual o registrando una nueva (FR-020).

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Registro de dirección y ubicación del cliente

  Escenario: HU11-E01 · Primera dirección queda predeterminada
    Dado que inicié sesión con rol "cliente" y no tengo direcciones guardadas
    Cuando registro una dirección con etiqueta "Casa" y un texto válido
    Entonces queda guardada y marcada como predeterminada automáticamente

  Escenario: HU11-E02 · Varias direcciones conviven
    Dado que ya tengo guardada la dirección "Casa"
    Cuando registro otra con etiqueta "Departamento de mi papá"
    Entonces ambas aparecen en mi lista de direcciones

  Escenario: HU11-E03 · Etiqueta duplicada, normalizada
    Dado que ya tengo una dirección con etiqueta "Casa"
    Cuando intento guardar otra con etiqueta "casa"
    Entonces el sistema lo rechaza con un mensaje en español asociado al campo

  Escenario: HU11-E04 · Etiqueta o texto vacío
    Cuando intento guardar una dirección sin etiqueta o con el texto vacío
    Entonces el sistema lo rechaza con un mensaje en español asociado al campo

  Escenario: HU11-E05 · Cambiar la dirección predeterminada
    Dado dos direcciones guardadas, "Casa" como predeterminada
    Cuando marco "Trabajo" como predeterminada
    Entonces "Trabajo" queda predeterminada y "Casa" deja de estarlo

  Escenario: HU11-E06 · Editar el texto de una dirección
    Dado una dirección "Casa" ya guardada
    Cuando edito su texto
    Entonces mi lista muestra el texto nuevo bajo la misma etiqueta

  Escenario: HU11-E07 · Elegir una dirección guardada al confirmar
    Dado que tengo guardadas "Casa" y "Trabajo"
    Cuando confirmo un pedido y elijo "Trabajo"
    Entonces el pedido queda con el texto de "Trabajo"

  Escenario: HU11-E08 · Sin dirección no se puede confirmar
    Dado que no tengo direcciones guardadas ni indico una puntual
    Cuando intento confirmar mi pedido
    Entonces el sistema lo impide y muestra un mensaje en español pidiendo una dirección de entrega

  Escenario: HU11-E09 · La dirección del pedido queda congelada
    Dado un pedido ya confirmado con la dirección "Casa" = "Los Aromos 123"
    Cuando edito el texto de "Casa" a "Los Aromos 456"
    Entonces el pedido confirmado sigue mostrando "Los Aromos 123"
    Y mis pedidos nuevos con "Casa" usan "Los Aromos 456"

  Escenario: HU11-E10 · Dirección puntual sin guardar
    Dado que tengo guardada la dirección "Casa"
    Cuando confirmo un pedido indicando la dirección puntual "Oficina, Piso 4"
    Entonces ese pedido queda con "Oficina, Piso 4"
    Y mi lista de direcciones guardadas no cambia

  Escenario: HU11-E11 · Desactivar una dirección usada
    Dado una dirección "Trabajo" usada en un pedido anterior
    Cuando la desactivo
    Entonces deja de ofrecerse para pedidos nuevos
    Y el pedido anterior sigue mostrando su texto sin cambios

  Escenario: HU11-E12 · Desactivar la última dirección activa
    Dado una sola dirección activa, marcada como predeterminada
    Cuando la desactivo
    Entonces queda desactivada, ya no tengo dirección predeterminada
    Y puedo registrar otra o usar una dirección puntual al confirmar

  Escenario: HU11-E13 · Reactivar sin ninguna dirección activa
    Dado una dirección desactivada y ninguna dirección activa
    Cuando la reactivo
    Entonces vuelve a ofrecerse para pedidos nuevos
    Y queda marcada como predeterminada

  Escenario: HU11-E14 · Reactivar con otra ya predeterminada
    Dado una dirección desactivada y otra dirección activa que ya es predeterminada
    Cuando reactivo la primera
    Entonces ambas quedan activas y la predeterminada no cambia

  Escenario: HU11-E15 · Solo texto libre, sin mapa
    Dado que estoy registrando una dirección
    Cuando reviso el formulario
    Entonces solo encuentro campos de texto para la etiqueta y la dirección, sin ningún selector de mapa, pin o coordenadas
```

---

## Casos límite cubiertos

- El cliente con una sola dirección activa intenta retirarla: si ya fue
  usada se desactiva, si nunca fue usada puede eliminarse, y queda sin
  dirección predeterminada hasta registrar otra.
- Eliminar (no desactivar) una dirección que nunca se usó en ningún pedido
  no deja rastro, a diferencia de una que sí se usó.
- Dos direcciones con etiquetas que solo difieren en tildes, mayúsculas o
  espacios ("Casa" vs. "casa ") se tratan como la misma etiqueta.
- Retirar la dirección predeterminada cuando existen otras activas exige
  elegir primero una nueva predeterminada antes de continuar.
- Un texto de dirección compuesto solo de espacios en blanco se rechaza
  igual que uno vacío.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-001 | El cliente arma un carrito, le agrega una dirección y confirma un pedido en menos de 2 minutos, sin ayuda técnica. |
| SC-003 | En una validación con al menos 3 pedidos cuyas direcciones guardadas se editan o desactivan después de confirmarse, los 3 conservan el texto de entrega original. |
| SC-011 | El cliente con más de una dirección guardada elige la que corresponde a un pedido en 1 clic, sin tener que reescribirla. |

---

## Frontera con HU-01 — a respetar

HU-11 registra y administra direcciones; **no** decide cuándo se exige una
ni qué pasa con el pedido si falta — eso lo define HU-01 (FR-022). Al
confirmar, HU-01 copia el texto de la dirección elegida en ese instante
dentro del pedido (snapshot, RN-006): un cambio posterior a la dirección
guardada, hecho aquí, nunca altera un pedido ya confirmado.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Geolocalización, mapas, selección de pin o distancia estimada**
  (Principio X).
- **Tope explícito de direcciones por cliente**: ninguna historia lo pide;
  si el listado creciera lo suficiente para necesitar paginación, sería un
  requisito propio.
- **Validación de la dirección contra un servicio externo** (existencia
  real, formato postal): es texto libre, sin verificación.

---

## Qué construyó realmente (resumen de implementación)

- **`packages/shared`**: esquemas de creación y edición de dirección (10 a
  500 caracteres de texto, 2 a 60 de etiqueta); mensajes fijos de etiqueta
  duplicada, campos vacíos y "falta una dirección de entrega".
- **`services/api`**: el módulo `addresses`, exclusivo del rol `CLIENTE`.
  **Índice único parcial** sobre `(customer_id, WHERE is_default)` para
  garantizar a nivel de base de datos que exista como máximo una dirección
  predeterminada por cliente — no solo una comprobación de la aplicación,
  mismo patrón que luego reutilizará E5 para "un repartidor, un pedido a la
  vez".
- **`apps/web`**: `/cliente/direcciones`, con el formulario de alta/edición,
  el marcador de predeterminada y las acciones de desactivar/reactivar/
  eliminar; el selector de dirección dentro del flujo de confirmación de
  HU-01.
- **Verificación funcional**: 2026-08-18, junto con HU-12 y HU-01 (40 pasos
  en total). Sin defectos propios de esta historia; el único hallazgo de la
  spec completa fue el mensaje de Zod sin traducir en HU-01 (dirección
  puntual demasiado corta al confirmar). Detalle en
  `specs/003-gestion-pedidos/verificacion.md`.
