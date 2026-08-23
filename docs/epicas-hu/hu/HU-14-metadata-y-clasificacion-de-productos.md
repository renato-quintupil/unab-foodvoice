# HU-14 — Metadata y clasificación de productos

> Borrador de historia de usuario, preparatorio de la spec de **E3 · Administración
> de menú**. Material de entrada para `/speckit-specify`, no la spec en sí.
> Se lee junto a [HU-02](./HU-02-administracion-de-menu.md) y al
> [borrador de modelo de datos de E3](./E3-modelo-de-datos-borrador.md).

**Como** negocio, **quiero** organizar mi catálogo en categorías que yo mismo
defino y describo, **para** que el cliente pueda encontrar productos hablando en
lenguaje natural y también navegando con filtros, sin depender de que yo acierte
el nombre exacto que él va a usar.

| Campo | Valor |
| --- | --- |
| **Épica** | E3 · Administración de menú |
| **Prioridad** | Alta |
| **MVP (web)** | Sí |
| **Story points** | 8 |
| **Causa raíz** | Sin datos que describan el producto no hay intención que resolver (Principio VII) |
| **Depende de** | HU-02 (el producto debe existir para clasificarlo) |
| **Consumida por** | HU-06 y HU-13 (E6), HU-12 (E2) |

**Justificación de prioridad**: es la HU que decide si la búsqueda por voz podrá
existir. E3 se especifica **antes** que E6, así que es la única oportunidad de
dejar guardados los datos que la voz necesitará después. Un dato que no se guarda
aquí es una intención que E6 no podrá resolver.

---

## Lo que esta HU es y lo que no es

**Esta HU no llama a ninguna inteligencia artificial.** No hay modelo de lenguaje,
no hay API externa, no hay clave de servicio. E3 solo **guarda los datos**; la
resolución de intención es la razón de ser de E6 y se construye allí.

Lo que sí decide esta HU es **qué material de lectura tendrá ese modelo**, y esa
decisión es irreversible en la práctica: cuando E6 llegue, el catálogo ya estará
cargado con lo que se haya definido aquí.

La cadena completa, para dejar clara la frontera:

```
  ┌─ E3 (esta épica) ──────────┐   ┌─ E6 (más adelante) ───────────────┐
  │                            │   │                                    │
  │  El negocio describe y     │   │  El cliente dice:                  │
  │  clasifica sus productos   │   │  «quiero algo económico y sano»    │
  │            │               │   │            │                       │
  │            ▼               │   │            ▼                       │
  │  Se guardan en la base     │──▶│  Un modelo LEE esos datos y        │
  │  de datos                  │   │  devuelve FILTROS, no productos    │
  │                            │   │            │                       │
  └────────────────────────────┘   │            ▼                       │
                                   │  SQL busca con esos filtros sobre  │
                                   │  productos activos y disponibles   │
                                   └────────────────────────────────────┘
```

Nótese el final de la cadena: **el modelo nunca elige productos, solo filtros.**
La lista que ve el cliente sale siempre de una consulta a la base de datos sobre
productos activos y disponibles. Es lo que garantiza que no se pueda inventar ni
ofrecer un producto agotado (Principios VII y VIII), y es una decisión de E6 que
se declara aquí porque condiciona qué se guarda.

---

## La decisión central: la taxonomía la define el negocio

Las categorías **no** son una lista fija en el código fuente. Viven en la base de
datos y el negocio las crea, edita y desactiva desde su panel.

Por qué así, y no con una lista cerrada de once tipos de comida escrita por el
equipo:

- Un local que empieza a vender poke, sushi vegano o cazuelas no debería esperar
  un despliegue para poder clasificarlos.
- El equipo no puede acertar de antemano la lista correcta para un negocio que no
  conoce. Cualquier lista fija sería a la vez demasiado larga (categorías vacías)
  y demasiado corta (lo que el local vende de verdad y no está).
- Con un modelo de lenguaje leyendo el catálogo en E6, la lista cerrada deja de
  aportar lo único que aportaba —vocabulario predecible—, porque el modelo puede
  leer nombres y descripciones que nunca vio antes.

Lo que **sí** es fijo son las **dimensiones**: las dos preguntas que se le hacen a
cada producto. En v1 son dos:

