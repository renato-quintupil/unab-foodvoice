# Checklist de calidad del contenido del catálogo: E3 · Administración de menú

**Propósito**: someter a prueba la **redacción de los requisitos** que gobiernan el contenido del catálogo —descripciones de producto y categoría, ayuda contextual, ingredientes, semilla y paridad voz/manual—, antes de pasar a la planificación. No comprueba comportamiento del sistema: comprueba si lo escrito en la spec está completo, es claro, es coherente y es medible.

**Creado**: 2026-08-16
**Funcionalidad**: [spec.md](../spec.md)
**Profundidad**: exhaustiva · **Uso**: puerta previa a `/speckit-plan`

**Revisado y cerrado**: 2026-08-16, antes de `/speckit-implement`. Los 24 ítems que quedaron sin marcar en la primera pasada se contrastaron uno a uno contra `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/` y `quickstart.md`. **Dieciséis** estaban ya resueltos por la fase de diseño y se marcan con la nota de dónde. Los **ocho** restantes se cerraron enmendando los artefactos, según § Enmiendas aplicadas. Los **40 ítems están completos**.

**Por qué este dominio**: la propia spec declara que «el riesgo real de E3 no está en el esquema, está en la calidad del contenido» (FR-036). Un esquema mal hecho se detecta al construir; una descripción pobre no rompe nada hoy y rompe la búsqueda por voz de E6 mañana, cuando ya no habrá ocasión de exigirla.

## Completitud de los requisitos de contenido

- [x] CHK001 ¿Está definido qué hace que una descripción sea «bien escrita», más allá del mínimo de caracteres? [Gap, Spec §FR-003, §FR-016]
- [x] CHK002 ¿Está especificado el contenido concreto del ejemplo y de la explicación que acompañan a cada campo de descripción, o queda al criterio de quien construya la pantalla? [Completitud, Spec §Ayuda contextual de los campos de descripción]
  - *Resuelto en `contracts/shared.md` § Mensajes fijos: `AYUDA_DESCRIPCION_PRODUCTO` y `AYUDA_DESCRIPCION_CATEGORIA` contienen el ejemplo completo y la explicación, viven en `packages/shared` y son la única fuente de su redacción. No queda al criterio de la pantalla.*
- [x] CHK003 ¿Está declarada la cantidad mínima de productos y de categorías que debe dejar cargada la semilla? [Gap, Spec §FR-036]
- [x] CHK004 ¿Está definido en qué idioma debe estar el contenido que carga la semilla, y si el negocio puede cargar contenido en otro idioma? [Gap, Spec §SC-029]
  - *Enmendado: **supuesto 26** distingue el texto **de la aplicación** —al que SC-029 exige español porque el proyecto lo controla— del **dato** que escribe el negocio, que no se restringe por idioma porque no habría forma de aplicar la regla. La semilla, en español.*
- [x] CHK005 ¿Está especificado si el texto de una descripción admite saltos de línea, listas o cualquier otro formato, o es un párrafo plano? [Gap, Spec §Límites de los campos]
  - *Enmendado: § Límites declara la descripción **párrafo plano**, con saltos y tabulaciones colapsados a un espacio antes de validar y de guardar; FR-039 precisa que un salto separa palabras; D-033 registra la decisión y las alternativas descartadas; `contracts/shared.md` la traslada al esquema. Ingredientes sigue siendo texto libre.*
- [x] CHK006 ¿Está definido si el nombre visible de un producto o categoría se conserva tal como lo escribió el negocio, dado que la normalización solo se declara para comparar unicidad? [Completitud, Spec §FR-004, §FR-014]
  - *Resuelto en `data-model.md`: `category.name` y `product.name` «se guardan tal como lo escribió el negocio»; `name_normalized` es una columna aparte, derivada, y `contracts/shared.md` declara que no se expone en ningún DTO.*
