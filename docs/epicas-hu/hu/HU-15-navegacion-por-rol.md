# HU-15 — Navegación por rol

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E9 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E9 · Navegación y experiencia visual ya está construida y verificada, a
> partir de `specs/004-navegacion-por-rol/spec.md` (Historia de Usuario 1) y
> del código resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-16](./HU-16-identidad-visual-de-la-aplicacion.md), la otra historia de
> la misma spec, de la que HU-15 es prerrequisito: sin encabezado no hay
> dónde aplicar la identidad visual salvo el login.

**Como** cliente o como negocio, **quiero** moverme entre las pantallas de
mi rol sin escribir URLs a mano, **para** poder usar la aplicación como
cualquier producto con navegación esperable.

| Campo | Valor |
| --- | --- |
| **Épica** | E9 · Navegación y experiencia visual *(transversal)* |
| **Prioridad** | P1 dentro de su spec |
| **MVP (web)** | Sí |
| **Causa raíz** | E1 + E3 + E2 construyeron todas las pantallas que cliente y negocio necesitan, pero ninguna forma de moverse entre ellas: se llegaba a cada una escribiendo la URL a mano. |
| **Depende de** | E1 (rol, sesión, encabezado de administrador como precedente), E3 (categorías del catálogo para la fila de `/menu`), E2 (dirección predeterminada, `PUT /addresses/:id/default`, que el selector reutiliza) |
| **Consumida por** | HU-16 (necesita el encabezado ya construido para tener dónde aplicar la identidad visual) |

---

## Alcance de esta HU

**Qué entra**: un encabezado persistente para cliente (Menú, Carrito, Mis
pedidos) y para negocio (Pedidos, Productos, Categorías); el indicador
visual de la pantalla activa; el selector de dirección predeterminada en el
encabezado de cliente, con acceso a las demás direcciones activas y a
"Gestionar direcciones"; la fila de categorías con ícono en `/menu`,
sincronizada con el filtro "Tipo de comida" ya existente; el patrón
responsivo (barra superior en escritorio, barra inferior en mobile); la
redirección de las landing genéricas de cliente y negocio a su pantalla
principal; y, agregado en una tercera ronda de clarificación, el mismo
patrón visual de navegación para el encabezado del administrador,
conservando sus dos destinos ya existentes.

**Qué no entra**: ninguna capacidad de negocio nueva — la única acción con
efecto real (elegir dirección predeterminada) reutiliza la transición ya
construida en E2, no crea una nueva; la identidad visual del login y la
paleta compartida — eso es HU-16; navegación para el rol repartidor, que no
tiene pantallas propias en v1 y por tanto no tiene a dónde navegar.

---

## Por qué es transversal y no participa del orden de especificación

Esta épica no agrega ninguna capacidad de negocio nueva. Es exclusivamente
el molde que envuelve pantallas ya construidas y verificadas: no crea
endpoints ni reglas de negocio nuevas, y no introduce entidades de datos.
Por eso E9 es **transversal** y no participa del orden de especificación
E1→E3→E2→E4→E6→E5→E7→E8 (`docs/epicas-hu/EPICS.md`): no bloquea ni depende
de las épicas todavía sin construir en el momento en que se especificó.

---

## Reglas de negocio

- **Un rol con más de un destino real necesita cómo moverse entre ellos**
  (Principio III): el precedente es el propio administrador, que desde E1
  ya tenía encabezado con navegación (Panel, Usuarios) porque, a diferencia
  de cliente y negocio en ese momento, sí tenía más de una pantalla propia.
- **El selector de dirección no inventa una regla de negocio nueva**: elegir
  una dirección distinta desde el encabezado reutiliza tal cual
  `PUT /api/v1/addresses/:id/default`, ya construido y probado en E2 —
  cambia de verdad cuál es la predeterminada, no es una vista de solo
  lectura.
- **La fila de categorías y el filtro "Tipo de comida" son un solo criterio,
  no dos**: seleccionar desde cualquiera de los dos actualiza el mismo
  estado de filtrado (`foodTypeCategoryId`).
- **El repartidor queda fuera por la misma razón que ya excluyó a cliente y
  negocio en E1**: no tiene más de una pantalla propia en v1, así que no
  tiene a dónde navegar.
