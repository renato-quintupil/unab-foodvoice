# Feature Specification: Búsqueda por voz

**Feature Branch**: `006-busqueda-por-voz`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Construir la búsqueda por voz (HU-06) y el agregado al carrito por voz (HU-13): que el cliente —solo el rol CLIENTE— pueda decir o escribir en lenguaje natural lo que quiere comer y recibir productos reales del catálogo, y que pueda confirmar agregar uno de esos productos al carrito con una confirmación explícita. La interpretación de la frase la hace un modelo de lenguaje que nunca tiene acceso a la base de datos ni puede ejecutar SQL: recibe una proyección de solo lectura del catálogo (productos activos y disponibles, con sus categorías y tramo de precio ya calculado por E3) y devuelve una estructura de filtros validable. El servidor valida esa estructura contra los IDs realmente enviados (allowlist), descarta cualquier ID ajeno, vuelve a consultar el estado vigente de disponibilidad, y construye la respuesta con datos reales del catálogo. La búsqueda es de solo lectura de principio a fin. Agregar al carrito por voz reutiliza esa misma búsqueda para resolver un producto candidato, revalida disponibilidad, muestra producto/cantidad/precio vigentes, y exige confirmación explícita antes de invocar el servicio de carrito ya existente de E2. Un dato nuevo se agrega al catálogo: una tabla de aptitudes dietéticas (vocabulario controlado) para declarar productos veganos. La integración usa Claude Haiku 4.5 vía API de Anthropic, con límite de 20 búsquedas/5min por sesión y tope de gasto de $15.000 CLP/mes."

## Clarifications

### Session 2026-08-23

- Q: ¿Las aptitudes dietéticas (como "Vegano") son administrables por el negocio, o "Vegano" es el único valor fijo de v1? → A: Fija en v1 — solo "Vegano", precargada por semilla, sin pantalla de administración; el negocio solo marca/desmarca la aptitud en cada producto.
- Q: ¿Qué datos de cada búsqueda por voz o texto debe registrar el sistema? → A: Solo metadatos técnicos (sesión, canal, estado final, latencia, tokens, modelo, código de error) — nunca la frase textual del cliente ni el audio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cliente busca comida hablando o escribiendo en lenguaje natural (Priority: P1)

Un cliente que sabe lo que se le antoja —«algo económico y sano», «una napolitana», «quiero chatarra»— quiere decirlo o escribirlo con sus propias palabras y recibir productos reales del local, sin tener que adivinar el nombre exacto ni recorrer filtro por filtro.

**Why this priority**: Es el escenario que da nombre a la épica y a la aplicación. Sin esto no hay búsqueda por voz; los demás escenarios dependen de que esta interpretación funcione primero.

**Independent Test**: Con un catálogo cargado (E3) y una sesión de cliente activa, se puede escribir o dictar una frase con una intención simple (precio, tipo de comida, perfil de salud o nombre de producto) y verificar que los resultados devueltos son productos reales, activos y disponibles del catálogo.

**Acceptance Scenarios**:

1. **Given** un catálogo con productos clasificados por tipo de comida y perfil de salud, **When** el cliente busca «quiero algo económico y sano», **Then** el sistema devuelve solo productos activos y disponibles que están en el tramo de precio económico y en una categoría de perfil de salud saludable.
2. **Given** un catálogo con un producto llamado «Pizza Napolitana» activo y disponible, **When** el cliente busca «quiero una napolitana», **Then** el sistema lo incluye entre los resultados.
3. **Given** una frase cuya intención admite más de una interpretación razonable que cambia el resultado (por ejemplo «algo liviano»: ¿salud, porción o precio?), **When** el cliente busca esa frase, **Then** el sistema pide una aclaración con opciones concretas derivadas del catálogo, en vez de adivinar.
4. **Given** una combinación de condiciones sin ningún producto que las cumpla todas, **When** el cliente busca esa combinación, **Then** el sistema comunica que no encontró resultados y qué entendió, sin sustituir la búsqueda por productos que cumplen solo una parte.
5. **Given** un producto que cumplía la intención pero se marcó como agotado momentos antes de responder, **When** el cliente ejecuta esa búsqueda, **Then** ese producto no aparece entre los resultados.
6. **Given** que el cliente escribió su búsqueda en vez de dictarla, **When** ejecuta la misma frase por voz en otro intento, **Then** ambos canales devuelven el mismo tipo de resultado para la misma frase — no son dos motores de búsqueda distintos.

