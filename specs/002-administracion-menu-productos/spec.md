# Especificación de Funcionalidad: E3 · Administración de menú

**Rama de funcionalidad**: `002-administracion-menu-productos` (el directorio de la spec es `specs/002-administracion-menu-productos`)

**Creada**: 2026-08-16

**Estado**: Borrador

**Épica**: E3 · Administración de menú — HU-02 (Administración de menú), HU-14 (Metadata y clasificación de productos)

**Entrada**: Descripción del usuario: especificación de la épica E3 de FoodVoice, con escenarios Gherkin, reglas de negocio, criterios de éxito, casos límite, semilla del catálogo y alcance excluido para HU-02 y HU-14.

## Contexto y motivación

El negocio necesita administrar su catálogo: qué vende, a qué precio, qué está disponible ahora mismo y cómo se organiza para que el cliente lo encuentre. El Principio VIII declara al catálogo la única fuente de verdad del producto: **no se puede buscar lo que no existe (E6) ni pedir lo que no existe (E2)**, de modo que el catálogo es prerequisito de ambas.

**E3 no llama a ninguna inteligencia artificial**: no hay modelo de lenguaje, ni servicio externo, ni clave de servicio. Lo que E3 sí hace es dejar guardados **los datos que la búsqueda por voz de E6 leerá más adelante**. Como E6 se construye después de que el catálogo esté cargado, esta épica es la única oportunidad de exigir que esos datos existan y estén bien escritos: una descripción vacía o pobre no rompe nada hoy, y rompe la búsqueda por voz mañana.

De ahí la asimetría que recorre toda la spec: los campos de texto —descripción del producto, descripción de la categoría— dejan de ser adorno y pasan a ser el índice sobre el que funcionará la voz. Por eso son obligatorios, tienen mínimos de longitud exigibles y los formularios enseñan a escribirlos.

**Principio que ordena el modelo de datos**: lo que se puede verificar con una consulta nunca se delega a un modelo de lenguaje. Precio, `activo` y `disponible` son datos duros; las descripciones son prosa. Que un producto esté agotado no puede depender de que alguien interprete bien una frase.

**Dependencia interna de la épica**: HU-14 (clasificación) → HU-02 (productos). Un producto no se puede dar de alta sin una categoría por cada dimensión obligatoria (RN-012), de modo que la taxonomía debe existir antes que el primer producto. Se especifican juntas porque comparten la misma entidad central —el Producto— y el mismo control de acceso por rol.

**Desvío declarado del orden sugerido**: `docs/epicas-hu/EPICS.md` propone E1 → E4 → E3 → E2. Esta épica se construye inmediatamente después de E1, adelantándose a E4. La consecuencia se declara aquí y se retoma en § Dependencias: los escenarios de esta spec que hablan de *pedidos ya creados* y del *carrito* no son verificables funcionalmente en E3, porque ninguna de las dos cosas existe todavía.

## Roles de usuario en esta épica

- **Negocio**: **único rol que administra el catálogo** —productos y categorías—. Es el actor de las dos historias de usuario.
- **Cliente**: consulta el menú, lo filtra por categoría y por tramo de precio. No lo edita. En E3 aún no puede agregar nada al carrito (§ Entrega por fases).
- **Repartidor**: consulta el menú en las mismas condiciones que el cliente. No lo edita.
- **Administrador**: consulta el menú en las mismas condiciones que el cliente. **No lo edita en v1**: HU-10 (E1) es de solo lectura por RN-004 de E1, y la acción administrativa sobre flujos críticos es HU-07, en E8.

Los cuatro roles y el mecanismo que los reconoce provienen de E1 (`specs/001-acceso-y-usuarios/spec.md`). Esta épica los consume, no los redefine.

## Clarifications

### Session 2026-08-16

- Q: ¿El menú del cliente muestra todos los productos activos de una vez o se pagina como el listado de administración? → A: Sin paginación; una sola pantalla desplazable, con los tramos calculados sobre el catálogo activo completo.
- Q: ¿La ficha de producto es una pantalla propia con dirección propia o se despliega dentro del listado del menú? → A: Pantalla propia con dirección propia; la de un producto no activo devuelve «no encontrado» en español.
- Q: ¿Qué productos ve el negocio en el listado de administración sin aplicar ningún filtro? → A: Solo los activos —disponibles y agotados—; los dados de baja se recuperan con el filtro de estado.
- Q: ¿Cómo se presenta un precio en pantalla? → A: `$4.990` — símbolo de peso, punto de miles, sin decimales, formateado una sola vez en `packages/shared`.
- Q: ¿Cuánto puede tardar como máximo en mostrarse el menú o el listado de administración? → A: Menos de 5 segundos con al menos 50 productos activos, medido con cronómetro como en E1 (SC-030).

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Clasificación de productos administrable por el negocio (HU-14) (Prioridad: P1)

El negocio organiza su catálogo en categorías que él mismo define y describe. Las categorías **no** son una lista fija en el código: viven en la base de datos y el negocio las crea, edita y desactiva desde su panel. Un local que empieza a vender poke no espera un despliegue para poder clasificarlo, y el equipo no puede acertar de antemano la lista correcta de un negocio que no conoce.

Lo que **sí** es fijo son las **dimensiones** —las preguntas que se le hacen a cada producto—, porque cada una tiene un desplegable propio en el alta y un filtro propio en el menú. En v1 son dos:

| Dimensión | Qué responde | Categorías de ejemplo |
|---|---|---|
| **Tipo de comida** | ¿Qué es este producto? | Pizzas · Hamburguesas · Completos · Ensaladas |
| **Perfil de salud** | ¿Cómo cae? | Saludable · Equilibrado · Indulgente |

Cada categoría tiene un **nombre** —lo que ve el cliente en el filtro— y una **descripción**, que es lo que leerá el modelo en E6. Con una descripción como «Hamburguesas, papas fritas, completos y frituras en general. Comida contundente, calórica y sabrosa; lo que la gente pide cuando quiere algo rico sin pensar en la dieta», frases como «quiero chatarra», «algo grasoso» o «para pecar» encontrarán la categoría **sin que nadie haya escrito esas expresiones en el sistema**. Eso sustituye a cualquier diccionario de sinónimos mantenido a mano: siempre estaría incompleto, y la descripción la escribe quien mejor conoce el producto.

**Por qué esta prioridad**: es P1 no por ser la más valiosa —la historia visible es el catálogo—, sino porque **es la única de las dos que es independientemente comprobable**. Sin al menos una categoría activa por dimensión no se puede dar de alta ningún producto (RN-012), de modo que HU-02 no es construible ni demostrable antes que ella.

**Prueba independiente**: se verifica íntegramente con un usuario de rol negocio y ningún producto en el sistema: crear categorías en ambas dimensiones, comprobar las validaciones de nombre y descripción, intentar duplicar un nombre dentro de una dimensión y repetirlo en la otra, editar, desactivar y reactivar. No requiere que HU-02 esté construida.

**Escenarios de Aceptación**:

```gherkin
Característica: Clasificación de productos

  Escenario: HU14-E01 · El negocio crea una categoría
    Dado que inicié sesión con rol "negocio"
    Cuando creo una categoría en "Tipo de comida" con nombre y descripción
    Entonces queda disponible en el alta de productos
    Y aparece como filtro en el menú del cliente

  Escenario: HU14-E02 · La descripción de la categoría es obligatoria
    Cuando dejo la descripción vacía o escribo menos de 30 caracteres
    O escribo 30 caracteres que solo repiten el nombre de la categoría
    Entonces el sistema lo rechaza con un mensaje en español asociado a ese campo
      que nombra la condición incumplida
    Y el formulario explica que la descripción permite encontrar la categoría por voz

  Escenario: HU14-E03 · El formulario enseña a describir una categoría
    Cuando llego al campo de la descripción
    Entonces veo un ejemplo de descripción bien escrita y una explicación en español

  Escenario: HU14-E04 · Nombre duplicado en la misma dimensión
    Dado que "Tipo de comida" ya tiene la categoría "Pizzas"
    Cuando intento crear "pizzas" en esa misma dimensión
    Entonces el sistema lo rechaza con un mensaje en español asociado al campo del nombre

  Escenario: HU14-E05 · Mismo nombre en dimensiones distintas sí se permite
    Dado que "Tipo de comida" tiene una categoría llamada "Saludable"
    Cuando creo "Saludable" en la dimensión "Perfil de salud"
    Entonces el sistema la acepta

  Escenario: HU14-E06 · La clasificación es obligatoria al dar de alta
    Cuando intento dar de alta un producto sin elegir tipo de comida
    Entonces el sistema lo rechaza con un mensaje en español asociado a ese campo

  Escenario: HU14-E07 · Una sola categoría por dimensión
    Cuando llego al campo de tipo de comida en el alta
    Entonces solo puedo elegir una categoría de esa dimensión

  Escenario: HU14-E08 · Desactivar una categoría
    Dado una categoría sin productos activos que dependan solo de ella
    Cuando la desactivo
    Entonces desaparece de los filtros del cliente y del alta de productos
    Y sigue visible en mi administración, marcada como desactivada

  Escenario: HU14-E09 · No se puede desactivar una categoría en uso
    Dado una categoría que es la única de su dimensión para tres productos activos
    Cuando intento desactivarla
    Entonces el sistema lo impide
    Y muestra en español cuántos productos lo bloquean

  Escenario: HU14-E10 · Las categorías no se borran
    Cuando consulto la administración de categorías
    Entonces no existe ninguna acción para eliminar una categoría definitivamente

  Escenario: HU14-E11 · Reclasificar un producto
    Dado un producto clasificado como "Pizzas" e "Indulgente"
    Cuando lo reclasifico como "Ensaladas" y "Saludable"
    Entonces el menú lo muestra bajo la nueva clasificación
    Y ya no aparece al filtrar por la anterior

  Escenario: HU14-E12 · Tramo de precio derivado del catálogo
    Dado un catálogo con productos de $2.000, $5.000 y $12.000
    Cuando se consultan los productos del tramo económico
    Entonces se obtiene el de $2.000 y no el de $12.000

  Escenario: HU14-E13 · El tramo se recalcula al cambiar el catálogo
    Dado un producto que hoy pertenece al tramo económico
    Cuando el negocio da de alta varios productos más baratos
    Entonces ese producto ya no aparece en el tramo económico

  Escenario: HU14-E14 · Catálogo demasiado pequeño para tramos
    Dado un catálogo con dos productos activos
    Cuando se consulta el tramo económico
    Entonces se obtienen ambos y la intención de precio no descarta ninguno

  Escenario: HU14-E15 · Filtro manual por categoría
    Dado que inicié sesión con rol "cliente"
    Cuando filtro el menú por "Pizzas"
    Entonces veo solo los productos activos de esa categoría
    Y los agotados aparecen marcados y no se pueden seleccionar para pedir

  Escenario: HU14-E16 · Un producto agotado no se ofrece por categoría
    Dado un producto "Saludable" marcado como agotado
    Cuando se consultan los productos saludables para ofrecer al cliente
    Entonces ese producto no se ofrece ni se sugiere

  Escenario: HU14-E17 · Combinación de dos filtros
    Cuando se consultan los productos económicos de la categoría "Saludable"
    Entonces se obtienen solo los que cumplen ambas condiciones
    Y no se sustituyen por productos que cumplan solo una

  Escenario: HU14-E18 · Reactivar una categoría desactivada
    Dado una categoría desactivada
    Cuando la reactivo
    Entonces vuelve a ofrecerse en el alta de productos y como filtro del cliente
    Y conserva su nombre y su descripción

  Escenario: HU14-E19 · Dimensión sin ninguna categoría activa
    Dado que "Perfil de salud" no tiene ninguna categoría activa
    Cuando entro al alta de productos
    Entonces el sistema me explica en español que falta crear la primera categoría de esa dimensión
    Y me ofrece ir a crearla
    Y no me permite guardar ningún producto hasta entonces
```