- [x] CHK007 ¿Está documentado qué campos exactos leerá E6 de esta épica, de modo que el contrato sea verificable desde ahora? [Trazabilidad, Spec §Qué se guarda, y qué frase habilita cada dato]
  - *Resuelto: la tabla de § Qué se guarda enumera los siete datos y la frase que habilita cada uno, SC-011 la convierte en comprobación recorrible, y `data-model.md` § Lo que deja preparado para E2 y E6 lo acota a las dos columnas `description` —sin vectores, sinónimos ni columna de intención—.*
- [x] CHK008 ¿Están definidos requisitos de contenido para el campo de ingredientes de la semilla, más allá de calificarlos de «reales»? [Completitud, Spec §FR-036]
- [x] CHK009 ¿Está especificado si la semilla se ejecuta solo en desarrollo o también sobre el entorno de demostración final? [Gap, Spec §FR-036]
  - *Resuelto en D-028: «es una herramienta de arranque y de demostración», ejecutada con `pnpm --filter api db:seed` junto a la semilla del administrador de E1. `quickstart.md` la incluye en la puesta en marcha y la ejercita en V-54.*

## Claridad y cuantificación

- [x] CHK010 ¿Puede «descripción en prosa» distinguirse objetivamente de una lista de palabras sueltas que cumpla la longitud? [Ambigüedad, Spec §RN-017]
  - *Resuelto por FR-039: tres condiciones mecánicas y comprobables (cinco palabras de 2+ caracteres, cinco palabras distintas, no repetir el nombre). La spec declara además de forma expresa el límite de lo que esas condiciones logran: descartan la basura evidente y no juzgan la prosa.*
- [x] CHK011 ¿Está cuantificado el término «descripciones bien escritas» que la semilla debe cumplir, o remite únicamente al mínimo de 30 caracteres? [Ambigüedad, Spec §FR-036]
- [x] CHK012 ¿Está definido el término «ingredientes reales» con algún criterio comprobable? [Ambigüedad, Spec §FR-036]
  - *Enmendado: **SC-032** se extiende a los ingredientes y fija el criterio —al menos **tres componentes reconocibles** del producto, no adjetivos ni frases, coherentes con su nombre y su descripción—, con el ejemplo que lo hace inequívoco: «masa, mozzarella, tomate» cumple; «ingredientes frescos de primera calidad» no. V-49 lo recorre.*
- [x] CHK013 ¿Está declarado si los mínimos de 20 y 30 caracteres se miden antes o después de recortar los espacios de los extremos, en ambos campos por igual? [Claridad, Spec §Límites de los campos]
- [x] CHK014 ¿Es inequívoco que el mínimo es inclusivo —que una descripción de exactamente 20 o 30 caracteres se acepta—? [Claridad, Spec §FR-003, §FR-016]
  - *Enmendado: § Límites declara que **todos** los límites de longitud de la sección son inclusivos, con el caso de borde explícito, y `contracts/shared.md` lo confirma para los cuatro pares. Las pruebas de borde tienen ahora texto que las respalde.*
- [x] CHK015 ¿Está definido qué significa que la semilla «no sobrescriba cambios hechos a mano»: por qué campo se reconoce que un registro ya existe? [Ambigüedad, Spec §Supuesto 15]
- [x] CHK016 ¿Está claro si la explicación de la ayuda contextual debe ser un texto fijo compartido o puede redactarse distinto en cada formulario? [Claridad, Spec §Ayuda contextual de los campos de descripción]
  - *Resuelto en `contracts/shared.md`: es texto fijo compartido en `packages/shared`. «Que vivan aquí y no en cada formulario es lo que garantiza que las dos pantallas enseñen lo mismo y que SC-019 se pueda comprobar en un solo sitio.»*

## Consistencia entre requisitos