---

### User Story 2 - Cliente agrega un producto al carrito por voz (Priority: P2)

Un cliente que ya encontró o nombró el producto que quiere («agrégame una napolitana», «ponme dos de esas») quiere confirmarlo con una palabra o un toque, en vez de tener que buscarlo, tocarlo y ajustar la cantidad a mano.

**Why this priority**: Depende de que la Historia 1 ya resuelva un producto candidato, pero es la que completa el ciclo de valor: sin ella, la búsqueda por voz solo muestra resultados y el cliente igual tiene que terminar de forma manual.

**Independent Test**: Con un producto activo y disponible ya resuelto por una búsqueda, el cliente puede pedir agregarlo, ver una pantalla de confirmación con producto, cantidad y precio vigentes, confirmar, y verificar que el producto quedó en su carrito con la cantidad correcta.

**Acceptance Scenarios**:

1. **Given** un producto activo y disponible resuelto por la búsqueda, **When** el cliente pide agregarlo y confirma en la pantalla que muestra producto, cantidad y precio, **Then** el producto queda en el carrito con esa cantidad y ese precio.
2. **Given** la misma situación anterior, **When** el cliente cancela en la pantalla de confirmación en vez de aprobar, **Then** el carrito queda exactamente igual que antes de la frase.
3. **Given** un producto que se agota entre que se muestra la confirmación y que el cliente la aprueba, **When** el cliente confirma, **Then** el sistema rechaza agregarlo con el mismo mensaje en español que usa el flujo manual de carrito, y no queda agregado.
4. **Given** una frase que no especifica cantidad («agrégame una napolitana»), **When** se muestra la pantalla de confirmación, **Then** se ve una cantidad de 1 unidad, visible y editable antes de confirmar.
5. **Given** una frase que podría referirse a más de un producto razonable («agrégame una pizza» con varias pizzas activas), **When** el cliente la dice, **Then** el sistema pide una aclaración antes de armar cualquier confirmación.

---

### User Story 3 - Cliente busca productos aptos para veganos (Priority: P3)

Un cliente vegano quiere pedir «algo para vegano» y recibir solo productos que el negocio haya declarado explícitamente aptos, no una lista adivinada a partir de los ingredientes.

**Why this priority**: Es la intención que el catálogo actual no puede resolver sin un dato nuevo (ninguna otra intención de la Historia 1 requiere un cambio de modelo de datos). Se prioriza P3 porque es un caso particular de búsqueda, no el mecanismo general.

**Independent Test**: Con al menos un producto marcado por el negocio como apto para veganos y otros sin esa marca, el cliente busca «algo para vegano» y verifica que solo recibe los marcados.

**Acceptance Scenarios**:

1. **Given** un producto marcado explícitamente como apto para veganos, **When** el cliente busca «quiero algo para vegano», **Then** ese producto aparece entre los resultados.
2. **Given** un producto sin ningún ingrediente de origen animal en su descripción pero que el negocio nunca marcó como vegano, **When** el cliente busca «quiero algo para vegano», **Then** ese producto NO aparece entre los resultados — la ausencia de marca nunca se interpreta como "sí es apto".

---

### Edge Cases

