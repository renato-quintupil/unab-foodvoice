# HU-02 — Administración de menú

> Borrador de historia de usuario, preparatorio de la spec de **E3 · Administración
> de menú**. Material de entrada para `/speckit-specify`, no la spec en sí.
> Se lee junto a [HU-14](./HU-14-metadata-y-clasificacion-de-productos.md) y al
> [borrador de modelo de datos de E3](./E3-modelo-de-datos-borrador.md).

**Como** negocio, **quiero** dar de alta y de baja productos, describirlos bien y
marcar cuáles están disponibles ahora mismo, **para** que el cliente solo pueda
pedir lo que realmente puedo preparar.

| Campo | Valor |
| --- | --- |
| **Épica** | E3 · Administración de menú |
| **Prioridad** | Alta |
| **MVP (web)** | Sí |
| **Story points** | 8 |
| **Causa raíz** | El catálogo es la única verdad del producto (Principio VIII) |
| **Depende de** | E1 (rol `NEGOCIO`, sesión, autorización por rol) |
| **Consumida por** | HU-14 (misma épica), HU-06 y HU-13 (E6), HU-12 (E2), HU-01 (E2) |

**Justificación de prioridad**: el Principio VIII declara al catálogo como única
fuente de verdad, y ninguna otra épica puede construirse sin él — no hay búsqueda
sin productos que buscar, ni pedido sin productos que pedir.

---

## Alcance de esta HU

**Qué entra**: el ciclo de vida del producto en manos del negocio —alta, edición,
baja lógica, reactivación—, el interruptor de disponibilidad, y los campos de
texto que describen el producto.

**Qué no entra**: la clasificación por categorías y la administración de esas
categorías; eso es HU-14. Aquí se define **quién puede tocar el catálogo, en qué
estados vive un producto y cómo se describe**; allí, **cómo se organiza el
catálogo para que la voz pueda navegarlo**.

**Tampoco entra ninguna llamada a un modelo de lenguaje.** E3 no consulta ninguna
IA: solo persiste los datos que E6 leerá más adelante. Mezclarlas haría crecer E3
sin control (Principio III).

---

## Los dos interruptores, que no son el mismo

Es la distinción central de esta HU y la fuente habitual de confusión:

| | `activo` | `disponible` |
| --- | --- | --- |
| **Qué significa** | El producto forma parte del menú del local | El producto se puede preparar ahora mismo |
| **Quién lo cambia** | El negocio, al dar de alta o de baja | El negocio, durante el servicio |
| **Frecuencia** | Rara vez | Varias veces al día |
| **Si es `false`** | El producto desaparece del menú del cliente | El producto **sigue visible**, marcado «Agotado» |
| **Se puede pedir** | No | No |
| **Aparece en la búsqueda por voz** | No | No se ofrece ni se sugiere |

Un producto **agotado** es un producto activo con `disponible = false`: sigue en
la carta, se muestra al cliente con la marca «Agotado», y no se puede agregar al
carrito. Un producto **dado de baja** es `activo = false`: para el cliente es como
si no existiera.

**No hay borrado físico**, en línea con lo ya decidido en E1 para los usuarios: un
producto que estuvo en un pedido debe seguir siendo legible en ese pedido para
siempre. La baja es siempre lógica y reversible.

---

## Los campos de texto no son decoración

Esta es la diferencia más importante respecto de un catálogo convencional, y la
razón de que esta HU pese más de lo que parece.

En E6 un modelo de lenguaje leerá el catálogo para entender qué pide el cliente.
**Ese modelo lee prosa en español.** La descripción de un producto deja de ser
texto de adorno y pasa a ser el índice sobre el que funciona la búsqueda por voz:
un producto mal descrito es un producto que la voz encontrará mal, por muy bien
clasificado que esté.

De ahí tres exigencias que a primera vista parecen excesivas para un formulario de
alta y no lo son:

- **La descripción es obligatoria** y tiene un mínimo de longitud (RN-10).
- **El formulario enseña a escribirla**: muestra un ejemplo real y explica para
  qué sirve, en español, junto al campo.
- **Existe un campo de ingredientes** (RN-11), porque resuelve toda una familia de
  peticiones —«algo con pollo», «sin cebolla», «algo vegetariano»— que ninguna
  categoría cubre y que al negocio le cuesta treinta segundos escribir.

---

## Reglas de negocio

- **RN-01** — Solo el rol `NEGOCIO` administra el catálogo. El administrador
  puede consultarlo, pero en v1 no lo edita: HU-10 es de solo lectura y la acción
  administrativa sobre operaciones pertenece a HU-07 (E8).
- **RN-02** — El cliente y el repartidor solo ven productos activos. Nunca se les
  expone un producto dado de baja.