| Dimensión | Qué responde | Ejemplos de categorías que el negocio podría crear |
| --- | --- | --- |
| **Tipo de comida** | ¿Qué es este producto? | Pizzas · Hamburguesas · Completos · Ensaladas · Bebidas |
| **Perfil de salud** | ¿Cómo cae? | Saludable · Equilibrado · Indulgente |

Las dimensiones son fijas porque cada una tiene un desplegable propio en el
formulario de alta y un filtro propio en el menú del cliente. Hacerlas
administrables obligaría a construir un generador de formularios genérico, que es
mucho trabajo para un beneficio que v1 no necesita (Principio I). Las categorías
dentro de cada dimensión son libres.

---

## La descripción de la categoría es el dato que hace todo esto funcionar

Cada categoría tiene un **nombre** (lo que ve el cliente en el filtro) y una
**descripción** (lo que leerá el modelo en E6). La descripción es el campo más
importante de esta HU y merece explicarse con un ejemplo:

> **Nombre:** Comida rápida
>
> **Descripción:** «Hamburguesas, papas fritas, completos y frituras en general.
> Comida contundente, calórica y sabrosa; lo que la gente pide cuando quiere algo
> rico sin pensar en la dieta.»

Con esa descripción, cuando el cliente diga «quiero chatarra», «algo grasoso» o
«para pecar hoy», el modelo de E6 la reconocerá — **sin que nadie haya escrito
esas tres expresiones en ninguna parte del sistema**.

Esto reemplaza por completo al diccionario de sinónimos que se había propuesto en
la primera versión de este borrador. Mantener a mano una lista de todas las formas
de decir «chatarra» es trabajo permanente para el equipo y siempre estará
incompleta; una descripción bien escrita la cubre y además la escribe quien mejor
conoce el producto.

**Consecuencia práctica**: el panel de categorías debe *enseñar* a escribir la
descripción, con un ejemplo a la vista y una explicación en español de para qué
sirve. Una categoría con la descripción «pizzas» a secas funciona mucho peor que
la del ejemplo, y el negocio no tiene por qué saberlo sin que se lo digan.

---

## El precio: un número, sin campo de tramo

El negocio ingresa **solo el precio en pesos chilenos** (HU-02 RN-06). Los tramos
que necesita la voz —económico, medio, caro— **se derivan al consultar**,
partiendo la distribución real de precios del catálogo activo en tercios.

Por qué así y no con un campo que el negocio marque: un umbral escrito en la spec
envejece con la inflación y no sirve igual para empanadas que para sushi; y un
campo marcado a mano puede contradecir al precio real del producto.

Consecuencia que hay que aceptar y declarar: **«económico» es siempre relativo al
catálogo**. En un local caro, el tercio inferior puede seguir siendo caro en
términos absolutos. Es el comportamiento correcto para «muéstrame lo más barato
que tienes», que es lo que el cliente realmente quiere decir.

---

## Reglas de negocio

- **RN-01** — Todo producto activo tiene **exactamente una** categoría por cada
  dimensión obligatoria. No se puede publicar un producto sin clasificar: un
  producto sin categoría es invisible para los filtros, y eso rompe el Principio
  VI (paridad entre voz y manual).
- **RN-02** — Las **dimensiones** son fijas en v1 y no se administran desde la
  aplicación. Las **categorías** dentro de cada dimensión las crea, edita y
  desactiva el rol `NEGOCIO`.
- **RN-03** — Toda categoría tiene nombre y descripción, ambos obligatorios. La
  descripción tiene un mínimo de 30 caracteres: es el índice semántico de E6.
- **RN-04** — El nombre de la categoría es único dentro de su dimensión, comparado
  en forma normalizada (misma función `normalizarBusqueda` de E1). «Pizzas» y
  «pizzas» son la misma categoría.
- **RN-05** — Una categoría **no se borra**, se desactiva. Una categoría
  desactivada desaparece de los filtros del cliente y del desplegable de alta,
  pero los productos que la tenían asignada la conservan.
- **RN-06** — No se puede desactivar una categoría si es la única de su dimensión
  para algún producto activo: dejaría ese producto sin clasificar, contra RN-01.
  El sistema lo impide y dice cuántos productos lo bloquean.
- **RN-07** — Los tramos de precio se calculan sobre los productos **activos** del
  catálogo, en el momento de la consulta. No se persisten.
- **RN-08** — Si el catálogo tiene menos de tres productos activos, todos se
  consideran del mismo tramo y una intención de precio no descarta ninguno.