---

### Historia de Usuario 2 - Administración del menú de productos (HU-02) (Prioridad: P2)

El negocio da de alta y de baja productos, los describe bien y marca cuáles están disponibles ahora mismo, para que el cliente solo pueda pedir lo que realmente puede preparar.

**Los dos interruptores, que no son el mismo**:

| | `activo` | `disponible` |
|---|---|---|
| Qué significa | Está en el menú | Se puede preparar ahora |
| Frecuencia de cambio | Rara vez | Varias veces al día |
| Si es `false` | Desaparece del menú del cliente | **Sigue visible**, marcado «Agotado» |
| Se puede pedir | No | No |

Un producto **agotado** es activo con `disponible = false`. Un producto **dado de baja** es `activo = false`. **No hay borrado físico**: la baja es lógica y reversible, igual que con los usuarios en E1, porque un producto que estuvo en un pedido debe seguir siendo legible en ese pedido para siempre.

**Por qué esta prioridad**: es la historia que entrega el valor visible de la épica —el catálogo que el cliente ve y que E2 y E6 consumirán— pero no es construible antes que HU-14. P2 refleja el orden de construcción, no una menor importancia.

**Prueba independiente**: una vez existe al menos una categoría activa por dimensión (HU-14), se verifica íntegramente con un usuario de rol negocio y un usuario de rol cliente: dar de alta un producto completo, comprobar las validaciones de nombre, precio y descripción, marcarlo agotado y reponerlo, darlo de baja y reactivarlo, y comprobar desde la sesión del cliente qué ve en cada estado.

**Escenarios de Aceptación**:

```gherkin
Característica: Administración del menú

  Escenario: HU02-E01 · Alta de producto
    Dado que inicié sesión con rol "negocio"
    Cuando doy de alta un producto con nombre, descripción, precio y clasificación
    Entonces queda guardado y aparece en el menú del cliente
    Y queda marcado como disponible sin que yo haga nada más

  Escenario: HU02-E02 · Nombre duplicado rechazado
    Dado que el catálogo ya tiene "Pizza Napolitana"
    Cuando intento dar de alta "pizza napolitana"
    Entonces el sistema lo rechaza con un mensaje en español asociado al campo del nombre

  Escenario: HU02-E03 · Precio inválido rechazado
    Cuando ingreso un precio de cero, negativo o con decimales
    Entonces el sistema lo rechaza con un mensaje en español asociado al campo del precio

  Escenario: HU02-E04 · La descripción es obligatoria
    Cuando dejo la descripción vacía o escribo menos de 20 caracteres
    O escribo 20 caracteres repitiendo una misma palabra
    Entonces el sistema lo rechaza con un mensaje en español asociado a ese campo
      que nombra la condición incumplida
    Y el formulario explica que la descripción es lo que permite encontrar el producto por voz

  Escenario: HU02-E05 · El formulario enseña a describir
    Cuando llego al campo de la descripción
    Entonces veo junto al campo un ejemplo de descripción bien escrita
      y una explicación en español de para qué se usa

  Escenario: HU02-E06 · Ingredientes con advertencia
    Dado un producto con ingredientes declarados
    Cuando el cliente lo consulta
    Entonces la pantalla advierte en español que es información referencial
      y no una declaración de alérgenos

  Escenario: HU02-E07 · Marcar un producto como agotado
    Dado un producto activo y disponible
    Cuando lo marco como agotado
    Entonces el cliente sigue viéndolo con la marca "Agotado"
    Y no puede seleccionarlo para pedir

  Escenario: HU02-E08 · Reponer un producto agotado
    Cuando lo marco como disponible otra vez
    Entonces el cliente puede volver a seleccionarlo y la marca desaparece

  Escenario: HU02-E09 · Baja lógica y reactivación
    Dado un producto activo
    Cuando lo doy de baja
    Entonces desaparece del menú del cliente
    Y sigue en mi administración, marcado como dado de baja
    Y cuando lo reactivo, vuelve al menú con todos sus datos intactos

  Escenario: HU02-E10 · El cliente no ve productos dados de baja
    Dado que inicié sesión con rol "cliente"
    Cuando consulto el menú
    Entonces ningún producto dado de baja aparece por ningún medio

  Escenario: HU02-E11 · Solo el negocio administra el catálogo
    Dado que inicié sesión con rol "cliente"
    Cuando intento acceder a la administración del catálogo
    Entonces el sistema me lo impide con un mensaje en español

  Escenario: HU02-E12 · Menú vacío
    Dado que no hay ningún producto activo
    Cuando el cliente consulta el menú
    Entonces ve un mensaje en español explicando que todavía no hay productos
    Y la pantalla no muestra un error ni queda en blanco

  Escenario: HU02-E13 · Cambio de precio y pedidos ya creados
    Dado un pedido ya creado que incluye un producto de $5.000
    Cuando el negocio cambia ese precio a $6.000
    Entonces el pedido ya creado sigue mostrando $5.000
    Y los pedidos nuevos usan el precio actualizado

  Escenario: HU02-E14 · Catálogo grande
    Dado un catálogo con más de veinte productos
    Cuando consulto la administración del catálogo
    Entonces veo veinte productos por página y el total de resultados
    Y puedo filtrar por estado y por categoría, y buscar por nombre

  Escenario: HU02-E15 · Reactivación bloqueada por categoría desactivada
    Dado un producto dado de baja cuya categoría de tipo de comida fue desactivada entretanto
    Cuando intento reactivarlo
    Entonces el sistema lo impide con un mensaje en español que nombra la dimensión sin categoría activa
    Y me permite reclasificarlo para poder reactivarlo
```

---

### Casos Límite

- **Dimensión sin ninguna categoría activa**: no se puede dar de alta ningún producto. La pantalla de alta lo explica en español y ofrece ir a crear la primera categoría de esa dimensión, en lugar de mostrar un desplegable vacío (HU14-E19, FR-012).
- **Categoría sin ningún producto**: se lista normalmente en la administración y se ofrece como filtro al cliente; al filtrarla, el cliente ve el mensaje de «sin resultados» (FR-035). Una categoría vacía no es un error: es una categoría recién creada.
- **Categoría con todos sus productos agotados**: se sigue ofreciendo como filtro, y al aplicarla el cliente ve los productos marcados «Agotado». No se oculta la categoría: ocultarla haría desaparecer productos que el cliente sabe que existen.
- **Todos los productos con el mismo precio**: los tercios colapsan. Cualquier intención de precio devuelve el catálogo completo y **no descarta ninguno** (FR-032).
- **Empate en el borde del tercio**: dos productos con el mismo precio pertenecen siempre al mismo tramo, sin depender del orden en que se listen. Lo garantiza que el tramo se determine comparando el precio contra dos valores de corte, y no por la posición del producto en una lista (FR-032).
- **Catálogo con menos de tres productos activos**: no hay tramos. Una intención de precio no descarta ninguno (RN-016, HU14-E14).
- **Producto agotado o dado de baja que ya está en el carrito de un cliente**: se declara aquí y **se resuelve en HU-12 (E2)**, que es donde existe el carrito. E3 aporta la única mitad que le corresponde: la consulta del catálogo nunca devuelve un producto no ofrecible (RN-018).
- **Nombres con acentos, eñes o mayúsculas distintas**: la unicidad los pliega. «Ají», «aji» y «AJI» son el mismo nombre a efectos de FR-014 y FR-004, por la misma función normalizadora que E1 usa para buscar usuarios.
- **Descripción compuesta solo de espacios en blanco**: se considera ausente y se rechaza, tanto en el producto como en la categoría (FR-013, FR-003).
- **Descripción que alcanza el mínimo de caracteres pero no dice nada**: «rica rica rica rica rica rica» cumple los 20 caracteres y se rechaza igual, por las tres condiciones de FR-039. La longitud sola nunca fue el criterio: era el único que se había declarado. Lo que FR-039 **no** hace es juzgar si la prosa es buena —«Masa con queso encima y nada más» pasa—, y esa parte queda en manos de la ayuda contextual y de la revisión humana de la semilla (SC-032).
- **Producto sin ingredientes declarados**: es válido, porque el campo es opcional. La ficha no muestra la sección de ingredientes ni su advertencia (FR-017), y **la ausencia del dato no significa que el producto no contenga nada**: ninguna consulta puede descartarlo por un ingrediente que no declaró (§ Qué se guarda, RN-019).
- **Dos ediciones simultáneas del mismo producto desde dos pestañas**: prevalece el último cambio guardado, sin aviso al primero, con el mismo criterio que E1 adoptó para los usuarios. v1 no detecta la edición concurrente: con un solo local y un puñado de personas administrando el menú, el conflicto es improbable y una comprobación de versión sería alcance sin requisito (Principio I, Principio III). La consecuencia asumida —una edición puede pisar a otra— se declara aquí para que no se descubra como un defecto.
- **Producto dado de baja cuya categoría fue desactivada entretanto**: la baja es válida y la conserva (RN-009), pero su reactivación se bloquea hasta reclasificarlo (FR-021, HU02-E15). Sin esta regla, reactivar produciría un producto activo con una categoría inactiva, invisible para los filtros y en contra de RN-011.
- **Nombre de producto reutilizado tras una baja**: se rechaza. La unicidad alcanza a los dados de baja (RN-005), para que la reactivación siempre sea posible, con el mismo criterio con que E1 reserva el correo de un usuario desactivado.
- **Precio cambiado mientras un cliente tiene el menú abierto**: el cliente sigue viendo el precio anterior hasta que su pantalla vuelve a cargar. Es la consecuencia aceptada de SC-003, que exige el reflejo «en la siguiente carga de pantalla» y no en tiempo real.
- **Doble clic sobre «Agotado» o sobre «Guardar»**: produce un solo efecto. El control queda inutilizable hasta que llega la respuesta (FR-026), y el sistema se comporta correctamente aunque la petición llegue dos veces.

### Trazabilidad de escenarios

Cada escenario de aceptación lleva un identificador estable `HU<nn>-E<nn>` en su título. La tabla lo enlaza con el requisito que ejerce y el criterio de éxito que lo declara superado. **Ningún escenario queda sin las dos columnas**: si alguna vez un escenario no tuviera criterio de éxito, sería señal de que se está probando algo que la spec no exige.

La columna de *paso de validación* remite a los pasos `V-nn` de [`quickstart.md`](./quickstart.md) § Validación funcional, redactado en la fase de planificación. Los 34 escenarios tienen paso asignado; ninguno queda sin las tres columnas.