- **El encabezado del administrador conserva exactamente sus dos destinos**:
  Panel y Usuarios, los mismos desde E1; el rediseño visual no agrega
  navegación nueva.

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Navegación por rol

  Escenario: HU15-E01 · Encabezado de cliente con sus tres destinos
    Dado que inicié sesión con rol cliente
    Cuando estoy en cualquier pantalla de mi rol
    Entonces veo un encabezado con accesos a Menú, Carrito y Mis pedidos

  Escenario: HU15-E02 · Indicador de pantalla activa
    Dado que estoy en "/menu"
    Cuando miro el encabezado
    Entonces el destino "Menú" se distingue visualmente de los demás como la pantalla activa

  Escenario: HU15-E03 · Encabezado de negocio con sus tres destinos
    Dado que inicié sesión con rol negocio
    Cuando estoy en cualquier pantalla de mi rol
    Entonces veo un encabezado con accesos a Pedidos, Productos y Categorías

  Escenario: HU15-E04 · Dirección predeterminada visible en el encabezado
    Dado que tengo al menos una dirección de entrega registrada
    Cuando miro el encabezado de cliente
    Entonces veo la etiqueta y el texto de mi dirección predeterminada

  Escenario: HU15-E05 · Sin dirección, un acceso directo para registrarla
    Dado que no tengo ninguna dirección registrada
    Cuando miro el encabezado de cliente
    Entonces veo un acceso directo para registrar una, no un espacio vacío

  Escenario: HU15-E06 · Ver otras direcciones desde el selector
    Dado que tengo más de una dirección activa
    Cuando abro el selector de dirección del encabezado
    Entonces veo las demás direcciones activas y un acceso a "Gestionar direcciones"

  Escenario: HU15-E07 · Cambiar la predeterminada desde el encabezado
    Dado que tengo más de una dirección activa
    Cuando elijo una distinta desde el selector del encabezado
    Entonces esa dirección pasa a ser mi predeterminada de inmediato
    Y el encabezado la refleja, sin salir de la pantalla en la que estaba

  Escenario: HU15-E08 · Fila de categorías en el menú
    Dado que estoy en "/menu"
    Cuando miro debajo del encabezado
    Entonces veo una fila de categorías de tipo de comida con ícono y etiqueta, además del filtro "Tipo de comida" existente

  Escenario: HU15-E09 · Fila de categorías y filtro sincronizados
    Dado que selecciono una categoría desde la fila de íconos
    Cuando reviso el filtro "Tipo de comida"
    Entonces ambos reflejan la misma selección

  Escenario: HU15-E10 · Navegación mobile como barra inferior
    Dado que uso la aplicación desde una pantalla de ancho de celular
    Cuando miro la navegación
    Entonces aparece como una barra inferior en vez de un encabezado superior, sin recortar contenido

  Escenario: HU15-E11 · Cerrar sesión sin cambios de comportamiento
    Dado que estoy en cualquier pantalla de cliente o negocio
    Cuando uso "Cerrar sesión" desde el encabezado
    Entonces el comportamiento es el mismo ya construido en E1

  Escenario: HU15-E12 · Landing de cliente redirige al menú
    Dado que inicio sesión con rol cliente
    Cuando aterrizo en la aplicación
    Entonces llego directo a "/menu", sin una pantalla intermedia de botones

  Escenario: HU15-E13 · Landing de negocio redirige a pedidos
    Dado que inicio sesión con rol negocio
    Cuando aterrizo en la aplicación
    Entonces llego directo a "/negocio/pedidos", sin una pantalla intermedia de botones

  Escenario: HU15-E14 · El repartidor no cambia
    Dado que inicio sesión con rol repartidor
    Cuando aterrizo en la aplicación
    Entonces sigo viendo la misma pantalla de siempre, sin encabezado

  Escenario: HU15-E15 · Encabezado del administrador con el mismo patrón visual
    Dado que inicié sesión con rol administrador
    Cuando estoy en cualquier pantalla administrativa
    Entonces veo un encabezado con accesos a Panel y Usuarios, con marca e íconos igual que los de cliente y negocio

  Escenario: HU15-E16 · Indicador de pantalla activa en administrador
    Dado que estoy en "/admin/usuarios"
    Cuando miro el encabezado
    Entonces el destino "Usuarios" se distingue visualmente como la pantalla activa

  Escenario: HU15-E17 · Navegación mobile del administrador también en barra inferior
    Dado que uso la aplicación como administrador desde una pantalla de ancho de celular
    Cuando miro la navegación
    Entonces aparece como una barra inferior, igual que en cliente y negocio
