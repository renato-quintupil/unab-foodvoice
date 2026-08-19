# Especificación de Funcionalidad: E9 · Navegación y experiencia visual

**Rama de funcionalidad**: `004-navegacion-por-rol` (el directorio de la spec es `specs/004-navegacion-por-rol`)

**Creada**: 2026-08-19

**Estado**: Borrador

**Épica**: E9 · Navegación y experiencia visual *(transversal)* — HU-15 (Navegación por rol), HU-16 (Identidad visual de la aplicación)

**Entrada**: Descripción del usuario: agregar un shell de navegación persistente para los roles cliente y negocio —hoy inexistente salvo en admin— más una identidad visual coherente (login, marca, paleta) extendida a esos encabezados, a partir de un mockup ya decidido con el usuario.

## Contexto y motivación

Hasta esta épica, E1 + E3 + E2 construyeron todas las pantallas que cliente y negocio necesitan (`/menu`, `/cliente/carrito`, `/cliente/direcciones`, `/cliente/pedidos` para cliente; `/negocio/pedidos`, `/negocio/productos`, `/negocio/categorias` para negocio), pero **ninguna forma de moverse entre ellas**: la pantalla de aterrizaje de cada rol es una lista de botones sueltos (`InicioDeRol`), y desde ahí en adelante no hay ningún encabezado ni navegación — solo se llega escribiendo la URL a mano. El único precedente es el rol administrador, que desde E1 tiene un encabezado con navegación propia (`NavegacionAdmin`: Panel, Usuarios, Cerrar sesión), construido bajo el mismo razonamiento que ahora se extiende a los otros dos roles: **cuando un rol tiene más de un destino real, necesita cómo moverse entre ellos** (Principio III de la constitución — no se construyó antes en cliente/negocio porque, en E1, esos roles todavía no tenían a dónde ir).

**Esta épica no agrega ninguna capacidad de negocio nueva.** Es exclusivamente el molde que envuelve pantallas ya construidas y verificadas: no crea endpoints ni reglas de negocio nuevas, y no introduce entidades de datos. La única acción con efecto real que agrega —elegir la dirección predeterminada desde el encabezado— **reutiliza** la transición ya construida en E2 (`PUT /api/v1/addresses/:id/default`), no crea una nueva. Por eso es **transversal** y no participa del orden de especificación E1→E3→E2→E4→E6→E5→E7→E8 (ver `docs/epicas-hu/EPICS.md`): no bloquea ni depende de las épicas todavía sin construir.

**El rol repartidor queda fuera de esta épica.** No tiene pantallas propias en v1 (`repartidor/page.tsx` es solo una página de entrada), por lo que no tiene a dónde navegar — el mismo criterio que ya excluyó a cliente y negocio de tener nav en E1.

**El rol administrador tampoco se modifica en esta épica.** Ya tiene su propio encabezado y navegación desde E1; esta épica no rediseña esa pantalla ni le aplica la nueva identidad visual, porque no existe mockup ni decisión tomada al respecto — extenderlo queda para una iteración futura si se decide explícitamente.

**El mockup ya fue decidido con el usuario** antes de escribir esta spec: cuatro referencias visuales (login, encabezado de cliente sobre `/menu`, encabezado de negocio sobre `/negocio/pedidos`, variante mobile) sirven de base a los requisitos de abajo. Las capturas quedan archivadas en `specs/004-navegacion-por-rol/design/`.

## Clarifications

### Session 2026-08-19

- Q: Cuando el cliente elige una dirección distinta desde el desplegable del encabezado, ¿esa selección debe cambiar de verdad cuál es su dirección predeterminada, o el desplegable es solo de lectura y el cambio real sigue requiriendo ir a `/cliente/direcciones`? → A: Sí cambia de verdad; el desplegable reutiliza `PUT /api/v1/addresses/:id/default`, ya construido y probado en E2, para marcarla como predeterminada de inmediato.

### Session 2026-08-19 (segunda ronda, tras verificación funcional)

- Q: Con el encabezado de HU-15 ya construido, `/cliente` y `/negocio` siguen mostrando su pantalla de aterrizaje genérica de E1/E3 (`InicioDeRol` en cliente, una lista de botones propia en negocio) con los mismos destinos que ahora también están en el encabezado — ¿se corrige dentro de esta épica o queda para otra? → A: Se corrige acá: ambas landing redirigen a la pantalla principal de su rol, porque el encabezado ya cubre lo que ofrecían. `/repartidor` no cambia — sigue usando `InicioDeRol` porque no tiene encabezado (FR-015) y "Ver el menú" sigue siendo su único destino.