| Escenario | Requisitos | Criterios de éxito | Paso de validación |
|---|---|---|---|
| HU14-E01 · El negocio crea una categoría | FR-002, FR-027 | SC-009, SC-011 | V-01 |
| HU14-E02 · La descripción de la categoría es obligatoria | FR-003, FR-005, FR-039 | SC-008, SC-031 | V-03, V-04 |
| HU14-E03 · El formulario enseña a describir una categoría | FR-005 | SC-008, SC-009 | V-05 |
| HU14-E04 · Nombre duplicado en la misma dimensión | FR-004 | SC-014 | V-06 |
| HU14-E05 · Mismo nombre en dimensiones distintas sí se permite | FR-004 | SC-014 | V-07 |
| HU14-E06 · La clasificación es obligatoria al dar de alta | FR-012, FR-013 | SC-007 | V-18 |
| HU14-E07 · Una sola categoría por dimensión | FR-012 | SC-007 | V-19 |
| HU14-E08 · Desactivar una categoría | FR-007, FR-011 | SC-006, SC-015 | V-10 |
| HU14-E09 · No se puede desactivar una categoría en uso | FR-007 | SC-015 | V-09 |
| HU14-E10 · Las categorías no se borran | FR-009 | SC-006 | V-08 |
| HU14-E11 · Reclasificar un producto | FR-022, FR-031 | SC-011 | V-27 |
| HU14-E12 · Tramo de precio derivado del catálogo | FR-032 | SC-016 | V-34 |
| HU14-E13 · El tramo se recalcula al cambiar el catálogo | FR-032 | SC-016 | V-35 |
| HU14-E14 · Catálogo demasiado pequeño para tramos | FR-032 | SC-017 | V-36 |
| HU14-E15 · Filtro manual por categoría | FR-029, FR-031 | SC-004, SC-011, SC-018 | V-32 |
| HU14-E16 · Un producto agotado no se ofrece por categoría | FR-029 | SC-004 | V-51 |
| HU14-E17 · Combinación de dos filtros | FR-031, FR-032, FR-035 | SC-018 | V-33 |
| HU14-E18 · Reactivar una categoría desactivada | FR-008 | SC-006 | V-11 |
| HU14-E19 · Dimensión sin ninguna categoría activa | FR-012 | SC-010 | V-20 |
| HU02-E01 · Alta de producto | FR-012, FR-025, FR-028 | SC-001, SC-013 | V-13, V-14 |
| HU02-E02 · Nombre duplicado rechazado | FR-014 | SC-014 | V-15 |
| HU02-E03 · Precio inválido rechazado | FR-015 | SC-012 | V-17 |
| HU02-E04 · La descripción es obligatoria | FR-013, FR-016, FR-039 | SC-007, SC-031 | V-03, V-04 |
| HU02-E05 · El formulario enseña a describir | FR-016 | SC-007, SC-019 | V-05 |
| HU02-E06 · Ingredientes con advertencia | FR-017, FR-034 | SC-020 | V-38 |
| HU02-E07 · Marcar un producto como agotado | FR-019, FR-029 | SC-002, SC-003, SC-004 | V-21, V-22 |
| HU02-E08 · Reponer un producto agotado | FR-019, FR-029 | SC-002, SC-003 | V-23 |
| HU02-E09 · Baja lógica y reactivación | FR-020, FR-028 | SC-005, SC-006 | V-24, V-25 |
| HU02-E10 · El cliente no ve productos dados de baja | FR-028, FR-034 | SC-005 | V-39, V-51 |
| HU02-E11 · Solo el negocio administra el catálogo | FR-027 | SC-021 | V-50 |
| HU02-E12 · Menú vacío | FR-030 | SC-022 | V-40 |
| HU02-E13 · Cambio de precio y pedidos ya creados | FR-024 | SC-023 | V-53 |
| HU02-E14 · Catálogo grande | FR-023 | SC-024 | V-28, V-29 |
| HU02-E15 · Reactivación bloqueada por categoría desactivada | FR-021 | SC-010 | V-26 |

**Requisitos sin escenario Gherkin propio**: cuatro requisitos son transversales a todas las pantallas y no corresponden al comportamiento de un escenario concreto, de modo que se declaran superados por su criterio de éxito y no por un Gherkin. Son **FR-026** (doble disparo, SC-027), **FR-036** (semilla del catálogo, SC-026), **FR-037** (accesibilidad, SC-028) y **FR-038** (anchos de pantalla y navegadores, verificado junto a SC-028). El texto visible en español (SC-029) se comprueba del mismo modo, recorriendo todas las pantallas, y el umbral de tiempo de respuesta (SC-030) se comprueba con un cronómetro sobre el catálogo de referencia, sin escenario propio.

## Requisitos *(obligatorio)*

### Convenciones de interfaz y mensajería

Las convenciones transversales del producto —qué significa «mensaje claro y sin detalles técnicos», dónde se presenta cada tipo de mensaje, formato de fechas y huso horario de referencia— están declaradas en `specs/001-acceso-y-usuarios/spec.md` § Convenciones de interfaz y mensajería y **rigen íntegramente aquí**. No se repiten para no crear dos fuentes que puedan divergir. Esta sección añade únicamente lo que es propio del catálogo.

#### Vocabulario visible del catálogo

| Concepto | En pantalla se dice | Nunca se dice |
|---|---|---|
| Retirar un producto del menú | **Dar de baja** | «eliminar», «borrar», «desactivar», «archivar» |
| Devolver un producto al menú | **Reactivar** | «restaurar», «habilitar» |
| Producto que no se puede preparar ahora | **Agotado** | «sin stock», «no disponible», «suspendido» |
| Devolver un producto agotado al servicio | **Reponer** | «activar», «habilitar» |
| Retirar una categoría del uso | **Desactivar** | «eliminar», «borrar», «dar de baja» |
| Conjunto de preguntas fijas de clasificación | **Dimensión**, con su nombre visible: **Tipo de comida** y **Perfil de salud** | «eje», «faceta», «atributo» |

Los estados visibles del producto son **Disponible**, **Agotado** y **Dado de baja**; los de la categoría, **Activa** y **Desactivada**. Los identificadores internos nunca se muestran.

Los tres tramos de precio se nombran en pantalla **Económico**, **Medio** y **Caro**.

#### Presentación del precio

Todo precio visible —menú, ficha del cliente y listado de administración— se muestra como **`$4.990`**: símbolo de peso, **punto como separador de miles** y **sin decimales**, según la convención chilena. El formateo se declara **una sola vez en `packages/shared`** y ninguna pantalla lo improvisa, con el mismo criterio con que E1 centraliza el formato de fechas. Esto es solo presentación: el dato se guarda y se ingresa como un entero sin separadores (FR-015), y el campo de entrada del formulario no aplica el formato mientras se escribe.

#### Presentación de la descripción en los listados

Una descripción puede llegar a 1.000 caracteres, y eso no puede hacer ilegible una pantalla que muestra decenas de productos. La regla es la misma en los dos listados —el menú del cliente (FR-031) y el listado de administración (FR-023)—:

- En un **listado**, la descripción se muestra **recortada a un máximo de 160 caracteres**, cortando en el último espacio anterior al límite y añadiendo puntos suspensivos, de modo que nunca se parta una palabra. El recorte es **solo de presentación**: el dato guardado y el que devuelve la consulta están completos.
- En la **ficha de producto** (FR-034) y en los **formularios de edición**, la descripción se muestra **íntegra**, sin recorte ni control para desplegarla: es la pantalla donde el cliente decide, y en v1 no hay fotografías que la sustituyan.
- El recorte no cambia el resultado de ningún filtro ni de ninguna búsqueda, que operan siempre sobre el texto completo.

Se elige recortar en lugar de mostrar la descripción completa en el listado porque el menú del cliente no se pagina (FR-031): con doce descripciones largas seguidas, el desplazamiento haría inalcanzable el final del catálogo. Se descartó ocultarla del listado por completo, que dejaría al cliente eligiendo solo por nombre y precio.

#### Ayuda contextual de los campos de descripción

Los campos de descripción del producto (FR-016) y de la categoría (FR-005) deben mostrar, **junto al campo y visible antes de escribir nada** —no dentro del propio campo como texto de marca de agua, que desaparece al escribir—, dos cosas en español:

1. **Un ejemplo real y completo** de descripción bien escrita, del largo que se espera.
2. **Una explicación de para qué se usa**: que es el texto con el que el cliente podrá encontrar el producto o la categoría hablando, y que una descripción pobre hará que la voz lo encuentre mal.

Es exigible que ambas cosas estén presentes y sean legibles sin interacción previa; su ausencia se detecta mirando la pantalla.

#### Límites de los campos

Las mismas reglas rigen al crear y al editar, de modo que ninguna edición pueda dejar un registro en un estado que su alta habría rechazado. Un campo que solo contenga espacios se considera ausente. El mensaje de error indica **qué campo falla y por qué**, y queda asociado a ese campo.

**Todos los límites de longitud de esta sección son inclusivos**: una descripción de exactamente 20 caracteres se acepta, y una de exactamente 1.000 también. Se declara porque «entre 20 y 1.000» admite dos lecturas y la prueba del borde necesita saber cuál rige.

**Las descripciones son párrafo plano**, no texto con formato. Los saltos de línea, tabulaciones y cualquier otro espacio en blanco **se colapsan a un solo espacio** antes de validar y de guardar, con el mismo criterio con que ya se colapsan los espacios repetidos para comparar nombres. La consecuencia es doble y se declara: un salto de línea **separa palabras** a efectos de las tres condiciones de FR-039, y una descripción no puede contener listas, viñetas ni saltos intencionados —lo que se guarda es una sola línea de prosa, que es lo que E6 leerá y lo que el listado del menú puede pintar sin decidir nada—. El campo de ingredientes, en cambio, es **texto libre** y sí conserva los saltos que el negocio escriba.

**Producto**:

| Campo | Regla |
|---|---|
| Nombre | Obligatorio. Entre 2 y 120 caracteres, descartados los espacios de los extremos. Único en forma normalizada (FR-014) |
| Descripción | Obligatoria. Entre 20 y 1.000 caracteres, descartados los espacios de los extremos y colapsados los saltos de línea. Además, las tres condiciones de sustancia de FR-039 |
| Ingredientes | **Opcional**. Hasta 500 caracteres. Texto libre, sin estructura impuesta |
| Precio | Obligatorio. Entero en pesos chilenos, entre 1 y 10.000.000, sin decimales ni separadores |
| Tipo de comida | Obligatorio. Exactamente una categoría **activa** de esa dimensión |
| Perfil de salud | Obligatorio. Exactamente una categoría **activa** de esa dimensión |

**Categoría**:

| Campo | Regla |
|---|---|
| Dimensión | Obligatoria. Una de las dos fijas de FR-001. No editable después de crear la categoría |
| Nombre | Obligatorio. Entre 2 y 60 caracteres. Único en forma normalizada dentro de su dimensión (FR-004) |
| Descripción | Obligatoria. Entre 30 y 500 caracteres, descartados los espacios de los extremos y colapsados los saltos de línea. Además, las tres condiciones de sustancia de FR-039 |

#### Entrega por fases: lo que E3 no puede verificar por sí sola

Tres escenarios de esta épica mencionan cosas que no existen todavía. Se especifican completos aquí, y su **verificación funcional queda condicionada** a la épica que las construye. Se declara para que la limitación no se descubra como un defecto durante la validación.

| Escenario | Qué falta | Qué sí verifica E3 |
|---|---|---|
| HU02-E07, HU02-E08, HU14-E15 · «no se puede agregar al carrito» | El carrito, que es HU-12 (E2) | Que el producto se muestre marcado «Agotado» y que **no exista ninguna acción para seleccionarlo**, y que la consulta del catálogo no lo devuelva como ofrecible (FR-029) |
| HU02-E13 · pedidos ya creados conservan su precio | Los pedidos, que son E4/E2 | Que el cambio de precio rija hacia adelante y que E3 **no reescriba** ningún dato histórico; la obligación de que el pedido guarde su propio precio queda declarada como contrato hacia E2 (FR-024) |
| Caso límite del producto agotado ya presente en un carrito | El carrito, que es HU-12 (E2) | Que la consulta del catálogo nunca devuelva un producto no ofrecible (RN-018) |