- ¿Qué pasa si el cliente deniega el permiso del micrófono o su navegador no soporta reconocimiento de voz? Debe poder seguir usando el campo de texto, los filtros manuales del menú y el carrito sin ninguna limitación.
- ¿Qué pasa si el proveedor externo de interpretación de lenguaje no responde a tiempo, devuelve un error, o la integración está deshabilitada por configuración? El menú, sus filtros manuales y el carrito deben seguir operando sin degradación.
- ¿Qué pasa si el modelo de lenguaje devuelve un identificador de categoría o producto que no estaba en la proyección enviada? El sistema lo descarta antes de tocar la base de datos y nunca lo usa para construir una respuesta.
- ¿Qué pasa si la descripción de un producto o categoría, escrita por el negocio, contiene texto que intenta instruir al modelo (por ejemplo "ignora las reglas anteriores")? El sistema no debe seguir esa instrucción; el modelo solo puede devolver la estructura de filtros pactada, nunca texto libre que se muestre como si fuera del sistema.
- ¿Qué pasa si el cliente hace más búsquedas que el límite permitido en la ventana de tiempo? El sistema rechaza las siguientes con un mensaje en español, sin dejar de mostrar el menú manual.
- ¿Qué pasa si el catálogo activo tiene menos de tres productos? Los tramos de precio no discriminan entre ellos (regla ya definida por E3); una intención de precio no debe descartar ninguno.
- ¿Qué pasa si la frase de búsqueda llega vacía, solo con espacios, o excede el largo máximo permitido? El sistema la rechaza con un mensaje en español antes de invocar al proveedor externo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a un cliente autenticado buscar productos escribiendo o dictando una frase en lenguaje natural.
- **FR-002**: Solo el rol Cliente DEBE poder invocar la búsqueda por voz/texto y el agregado al carrito por voz; los demás roles no tienen acceso a esta funcionalidad.
- **FR-003**: La interpretación de la frase DEBE realizarla un modelo de lenguaje que no tiene acceso directo a la base de datos ni puede ejecutar consultas arbitrarias; solo recibe una proyección de solo lectura de las categorías activas y los productos activos y disponibles del catálogo.
- **FR-004**: El modelo DEBE devolver únicamente una estructura de filtros validable (tramo de precio, categoría de tipo de comida, categoría de perfil de salud, términos de búsqueda, aptitud dietética, marca de recomendación abierta) — nunca productos completos ni texto libre que se muestre directamente al cliente.
- **FR-005**: El sistema DEBE validar la respuesta del modelo contra los identificadores de categoría y producto realmente enviados en la proyección, descartando cualquier identificador ajeno antes de construir la respuesta.
- **FR-006**: Antes de responder al cliente, el sistema DEBE volver a consultar el estado vigente (activo y disponible) de los productos candidatos.
- **FR-007**: Un producto que no está activo y disponible en el momento de responder NO DEBE aparecer entre los resultados de una búsqueda, aunque el modelo lo haya sugerido.
- **FR-008**: La búsqueda, por voz o por texto, NO DEBE modificar el carrito, el pedido ni ningún otro dato del sistema.
- **FR-009**: El sistema DEBE aceptar la misma solicitud de búsqueda tanto si el cliente la escribió como si la dictó por voz, transcrita a texto editable antes de enviarse.
- **FR-010**: Cuando una combinación de condiciones no tiene resultados, el sistema DEBE comunicar qué entendió de la frase, sin relajar automáticamente ninguna condición para mostrar resultados parciales.
- **FR-011**: Cuando la frase admite más de una interpretación razonable que cambia el resultado, el sistema DEBE pedir una aclaración con opciones concretas derivadas del catálogo, sin exponer al cliente ningún puntaje de confianza técnico.
- **FR-012**: El sistema DEBE permitir al negocio declarar, al crear o editar un producto, si es apto para veganos, marcando o desmarcando esa aptitud — nunca inferida de los ingredientes. En v1 "Vegano" es la única aptitud dietética, precargada por semilla; el negocio no tiene una pantalla para crear, editar o desactivar aptitudes nuevas (esa administración queda fuera de alcance de v1, ver Assumptions).
- **FR-013**: El sistema DEBE permitir al cliente buscar productos por aptitud dietética explícita («vegano»), devolviendo únicamente los productos que el negocio marcó, nunca los que simplemente no tienen ingredientes de origen animal mencionados.
- **FR-014**: El sistema DEBE limitar la frecuencia de búsquedas de un mismo cliente a 20 solicitudes cada 5 minutos.
- **FR-015**: La entrada de texto de una búsqueda DEBE tener un largo máximo, más allá del cual el sistema la rechaza con un mensaje en español antes de invocar al proveedor externo.
- **FR-016**: Si el proveedor externo de interpretación de lenguaje falla, no responde a tiempo, o está deshabilitado por configuración, el sistema DEBE seguir permitiendo al cliente usar el menú y sus filtros manuales, y el carrito, sin ninguna degradación.
- **FR-017**: El sistema NO DEBE conservar audio crudo de la voz del cliente en ningún punto del flujo.
- **FR-018**: El sistema DEBE pedir consentimiento explícito del cliente antes de activar el micrófono.
- **FR-019**: El sistema DEBE permitir a un cliente expresar, mediante una frase en lenguaje natural, la intención de agregar un producto al carrito.
- **FR-020**: Antes de agregar cualquier producto al carrito por esta vía, el sistema DEBE mostrar al cliente el producto interpretado, la cantidad y el precio vigente, y exigir una confirmación explícita separada de la frase original.
- **FR-021**: El sistema DEBE revalidar que el producto siga activo y disponible inmediatamente antes de mostrar la pantalla de confirmación de agregado.
- **FR-022**: Al confirmar, el sistema DEBE usar el mismo servicio de carrito que ya existe para el flujo manual, incluida su revalidación de disponibilidad y precio como autoridad final — sin un endpoint de escritura nuevo y paralelo.
- **FR-023**: Si el cliente cancela la confirmación o no responde, el sistema NO DEBE realizar ningún cambio en el carrito.
- **FR-024**: Cuando la frase de agregar no especifica una cantidad, el sistema DEBE asumir una unidad, mostrándola de forma visible y editable antes de que el cliente confirme.
- **FR-025**: Si al confirmar el producto ya no está disponible, el sistema DEBE mostrar el mismo mensaje de rechazo en español que usa el flujo manual de carrito, no un mensaje distinto para la vía de voz.
- **FR-026**: Si una frase de agregar puede referirse a más de un producto candidato razonable, el sistema DEBE pedir una aclaración antes de construir cualquier pantalla de confirmación.
- **FR-027**: El sistema DEBE registrar de cada búsqueda únicamente metadatos técnicos —identificador de sesión, canal (voz o texto), estado final (resultados, aclaración o sin resultados), latencia, tokens consumidos, modelo usado y código de error si corresponde—; NUNCA la frase textual del cliente ni el audio.