## Roles de usuario en esta épica

- **Cliente**: ve un encabezado persistente con Menú, Carrito y Mis pedidos, más un selector de su dirección de entrega predeterminada. En `/menu` ve además una fila de categorías navegable.
- **Negocio**: ve un encabezado persistente con Pedidos, Productos y Categorías.
- **Repartidor**: sin cambios — no tiene pantallas propias en v1, fuera de alcance.
- **Administrador**: sin cambios — conserva el encabezado ya construido en E1, fuera de alcance de esta épica.

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Navegación por rol (HU-15) (Prioridad: P1)

Como cliente o como negocio, quiero moverse entre las pantallas de mi rol sin escribir URLs a mano, para poder usar la aplicación como cualquier producto con navegación esperable.

**Por qué esta prioridad**: sin esto, cada pantalla construida en E1/E3/E2 es una isla alcanzable solo por casualidad o memorizando rutas — es el defecto más visible de usabilidad que queda en el producto.

**Prueba independiente**: se puede probar por completo iniciando sesión como cliente o como negocio y navegando entre todas las pantallas de ese rol usando solo el encabezado, sin escribir ninguna URL — entrega valor por sí sola, sin depender de HU-16.

**Escenarios de Aceptación**:

1. **Dado** que inicié sesión con rol cliente, **Cuando** estoy en cualquier pantalla de mi rol, **Entonces** veo un encabezado con accesos a Menú, Carrito y Mis pedidos.
2. **Dado** que estoy en `/menu`, **Cuando** miro el encabezado, **Entonces** el destino "Menú" se distingue visualmente de los demás como la pantalla activa.
3. **Dado** que inicié sesión con rol negocio, **Cuando** estoy en cualquier pantalla de mi rol, **Entonces** veo un encabezado con accesos a Pedidos, Productos y Categorías.
4. **Dado** que tengo al menos una dirección de entrega registrada, **Cuando** miro el encabezado de cliente, **Entonces** veo la etiqueta y el texto de mi dirección predeterminada (ej. "Casa · Av. Providencia 1234").
5. **Dado** que no tengo ninguna dirección registrada, **Cuando** miro el encabezado de cliente, **Entonces** veo un acceso directo para registrar una, no un espacio vacío.
6. **Dado** que tengo más de una dirección activa, **Cuando** abro el selector de dirección del encabezado, **Entonces** veo las demás direcciones activas y un acceso a "Gestionar direcciones".
7. **Dado** que tengo más de una dirección activa, **Cuando** elijo una distinta desde el selector del encabezado, **Entonces** esa dirección pasa a ser mi predeterminada de inmediato y el encabezado la refleja, sin salir de la pantalla en la que estaba.
8. **Dado** que estoy en `/menu`, **Cuando** miro debajo del encabezado, **Entonces** veo una fila de categorías de tipo de comida con ícono y etiqueta, además del filtro "Tipo de comida" ya existente.
9. **Dado** que selecciono una categoría desde la fila de íconos, **Cuando** reviso el filtro "Tipo de comida", **Entonces** ambos reflejan la misma selección.
10. **Dado** que uso la aplicación desde una pantalla de ancho de celular, **Cuando** miro la navegación, **Entonces** aparece como una barra inferior en vez de un encabezado superior, sin recortar contenido.
11. **Dado** que estoy en cualquier pantalla de cliente o negocio, **Cuando** uso "Cerrar sesión" desde el encabezado, **Entonces** el comportamiento es el mismo ya construido en E1 (sin ningún aviso, FR-006 de E1).
12. **Dado** que inicio sesión con rol cliente, **Cuando** aterrizo en la aplicación, **Entonces** llego directo a `/menu`, sin una pantalla intermedia de botones que dupliquen el encabezado.
13. **Dado** que inicio sesión con rol negocio, **Cuando** aterrizo en la aplicación, **Entonces** llego directo a `/negocio/pedidos`, sin una pantalla intermedia de botones que dupliquen el encabezado.
14. **Dado** que inicio sesión con rol repartidor, **Cuando** aterrizo en la aplicación, **Entonces** sigo viendo la misma pantalla de siempre (`InicioDeRol`, con el acceso a "Ver el menú") — este rol no tiene encabezado, así que su landing no cambia.