En los tres casos, E3 entrega **su mitad del contrato**; la otra mitad se verifica cuando exista la épica correspondiente.

### Requisitos Funcionales — HU-14 · Metadata y clasificación de productos

- **FR-001**: El sistema DEBE contar con exactamente **dos dimensiones de clasificación fijas** —**Tipo de comida** y **Perfil de salud**—, presentes desde el arranque y provistas por la semilla (FR-036). Ambas son **obligatorias**: todo producto activo tiene exactamente una categoría de cada una (RN-011). Las dimensiones NO son administrables por ningún rol en v1: no se crean, no se editan, no se desactivan y no se reordenan desde la aplicación. Son fijas porque cada una tiene un desplegable propio en el alta de productos y un filtro propio en el menú; hacerlas administrables obligaría a generar formularios y filtros dinámicos, complejidad anticipada sin requisito que la pida (Principio I, Principio III).

- **FR-002**: El sistema DEBE permitir al rol negocio **crear una categoría** dentro de una de las dos dimensiones, indicando su nombre y su descripción. La categoría queda **activa** desde su creación y disponible de inmediato tanto en el alta de productos como entre los filtros del menú del cliente, sin ningún paso adicional de publicación.

- **FR-003**: El sistema DEBE validar los campos de la categoría según la tabla de § Límites de los campos, con un mensaje en español **asociado al campo que falla** (Principio II). En particular, la descripción es **obligatoria y de al menos 30 caracteres**: no es un mínimo arbitrario sino el umbral por debajo del cual una descripción deja de ser prosa útil para E6 y se convierte en una repetición del nombre. La longitud no basta por sí sola: la descripción DEBE cumplir además las tres condiciones de sustancia de **FR-039**. Una descripción compuesta solo de espacios se considera ausente.

- **FR-004**: El sistema DEBE impedir que existan dos categorías con el mismo nombre **dentro de una misma dimensión**, comparándolos en forma normalizada con la misma función de normalización de `packages/shared` que E1 emplea para buscar usuarios —descomposición, eliminación de acentos, minúsculas, colapso de espacios y recorte—. La unicidad alcanza también a las **categorías desactivadas**, de modo que su reactivación siempre sea posible. El mismo nombre **sí** puede existir en dimensiones distintas: «Saludable» puede ser a la vez un tipo de comida y un perfil de salud, y son dos categorías independientes.

- **FR-005**: El formulario de categoría DEBE mostrar, junto al campo de la descripción, un ejemplo de descripción bien escrita y una explicación en español de para qué se usa, según § Ayuda contextual de los campos de descripción.

- **FR-006**: El sistema DEBE permitir al rol negocio **editar el nombre y la descripción** de una categoría existente, con las mismas reglas de validación que su creación (FR-003, FR-004). **La dimensión no es editable**: cambiarla movería de golpe todos los productos clasificados con ella a otra pregunta distinta, sin que nadie lo hubiera pedido producto a producto. Para cambiar de dimensión se crea una categoría nueva y se reclasifican los productos (FR-022). Los cambios de nombre y descripción rigen **de inmediato** para las consultas siguientes y no afectan a ningún pedido ya creado.

- **FR-007**: El sistema DEBE permitir al rol negocio **desactivar** una categoría, y DEBE **impedirlo** cuando esa categoría sea la única de su dimensión para al menos un **producto activo**. El rechazo DEBE indicar en español **cuántos productos activos lo bloquean**, para que el negocio sepa el tamaño del trabajo que tiene por delante y no descubra el problema producto a producto. La comprobación se realiza en el momento de aplicar la desactivación, no solo al pintar la pantalla.

- **FR-008**: El sistema DEBE permitir al rol negocio **reactivar** una categoría previamente desactivada, conservando su nombre, su descripción y su dimensión. Al reactivarse vuelve a ofrecerse en el alta de productos y como filtro del cliente.

- **FR-009**: El sistema NO DEBE ofrecer **ninguna acción que elimine una categoría de forma definitiva**, en ninguna pantalla ni por ningún punto de entrada. La desactivación (FR-007) es el único camino de retirada, y es reversible (FR-008).

- **FR-010**: El sistema DEBE permitir al rol negocio **listar las categorías** de la administración agrupadas o filtrables por dimensión y filtrables por estado (activa/desactivada), mostrando el estado de cada una. Las desactivadas siguen siendo visibles en esta vista; solo desaparecen de los filtros del cliente y del alta de productos (FR-011).

- **FR-011**: Una categoría desactivada NO DEBE ofrecerse ni en los filtros del menú del cliente ni en los desplegables del alta y la edición de productos. Los productos que ya la tenían **la conservan**: la desactivación de una categoría nunca modifica la clasificación de ningún producto. Esto solo puede ocurrir con productos dados de baja o con la otra dimensión aún cubierta, porque FR-007 impide desactivar una categoría de la que dependa un producto activo.

### Requisitos Funcionales — HU-02 · Administración del menú

- **FR-012**: El sistema DEBE permitir al rol negocio **dar de alta un producto** con nombre, descripción, ingredientes (opcionales), precio y **exactamente una categoría activa por cada dimensión obligatoria**. Al guardarse, el producto queda **activo y disponible** sin ninguna acción adicional. El formulario DEBE ofrecer **un desplegable por dimensión que admita una sola selección**; no es admisible una selección múltiple deshabilitada por validación posterior. Cuando una dimensión **no tiene ninguna categoría activa**, el sistema NO DEBE mostrar un desplegable vacío: DEBE explicar en español que falta crear la primera categoría de esa dimensión, ofrecer ir a crearla e impedir guardar el producto hasta entonces.

- **FR-013**: El sistema DEBE validar los campos del producto según la tabla de § Límites de los campos, con un mensaje en español **asociado al campo que falla** (Principio II). La validación es idéntica al crear (FR-012) y al editar (FR-018).

- **FR-014**: El sistema DEBE impedir que existan dos productos con el mismo nombre, comparándolos en forma normalizada con la misma función de `packages/shared` que emplea FR-004. La unicidad alcanza también a los **productos dados de baja**, cuyo nombre queda reservado para que su reactivación siempre sea posible. El rechazo se presenta con un mensaje en español asociado al campo del nombre.

- **FR-015**: El sistema DEBE aceptar como precio únicamente un **entero en pesos chilenos mayor que cero y sin decimales**, dentro de los límites de § Límites de los campos. Un valor de cero, negativo, con decimales o no numérico DEBE rechazarse con un mensaje en español asociado al campo del precio, indicando cuál de las condiciones se incumplió. El sistema NO DEBE redondear ni truncar en silencio un precio con decimales: lo rechaza y el negocio lo sabe. Al **mostrarlo**, todo precio se presenta según § Presentación del precio (`$4.990`); la entrada y el almacenamiento siguen siendo el entero sin separadores.

- **FR-016**: El sistema DEBE exigir una **descripción de al menos 20 caracteres** para todo producto, que cumpla además las tres condiciones de sustancia de **FR-039**, y el formulario DEBE mostrar junto al campo un ejemplo y una explicación en español según § Ayuda contextual de los campos de descripción. El mínimo no es una regla de formato: la descripción es el índice sobre el que funcionará la búsqueda por voz de E6, y esta épica es el único momento del proyecto en que se puede exigir que exista.

- **FR-017**: El sistema DEBE permitir registrar **ingredientes** como texto libre opcional, y DEBE mostrarlos al cliente cuando existan. Junto a ellos, y siempre que se muestren, la interfaz DEBE advertir en español que se trata de **información referencial y no de una declaración de alérgenos**. La advertencia es obligatoria y no configurable: sin ella, un cliente con una alergia podría tomar la ausencia de un ingrediente en la lista como una garantía que el sistema no da (§ Fuera de Alcance).

- **FR-018**: El sistema DEBE permitir al rol negocio **editar** nombre, descripción, ingredientes, precio y clasificación de un producto existente, con las mismas reglas de validación que el alta (FR-013, FR-014, FR-015). Los cambios rigen **de inmediato** para las consultas siguientes.

- **FR-019**: El sistema DEBE permitir al rol negocio **marcar un producto como agotado y reponerlo**, y DEBE ofrecer ambas acciones **directamente desde el listado de administración, en dos clics o menos**, sin obligar a entrar a la ficha del producto ni a pasar por un diálogo de confirmación. Es la única acción de la épica exenta de confirmación, y la exención es deliberada: ocurre varias veces al día en medio del servicio, es inmediatamente reversible con la acción contraria y no destruye ningún dato. Un producto agotado **sigue siendo activo**: permanece visible para el cliente, marcado (FR-029).

- **FR-020**: El sistema DEBE permitir al rol negocio **dar de baja** un producto y **reactivarlo**, pidiendo confirmación explícita y cancelable en ambos casos (Principio IX), indicando en español qué producto se ve afectado y qué efecto tiene. Dar de baja **no elimina** el producto ni sus datos, y no lo retira de ningún pedido ya creado (RN-008). Al reactivarlo, el producto vuelve al menú **con todos sus datos intactos** —nombre, descripción, ingredientes, precio y clasificación—, en el estado disponible.

- **FR-021**: El sistema DEBE **impedir la reactivación** de un producto cuando alguna de sus categorías esté desactivada, con un mensaje en español que nombre la dimensión afectada, y DEBE ofrecer reclasificarlo para poder reactivarlo. Sin esta regla, una reactivación produciría un producto activo con una categoría inactiva: invisible para los filtros del cliente y en contra de RN-011.

- **FR-022**: El sistema DEBE permitir al rol negocio **reclasificar** un producto, cambiando su categoría en una o en ambas dimensiones. El cambio rige de inmediato: el producto pasa a aparecer al filtrar por la categoría nueva y deja de aparecer al filtrar por la anterior. No afecta a ningún pedido ya creado.

- **FR-023**: El sistema DEBE permitir al rol negocio **listar los productos** de la administración con **paginación de 20 por página e indicación del total de resultados**, **filtro por estado** (disponible, agotado, dado de baja) y **por categoría**, y **búsqueda por texto sobre el nombre**, todo combinable entre sí. **Sin ningún filtro aplicado, el listado muestra únicamente los productos activos —disponibles y agotados—**, y los dados de baja se ven eligiendo ese estado en el filtro: el trabajo cotidiano del negocio es sobre el menú vigente, y una baja es la excepción. Que estén ocultos por defecto no los hace inaccesibles: el filtro los recupera en un clic, y siguen siendo visibles en la administración según FR-020. La búsqueda DEBE encontrar coincidencias parciales, sin distinguir mayúsculas de minúsculas ni acentos, con el mismo criterio y la misma función normalizadora que el listado de usuarios de E1 (FR-015 de E1). El listado DEBE presentarse en un **orden estable y predecible: del alta más reciente a la más antigua**, para que un mismo conjunto de criterios devuelva siempre los mismos productos en la misma página. Cuando la combinación no produce resultados, DEBE mostrarse el mensaje de «sin resultados» en español (FR-035). Si el listado muestra la descripción, la presenta recortada según § Presentación de la descripción en los listados.