- **RN-03** — Un producto agotado (`activo = true`, `disponible = false`) se
  muestra al cliente con la marca «Agotado» y no se puede agregar al carrito.
- **RN-04** — No existe borrado físico. La baja es lógica y es reversible.
- **RN-05** — El nombre del producto es único dentro del catálogo, comparado en
  su forma normalizada (misma función `normalizarBusqueda` de `packages/shared`
  que usa E1). «Pizza Napolitana» y «pizza napolitana» son el mismo producto.
  La unicidad alcanza también a los productos dados de baja.
- **RN-06** — El precio es un entero en pesos chilenos, mayor que cero. No hay
  decimales: el peso chileno no los usa, y admitirlos invitaría a errores de
  redondeo sin ningún beneficio.
- **RN-07** — Dar de alta un producto lo deja `activo = true` y
  `disponible = true`. Es el caso normal y evita el paso olvidable de tener que
  publicarlo aparte.
- **RN-08** — Dar de baja un producto no lo elimina de los pedidos en curso. Un
  pedido ya creado conserva lo que el cliente pidió (ver «Frontera con E2»).
- **RN-09** — Todo cambio de precio rige desde ese instante hacia adelante. Los
  pedidos ya creados conservan el precio que tenían al crearse.
- **RN-10** — La descripción es **obligatoria**, con un mínimo de 20 caracteres.
  Es el índice semántico de la búsqueda por voz, no un adorno.
- **RN-11** — Los ingredientes son un texto libre **opcional**, visible al
  cliente. Es **información, no una declaración de alérgenos**: el sistema no
  certifica ausencia de ningún componente y así debe decirlo la interfaz.
- **RN-12** — Un producto debe tener asignada una categoría por cada dimensión
  obligatoria (HU-14 RN-01). No se puede guardar un producto sin clasificar.

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Administración del menú

  Escenario: HU02-E01 · Alta de producto
    Dado que inicié sesión con rol "negocio"
    Cuando doy de alta un producto con nombre, descripción, precio y su clasificación
    Entonces el producto queda guardado en el catálogo
    Y aparece en el menú del cliente
    Y queda marcado como disponible sin que yo tenga que hacer nada más

  Escenario: HU02-E02 · Nombre duplicado rechazado
    Dado que el catálogo ya tiene un producto llamado "Pizza Napolitana"
    Cuando intento dar de alta otro producto llamado "pizza napolitana"
    Entonces el sistema lo rechaza
    Y muestra un mensaje en español indicando que ya existe un producto con ese nombre
    Y el error aparece asociado al campo del nombre

  Escenario: HU02-E03 · Precio inválido rechazado
    Dado que estoy dando de alta un producto
    Cuando ingreso un precio de cero, negativo o con decimales
    Entonces el sistema lo rechaza
    Y muestra un mensaje en español asociado al campo del precio

  Escenario: HU02-E04 · La descripción es obligatoria
    Dado que estoy dando de alta un producto
    Cuando dejo la descripción vacía o escribo menos de 20 caracteres
    Entonces el sistema lo rechaza
    Y muestra un mensaje en español asociado al campo de la descripción
    Y el formulario explica que la descripción es lo que permite encontrar el producto por voz

  Escenario: HU02-E05 · El formulario enseña a describir
    Dado que estoy dando de alta un producto
    Cuando llego al campo de la descripción
    Entonces veo junto al campo un ejemplo de descripción bien escrita
    Y una explicación en español de para qué se usa

  Escenario: HU02-E06 · Ingredientes opcionales con advertencia
    Dado que estoy dando de alta un producto
    Cuando dejo el campo de ingredientes vacío
    Entonces el producto se guarda igualmente
    Y cuando el cliente ve un producto con ingredientes declarados
    Entonces la pantalla advierte en español que es información referencial
      y no una declaración de alérgenos

  Escenario: HU02-E07 · Edición de producto
    Dado un producto existente en el catálogo
    Cuando modifico su nombre, descripción, ingredientes, precio o clasificación
    Entonces los cambios quedan guardados
    Y el cliente ve la versión actualizada en el menú

  Escenario: HU02-E08 · Marcar un producto como agotado
    Dado un producto activo y disponible
    Cuando lo marco como agotado
    Entonces el cliente sigue viéndolo en el menú con la marca "Agotado"
    Y no puede agregarlo al carrito

  Escenario: HU02-E09 · Reponer un producto agotado
    Dado un producto marcado como agotado
    Cuando lo marco como disponible otra vez
    Entonces el cliente puede volver a agregarlo al carrito
    Y la marca "Agotado" desaparece

  Escenario: HU02-E10 · Baja lógica de un producto
    Dado un producto activo en el catálogo
    Cuando lo doy de baja
    Entonces desaparece del menú del cliente
    Y sigue apareciendo en mi administración del catálogo, marcado como dado de baja

  Escenario: HU02-E11 · Reactivación de un producto dado de baja
    Dado un producto dado de baja
    Cuando lo reactivo
    Entonces vuelve a aparecer en el menú del cliente
    Y conserva el nombre, la descripción, los ingredientes, el precio y la clasificación

  Escenario: HU02-E12 · El cliente no ve productos dados de baja
    Dado que inicié sesión con rol "cliente"
    Y que el negocio dio de baja un producto
    Cuando consulto el menú
    Entonces ese producto no aparece por ningún medio

  Escenario: HU02-E13 · Solo el negocio administra el catálogo
    Dado que inicié sesión con rol "cliente"
    Cuando intento acceder a la administración del catálogo
    Entonces el sistema me lo impide
    Y muestra un mensaje en español explicando que no tengo permiso

  Escenario: HU02-E14 · Menú vacío
    Dado que el catálogo no tiene ningún producto activo
    Cuando el cliente consulta el menú
    Entonces ve un mensaje en español explicando que todavía no hay productos
    Y la pantalla no muestra un error ni queda en blanco

  Escenario: HU02-E15 · Cambio de precio y pedidos ya creados
    Dado un pedido ya creado que incluye un producto de $5.000
    Cuando el negocio cambia el precio de ese producto a $6.000
    Entonces el pedido ya creado sigue mostrando $5.000
    Y los pedidos nuevos usan el precio actualizado