### Key Entities

- **Aptitud dietética**: valor precargado por el sistema (en v1, únicamente "Vegano", sin administración desde la interfaz) que el negocio asocia explícitamente a los productos que la cumplen, marcando o desmarcando la aptitud en cada producto. La ausencia de asociación significa "no declarado", nunca "declarado que no cumple".
- **Interpretación de búsqueda**: estructura de filtros (tramo de precio, categoría de tipo de comida, categoría de perfil de salud, términos de búsqueda, aptitud dietética, marca de recomendación abierta) que resulta de interpretar la frase del cliente. Nunca contiene productos directamente — solo criterios que el sistema usa para consultar el catálogo real.
- **Confirmación de agregado por voz**: paso intermedio, siempre visible, entre "el sistema entendió qué producto se pide" y "el producto quedó en el carrito". Muestra producto, cantidad y precio vigentes y exige aprobación explícita del cliente antes de escribir cualquier cambio.
- **Registro técnico de búsqueda**: entrada de telemetría por cada búsqueda, con sesión, canal, estado final, latencia, tokens, modelo y código de error. Nunca incluye la frase textual del cliente ni audio (FR-027); existe solo para depurar fallos y vigilar el SLO (SC-004) y el gasto (SC-007), no para evaluar calidad de interpretación con datos reales de producción.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Al menos el 90% de las frases de búsqueda no ambiguas de un corpus de aceptación previamente aprobado devuelven un producto correcto entre sus primeros 3 resultados.
- **SC-002**: El 0% de los resultados sugeridos, en cualquier búsqueda del corpus de aceptación, corresponde a un producto inactivo o no disponible.
- **SC-003**: El 100% de las búsquedas se completan sin ninguna escritura en el sistema; la única escritura de todo el flujo ocurre cuando el cliente confirma explícitamente agregar un producto al carrito.
- **SC-004**: Al menos el 95% de las búsquedas por voz o texto responde en 5 segundos o menos, medido en el entorno de referencia con el modelo elegido.
- **SC-005**: Un cliente puede completar su pedido usando exclusivamente el menú y el carrito manual, sin ningún paso bloqueado, cuando el micrófono está denegado o el proveedor externo falla.
- **SC-006**: El 100% de los intentos de agregar un producto al carrito por voz muestran una pantalla de confirmación con producto, cantidad y precio vigentes antes de escribir cualquier cambio en el carrito.
- **SC-007**: El costo mensual acumulado de las llamadas al proveedor de interpretación de lenguaje se mantiene por debajo de $15.000 CLP en el entorno de referencia, con una alerta configurada para detectarlo antes de superarlo.
- **SC-008**: El 100% de los productos marcados por el negocio como aptos para veganos son encontrables por esa vía, y el 0% de los productos sin esa marca aparece como resultado de una búsqueda de aptitud vegana.