- **FR-024**: Todo **cambio de precio rige hacia adelante**. El sistema NO DEBE modificar, recalcular ni reescribir ningún dato de un pedido ya creado al cambiar el precio de un producto. Como contrato hacia E2: el pedido DEBE conservar el precio con el que se creó cada una de sus líneas, guardándolo en el momento de crearse, y no consultarlo del catálogo al mostrarse. E3 entrega su mitad —el catálogo guarda el precio vigente y no toca el pasado—; la otra mitad se verifica cuando existan los pedidos (§ Entrega por fases).

- **FR-025**: Tras aplicar cualquier acción sobre el catálogo —alta, edición, agotar, reponer, dar de baja, reactivar y reclasificar productos; crear, editar, desactivar y reactivar categorías— el sistema DEBE mostrar una **confirmación de éxito en español** que nombre el elemento afectado y la acción realizada. La confirmación aparece solo cuando el cambio quedó firme; si la acción se rechaza, se muestra el mensaje de error correspondiente y nunca ambos.

- **FR-026**: Toda acción que espere respuesta del sistema DEBE mostrar que está en curso e **impedir que se dispare dos veces**: el control que la inició queda inutilizable hasta que llega la respuesta. El resguardo es de interfaz y no la única defensa: el sistema DEBE seguir comportándose correctamente si la petición llega dos veces —rechazando el nombre duplicado (FR-004, FR-014) y tratando como sin efecto la petición que no cambia nada (FR-019, FR-020)—.

- **FR-027**: El sistema DEBE restringir **toda** administración del catálogo —productos y categorías— exclusivamente al rol **negocio**, apoyándose en el mecanismo de autenticación y rol de E1. El rechazo DEBE producirse **al procesar la acción, no solo al pintar la pantalla**: ocultar la opción en la interfaz no cumple este requisito. La restricción alcanza por igual a la navegación desde la interfaz, a la escritura directa de una dirección en el navegador y a la llamada directa al punto de entrada sin pasar por la interfaz, con el mismo resultado en los tres casos. El rechazo se presenta como una **página propia** con el mensaje en español y un enlace a la página de inicio del rol de esa persona, según § Convenciones de interfaz de E1. La sesión no se cierra.

### Requisitos Funcionales — Consulta del menú

Aplican a los roles cliente, repartidor y administrador, que consultan el catálogo sin editarlo.

- **FR-028**: El sistema DEBE mostrar a cliente, repartidor y administrador **únicamente productos activos**. Un producto dado de baja NO DEBE aparecer **por ningún medio**: ni en el listado, ni al filtrar por su categoría, ni al filtrar por tramo de precio, ni accediendo directamente a su ficha por su dirección, ni en la respuesta de ninguna consulta del catálogo. El requisito se comprueba también **sin usar la interfaz**, invocando directamente el punto de entrada de consulta.

- **FR-029**: El sistema DEBE mostrar los productos **agotados** —activos con `disponible = false`— **marcados en pantalla con la etiqueta «Agotado»**, y NO DEBE ofrecer ninguna acción para seleccionarlos, pedirlos o agregarlos a un carrito. Un producto agotado **nunca se ofrece ni se sugiere** por ninguna vía de consulta, aunque cumpla el filtro aplicado (Principio VIII, RN-018). La marca es visible sin interacción previa: no basta con deshabilitar un botón.

- **FR-030**: Cuando no existe **ningún producto activo**, el menú DEBE mostrar un mensaje en español explicando que todavía no hay productos, y no un error, una pantalla en blanco ni un indicador de carga permanente (Principio II, Principio IV).

- **FR-031**: El sistema DEBE ofrecer al cliente un **filtro manual por categoría de cada dimensión**, con las categorías activas de esa dimensión, **combinables entre sí y con el filtro de tramo de precio** (FR-032). El filtro devuelve solo los productos activos de esa categoría; los agotados aparecen marcados (FR-029). El menú del cliente **NO se pagina**: muestra en una sola pantalla desplazable todos los productos activos que cumplen los filtros aplicados, a diferencia del listado de administración, que sí pagina de 20 en 20 (FR-023). La paginación del menú se descartó por el volumen de un catálogo mono-local y para no construir un segundo mecanismo de recorrido; los tramos de precio se calculan siempre sobre el catálogo activo completo y nunca sobre lo que se está mostrando (FR-032). Cada producto del listado muestra su descripción **recortada** según § Presentación de la descripción en los listados, y completa en su ficha (FR-034): sin paginación, doce descripciones de 1.000 caracteres harían inalcanzable el final del catálogo. Este requisito da cumplimiento al Principio VI: **todo lo que E6 podrá resolver por voz debe ser alcanzable con estos filtros**, sin micrófono.

- **FR-032**: El sistema DEBE **derivar los tramos de precio en el momento de la consulta**, sobre los productos **activos** —incluidos los agotados—, y **NO DEBE persistirlos** ni ofrecer ningún campo de tramo en el alta o la edición de productos. La derivación se define así, de forma que dos productos con el mismo precio caigan siempre en el mismo tramo con independencia del orden en que se listen:

  1. Sea `P` la lista de precios de los productos activos, ordenada de menor a mayor, y `n` su cantidad.
  2. Si `n < 3`, o si **todos los precios son iguales**, no hay tramos: **cada producto pertenece a los tres**, y una intención de precio no descarta ninguno (RN-016).
  3. En otro caso se calculan dos **precios de corte**: `c1` es el precio que ocupa la posición `techo(n/3)` de `P`, y `c2` el que ocupa la posición `techo(2n/3)`.
  4. Un producto es **Económico** si su precio es `≤ c1`; **Medio** si está entre `c1` (excluido) y `c2` (incluido); **Caro** si es `> c2`.

  La clasificación depende **solo del valor del precio**, nunca de la posición del producto en una lista. En un catálogo con precios muy agrupados, los tramos Medio o Caro **pueden quedar vacíos**; en ese caso la consulta devuelve el mensaje de «sin resultados» (FR-035) y NO DEBE sustituirlos por productos de otro tramo. Un umbral fijo se descartó porque envejece con la inflación y no sirve igual para empanadas que para sushi; la consecuencia aceptada es que «económico» es siempre **relativo al catálogo**, que es exactamente lo que corresponde a «muéstrame lo más barato que tienes».

- **FR-033**: Toda capacidad de búsqueda que E6 vaya a ofrecer por voz DEBE tener en E3 su **equivalente manual funcionando** (Principio VI, NO NEGOCIABLE): filtro por tipo de comida, filtro por perfil de salud, filtro por tramo de precio, todos combinables, y el listado completo de productos disponibles como recomendación abierta. E3 NO DEBE incorporar ningún elemento de voz: no hay micrófono, ni permiso de audio, ni llamada a ningún modelo de lenguaje en esta épica.

- **FR-034**: La ficha de producto visible al cliente DEBE ser una **pantalla propia, con su propia dirección estable por producto**, enlazada desde el listado del menú, y DEBE mostrar **nombre, descripción, precio y estado**, y los **ingredientes con su advertencia** (FR-017) cuando existan. Cuando la dirección corresponde a un producto **no activo** o inexistente, el sistema DEBE responder con la página de **«no encontrado» en español**, sin revelar ningún dato del producto ni distinguir entre «dado de baja» e «inexistente» (FR-028). Un producto **agotado** sí tiene ficha visible, marcada «Agotado» y sin ninguna acción para pedirlo (FR-029). La descripción se muestra al cliente y no es un dato solo para máquinas: es también lo que le permite decidir sin fotografías, que no existen en v1 (§ Fuera de Alcance).

- **FR-035**: Cuando una combinación de filtros o una búsqueda no produce resultados, el sistema DEBE mostrar un **mensaje claro en español** indicando que no hay productos para esos criterios, en lugar de una pantalla vacía sin explicación, y **NO DEBE sustituir el resultado** por productos que cumplan solo parte de los criterios. Ofrecer algo distinto a lo pedido sin decirlo contradice el Principio VII y el IX.

- **FR-036**: El sistema DEBE incluir una **semilla idempotente del catálogo**, con cantidades mínimas declaradas para que su suficiencia sea comprobable y no una apreciación:

  | Qué carga | Mínimo exigible |
  |---|---|
  | Dimensiones | Las **dos** de FR-001; sin ellas la aplicación no funciona |
  | Categorías activas | **Al menos tres por dimensión**, con descripción que cumpla FR-003 y FR-039 |
  | Productos activos | **Al menos doce**, repartidos de modo que existan los **tres tramos de precio** y que cada categoría de la semilla tenga al menos un producto |
  | Ingredientes | **Declarados en todos** los productos de la semilla, pese a ser opcionales en general (FR-017) |

  Sus descripciones no se limitan a cumplir el mínimo mecánico de FR-039: son **contenido real y revisado a mano** —el de un local verosímil—, y cada una menciona algo que el nombre no dice. Doce productos y tres categorías por dimensión son el mínimo con el que los tres tramos de precio existen de verdad, un filtro combinado devuelve resultados y otro devuelve el mensaje de «sin resultados»; con menos, la demostración no ejercita lo que la épica exige. La semilla se puede ejecutar varias veces sin duplicar nada ni sobrescribir cambios hechos a mano sobre los mismos registros; **reconoce un registro ya existente por su nombre en forma normalizada** (FR-004, FR-014), y en ese caso lo deja intacto. No es un adorno: sin ella E6 no se puede verificar a mano por una persona no técnica (Principio IV), no se pueden probar las frases de ejemplo del Principio XI, y la demostración final dependería de que alguien cargue datos la noche anterior. **El riesgo real de E3 no está en el esquema, está en la calidad del contenido**, y la semilla es donde ese contenido queda fijado y revisable.

- **FR-037**: Las pantallas de esta épica DEBEN cumplir las cuatro condiciones de accesibilidad ya declaradas en E1 (FR-039 de E1): recorrido y operación **solo con teclado**, incluidos los diálogos de confirmación de FR-020; **foco visible** en todo momento; **etiqueta asociada** a cada campo de formulario, con su mensaje de error asociado al campo y no suelto en la página; y **contraste suficiente** del texto frente a su fondo. La auditoría formal de conformidad y las pruebas con lectores de pantalla reales siguen fuera del alcance de v1.

- **FR-038**: La aplicación DEBE ser usable en pantallas desde **360 píxeles de ancho** hasta las de escritorio, sin que ningún contenido quede inalcanzable: el listado de productos, que tiene más columnas que el de usuarios, se desplaza o se reorganiza, pero no se recorta. Los navegadores contemplados son los mismos que declaró E1 (FR-040 de E1).

- **FR-039**: Toda descripción —de producto (FR-016) y de categoría (FR-003)— DEBE cumplir, además de su mínimo de caracteres, **tres condiciones de sustancia comprobables por el sistema**, y su incumplimiento DEBE rechazarse con un mensaje en español asociado al campo que explique **cuál de las tres falló**:

  1. **Al menos cinco palabras** de dos o más caracteres, contadas tras colapsar los espacios —**incluidos los saltos de línea y las tabulaciones**, que separan palabras como cualquier otro espacio (§ Límites de los campos)—.
  2. **No es una repetición del nombre**: en forma normalizada —la misma función de FR-004 y FR-014—, la descripción no puede ser igual al nombre del registro ni limitarse a contenerlo sin añadir nada más.
  3. **No es una sola palabra repetida** ni la repetición de una misma secuencia para alcanzar el mínimo: la descripción tiene al menos cinco palabras **distintas** entre sí.

  El mínimo de caracteres por sí solo no distingue una descripción útil de una inútil —«rica rica rica rica rica rica» cumple los 20 caracteres y no sirve para nada—, y esta épica es el único momento del proyecto en que se puede exigir lo contrario (RN-017). Las tres condiciones son deliberadamente **mecánicas y de mínimos**: descartan la basura evidente sin pretender juzgar la calidad de la prosa, que ningún sistema puede evaluar y que se cuida por otra vía —la ayuda contextual que enseña a escribirla (§ Ayuda contextual de los campos de descripción) y la revisión humana del contenido de la semilla (FR-036)—. Se descartó exigir un mínimo de caracteres más alto en lugar de estas condiciones: castigaría descripciones cortas y buenas sin impedir las largas y vacías.

