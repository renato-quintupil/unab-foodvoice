# Checklist de calidad del contenido del catálogo: E3 · Administración de menú

**Propósito**: someter a prueba la **redacción de los requisitos** que gobiernan el contenido del catálogo —descripciones de producto y categoría, ayuda contextual, ingredientes, semilla y paridad voz/manual—, antes de pasar a la planificación. No comprueba comportamiento del sistema: comprueba si lo escrito en la spec está completo, es claro, es coherente y es medible.

**Creado**: 2026-08-16
**Funcionalidad**: [spec.md](../spec.md)
**Profundidad**: exhaustiva · **Uso**: puerta previa a `/speckit-plan`

**Por qué este dominio**: la propia spec declara que «el riesgo real de E3 no está en el esquema, está en la calidad del contenido» (FR-036). Un esquema mal hecho se detecta al construir; una descripción pobre no rompe nada hoy y rompe la búsqueda por voz de E6 mañana, cuando ya no habrá ocasión de exigirla.

## Completitud de los requisitos de contenido

- [x] CHK001 ¿Está definido qué hace que una descripción sea «bien escrita», más allá del mínimo de caracteres? [Gap, Spec §FR-003, §FR-016]
- [ ] CHK002 ¿Está especificado el contenido concreto del ejemplo y de la explicación que acompañan a cada campo de descripción, o queda al criterio de quien construya la pantalla? [Completitud, Spec §Ayuda contextual de los campos de descripción]
- [x] CHK003 ¿Está declarada la cantidad mínima de productos y de categorías que debe dejar cargada la semilla? [Gap, Spec §FR-036]
- [ ] CHK004 ¿Está definido en qué idioma debe estar el contenido que carga la semilla, y si el negocio puede cargar contenido en otro idioma? [Gap, Spec §SC-029]
- [ ] CHK005 ¿Está especificado si el texto de una descripción admite saltos de línea, listas o cualquier otro formato, o es un párrafo plano? [Gap, Spec §Límites de los campos]
- [ ] CHK006 ¿Está definido si el nombre visible de un producto o categoría se conserva tal como lo escribió el negocio, dado que la normalización solo se declara para comparar unicidad? [Completitud, Spec §FR-004, §FR-014]
- [ ] CHK007 ¿Está documentado qué campos exactos leerá E6 de esta épica, de modo que el contrato sea verificable desde ahora? [Trazabilidad, Spec §Qué se guarda, y qué frase habilita cada dato]
- [x] CHK008 ¿Están definidos requisitos de contenido para el campo de ingredientes de la semilla, más allá de calificarlos de «reales»? [Completitud, Spec §FR-036]
- [ ] CHK009 ¿Está especificado si la semilla se ejecuta solo en desarrollo o también sobre el entorno de demostración final? [Gap, Spec §FR-036]

## Claridad y cuantificación

- [ ] CHK010 ¿Puede «descripción en prosa» distinguirse objetivamente de una lista de palabras sueltas que cumpla la longitud? [Ambigüedad, Spec §RN-017]
- [x] CHK011 ¿Está cuantificado el término «descripciones bien escritas» que la semilla debe cumplir, o remite únicamente al mínimo de 30 caracteres? [Ambigüedad, Spec §FR-036]
- [ ] CHK012 ¿Está definido el término «ingredientes reales» con algún criterio comprobable? [Ambigüedad, Spec §FR-036]
- [x] CHK013 ¿Está declarado si los mínimos de 20 y 30 caracteres se miden antes o después de recortar los espacios de los extremos, en ambos campos por igual? [Claridad, Spec §Límites de los campos]
- [ ] CHK014 ¿Es inequívoco que el mínimo es inclusivo —que una descripción de exactamente 20 o 30 caracteres se acepta—? [Claridad, Spec §FR-003, §FR-016]
- [x] CHK015 ¿Está definido qué significa que la semilla «no sobrescriba cambios hechos a mano»: por qué campo se reconoce que un registro ya existe? [Ambigüedad, Spec §Supuesto 15]
- [ ] CHK016 ¿Está claro si la explicación de la ayuda contextual debe ser un texto fijo compartido o puede redactarse distinto en cada formulario? [Claridad, Spec §Ayuda contextual de los campos de descripción]

## Consistencia entre requisitos