- [x] CHK017 ¿Es coherente el tratamiento de los espacios de los extremos entre la fila de descripción del producto y la de la categoría, que no lo declaran igual? [Consistencia, Spec §Límites de los campos]
- [x] CHK018 ¿Concuerda la tabla de frases habilitadas con el carácter **opcional** del campo de ingredientes, dado que atribuye a ese campo las frases «sin cebolla» y «algo vegetariano»? [Conflicto, Spec §Qué se guarda, y qué frase habilita cada dato · §FR-017]
- [x] CHK019 ¿Es compatible el catálogo de referencia de 50 productos activos con lo que la semilla se compromete a cargar? [Conflicto, Spec §SC-030 · §FR-036]
- [x] CHK020 ¿Usan el mismo vocabulario los requisitos de contenido y la tabla de vocabulario visible, sin introducir sinónimos prohibidos? [Consistencia, Spec §Vocabulario visible del catálogo]
  - *Resuelto: `contracts/shared.md` § Etiquetas visibles centraliza las cuatro tablas (`ETIQUETA_DIMENSION`, `ETIQUETA_TRAMO`, `ETIQUETA_ESTADO_PRODUCTO`, `ETIQUETA_ESTADO_CATEGORIA`) y enumera los sinónimos prohibidos, «de modo que el vocabulario no se improvisa pantalla a pantalla y la prohibición es revisable en un solo archivo».*
- [x] CHK021 ¿Son coherentes entre sí las exigencias de descripción al crear y al editar, tanto para producto como para categoría? [Consistencia, Spec §FR-013, §FR-006]
  - *Resuelto: § Límites abre con «las mismas reglas rigen al crear y al editar, de modo que ninguna edición pueda dejar un registro en un estado que su alta habría rechazado»; FR-013 lo repite para el producto y FR-006 para la categoría. En los contratos, `UpdateProductSchema` y `UpdateCategorySchema` aplican el mismo `validarDescripcion` que los de alta.*
- [x] CHK022 ¿Coincide lo que FR-034 obliga a mostrar en la ficha con los campos que §Límites de los campos declara existentes? [Consistencia, Spec §FR-034]
  - *Resuelto: los cinco datos que FR-034 exige —nombre, descripción, precio, estado e ingredientes con su advertencia— existen todos en § Límites, y `ProductDto` los expone todos, con `status` derivado de los dos interruptores.*

## Calidad de los criterios de aceptación

- [x] CHK023 ¿Es objetivamente medible el criterio que declara resueltas las cinco categorías de intención recorriendo una tabla? [Medibilidad, Spec §SC-011]
  - *Resuelto por la enmienda de SC-011, que fija el sustrato y el juicio: se recorre la tabla **sobre el catálogo de la semilla** comprobando que cada frase tiene ahí un dato que la resuelve, con la salvedad declarada de las frases que dependen de ingredientes. Se ejercita en V-32 a V-38 y V-41.*
- [x] CHK024 ¿Es reproducible un criterio que se comprueba «eligiendo tres productos al azar», o depende de qué tres se elijan? [Medibilidad, Spec §SC-025]
  - *Enmendado en los dos sitios: **SC-025** sustituye «al azar» por un criterio de selección declarado —uno de cada tramo de precio, los tres de categorías de tipo de comida distintas—, exige anotar cuáles fueron en `verificacion.md`, y explica por qué el azar no servía: tres productos de la misma categoría y el mismo tramo no ejercitan los filtros que el criterio existe para probar. **V-41** lo recoge.*
- [x] CHK025 ¿Mide algún criterio de éxito la **calidad** del contenido de la semilla, o solo su longitud y su idempotencia? [Gap, Spec §SC-026]
- [x] CHK026 ¿Existe un criterio de éxito que ampare la ayuda contextual con la misma exigencia con que FR-005 y FR-016 la imponen? [Cobertura, Spec §SC-019]
  - *Resuelto: SC-019 exige que el **100 %** de los formularios con campo de descripción muestre, sin interacción previa, el ejemplo y la explicación —la misma exigencia de FR-005 y FR-016—, y `quickstart.md` lo comprueba en V-05, declarándolo sin cobertura automática.*
- [x] CHK027 ¿Está declarado quién juzga si una descripción cumple, cuando el criterio no es la longitud sino la utilidad para la voz? [Gap, Spec §RN-017]

## Cobertura de escenarios

- [x] CHK028 ¿Hay requisitos para el flujo alterno de editar una descripción existente dejándola por debajo del mínimo? [Cobertura, Spec §FR-013]
  - *Resuelto: § Límites lo declara como propósito explícito («ninguna edición pueda dejar un registro en un estado que su alta habría rechazado») y FR-013 cierra con «la validación es idéntica al crear (FR-012) y al editar (FR-018)».*