### Reglas de Negocio

- **RN-001 · Solo el negocio administra el catálogo**: ningún otro rol crea, edita, agota, da de baja ni reclasifica productos o categorías. *Ejemplo*: un administrador que ve en el menú un producto mal descrito no puede corregirlo; debe pedírselo al negocio. La acción administrativa sobre flujos críticos es HU-07, en E8.
- **RN-002 · Cliente y repartidor solo ven productos activos**: *Ejemplo*: un producto dado de baja el lunes deja de aparecer en el menú del martes, aunque el cliente conozca su nombre y lo escriba en la búsqueda.
- **RN-003 · Un producto agotado sigue visible, marcado y no pedible**: *Ejemplo*: si se acaban las empanadas de pino a media tarde, el cliente sigue viéndolas en el menú con la marca «Agotado», y no puede seleccionarlas. Verlas y no poder pedirlas es mejor que no verlas: el cliente sabe que existen y que puede volver mañana.
- **RN-004 · No existe borrado físico**: ni de productos ni de categorías. La retirada es lógica y reversible. *Ejemplo*: un producto que estuvo en un pedido de marzo debe seguir siendo legible en ese pedido en diciembre, aunque el negocio dejara de venderlo en abril.
- **RN-005 · Nombre de producto único, incluso entre los dados de baja**: comparado en forma normalizada. *Ejemplo*: si «Pizza Napolitana» fue dada de baja, no se puede crear «pizza napolitana»; así su reactivación siempre es posible. Es el mismo criterio con que E1 reserva el correo de un usuario desactivado.
- **RN-006 · El precio es un entero en pesos chilenos mayor que cero**: sin decimales. *Ejemplo*: `4990` es válido; `0`, `-100` y `4990,50` se rechazan, y ninguno se corrige en silencio.
- **RN-007 · Al dar de alta, el producto queda activo y disponible**: *Ejemplo*: el negocio guarda una pizza nueva y el cliente puede verla y pedirla sin que nadie la «publique» ni la marque disponible después.
- **RN-008 · Dar de baja un producto no lo elimina de los pedidos en curso**: *Ejemplo*: si un cliente ya pidió un completo y el negocio da de baja el completo, ese pedido sigue conteniéndolo y el repartidor sigue viéndolo. Lo que cambia es que nadie puede pedirlo de nuevo.
- **RN-009 · Desactivar una categoría no reclasifica ningún producto**: los que la tenían la conservan. *Ejemplo*: si «Completos» se desactiva, un producto dado de baja que era un completo sigue siéndolo, y al reactivarlo habrá que reclasificarlo primero (FR-021).
- **RN-010 · Todo cambio rige hacia adelante**: precio, descripción, ingredientes y clasificación afectan a las consultas siguientes y **nunca** a un pedido ya creado. *Ejemplo*: subir la pizza de $5.000 a $6.000 no cambia el total de un pedido de ayer.
- **RN-011 · Todo producto activo tiene exactamente una categoría por dimensión obligatoria**: *Ejemplo*: una pizza es a la vez «Pizzas» (tipo de comida) e «Indulgente» (perfil de salud); no puede ser dos tipos de comida ni ninguno. Un producto sin clasificar sería invisible para los filtros, y eso rompería la paridad voz/manual del Principio VI.
- **RN-012 · Sin categorías no hay productos**: si una dimensión no tiene ninguna categoría activa, no se puede dar de alta ningún producto. *Ejemplo*: en un sistema recién instalado sin semilla, lo primero que puede hacer el negocio es crear categorías, no productos.
- **RN-013 · Las dimensiones son fijas; las categorías las administra el negocio**: *Ejemplo*: el negocio puede crear la categoría «Poke» sin esperar un despliegue, pero no puede añadir una tercera pregunta como «Picante / No picante».
- **RN-014 · Nombre de categoría único dentro de su dimensión, no entre dimensiones**: comparado en forma normalizada, alcanzando a las desactivadas. *Ejemplo*: «Saludable» puede existir a la vez como tipo de comida y como perfil de salud; dos «Saludable» en «Perfil de salud» no.
- **RN-015 · No se desactiva una categoría de la que dependa un producto activo**: el sistema lo impide y dice cuántos lo bloquean. *Ejemplo*: si «Pizzas» es el tipo de comida de tres productos activos, desactivarla exige antes reclasificar o dar de baja esos tres.
- **RN-016 · Los tramos de precio se derivan al consultar y no se persisten**: se calculan sobre los productos activos, en el momento de la consulta. Con menos de tres productos activos, o con todos al mismo precio, no hay tramos y una intención de precio no descarta ninguno. *Ejemplo*: con un catálogo de dos productos, «lo más barato» devuelve los dos.
- **RN-017 · La descripción no es decoración**: es obligatoria en productos (≥20 caracteres) y en categorías (≥30), y en ambos casos con al menos cinco palabras distintas y sin ser una repetición del nombre (FR-039), porque es el índice sobre el que funcionará la búsqueda por voz de E6. *Ejemplo*: «rica» no es una descripción admisible de una pizza, ni lo es «rica rica rica rica rica rica», que cumple la longitud y ninguna de las otras dos condiciones; «Masa delgada con salsa de tomate, mozzarella fresca, albahaca y aceite de oliva; contundente y para compartir» sí.
- **RN-018 · Un producto agotado o dado de baja nunca se ofrece ni se sugiere, por ninguna vía**: ni en el menú, ni en un filtro, ni en un tramo de precio, ni —cuando exista— en una respuesta de la búsqueda por voz (Principio VIII). *Ejemplo*: si el único producto «Saludable» está agotado, la consulta de productos saludables devuelve el mensaje de «sin resultados», no ese producto ni un sustituto de otra categoría.
- **RN-019 · Los ingredientes son información, no una declaración de alérgenos**: y la interfaz DEBE decirlo cada vez que los muestra. *Ejemplo*: que «maní» no figure en los ingredientes de una salsa no significa que la salsa no lo contenga; certificar la ausencia de un componente es seguridad alimentaria, no software (§ Fuera de Alcance).

### Entidades Clave