```

---

## Casos límite cubiertos

- El cliente sin ninguna dirección guardada ve un acceso directo para
  registrar una, nunca un espacio vacío ni una dirección inventada.
- El cliente con exactamente una dirección no ve "otras direcciones" en el
  desplegable porque no existen, pero sí conserva el acceso a "Gestionar
  direcciones".
- El negocio sin pedidos pendientes sigue viendo los tres destinos del
  encabezado igual; no se fuerza ningún aviso adicional al ya existente en
  `/negocio/pedidos`.
- Si en el futuro se agregan más categorías al catálogo, la fila de íconos
  sigue funcionando sin rediseño, con desplazamiento horizontal y sin límite
  fijo.
- Si elegir una dirección distinta desde el encabezado falla (por ejemplo,
  un problema de red), se muestra un aviso de error en español, sin dejar
  el encabezado en un estado ambiguo sobre cuál dirección quedó
  predeterminada.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-001 | Una persona con rol cliente llega a cualquiera de las pantallas de su rol desde cualquier otra en un solo toque, sin escribir una URL. |
| SC-002 | Una persona con rol negocio llega a cualquiera de las pantallas de su rol desde cualquier otra en un solo toque. |
| SC-003 | Un cliente con al menos una dirección guardada ve su dirección predeterminada sin necesidad de navegar a otra pantalla. |
| SC-004 | Un cliente cambia el filtro de tipo de comida del menú en un solo toque desde la fila de categorías. |
| SC-005 | El 100 % de las pantallas de cliente y negocio construidas hasta esta épica expone la navegación persistente. |
| SC-006 | La navegación se usa sin recortar ni superponer contenido tanto en escritorio como en un ancho de celular. |
| SC-008 | Un cliente cambia su dirección predeterminada en un solo toque desde el encabezado, sin salir de la pantalla ni navegar a `/cliente/direcciones`. |
| SC-009 | Un cliente o negocio que inicia sesión llega directo a la pantalla principal de su rol, sin una pantalla intermedia que duplique el encabezado. |

---

## Frontera con HU-16 — a respetar

HU-15 construye **dónde** navegar y **qué** destinos existen; HU-16 decide
**cómo se ve** ese encabezado (marca, paleta, tipografía). HU-16 depende de
que HU-15 exista para tener dónde aplicarse: sin encabezado, la identidad
visual solo alcanzaría al login.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Navegación para el rol repartidor**: no tiene pantallas propias en v1.
- **Badges de conteo** (carrito, pedidos pendientes) en el encabezado:
  ninguna FR los pidió, aunque aparecían en el mockup de referencia.
- **Cualquier destino nuevo en el encabezado del administrador**: el
  rediseño visual (tercera ronda) es solo de presentación; Panel y Usuarios
  siguen siendo los únicos dos.
- **Auditoría formal de accesibilidad**: fuera de alcance de v1 desde E1;
  esta épica mantiene el patrón de foco visible ya usado en el resto del
  producto, sin ir más allá.

---

## Qué construyó realmente (resumen de implementación)

- **`apps/web`** únicamente — E9 no toca `services/api` ni
  `packages/shared`.
- **Shell de navegación por rol**: `cliente/layout.tsx` y
  `negocio/layout.tsx` (nuevos, mismo patrón que `admin/layout.tsx` desde
  E1), cada uno con su componente `_components/navegacion.tsx` — header
  superior en escritorio, barra inferior en mobile vía `hidden md:block` /
  `md:hidden`, sin duplicar componentes.
- **Selector de dirección** (`components/selector-direccion.tsx`): reutiliza
  `PUT /addresses/:id/default` de E2 para cambiar la predeterminada desde el
  encabezado — sin regla de negocio nueva.
- **`/menu` despacha el encabezado según `sesion.role`** dentro de
  `menu/page.tsx`, porque es una ruta compartida por los cuatro roles y no
  admite un `layout.tsx` anidado bajo `cliente/`. `admin` y `repartidor` no
  reciben header nuevo ahí.
- **Fila de categorías del menú** (`menu/_components/filtros-menu.tsx`):
  comparte la misma función `aplicar()` que el combobox "Tipo de comida" ya
  existente — un solo estado, no dos sincronizados.
- **`NavegacionAdmin` recibió el mismo rediseño que cliente y negocio**
  (segunda enmienda post-verificación, FR-017): marca, íconos, estado
  activo, barra mobile y `.tema-voz` en `admin/layout.tsx`. Sus dos
  destinos —Panel y Usuarios— no cambiaron. Su propia validación encontró
  un defecto de comparación de ruta: `/admin` es prefijo de toda ruta
  administrativa, así que "Panel" necesita comparación exacta, no
  `startsWith`, o queda marcado activo también en `/admin/usuarios`.
- **Verificación funcional**: 2026-08-19, sus 26 pasos (dos rondas de
  enmiendas incluidas). Ningún defecto de la validación en sí, pero sí dos
  correcciones después de darla por cerrada, al seguir usando la aplicación
  con el header ya puesto: las landing genéricas de cliente y negocio
  quedaron duplicando lo que el header ya ofrecía (FR-016), y el encabezado
  de administrador quedó con el estilo visual anterior a HU-16 (FR-017).
  Ambas se corrigieron con una enmienda chica a la spec antes de tocar el
  código. Detalle en `specs/004-navegacion-por-rol/verificacion.md`.