```

---

## Casos límite a cubrir

- Producto agotado que ya está en el carrito de un cliente cuando el negocio lo
  marca: el carrito debe advertirlo antes de confirmar el pedido (frontera con
  HU-12, se resuelve allí, se declara aquí).
- Producto dado de baja mientras está en el carrito de un cliente: mismo
  tratamiento.
- Catálogo grande: el listado del negocio necesita paginación, filtro por estado
  y búsqueda por nombre, con el mismo criterio de 20 por página que HU-09.
- Nombre con acentos, eñes o mayúsculas distintas: la unicidad los pliega.
- Dos ediciones simultáneas del mismo producto desde dos pestañas.
- Descripción muy larga, o compuesta solo de espacios en blanco.
- Precio muy alto: se declara un máximo razonable para que un dedazo no genere un
  producto de nueve cifras.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-1 | El negocio da de alta un producto completo y lo ve publicado en el menú del cliente **en menos de 3 minutos**, sin ayuda técnica. |
| SC-2 | Marcar un producto como agotado se refleja en el menú del cliente **en la siguiente carga de la pantalla**. |
| SC-3 | El **100 %** de los productos agotados o dados de baja resulta imposible de agregar al carrito. |
| SC-4 | El **0 %** de los productos dados de baja es visible para clientes o repartidores. |
| SC-5 | Ninguna acción de la interfaz elimina un producto de forma irreversible. |
| SC-6 | Marcar agotado o reponer se hace en **2 clics o menos** desde el listado del catálogo, porque ocurre en medio del servicio. |
| SC-7 | El **100 %** de los productos activos tiene una descripción de al menos 20 caracteres. No existe producto publicado sin describir. |

---

## Frontera con E2 (a respetar al especificar)

Un pedido no puede depender del estado actual del catálogo: si el negocio sube el
precio o da de baja un producto, los pedidos ya creados no pueden cambiar debajo
del cliente. La forma de garantizarlo —copiar nombre y precio en la línea de
pedido, en vez de referenciar el producto vivo— **se decide y se construye en
E2/HU-12**, pero se declara aquí porque nace de reglas de esta HU (RN-08, RN-09).

---

## Fuera de alcance de v1 (declarado, no omitido)

- Múltiples locales: v1 es mono-local, hay un solo catálogo.
- Imágenes de producto.
- Variantes y adicionales (tamaños, ingredientes extra, «sin cebolla» como opción
  de pedido; el texto de ingredientes es informativo, no configurable).
- Promociones, combos y descuentos.
- Horarios de disponibilidad (desayuno / almuerzo / cena).
- Importación masiva del catálogo desde archivo.
- Historial de cambios del catálogo (quién cambió qué precio y cuándo).
- Declaración certificada de alérgenos (ver RN-11).

---

## Decisiones que quedan abiertas para `/speckit-clarify`

1. **Si el administrador puede editar el catálogo** además del negocio, o si la
   separación estricta de RN-01 se sostiene hasta HU-07.
2. **Qué ve el cliente en un producto agotado**: solo la marca, o además la
   opción de que le avise cuando vuelva (esto último parece E7 o fuera de v1).
3. **Máximos** de precio, nombre, descripción e ingredientes.
4. **Si el mínimo de 20 caracteres de descripción es el correcto**, o conviene
   exigir más para que la búsqueda por voz tenga suficiente material.