- **RN-09** — Cambiar la clasificación o la descripción de un producto rige de
  inmediato para las búsquedas siguientes; no afecta a pedidos ya creados.
- **RN-10** — Un producto agotado o dado de baja **nunca** se ofrece ni se sugiere,
  cualquiera sea la vía de búsqueda (Principio VIII).

---

## Los datos que se guardan, y qué intención habilita cada uno

Esta tabla es el corazón de la HU: **ningún campo entra al modelo si no hay una
frase de cliente que sin él no se pueda resolver**. Es la defensa contra el
alcance fantasma (Principio III) y la justificación de cada columna.

| Dato | Dónde vive | Frase que habilita |
| --- | --- | --- |
| `nombre` del producto | producto | «quiero una napolitana» |
| `descripcion` del producto | producto | «algo con harto queso», «que sea contundente» |
| `ingredientes` | producto | «algo con pollo», «sin cebolla», «algo vegetariano» |
| `precio_clp` | producto | «lo más barato», «algo económico» |
| `activo` / `disponible` | producto | *no habilita frases: **impide** ofrecer lo que no existe* |
| categoría de **tipo de comida** | categoría | «quiero pizza», y el filtro manual del menú |
| categoría de **perfil de salud** | categoría | «quiero comer sano», «quiero chatarra» |
| `descripcion` de la categoría | categoría | es lo que permite que «chatarra» encuentre «Comida rápida» |

Con esos ocho datos quedan cubiertas las **cinco categorías de intención** del
Principio VII:

| Intención del Principio VII | Se resuelve con |
| --- | --- |
| Precio | `precio_clp` + tramos derivados |
| Salud | categoría de perfil de salud + su descripción |
| Tipo de comida | categoría de tipo de comida + su descripción |
| Plato específico | `nombre` y `descripcion` del producto |
| Recomendación abierta | el conjunto de productos activos y disponibles |

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Clasificación de productos

  Escenario: HU14-E01 · El negocio crea una categoría
    Dado que inicié sesión con rol "negocio"
    Cuando creo una categoría en la dimensión "Tipo de comida" con nombre y descripción
    Entonces la categoría queda disponible en el formulario de alta de productos
    Y aparece como filtro en el menú del cliente

  Escenario: HU14-E02 · La descripción de la categoría es obligatoria
    Dado que estoy creando una categoría
    Cuando dejo la descripción vacía o escribo menos de 30 caracteres
    Entonces el sistema lo rechaza
    Y muestra un mensaje en español asociado al campo de la descripción
    Y el formulario explica que la descripción es lo que permite encontrar la categoría por voz

  Escenario: HU14-E03 · El formulario enseña a describir una categoría
    Dado que estoy creando una categoría
    Cuando llego al campo de la descripción
    Entonces veo junto al campo un ejemplo de descripción bien escrita
    Y una explicación en español de para qué se usa

  Escenario: HU14-E04 · Nombre de categoría duplicado en la misma dimensión
    Dado que la dimensión "Tipo de comida" ya tiene una categoría llamada "Pizzas"
    Cuando intento crear otra llamada "pizzas" en esa misma dimensión
    Entonces el sistema lo rechaza
    Y muestra un mensaje en español asociado al campo del nombre

  Escenario: HU14-E05 · Mismo nombre en dimensiones distintas sí se permite
    Dado que la dimensión "Tipo de comida" tiene una categoría llamada "Saludable"
    Cuando creo una categoría llamada "Saludable" en la dimensión "Perfil de salud"
    Entonces el sistema la acepta

  Escenario: HU14-E06 · La clasificación es obligatoria al dar de alta
    Dado que inicié sesión con rol "negocio"
    Cuando intento dar de alta un producto sin elegir categoría de tipo de comida
    Entonces el sistema lo rechaza
    Y muestra un mensaje en español asociado a ese campo

  Escenario: HU14-E07 · Una categoría por dimensión, no varias
    Dado que estoy dando de alta un producto
    Cuando llego al campo de tipo de comida
    Entonces solo puedo elegir una categoría de esa dimensión

  Escenario: HU14-E08 · Desactivar una categoría
    Dado una categoría sin productos activos que dependan solo de ella
    Cuando la desactivo
    Entonces desaparece de los filtros del cliente
    Y desaparece del desplegable de alta de productos
    Y sigue visible en mi administración, marcada como desactivada

  Escenario: HU14-E09 · No se puede desactivar una categoría en uso
    Dado una categoría que es la única de su dimensión para tres productos activos
    Cuando intento desactivarla
    Entonces el sistema lo impide
    Y muestra un mensaje en español indicando cuántos productos lo bloquean

  Escenario: HU14-E10 · Las categorías no se borran
    Dado que consulto la administración de categorías
    Entonces no existe ninguna acción para eliminar una categoría de forma definitiva

  Escenario: HU14-E11 · Reclasificar un producto
    Dado un producto clasificado como "Pizzas" e "Indulgente"
    Cuando el negocio lo reclasifica como "Ensaladas" y "Saludable"
    Entonces el menú del cliente lo muestra bajo la nueva clasificación
    Y ya no aparece al filtrar por la anterior

  Escenario: HU14-E12 · Tramo de precio derivado del catálogo
    Dado un catálogo con productos de $2.000, $5.000 y $12.000
    Cuando se consultan los productos del tramo económico
    Entonces se obtiene el de $2.000
    Y no se obtiene el de $12.000

  Escenario: HU14-E13 · El tramo se recalcula al cambiar el catálogo
    Dado un producto que hoy pertenece al tramo económico
    Cuando el negocio da de alta varios productos más baratos
    Y se vuelve a consultar el tramo económico
    Entonces ese producto ya no aparece en el tramo económico

  Escenario: HU14-E14 · Catálogo demasiado pequeño para tramos
    Dado un catálogo con dos productos activos
    Cuando se consulta el tramo económico
    Entonces se obtienen ambos productos
    Y la intención de precio no descarta ninguno

  Escenario: HU14-E15 · Filtro manual por categoría
    Dado que inicié sesión con rol "cliente"
    Cuando filtro el menú por la categoría "Pizzas"
    Entonces veo solo los productos activos de esa categoría
    Y los agotados aparecen marcados y no se pueden agregar al carrito

  Escenario: HU14-E16 · Un producto agotado no se ofrece por categoría
    Dado un producto clasificado como "Saludable" y marcado como agotado
    Cuando se consultan los productos saludables para ofrecer al cliente
    Entonces ese producto no se ofrece ni se sugiere

  Escenario: HU14-E17 · Combinación de dos filtros
    Dado un catálogo con productos de distintos tramos y categorías
    Cuando se consultan los productos económicos de la categoría "Saludable"
    Entonces se obtienen solo los que cumplen ambas condiciones
    Y no se sustituyen por productos que cumplan solo una de las dos