---

### Historia de Usuario 2 - Identidad visual de la aplicación (HU-16) (Prioridad: P2)

Como usuario de cualquier rol, quiero que la aplicación se sienta como un mismo producto coherente y con identidad propia, para que transmita que la búsqueda/pedido por voz es lo que la distingue de una app de delivery genérica.

**Por qué esta prioridad**: depende de que exista el encabezado de HU-15 para tener dónde aplicarse de forma consistente; sin HU-15 solo alcanzaría al login.

**Prueba independiente**: se puede probar por completo comparando la pantalla de login con cualquier encabezado de HU-15 y verificando que comparten paleta, tipografía y marca — entrega valor por sí sola como mejora de percepción, incluso si HU-15 ya está probada por separado.

**Escenarios de Aceptación**:

1. **Dado** que abro la pantalla de inicio de sesión, **Cuando** la miro, **Entonces** veo una identidad visual (marca, paleta cálida, motivo de voz) distinta del formulario genérico anterior, con los mismos campos y comportamiento de antes.
2. **Dado** que ya inicié sesión, **Cuando** comparo el encabezado de mi rol con la pantalla de login, **Entonces** ambos comparten la misma paleta, tipografía y marca.
3. **Dado** que uso cualquier formulario o control ya existente (email, contraseña, botones), **Cuando** interactúo con él tras esta épica, **Entonces** su comportamiento funcional es idéntico al de antes — solo cambió su apariencia.

### Edge Cases