- **Dimensión de clasificación**: pregunta fija que se le hace a cada producto. Atributos: nombre visible y carácter obligatorio. Valores en v1: **Tipo de comida** y **Perfil de salud**. No es editable ni extensible desde la aplicación; se provee con la semilla (FR-001, FR-036).
- **Categoría**: valor administrable de una dimensión. Atributos: dimensión a la que pertenece (fija tras la creación), nombre visible, **descripción en prosa** (el dato que hará funcionar la búsqueda de E6) y estado (activa/desactivada). Su nombre es único dentro de su dimensión en forma normalizada, incluidas las desactivadas. Una categoría nunca se borra.
- **Producto**: elemento del catálogo que el cliente puede pedir. Atributos: nombre (único en todo el catálogo, en forma normalizada, incluidos los dados de baja), **descripción en prosa** (obligatoria), **ingredientes** (texto libre opcional, informativo), **precio** (entero en pesos chilenos mayor que cero), **`activo`** (está en el menú) y **`disponible`** (se puede preparar ahora). Un producto nunca se borra.
- **Clasificación del producto**: vínculo entre un producto y **exactamente una categoría por cada dimensión obligatoria**. Es parte del producto, no una entidad que el usuario administre por separado: se establece al darlo de alta y se cambia reclasificándolo (FR-022). Un producto activo no puede existir sin ella.
- **Tramo de precio** *(derivado, sin entidad propia)*: Económico, Medio o Caro. **No se almacena en ninguna parte**: se calcula en el momento de la consulta a partir de la distribución de precios de los productos activos (FR-032). Que no sea una entidad es la decisión de diseño central de HU-14 y no un detalle: un tramo persistido envejece con la inflación y obliga a recalcular todo el catálogo cada vez que cambia un precio.
- **Pedido** *(entidad externa a esta épica)*: definida en E4/E2. E3 no la consulta ni la modifica; solo declara el contrato de FR-024, según el cual el pedido guarda el precio con el que se creó.
- **Carrito** *(entidad externa a esta épica)*: definida en HU-12 (E2). E3 solo declara qué productos son ofrecibles (RN-018); la reacción del carrito ante un producto que se agota se resuelve allí.

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: El negocio da de alta un producto completo —nombre, descripción, ingredientes, precio y las dos categorías— y lo ve en el menú del cliente en **menos de 3 minutos**, sin ayuda técnica. Se mide con un cronómetro sobre el entorno de contenedores del proyecto, desde que entra al formulario hasta que el producto es visible en la sesión de un cliente.
- **SC-002**: Marcar un producto como agotado o reponerlo se hace en **2 clics o menos desde el listado**, sin entrar a la ficha y sin diálogo de confirmación. Se cuenta contando los clics.
- **SC-003**: Marcar un producto como agotado o reponerlo se refleja en el menú del cliente **en la siguiente carga de pantalla**, sin ninguna espera adicional ni paso de publicación.
- **SC-004**: El **100 %** de los productos agotados o dados de baja resulta imposible de seleccionar para pedir, y ninguno es devuelto como ofrecible por ninguna consulta del catálogo. Se comprueba también **sin usar la interfaz**, invocando directamente el punto de entrada de consulta.
- **SC-005**: El **0 %** de los productos dados de baja es visible para clientes o repartidores, por ningún medio: listado, filtro por categoría, filtro por tramo de precio o acceso directo a su ficha.
- **SC-006**: **Ninguna acción de la interfaz elimina un producto o una categoría de forma irreversible**. Se comprueba recorriendo todas las pantallas de administración y verificando que no existe ninguna acción de borrado, y que toda retirada tiene su acción contraria.
- **SC-007**: El **100 %** de los productos activos tiene descripción de al menos 20 caracteres y **una categoría por cada dimensión obligatoria**. Se comprueba intentando guardar productos que incumplan cada condición y verificando que ninguno se guarda.
- **SC-008**: El **100 %** de las categorías activas tiene descripción de al menos 30 caracteres. Se comprueba del mismo modo que SC-007.
- **SC-009**: El negocio crea una categoría nueva y clasifica un producto con ella en **menos de 2 minutos**, sin ningún despliegue de código y sin intervención técnica. Se mide con un cronómetro.
- **SC-010**: El **100 %** de los intentos de dejar un producto activo sin categoría activa en alguna dimensión es rechazado, tanto al dar de alta (FR-012) como al reactivar (FR-021), con un mensaje en español que nombra la dimensión afectada.
- **SC-011**: **Las cinco categorías de intención del Principio VII** —precio, salud, tipo de comida, plato específico y recomendación abierta— se resuelven íntegramente con los datos de esta épica, **sin ningún campo adicional**. Se comprueba recorriendo la tabla de § Qué se guarda y qué frase habilita cada dato **sobre el catálogo de la semilla**, y comprobando que cada frase tiene ahí un dato que la resuelve. Las frases que dependen de los ingredientes se comprueban sobre productos que los declaran, y la semilla garantiza que todos los suyos lo hacen (FR-036); sobre un producto sin ingredientes, la ausencia del dato no se lee como ausencia del ingrediente.
- **SC-012**: El **100 %** de los intentos de guardar un precio de cero, negativo, con decimales o no numérico es rechazado, con el mensaje asociado al campo del precio y sin que el valor se corrija en silencio.
- **SC-013**: El **100 %** de los productos recién dados de alta queda activo y disponible sin ninguna acción adicional.
- **SC-014**: El **100 %** de los intentos de crear un nombre duplicado —de producto en todo el catálogo, o de categoría dentro de su dimensión— es rechazado, incluso variando acentos, eñes y mayúsculas; y el **100 %** de los intentos de repetir un nombre de categoría en la **otra** dimensión es aceptado.
- **SC-015**: El **100 %** de los intentos de desactivar una categoría de la que dependa al menos un producto activo es rechazado, y el mensaje indica **cuántos productos** lo bloquean.
- **SC-016**: Con un catálogo de al menos tres precios distintos, cada consulta por tramo devuelve **solo** productos cuyo precio cumple el corte, y el tramo de un producto **cambia por sí solo** al dar de alta productos más baratos, sin que nadie edite ese producto.
- **SC-017**: Con menos de tres productos activos, o con todos al mismo precio, una consulta por tramo de precio **no descarta ninguno**.
- **SC-018**: Una consulta que combina categoría y tramo de precio devuelve **solo** los productos que cumplen ambas condiciones, y **nunca** sustituye el resultado por productos que cumplan solo una.
- **SC-019**: El **100 %** de los formularios con campo de descripción —producto y categoría— muestra, sin interacción previa, un ejemplo de descripción bien escrita y una explicación en español de para qué se usa.
- **SC-020**: El **100 %** de las pantallas que muestran ingredientes muestra junto a ellos la advertencia en español de que son información referencial y no una declaración de alérgenos.
- **SC-021**: El **100 %** de los intentos de administrar el catálogo desde un rol distinto de negocio es bloqueado. Se comprueba **sin usar la interfaz**: con la sesión de un usuario de otro rol se invoca directamente el punto de entrada de administración. Que la opción no aparezca en pantalla no cuenta como bloqueo.
- **SC-022**: Con el catálogo sin ningún producto activo, el cliente ve un mensaje en español y **ninguna** pantalla en blanco, error técnico ni indicador de carga permanente.
- **SC-023**: Un cambio de precio **no modifica ningún dato ya guardado**: el catálogo pasa a mostrar el precio nuevo y ningún registro anterior se reescribe. La comprobación sobre pedidos concretos se realiza cuando E2 los haya entregado (§ Entrega por fases).
- **SC-024**: Con más de veinte productos, el listado de administración muestra **20 por página** con el total de resultados, y la búsqueda por nombre encuentra un producto escribiendo parte de su nombre sin acentos y en minúsculas.
- **SC-025**: **El cliente sin voz llega a cualquier producto activo** usando solo los filtros por categoría y por tramo de precio. Se comprueba alcanzando solo con filtros **tres productos del catálogo de la semilla elegidos con este criterio declarado**: uno de cada tramo de precio —Económico, Medio y Caro—, y los tres de **categorías de tipo de comida distintas** entre sí. La elección concreta se anota en `verificacion.md`, de modo que la comprobación sea repetible y no dependa de qué tres tocaran esa vez (Principio VI). Se descartó «tres al azar»: no es reproducible, y tres productos de la misma categoría y el mismo tramo no ejercitarían los filtros que el criterio existe para probar.
- **SC-026**: La semilla, ejecutada sobre una base vacía, carga **las dos dimensiones**, **al menos tres categorías activas por dimensión** y **al menos doce productos activos**, todos con descripción que cumple su mínimo de caracteres y las tres condiciones de FR-039, todos con ingredientes declarados, cubriendo **los tres tramos de precio** y con al menos un producto por categoría. Ejecutada dos veces seguidas, no duplica ningún registro ni modifica los ya existentes. Se comprueba contando los registros cargados.
- **SC-031**: El **100 %** de los intentos de guardar una descripción —de producto o de categoría— que alcance el mínimo de caracteres pero incumpla alguna de las tres condiciones de FR-039 es rechazado, con un mensaje en español asociado al campo que nombra la condición incumplida. Se comprueba con los tres casos: menos de cinco palabras, repetición del nombre y una misma palabra repetida.
- **SC-032**: El **100 %** de las descripciones de la semilla menciona algo que su nombre no dice, y el **100 %** de sus campos de ingredientes enumera **al menos tres componentes reconocibles del producto** —no adjetivos ni frases—, coherentes con su nombre y su descripción. Se comprueba leyéndolos uno por uno; es una revisión humana y así se declara, porque ningún sistema puede juzgarlo. Los tres componentes son el criterio comprobable de lo que FR-036 llama «ingredientes reales»: «masa, mozzarella, tomate» cumple; «ingredientes frescos de primera calidad» no.
- **SC-027**: Un doble clic sobre cualquier acción del catálogo produce un solo efecto: nunca dos productos creados ni dos categorías con el mismo nombre.
- **SC-028**: El **100 %** de las pantallas de esta épica se recorren y operan solo con el teclado, con el foco visible en todo momento, incluidos los diálogos de confirmación; y el **100 %** de los campos de formulario tiene etiqueta asociada, con su mensaje de error asociado al campo.
- **SC-029**: El **100 %** del texto visible de esta épica está en español, con su ortografía y sus acentos correctos, y ningún término técnico interno aparece en pantalla.
- **SC-030**: Con un catálogo de **al menos 50 productos activos** —los de la semilla (FR-036) más productos de relleno cargados solo para esta medición, que cumplen las validaciones pero de los que **no se exige contenido revisado**—, el menú del cliente —sin paginación (FR-031)— y el listado de administración se muestran completos en **menos de 5 segundos**, tanto sin filtros como con la combinación de categoría y tramo de precio. Se mide con un cronómetro sobre el entorno de contenedores del proyecto, con el mismo criterio y el mismo método que SC-001 y SC-007 de E1: basta con observarlo, no se exige instrumentación ni medición automatizada. Como aquellos, **no tiene cobertura automática**: una degradación la detectaría una persona validando, no la batería de pruebas.

### Qué se guarda, y qué frase habilita cada dato

Ningún campo entra al modelo sin una frase de cliente que sin él no se pueda resolver (Principio III). Esta tabla es el instrumento con que se comprueba SC-011.

| Dato | Frase que habilita |
|---|---|
| Nombre del producto | «quiero una napolitana» |
| Descripción del producto | «algo con harto queso», «que sea contundente» |
| Ingredientes *(opcional)* | «algo con pollo», «sin cebolla», «algo vegetariano» — **solo sobre los productos que los declaran**; ver la nota de abajo |
| Precio | «lo más barato», «algo económico» |
| `activo` / `disponible` | *ninguna: **impiden** ofrecer lo que no existe* |
| Categoría de tipo de comida + su descripción | «quiero pizza» · y el filtro manual |
| Categoría de perfil de salud + su descripción | «quiero comer sano», «quiero chatarra» |

Con eso quedan cubiertas las cinco categorías de intención del Principio VII: precio, salud, tipo de comida, plato específico (nombre, descripción, ingredientes) y recomendación abierta (el conjunto de productos disponibles).

**El único campo opcional de la tabla es el de ingredientes**, y eso tiene una consecuencia que se declara aquí en lugar de dejarla implícita: las frases que dependen de él **solo se resuelven sobre los productos que los declaran**. Un producto sin ingredientes no es candidato de «algo con pollo» ni queda descartado por «sin cebolla» —**la ausencia del dato nunca se lee como ausencia del ingrediente**, con el mismo criterio que RN-019 aplica a los alérgenos—. Se descartó volver obligatorio el campo: obligaría al negocio a desglosar cada producto para dar de alta el primero, y ninguna historia lo pide. Lo que sí se exige es que **la semilla los declare en todos sus productos** (FR-036), de modo que estas frases sean demostrables sobre el catálogo de referencia; y el resto de la intención de plato específico se sostiene sobre nombre y descripción, que sí son obligatorios.

## Supuestos

Decisiones tomadas al redactar esta especificación, con la alternativa descartada cuando la hubo. Se declaran como decisiones, no como preguntas abiertas.