- [x] CHK017 ¿Es coherente el tratamiento de los espacios de los extremos entre la fila de descripción del producto y la de la categoría, que no lo declaran igual? [Consistencia, Spec §Límites de los campos]
- [x] CHK018 ¿Concuerda la tabla de frases habilitadas con el carácter **opcional** del campo de ingredientes, dado que atribuye a ese campo las frases «sin cebolla» y «algo vegetariano»? [Conflicto, Spec §Qué se guarda, y qué frase habilita cada dato · §FR-017]
- [x] CHK019 ¿Es compatible el catálogo de referencia de 50 productos activos con lo que la semilla se compromete a cargar? [Conflicto, Spec §SC-030 · §FR-036]
- [ ] CHK020 ¿Usan el mismo vocabulario los requisitos de contenido y la tabla de vocabulario visible, sin introducir sinónimos prohibidos? [Consistencia, Spec §Vocabulario visible del catálogo]
- [ ] CHK021 ¿Son coherentes entre sí las exigencias de descripción al crear y al editar, tanto para producto como para categoría? [Consistencia, Spec §FR-013, §FR-006]
- [ ] CHK022 ¿Coincide lo que FR-034 obliga a mostrar en la ficha con los campos que §Límites de los campos declara existentes? [Consistencia, Spec §FR-034]

## Calidad de los criterios de aceptación

- [ ] CHK023 ¿Es objetivamente medible el criterio que declara resueltas las cinco categorías de intención recorriendo una tabla? [Medibilidad, Spec §SC-011]
- [ ] CHK024 ¿Es reproducible un criterio que se comprueba «eligiendo tres productos al azar», o depende de qué tres se elijan? [Medibilidad, Spec §SC-025]
- [x] CHK025 ¿Mide algún criterio de éxito la **calidad** del contenido de la semilla, o solo su longitud y su idempotencia? [Gap, Spec §SC-026]
- [ ] CHK026 ¿Existe un criterio de éxito que ampare la ayuda contextual con la misma exigencia con que FR-005 y FR-016 la imponen? [Cobertura, Spec §SC-019]
- [x] CHK027 ¿Está declarado quién juzga si una descripción cumple, cuando el criterio no es la longitud sino la utilidad para la voz? [Gap, Spec §RN-017]

## Cobertura de escenarios

- [ ] CHK028 ¿Hay requisitos para el flujo alterno de editar una descripción existente dejándola por debajo del mínimo? [Cobertura, Spec §FR-013]
- [x] CHK029 ¿Están definidos requisitos para el caso de excepción de una semilla que encuentre un nombre ya ocupado en forma normalizada? [Gap, Excepción, Spec §FR-036]
- [ ] CHK030 ¿Está definido qué estado queda si la semilla se interrumpe a mitad de su ejecución? [Gap, Recuperación, Spec §FR-036]
- [x] CHK031 ¿Están cubiertos con requisitos los tres tramos de precio que la semilla debe producir, incluida la comprobación de que existen los tres? [Cobertura, Spec §SC-026]
- [x] CHK032 ¿Hay requisitos que describan qué ve el cliente en la ficha de un producto **sin** ingredientes declarados? [Gap, Spec §FR-034]

## Cobertura de casos límite del contenido

- [x] CHK033 ¿Está definido el tratamiento de una descripción que cumple la longitud pero es una repetición del nombre o una cadena de caracteres sin sentido? [Caso límite, Gap, Spec §FR-003]
- [x] CHK034 ¿Está declarado si un campo de ingredientes vacío equivale a ausente a efectos de mostrar la advertencia obligatoria? [Ambigüedad, Spec §FR-017]
- [ ] CHK035 ¿Está definido cómo se presenta una descripción de 1.000 caracteres dentro de un listado, y si se recorta? [Gap, Spec §Límites de los campos]
- [ ] CHK036 ¿Están cubiertos los requisitos de legibilidad del contenido largo desde 360 píxeles de ancho? [Cobertura, Spec §FR-038]
- [ ] CHK037 ¿Está definido qué ocurre con el contenido de una categoría desactivada: sigue siendo legible y editable mientras está fuera de uso? [Caso límite, Spec §FR-008, §FR-010]

## Dependencias y supuestos

- [ ] CHK038 ¿Está declarado como supuesto verificable —y no como certeza— que las descripciones en prosa bastarán para E6 sin diccionario de sinónimos? [Supuesto, Spec §Fuera de Alcance]
- [ ] CHK039 ¿Está previsto en algún requisito qué se hace si E6 descubre que necesita un dato que E3 no guardó? [Gap, Dependencia, Spec §Dependencias]
- [ ] CHK040 ¿Está documentado que la calidad del contenido cargado por el negocio real queda fuera del control del sistema, y qué parte sí se exige? [Supuesto, Spec §RN-017]

## Notas

- Marca cada ítem con `[x]` cuando el requisito correspondiente esté bien escrito, o anota debajo la enmienda que hace falta en `spec.md`.
- Un ítem que falla **no** se arregla en este archivo: se arregla enmendando la spec, y luego se marca.
- Ítems con mayor riesgo declarado por la propia spec: CHK001, CHK003, CHK011, CHK019, CHK025 y CHK027 — todos giran sobre lo mismo, que la spec exige longitud pero no calidad, y la calidad es lo que E6 necesitará.