## Assumptions

- **Resultado vacío**: en v1, el sistema se limita a comunicar que no encontró resultados y qué entendió de la frase; no ofrece alternativas cercanas en una sección aparte. Es el comportamiento más simple y evita que el cliente confunda una alternativa con lo que pidió.
- **Navegadores y dispositivos para voz**: v1 se apoya en el reconocimiento de voz del navegador, con el campo de texto siempre disponible como alternativa cuando el navegador no lo soporta o el permiso es denegado (Principio VI). No se construye un servicio propio de transcripción en el servidor en esta épica.
- **Retención de frases**: no se conservan frases de texto ni transcripciones para evaluación futura del sistema en v1. El corpus de frases de aceptación (Principio XI) se redacta y aprueba manualmente antes de implementar, no se recolecta desde producción.
- **Máximo de resultados por búsqueda**: 5 productos sugeridos por búsqueda.
- **Continuidad de una aclaración**: si el sistema pide aclarar, el cliente reformula la frase completa en su siguiente intento; no existe memoria conversacional persistente entre búsquedas.
- **Dueño del corpus de aceptación**: el responsable de producto del proyecto (hasta que se designe otro rol), con revisión cada vez que cambie el catálogo de forma relevante.
- **Múltiples productos en una sola frase de agregado**: soportado (D-066, decisión posterior a la implementación inicial, corrigiendo esta misma suposición). Una frase como «una napolitana y una cuatro quesos» resuelve todos los productos mencionados y los muestra en una sola pantalla de confirmación, con cantidad editable por producto; el cliente los agrega todos con una única acción. Detectado como necesario al usar la aplicación en vivo: la primera versión solo resolvía el primer producto de la frase y descartaba el resto en silencio, sin avisar al cliente.
- **Producto que ya está en el carrito**: si el cliente pide agregar un producto que ya tiene en el carrito, el sistema suma la cantidad a la que ya existía, igual que en el flujo manual, en vez de preguntar.
- **Confirmación de agregado por voz**: en v1 la confirmación se realiza solo por interacción manual (botón o toque) sobre la pantalla de confirmación, no repitiendo la frase por voz — reduce el riesgo de interpretar mal un "sí" ambiguo.
- **Proveedor y modelo de lenguaje**: Claude Haiku 4.5 vía API de Anthropic, decidido por tratarse de un proyecto de titulación con presupuesto de estudiante y una tarea (clasificar una frase corta contra categorías del catálogo) muy por debajo del techo de un modelo pequeño.
- **Vectores y búsqueda semántica (embeddings/`pgvector`)**: fuera de alcance de v1. El catálogo actual (decenas de productos, mono-local) no lo justifica; se evaluará con evidencia real de la operación de esta épica, no por anticipado.
- **Múltiples locales**: fuera de alcance de v1, ya declarado en el mapa de épicas del proyecto.
- **Administración de aptitudes dietéticas**: fuera de alcance de v1. El negocio no puede crear, editar ni desactivar aptitudes dietéticas desde la interfaz; "Vegano" es el único valor y se precarga por semilla. Si el negocio necesita más aptitudes, se agrega una pantalla de administración en una iteración posterior, sin requerir otra migración de esquema (la tabla ya lo permite).