- [x] CHK029 ¿Están definidos requisitos para el caso de excepción de una semilla que encuentre un nombre ya ocupado en forma normalizada? [Gap, Excepción, Spec §FR-036]
- [x] CHK030 ¿Está definido qué estado queda si la semilla se interrumpe a mitad de su ejecución? [Gap, Recuperación, Spec §FR-036]
  - *Resuelto por la idempotencia de D-028: la semilla busca cada registro por su nombre normalizado y crea solo lo que falta, de modo que una ejecución interrumpida deja un catálogo parcial que la ejecución siguiente completa sin duplicar nada. No hace falta ni transacción global ni limpieza previa.*
- [x] CHK031 ¿Están cubiertos con requisitos los tres tramos de precio que la semilla debe producir, incluida la comprobación de que existen los tres? [Cobertura, Spec §SC-026]
- [x] CHK032 ¿Hay requisitos que describan qué ve el cliente en la ficha de un producto **sin** ingredientes declarados? [Gap, Spec §FR-034]

## Cobertura de casos límite del contenido

- [x] CHK033 ¿Está definido el tratamiento de una descripción que cumple la longitud pero es una repetición del nombre o una cadena de caracteres sin sentido? [Caso límite, Gap, Spec §FR-003]
- [x] CHK034 ¿Está declarado si un campo de ingredientes vacío equivale a ausente a efectos de mostrar la advertencia obligatoria? [Ambigüedad, Spec §FR-017]
- [x] CHK035 ¿Está definido cómo se presenta una descripción de 1.000 caracteres dentro de un listado, y si se recorta? [Gap, Spec §Límites de los campos]
  - *Enmendado: la sección nueva **§ Presentación de la descripción en los listados** fija el recorte a 160 caracteres en el último espacio anterior al límite, íntegra en la ficha y en los formularios, y solo de presentación —el filtro y la búsqueda operan sobre el texto completo—. FR-023 y FR-031 la referencian, D-033 registra la decisión, `contracts/shared.md` declara `recortarDescripcion` y `MAX_DESCRIPCION_LISTADO`, y V-56 lo comprueba.*
- [x] CHK036 ¿Están cubiertos los requisitos de legibilidad del contenido largo desde 360 píxeles de ancho? [Cobertura, Spec §FR-038]
  - *Resuelto por FR-038, que nombra expresamente el listado de productos —«que tiene más columnas que el de usuarios»— y exige que se desplace o se reorganice pero no se recorte. Se comprueba en V-48.*
- [x] CHK037 ¿Está definido qué ocurre con el contenido de una categoría desactivada: sigue siendo legible y editable mientras está fuera de uso? [Caso límite, Spec §FR-008, §FR-010]
  - *Resuelto: FR-010 la mantiene visible en la administración con su estado; FR-008 garantiza que conserva nombre, descripción y dimensión; y `PATCH /business/categories/:id` no condiciona la edición al estado, de modo que una categoría desactivada se puede editar. V-10 y V-11 lo recorren.*

## Dependencias y supuestos

- [x] CHK038 ¿Está declarado como supuesto verificable —y no como certeza— que las descripciones en prosa bastarán para E6 sin diccionario de sinónimos? [Supuesto, Spec §Fuera de Alcance]
  - *Enmendado: **supuesto 27** lo declara «la apuesta central de la épica», nombra a **E6 como quien la confirma o la refuta** —E3 no tiene modelo al que preguntar— y acota qué garantiza E3 en cambio: que la prosa exista, tenga sustancia mínima (FR-039) y esté revisada en la semilla (SC-032). Si no bastara, se leería como el riesgo anotado y no como un defecto sorpresa.*