```

---

## Casos límite a cubrir

- Todos los productos con el mismo precio: los tercios colapsan y ningún producto
  queda excluido por precio.
- Catálogo con un solo producto activo.
- Empate en el borde del tercio: dos productos con el mismo precio deben caer
  siempre en el mismo tramo, sin depender del orden de la consulta.
- Dimensión sin ninguna categoría creada todavía: no se puede dar de alta ningún
  producto; la pantalla lo explica y ofrece crear la primera categoría.
- Categoría sin ningún producto: aparece en la administración pero no en los
  filtros del cliente.
- Todos los productos de una categoría agotados: la categoría existe pero no
  tiene nada que ofrecer.
- Categoría cuyo nombre coincide con el de un producto.
- Descripción de categoría escrita con desgana («pizzas» a secas): el sistema la
  acepta si cumple el mínimo, pero el ejemplo del formulario debe empujar a algo
  mejor.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-1 | El **100 %** de los productos activos tiene una categoría por cada dimensión obligatoria. No existe producto publicado sin clasificar. |
| SC-2 | El **100 %** de las categorías activas tiene una descripción de al menos 30 caracteres. |
| SC-3 | Las cinco categorías de intención del Principio VII **se pueden resolver íntegramente** con los datos que guarda esta HU, sin ningún campo adicional. Se demuestra con la tabla de trazabilidad de arriba. |
| SC-4 | El negocio crea una categoría nueva y la usa para clasificar un producto **en menos de 2 minutos**, sin ayuda técnica y **sin ningún despliegue de código**. |
| SC-5 | El **0 %** de los productos agotados o dados de baja aparece en un resultado filtrado por categoría (Principio VIII). |
| SC-6 | El cliente **sin voz** puede llegar a cualquier producto del catálogo usando solo los filtros por categoría y precio (Principio VI). |
| SC-7 | La semilla de ejemplo carga un catálogo con al menos una categoría por dimensión y productos repartidos en los tres tramos de precio. |

---

## Semilla del catálogo

E3 debe incluir una semilla idempotente con un catálogo de ejemplo: categorías
con **descripciones bien escritas** y productos con **descripciones e ingredientes
reales**, repartidos de modo que los tres tramos de precio existan.

No es un adorno y conviene decir por qué: sin ella, E6 no se puede verificar a
mano por una persona no técnica (Principio IV), no se pueden probar las frases de
ejemplo que exige el Principio XI, y la demostración final del proyecto dependería
de que alguien cargue datos a mano el día anterior.

**El riesgo real de esta épica no está en el modelo de datos, está en la calidad
del contenido que se cargue.** La semilla es la mitigación.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Cualquier llamada a un modelo de lenguaje**: es E6.
- **Sinónimos o alias por producto ingresados por el negocio**: el modelo de E6
  los deriva de las descripciones. Mantenerlos a mano sería trabajo permanente
  para un beneficio que ya se obtiene gratis.
- **Vectores de búsqueda semántica (`pgvector` o similar)**: complejidad
  anticipada (Principio I). Con un catálogo de decenas de productos no aportan
  frente a leer el catálogo, y añaden una extensión de PostgreSQL, recálculo en
  cada edición y una capa difícil de explicar y verificar.
- **Información nutricional real**: calorías, macronutrientes.
- **Alérgenos certificados**: el campo de ingredientes es informativo (HU-02
  RN-11); certificar ausencia de un componente es un problema de seguridad
  alimentaria, no de software.
- **Dimensiones administrables por el negocio**: las dos de v1 son fijas.
- **Múltiples categorías de la misma dimensión por producto**.
- **Popularidad, valoraciones o historial** como criterio de recomendación: no
  existen pedidos todavía (E2).
- **Jerarquías de categorías** (subcategorías anidadas).
- **Traducción del catálogo a otros idiomas** (Principio II: todo en español).

---

## Decisiones que quedan abiertas para `/speckit-clarify`

1. **Si las dos dimensiones de v1 son las correctas**, o hace falta una tercera
   (por ejemplo «momento del día» o «para compartir»). Es la decisión más difícil
   de revertir, porque cada dimensión añade un campo obligatorio a todo producto
   ya cargado.
2. **Si el administrador puede crear categorías** además del negocio, o la
   separación de HU-02 RN-01 se sostiene.
3. **Si la dimensión de perfil de salud debe ser obligatoria**, o basta con que
   lo sea el tipo de comida. Obligar a las dos exige del negocio un juicio que
   quizá no tiene criterio para emitir.
4. **Qué responde una recomendación abierta** («sugiéreme algo rico»): producto al
   azar entre los disponibles, el más barato, o una pregunta de vuelta al cliente
   para acotar. El Principio VII permite preguntar cuando la intención no basta.
5. **Mínimos de longitud** de las descripciones de producto (20) y de categoría
   (30): son propuestas, conviene validarlas escribiendo la semilla primero.

---

## Cambios respecto de la versión anterior de este borrador

| Antes | Ahora | Por qué |
| --- | --- | --- |
| `FoodType` y `HealthTag` como enums cerrados en `packages/shared` | Dimensiones fijas + categorías administradas por el negocio en base de datos | Una lista fija en código obliga a un despliegue para vender algo nuevo, y el equipo no puede acertar de antemano la lista correcta de un negocio que no conoce |
| Diccionario de sinónimos mantenido por el equipo | Descripción en español de cada categoría | El modelo de E6 lee prosa; una buena descripción cubre todas las formas de decir lo mismo, y la escribe quien conoce el producto |
| La descripción del producto no participaba de la búsqueda por categorías | La descripción es el índice semántico principal | Con un modelo leyendo el catálogo, la prosa deja de ser adorno y pasa a ser el dato de mayor valor |
| No existía campo de ingredientes | `ingredientes` como texto libre opcional | Resuelve «algo con pollo», «sin cebolla», «vegetariano», que ninguna categoría cubre, con treinta segundos de trabajo del negocio |
| La descripción del producto era opcional | Obligatoria, con mínimo (HU-02 RN-10) | Un producto sin describir es invisible para la voz |