1. **Cómo se parte la distribución de precios en tercios** (FR-032): por **cantidad de productos**, mediante dos precios de corte tomados de las posiciones `techo(n/3)` y `techo(2n/3)` de la lista ordenada de precios. Se descartó partir el **rango** de precios en tres intervalos iguales (`mínimo + (máximo − mínimo)/3`): un solo producto muy caro desplazaría el corte y dejaría casi todo el catálogo en «económico». La formulación elegida es además la única compatible con las dos condiciones que la propia épica exige —que con menos de tres productos no haya tramos, y que dos productos con el mismo precio caigan siempre en el mismo tramo—.
2. **Los agotados cuentan para calcular los cortes** (FR-032): las posiciones se calculan sobre todos los productos **activos**, incluidos los agotados, aunque estos no se ofrezcan (RN-018). Se descartó calcularlas solo sobre los disponibles porque haría que el tramo de un producto cambiara cuando **otro** se agota, un efecto que el negocio no entendería y que convertiría un dato ya relativo en uno además volátil.
3. **Un tramo puede quedar vacío** (FR-032): en catálogos con precios muy agrupados, «Medio» o «Caro» pueden no contener ningún producto, y la consulta devuelve el mensaje de «sin resultados». Se descartó redistribuir para que los tres tramos siempre tuvieran productos: obligaría a mover productos entre tramos por motivos que el cliente no puede percibir y contradiría FR-035.
4. **Verbos de retirada distintos para producto y para categoría**: el producto se **da de baja** y la categoría se **desactiva**, siguiendo el vocabulario del negocio y el de E1 respectivamente. Se anota como una **inconsistencia consciente**: el producto usa un verbo de menú («dar de baja», que casa con el estado visible «Dado de baja») y la categoría uno de configuración («desactivar», que casa con «Desactivada» y con el mismo verbo que E1 aplica a los usuarios). La alternativa —unificar en un solo par de verbos para las tres entidades— se descartó porque obligaría a llamar «desactivado» a un producto retirado del menú, que no es como se habla en un local. Ambos pares aparecen en § Vocabulario visible del catálogo para que la interfaz no improvise.
5. **Límites de longitud de los campos**: nombre de producto 2–120 caracteres (los mismos que el nombre de usuario en E1), descripción de producto 20–1.000, ingredientes hasta 500, nombre de categoría 2–60, descripción de categoría 30–500. Los mínimos vienen de la épica; los máximos son valores de sentido común elegidos aquí para que los campos tengan un límite declarado y comprobable en lugar de uno implícito.
6. **Precio máximo de 10.000.000 de pesos**: elegido como cota superior razonable para un local de barrio. No responde a ningún requisito de negocio; existe para que el campo tenga un límite declarado y no dependa del comportamiento del almacenamiento.
7. **La dimensión de una categoría no se puede cambiar** (FR-006): se descartó permitirlo porque movería de golpe todos los productos clasificados con ella a otra pregunta distinta, sin que nadie lo hubiera pedido producto a producto.
8. **Reactivar un producto con categoría desactivada se bloquea** (FR-021): se descartó reactivarlo de todos modos —produciría un producto activo invisible para los filtros, contra RN-011— y también reactivar automáticamente la categoría, que revertiría una decisión deliberada del negocio sin pedírselo.
9. **Agotar y reponer no piden confirmación** (FR-019): es la única acción exenta. Ocurre varias veces al día en medio del servicio, es inmediatamente reversible con la acción contraria y no destruye ningún dato. Exigir confirmación haría imposible el criterio de dos clics de SC-002.
10. **Dar de baja y reactivar sí piden confirmación** (FR-020): ambas cambian lo que el cliente ve en el menú y no forman parte de la rutina del servicio.
11. **Edición concurrente**: prevalece el último cambio guardado, sin aviso, con el mismo criterio y por las mismas razones que E1 adoptó para los usuarios (Principio I, Principio III).
12. **Quién consulta el menú**: los cuatro roles autenticados. **No hay menú público sin sesión**, porque E1 no contempla ninguna pantalla accesible sin autenticarse y añadirla aquí sería alcance no pedido (Principio III). Un catálogo público, si llega a hacer falta, será un requisito propio.
13. **El administrador no edita el catálogo**: consulta el menú como el cliente y no dispone de las pantallas de administración. Coherente con RN-004 de E1 (el panel es de solo lectura); la acción administrativa sobre flujos críticos es HU-07, en E8.
14. **Orden del listado de administración** (FR-023): del alta más reciente a la más antigua, el mismo criterio y por la misma razón que el listado de usuarios de E1: sin un orden declarado la paginación no es determinista.
15. **La semilla no sobrescribe cambios hechos a mano** (FR-036): al reejecutarse, respeta los registros que ya existen en lugar de devolverlos a su contenido original. Se descartó que restaurase el estado inicial porque borraría el trabajo de quien esté cargando el catálogo real.
16. **Mono-local**: v1 no contempla múltiples locales, de acuerdo con la decisión de alcance de `docs/epicas-hu/EPICS.md`. El catálogo es uno solo y no se segmenta por local.
17. **Sin voz en E3**: esta épica no incorpora micrófono, permiso de audio ni llamada a ningún modelo de lenguaje. Todo lo relativo a la voz es E6; E3 solo deja guardados los datos que E6 leerá.
18. **El menú del cliente no se pagina** (FR-031): se muestra completo en una sola pantalla desplazable. Se descartó paginarlo como la administración porque un catálogo mono-local se recorre bien de una vez y obligaría a construir un segundo mecanismo de recorrido; los tramos de precio se calculan sobre el catálogo activo completo y no sobre lo mostrado, de modo que la decisión no altera FR-032. Si el catálogo creciera hasta hacerlo incómodo, la paginación sería un requisito propio.
19. **La ficha de producto es una pantalla propia con dirección propia** (FR-034): es lo que FR-028 y SC-005 ya presuponían al hablar de acceso directo por dirección, y deja una dirección estable que E2 podrá enlazar desde el carrito. Se descartó desplegar el detalle dentro del listado, que habría obligado a reescribir ambos para no hablar de acceso directo. La dirección de un producto no activo responde «no encontrado», sin distinguirlo de uno inexistente.
20. **El listado de administración oculta por defecto los dados de baja** (FR-023): el trabajo cotidiano es sobre el menú vigente y la baja es la excepción. Se descartó mostrarlos siempre mezclados, que ensucia la vista de servicio; el filtro por estado los recupera en un clic.
21. **Tres condiciones mecánicas de sustancia para la descripción** (FR-039): cinco palabras distintas, sin repetir el nombre y sin una palabra repetida. Se descartaron las dos alternativas: subir el mínimo de caracteres —castiga descripciones cortas y buenas sin impedir las largas y vacías— y juzgar la calidad de la prosa con un modelo de lenguaje, que E3 no puede hacer por decisión de alcance y que además delegaría a una máquina algo verificable con una consulta (§ Contexto y motivación). La calidad real se cuida por otra vía: la ayuda contextual que enseña a escribir y la revisión humana de la semilla (SC-032).
22. **Cantidades mínimas de la semilla** (FR-036): tres categorías por dimensión y doce productos, con ingredientes en todos. Es el mínimo con el que los tres tramos existen de verdad, un filtro combinado devuelve resultados y otro devuelve «sin resultados». Se descartó dejarlo en «al menos una categoría por dimensión»: cumplía la letra y no permitía demostrar ningún filtro.
23. **Los 50 productos del umbral de rendimiento no los aporta la semilla** (SC-030): se alcanzan añadiendo productos de relleno solo para esa medición, de los que no se exige contenido revisado. Se descartó exigir 50 productos a la semilla: multiplicaría por cuatro el contenido que hay que redactar a mano para medir un tiempo de respuesta, mezclando dos objetivos distintos —contenido demostrable y volumen— en un solo artefacto.
24. **Los ingredientes siguen siendo opcionales** (§ Qué se guarda): la ausencia del dato nunca se lee como ausencia del ingrediente, con el mismo criterio de RN-019. Se descartó volverlos obligatorios, que obligaría a desglosar cada producto para dar de alta el primero sin que ninguna historia lo pida; la demostrabilidad se resuelve exigiéndolos en la semilla, no en el modelo.
25. **Presentación del precio como `$4.990`** (§ Presentación del precio): convención chilena, punto de miles y sin decimales, declarada una sola vez en `packages/shared` como el formato de fechas de E1. Se descartó dejarlo a criterio de cada pantalla, que produciría el mismo precio escrito de dos formas y trasladaría la inconsistencia a los totales de E2.
26. **Idioma del contenido del catálogo**: el contenido que carga la semilla está **íntegramente en español** —es el catálogo de un local chileno y es el que se lee para comprobar SC-032—. En cambio, el contenido que carga el negocio **no se restringe por idioma**: el sistema no comprueba en qué idioma está escrita una descripción, y no podría hacerlo sin un juicio que FR-039 declara expresamente fuera de su alcance. La distinción importa porque SC-029 exige español al **texto de la aplicación** —etiquetas, mensajes, títulos—, que es lo que el proyecto controla, y no al **dato** que el negocio escribe. Se descartó exigir español al contenido del negocio: sería una regla sin forma de aplicarla.
27. **Las descripciones en prosa bastarán para E6, y es un supuesto, no una certeza** (§ Fuera de Alcance): la épica apuesta a que una descripción bien escrita permite a un modelo de lenguaje resolver «algo grasoso» o «para pecar» sin diccionario de sinónimos, y por eso descarta mantener alias por producto. **Es la apuesta central de la épica y quien la confirma o la refuta es E6**, no E3: aquí no hay forma de comprobarla, porque no hay modelo al que preguntar. Se declara como supuesto para que, si E6 descubre que no basta, se lea como el riesgo que estaba anotado y no como un defecto sorpresa. Lo que E3 sí garantiza es que la prosa exista, tenga sustancia mínima (FR-039) y esté revisada en la semilla (SC-032); si aun así hiciera falta un diccionario, sería un requisito de E6 con su propio alcance.

## Fuera de Alcance (v1)

- **Cualquier llamada a un modelo de lenguaje o servicio de inteligencia artificial**: corresponde a E6. E3 no incorpora ninguna clave de servicio ni ninguna dependencia externa nueva.
- **Sinónimos o alias por producto**: el modelo de E6 los deriva de las descripciones. Mantener un diccionario a mano es trabajo permanente que siempre estaría incompleto.
- **Búsqueda semántica con vectores (`pgvector`)**: complejidad anticipada (Principio I). Con decenas de productos no aporta, y añadiría una extensión de PostgreSQL, recálculo en cada edición y una capa difícil de verificar por una persona no técnica (Principio IV).
- **Información nutricional y alérgenos certificados**: el campo de ingredientes es informativo y así se declara en pantalla (FR-017). Certificar la ausencia de un componente es seguridad alimentaria, no software.
- **Dimensiones administrables por el negocio**: las dos de FR-001 son fijas en v1.
- **Múltiples categorías de la misma dimensión por producto** y **subcategorías anidadas**.
- **Imágenes de producto**: el cliente decide con el nombre, la descripción y los ingredientes (FR-034).
- **Variantes y adicionales** (tamaños, extras), **promociones y combos**, y **horarios de disponibilidad**.
- **Importación masiva del catálogo** desde un archivo, e **historial de cambios del catálogo**: quién cambió qué precio y cuándo no se registra en v1. La bitácora de E1 (FR-034 de E1) cubre solo las acciones administrativas sobre usuarios y no se amplía aquí.
- **Popularidad, valoraciones o historial de pedidos** como criterio de orden o de recomendación: no hay pedidos aún (E2).
- **Stock numérico por producto**: v1 tiene un interruptor de disponibilidad, no un contador de unidades. Un contador exigiría descontarlo al confirmar el pedido, devolverlo al cancelarlo y decidir qué hacer con las reservas, todo ello en E2 y sin que ninguna historia lo pida.
- **Actualización en tiempo real del menú del cliente**: los cambios se reflejan en la siguiente carga de pantalla (SC-003).
- **Menú público accesible sin iniciar sesión** (supuesto 12).
- **Control de edición concurrente sobre un mismo producto**: prevalece el último cambio guardado, sin aviso (§ Casos Límite).
- **Edición del catálogo por el administrador**: consulta, no edita (supuesto 13).
- **Múltiples locales**: v1 es mono-local.
- **Auditoría formal de conformidad de accesibilidad y pruebas con lectores de pantalla reales**: v1 se limita a las cuatro condiciones comprobables de FR-037, igual que E1.

## Dependencias

- **Hacia atrás**: **E1 · Acceso y usuarios**, ya construida y verificada. E3 consume de ella los cuatro roles, el mecanismo de autenticación y autorización por rol, las convenciones de interfaz y mensajería, y la función de normalización de `packages/shared` sobre la que se apoyan FR-004, FR-014 y FR-023.
- **Hacia adelante**:
  - **E2 · Gestión de pedidos** debe existir para verificar funcionalmente los escenarios que hablan del carrito (HU02-E07, HU02-E08, HU14-E15) y del precio de pedidos ya creados (HU02-E13). E3 entrega su mitad del contrato (FR-024, FR-029, RN-018).
  - **E6 · Búsqueda por voz** es la razón de ser de los campos de descripción de esta épica. E3 no la implementa ni la anticipa: solo garantiza que los datos que E6 leerá existan y estén bien escritos (FR-005, FR-016, FR-036).

    **Si E6 descubre que necesita un dato que E3 no guardó** —un campo, un alias, una clasificación más—, ese dato es **un requisito de E6**, con su propia migración y su propio criterio de éxito, y no una deuda ni un defecto de esta épica. E3 se compromete con la tabla de § Qué se guarda y qué frase habilita cada dato, y SC-011 la recorre frase por frase precisamente para que el hueco, si existe, se detecte **aquí** y no después. Lo que E3 no hace es añadir columnas por si acaso: un campo sin frase que lo justifique es alcance fantasma (Principio III), y añadirlo más tarde con un requisito que lo pida cuesta una migración sobre dos tablas pequeñas.
- **Orden de construcción interno**: HU-14 antes que HU-02. Sin al menos una categoría activa por dimensión no se puede dar de alta ningún producto (RN-012).
- **Desvío del orden sugerido de épicas**: `docs/epicas-hu/EPICS.md` propone E1 → E4 → E3. Esta épica se adelanta a E4, con la consecuencia declarada en § Entrega por fases: tres escenarios quedan con verificación funcional condicionada. Ninguno de ellos bloquea la construcción de E3.