- [x] CHK039 ¿Está previsto en algún requisito qué se hace si E6 descubre que necesita un dato que E3 no guardó? [Gap, Dependencia, Spec §Dependencias]
  - *Enmendado: § Dependencias declara que un dato así es **un requisito de E6**, con su propia migración y su criterio de éxito, no una deuda de esta épica; que SC-011 existe para detectar el hueco **aquí**; y que E3 no añade columnas por si acaso, porque un campo sin frase que lo justifique es alcance fantasma (Principio III).*
- [x] CHK040 ¿Está documentado que la calidad del contenido cargado por el negocio real queda fuera del control del sistema, y qué parte sí se exige? [Supuesto, Spec §RN-017]
  - *Resuelto por el párrafo de cierre de FR-039: las tres condiciones «son deliberadamente mecánicas y de mínimos: descartan la basura evidente sin pretender juzgar la calidad de la prosa, que ningún sistema puede evaluar y que se cuida por otra vía —la ayuda contextual que enseña a escribirla y la revisión humana del contenido de la semilla—». El supuesto 21 registra además las dos alternativas descartadas.*

## Enmiendas aplicadas

Los ocho ítems que seguían abiertos se cerraron el 2026-08-16 enmendando los artefactos, **antes** de escribir una sola línea de código. Ninguna enmienda amplía el alcance de la épica: seis precisan requisitos que ya existían y dos declaran supuestos que estaban implícitos.

| Ítem | Enmienda | Dónde |
|---|---|---|
| **CHK005** | Descripción = párrafo plano; saltos y tabulaciones colapsados a un espacio antes de validar y de guardar; un salto separa palabras para FR-039 | `spec.md` § Límites, FR-039 · `research.md` D-033 · `contracts/shared.md` |
| **CHK035** | Recorte a 160 caracteres en los dos listados, íntegra en la ficha y en los formularios, solo de presentación | `spec.md` § Presentación de la descripción en los listados, FR-023, FR-031 · D-033 · `contracts/shared.md` (`recortarDescripcion`, `MAX_DESCRIPCION_LISTADO`) · `plan.md` (`format/texto.ts`) · V-56 |
| **CHK014** | Todos los límites de longitud son inclusivos, con el caso de borde explícito | `spec.md` § Límites · `contracts/shared.md` |
| **CHK012** | «Ingredientes reales» = al menos tres componentes reconocibles, no adjetivos, coherentes con nombre y descripción | `spec.md` SC-032 · V-49 |
| **CHK024** | SC-025 con criterio de selección declarado —un producto por tramo, tres categorías distintas— y anotación en `verificacion.md` | `spec.md` SC-025 · V-41 |
| **CHK004** | Español exigible al texto de la aplicación y a la semilla; el contenido del negocio no se restringe por idioma | `spec.md` supuesto 26 |
| **CHK038** | La suficiencia de la prosa para E6 es un supuesto, y E6 es quien lo confirma o lo refuta | `spec.md` supuesto 27 |
| **CHK039** | Un dato que E6 necesite y E3 no guardó es un requisito de E6, no una deuda de E3 | `spec.md` § Dependencias |

**Solo CHK005 y CHK035 tenían consecuencia sobre la construcción**, y por eso se cerraron antes de la Fase A: deciden la forma del control de descripción, el comportamiento de `validarDescripcion` ante un salto de línea y una función nueva en `packages/shared`. Los otros seis son texto.

Consecuencia sobre el plan: **una función compartida nueva** (`recortarDescripcion` en `format/texto.ts`, con sus unitarias), **una decisión nueva** (D-033) y **un paso de validación nuevo** (V-56, que eleva la guía a 56 pasos).

## Notas

- Marca cada ítem con `[x]` cuando el requisito correspondiente esté bien escrito, o anota debajo la enmienda que hace falta en `spec.md`.
- Un ítem que falla **no** se arregla en este archivo: se arregla enmendando la spec, y luego se marca.
- Ítems con mayor riesgo declarado por la propia spec: CHK001, CHK003, CHK011, CHK019, CHK025 y CHK027 — todos giran sobre lo mismo, que la spec exige longitud pero no calidad, y la calidad es lo que E6 necesitará. **Los seis quedaron resueltos** por la enmienda que introdujo FR-039, SC-031 y SC-032.