- ¿Qué ve el cliente en el selector de dirección si no tiene ninguna dirección guardada? → Un acceso directo para registrar una (escenario 5 de HU-15), nunca un espacio vacío ni una dirección inventada.
- ¿Qué ve el cliente si tiene exactamente una dirección? → Esa dirección es la predeterminada por regla ya construida en E2; el desplegable no ofrece "otras direcciones" porque no existen, pero sí conserva el acceso a "Gestionar direcciones".
- ¿Qué pasa si el negocio no tiene pedidos pendientes? → El encabezado sigue mostrando los tres destinos igual; no se fuerza ningún aviso adicional al ya existente en `/negocio/pedidos`.
- ¿Qué pasa si en el futuro se agregan más categorías de tipo de comida al catálogo? → La fila de íconos debe seguir funcionando sin rediseño (desplazamiento horizontal), sin límite fijo de categorías.
- ¿Qué pasa si elegir una dirección distinta desde el encabezado falla (por ejemplo, un problema de red)? → Se maneja igual que cualquier otra llamada a la API ya existente: aviso de error en español, sin dejar el encabezado en un estado ambiguo sobre cuál dirección quedó predeterminada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar un encabezado de navegación persistente en todas las pantallas del rol cliente, con accesos directos a Menú, Carrito y Mis pedidos.
- **FR-002**: El sistema DEBE mostrar un encabezado de navegación persistente en todas las pantallas del rol negocio, con accesos directos a Pedidos, Productos y Categorías.
- **FR-003**: El sistema DEBE indicar visualmente cuál destino del encabezado corresponde a la pantalla en la que la persona está parada.
- **FR-004**: El encabezado de cliente DEBE mostrar la etiqueta y el texto de la dirección de entrega predeterminada cuando exista al menos una dirección registrada.
- **FR-005**: Cuando el cliente no tenga ninguna dirección registrada, el encabezado DEBE ofrecer un acceso directo para registrar una, en vez de mostrar un espacio vacío.
- **FR-006**: El sistema DEBE permitir, desde el encabezado, ver las demás direcciones activas del cliente además de la predeterminada, y elegir una de ellas como nueva predeterminada, reutilizando la transición ya construida en E2 (`PUT /api/v1/addresses/:id/default`) sin crear una regla de negocio nueva.
- **FR-007**: El encabezado de cliente DEBE ofrecer un acceso directo a la pantalla de gestión de direcciones (`/cliente/direcciones`) ya existente.
- **FR-008**: La pantalla de menú (`/menu`) DEBE mostrar las categorías de tipo de comida del catálogo como una fila navegable con ícono distintivo y etiqueta por categoría, sin quitar el filtro "Tipo de comida" existente.
- **FR-009**: Seleccionar una categoría desde la fila de íconos y seleccionar la misma categoría desde el filtro "Tipo de comida" DEBEN reflejar y controlar el mismo criterio de filtrado.
- **FR-010**: El sistema DEBE ofrecer, en pantallas de ancho de celular, un patrón de navegación adaptado (barra inferior) distinto de la barra superior usada en escritorio, para los encabezados de cliente y negocio.
- **FR-011**: El encabezado DEBE mantener accesible la acción de cerrar sesión ya construida en E1, sin alterar su comportamiento.
- **FR-012**: La pantalla de inicio de sesión DEBE presentar una identidad visual (marca, paleta, tipografía) que exprese que la búsqueda/pedido por voz es el diferenciador del producto, sin agregar ni quitar ningún campo o comportamiento del formulario existente.
- **FR-013**: La paleta, tipografía y marca definidas para el login DEBEN aplicarse también a los encabezados de cliente y negocio de FR-001/FR-002, de modo que ambos roles compartan una identidad visual coherente con el login.
- **FR-014**: Esta épica NO DEBE alterar el comportamiento funcional de ninguna pantalla existente que no sea la landing de cliente o negocio (autenticación, carrito, direcciones, pedidos, catálogo) — los cambios son exclusivamente de navegación y presentación visual.
- **FR-015**: El encabezado del rol administrador y las pantallas del rol repartidor NO se modifican en esta épica.
- **FR-016**: Las pantallas de aterrizaje genéricas de cliente (`/cliente`) y negocio (`/negocio`) DEBEN redirigir a la pantalla principal de su rol (`/menu` y `/negocio/pedidos` respectivamente), porque el encabezado de FR-001/FR-002 ya ofrece los mismos destinos que esas landing mostraban como botones — mantenerlas sería navegación duplicada. La landing de repartidor (`/repartidor`) NO cambia: sigue siendo su única forma de llegar al menú, porque este rol no tiene encabezado (FR-015).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona con rol cliente llega a cualquiera de las pantallas de su rol (menú, carrito, direcciones, pedidos) desde cualquier otra en un solo toque, sin escribir una URL.
- **SC-002**: Una persona con rol negocio llega a cualquiera de las pantallas de su rol (pedidos, productos, categorías) desde cualquier otra en un solo toque.
- **SC-003**: Un cliente con al menos una dirección guardada ve su dirección de entrega predeterminada sin necesidad de navegar a otra pantalla.
- **SC-004**: Un cliente cambia el filtro de tipo de comida del menú en un solo toque desde la fila de categorías.
- **SC-005**: El 100% de las pantallas de cliente y negocio construidas hasta esta épica expone la navegación persistente — ninguna queda huérfana.
- **SC-006**: La navegación se usa sin recortar ni superponer contenido tanto en una pantalla de escritorio como en una de ancho de celular.
- **SC-007**: Una persona que ve el login y luego cualquier pantalla de cliente o negocio percibe ambas como el mismo producto, sin un cambio de identidad visual entre una y otra.
- **SC-008**: Un cliente cambia su dirección predeterminada en un solo toque desde el encabezado, sin salir de la pantalla en la que está ni navegar a `/cliente/direcciones`.
- **SC-009**: Un cliente o negocio que inicia sesión llega directo a la pantalla principal de su rol, sin pasar por una pantalla intermedia de botones que dupliquen el encabezado.

## Assumptions

- El rol repartidor no tiene pantallas propias en v1 (ya establecido desde E1), por lo que no requiere navegación en esta épica.
- El encabezado del administrador, ya construido en E1, no se modifica: no hay mockup ni decisión tomada para rediseñarlo junto con esta épica.
- La fila de categorías de `/menu` y el filtro "Tipo de comida" ya existente son dos vistas sincronizadas del mismo criterio de filtrado (`foodTypeCategoryId`), no un segundo mecanismo de filtrado independiente.
- El punto de quiebre entre el patrón de escritorio (barra superior) y el patrón mobile (barra inferior) sigue el mismo criterio responsivo ya usado en el resto de la aplicación.
- Las categorías de tipo de comida mostradas con ícono son las que ya existen en el catálogo de E3 (Pizzas, Sándwiches, Ensaladas); no se inventan categorías nuevas.
- Esta épica no requiere auditoría formal de accesibilidad (fuera de alcance de v1 desde E1), pero mantiene el patrón de foco visible ya usado en el resto del producto.
- No se requiere ninguna migración de datos ni cambio de esquema: HU-15 y HU-16 son exclusivamente de presentación y navegación sobre datos que ya existen.
