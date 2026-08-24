# HU-06 — Búsqueda asistida por voz

> Borrador de historia de usuario, preparatorio de la spec de **E6 · Búsqueda
> por voz**. Material de entrada para `/speckit.specify`, no la spec en sí.
> Se apoya en dos documentos previos que no reemplazan ni autorizan la spec:
> [`analisis_codex.md`](../analisis_foodvoice/analisis_codex.md) (dirección
> técnica y funcional propuesta) y
> [`revision_claude.md`](../analisis_foodvoice/revision_claude.md) (revisión
> crítica de ese análisis). Se lee junto a [HU-13](./HU-13-agregar-al-carrito-por-voz.md)
> (agregar al carrito por voz, misma épica, HU siguiente) y a
> [HU-14](./HU-14-metadata-y-clasificacion-de-productos.md) (E3, de donde sale
> el catálogo que esta HU consulta).

**Como** cliente, **quiero** decir o escribir en lenguaje natural lo que
quiero comer —«algo económico y sano», «una napolitana», «quiero chatarra»—
**y que el sistema me muestre productos reales de este local**, para no tener
que adivinar el nombre exacto ni navegar filtro por filtro cuando ya sé lo que
se me antoja.

| Campo | Valor |
| --- | --- |
| **Épica** | E6 · Búsqueda por voz |
| **Depende de** | HU-14 (categorías con descripción, tramos de precio) y HU-02 (productos activos/disponibles), ambas de E3 |
| **Consume** | El catálogo que E3 ya deja cargado; agrega la tabla de aptitudes dietéticas de la sección 7 |
| **Consumida por** | HU-13 (agregar al carrito por voz reutiliza esta búsqueda para resolver el producto antes de confirmar) |
| **Rol habilitado** | Solo `CLIENTE` (decidido 2026-08-23) — negocio, admin y repartidor no tienen caso de uso real y cada búsqueda cuesta dinero de proveedor |
| **Proveedor / modelo LLM** | Claude Haiku 4.5, vía API de Anthropic (decidido 2026-08-23; es proyecto de titulación con presupuesto de estudiante, ver sección 8) |

**Justificación de orden**: E6 va después de E3 y E2 en el orden sugerido
(`docs/epicas-hu/EPICS.md`) porque necesita un catálogo ya clasificado
(E3) y, para HU-13, un carrito que ya exista y valide disponibilidad (E2).

---

## Lo que esta HU es y lo que no es

**Esta HU no le da a ningún modelo de lenguaje acceso a la base de datos ni a
SQL.** El LLM interpreta una frase y devuelve una estructura de filtros; el
servidor —no el modelo— decide qué productos existen, están activos y
disponibles, ejecutando la consulta real contra PostgreSQL. Esta frontera no
es un detalle de implementación: es la que impide que el sistema pueda
"alucinar" un producto que no existe o mostrar uno agotado (Principios VII y
VIII de la constitución).

**Esta HU no escribe nada.** Buscar —por voz o por texto— nunca agrega
productos al carrito ni modifica ningún dato. Esa acción es HU-13, que además
exige una confirmación explícita separada (Principio IX). HU-06 termina en
"aquí están los productos que entendí", nunca en "ya los agregué".

**Esta HU no reemplaza los filtros manuales del menú (E3).** Conviven: la
misma consulta de texto libre debe funcionar por micrófono o por teclado, y el
cliente puede seguir usando los desplegables de categoría y precio en
cualquier momento (Principio VI, paridad manual no negociable).

---

## Qué ya existe en el sistema (2026-08-23)

Antes de especificar, esto es lo que E1/E2/E3 ya construyeron y sobre lo que
HU-06 se apoya:

- **El catálogo ya está clasificado para esto.** `Product` tiene `name`,
  `description`, `ingredients` (opcional, informativo), `price` (entero CLP),
  y exactamente una `Category` por cada una de las dos dimensiones fijas
  (`foodTypeCategoryId`, `healthProfileCategoryId`). Cada `Category` tiene
  `name` y `description` — el campo que HU-14 diseñó explícitamente para que
  un modelo de lenguaje lo lea (`services/api/prisma/schema.prisma:181`, "El
  dato que hará funcionar la búsqueda por voz de E6").
- **Los tramos de precio (`ECONOMICO`/`MEDIO`/`CARO`) ya se calculan**, sin
  columna propia, partiendo en tercios la distribución de precios de los
  productos activos (`products/price-tier.ts`, E3). HU-06 los consume tal
  cual; no le corresponde recalcularlos ni redefinir los cortes.
- **`MenuService.consultar()` (E3) ya expone el menú**, pero incluye
  productos `active && !available` (agotados) para mostrarlos marcados en la
  vista manual. Esta HU **no puede reutilizar ese método sin filtrar**: la
  candidatura para sugerir o agregar por voz exige `active && available`
  (Principio VIII). El análisis previo señala esta diferencia como un punto a
  resolver dentro de un método común del dominio de menú, no como una
  limitación aceptable.
- **No existe ningún endpoint de búsqueda todavía.** `GET /menu` (E3) es
  consulta con filtros exactos (categoría, tramo), no interpretación de
  lenguaje natural. HU-06 agrega el endpoint nuevo; no modifica ni reemplaza
  el existente.
- **No hay ninguna integración con un proveedor de modelos de lenguaje en el
  código.** No hay adaptador, no hay variable de entorno `LLM_*`, no hay
  dependencia instalada. Esta HU es la primera vez que el proyecto habla con
  un servicio externo de IA.
- **No existe ningún dato de aptitud dietética** en `Product`
  (`services/api/prisma/schema.prisma:203`). Es el único vacío de datos que
  el análisis previo identifica como necesario para cubrir todas las frases
  del alcance pedido (ver sección 7, ya resuelta con vocabulario controlado).

---

## La arquitectura que esta HU debe seguir

Ambos documentos de análisis coinciden en la misma dirección, y ninguno de los
dos recomienda vectores ni acceso directo a base de datos para v1. Se resume
así:

```
Voz o texto (misma frase) ──▶ POST /menu/search
                                     │
                        ┌────────────┼─────────────┐
                        ▼            ▼              ▼
              Catálogo permitido  LLM (sin      Validación Zod
             active && available  credenciales   + IDs permitidos
                        │           de BD)             │
                        └────────────┴──────────────────┘
                                     │
                       Reconsulta del catálogo vigente
                                     │
                    ┌────────────────┴─────────────────┐
                    ▼                                   ▼
          resultados / aclaración / sin resultados   (HU-13 confirma aparte)
```

Puntos no negociables que esta HU hereda de la constitución y del análisis
previo, y que la spec debe convertir en requisitos verificables:

1. El LLM **nunca** recibe credenciales de base de datos, SQL, ni la
   capacidad de ejecutar nada. Solo recibe una proyección de solo lectura:
   categorías activas (id, nombre, descripción) y productos activos +
   disponibles (id, nombre, descripción, ingredientes, categorías, tramo).
2. El LLM devuelve **una estructura JSON validable**, no productos. Los
   campos posibles son los que ya modela el dominio: `priceTier`,
   `foodTypeCategoryId`, `healthProfileCategoryId`, términos de búsqueda
   sobre nombre/descripción, y una marca de recomendación abierta.
   Cualquier ID que el modelo devuelva y no estuviera en la proyección
   enviada se descarta; el incidente se registra, nunca se consulta fuera de
   esa lista (allowlist).
3. **El servidor reconsulta el estado vigente antes de responder.** Entre que
   se arma la proyección y el modelo responde puede cambiar la
   disponibilidad; la respuesta final sale de una consulta fresca a
   PostgreSQL, nunca de lo que el modelo "recuerda" del catálogo.
4. **Cero escrituras en toda esta HU.** Ni en el pedido, ni en el carrito, ni
   en ninguna tabla de negocio.
5. La voz y el texto **convergen en la misma búsqueda**: el micrófono
   transcribe a texto editable, y ese texto es la misma solicitud que si el
   cliente hubiera escrito directamente. No hay dos motores de búsqueda.
6. **Falla el proveedor externo → el menú manual sigue intacto.** Un
   timeout, un error o la integración deshabilitada nunca debe bloquear el
   menú, sus filtros ni el carrito manual.

---

## Semántica de las frases (referencia para los criterios de aceptación)

Tomado y ajustado de `analisis_codex.md` §3, que ya lo valida contra el modelo
de datos actual:

| Frase del cliente | Se resuelve con | Nota |
| --- | --- | --- |
| «Quiero algo económico» | `priceTier = ECONOMICO` | Tramo ya calculado por E3, sin cambios |
| «Quiero algo sano» | Categoría de perfil de salud equivalente | Depende de que el negocio haya cargado esa categoría |
| «Quiero comer chatarra» | Categoría de perfil de salud "indulgente" | No se convierte en afirmación nutricional; solo mapea a la categoría, sea cual sea su nombre real |
| «Quiero hamburguesa» | Búsqueda sobre tipo/nombre | Si el catálogo no tiene, corresponde `NO_RESULTS`, no una sustitución silenciosa |
| «Quiero pizza» | Categoría de tipo de comida | — |
| «Quiero una napolitana» | Nombre de producto específico | Coincidencia solo si sigue activo y disponible |
| «Algo con harto queso» | Términos sobre nombre/descripción/ingredientes | Ordena candidatos, no filtra binariamente |
| «Quiero algo para vegano» | Filtro explícito, **no inferido** | Requiere la aptitud dietética "vegano" de la sección 7 |
| «Sugiere algo rico» | Recomendación abierta | Solo entre disponibles; sin inventar popularidad ni valoraciones que no existen |
| «Una pizza sana y económica» | Intersección conjuntiva | Igual que los filtros manuales: nunca se relaja en silencio a "cumple solo una condición" |

**Regla general para resultado vacío**: si una combinación de condiciones no
tiene coincidencias, el sistema no relaja ninguna condición por su cuenta.
Puede explicar qué entendió y ofrecer quitar una condición, pero la decisión
de mostrar alternativas parciales por separado queda para que la spec la
decida explícitamente (pregunta abierta 3 más abajo), no como comportamiento
por defecto.

**Regla general para ambigüedad**: cuando una frase admite más de una
interpretación razonable y el resultado cambia según cuál sea («algo
liviano» → ¿salud, porción o precio?), el sistema pregunta antes de buscar,
con opciones concretas derivadas del catálogo — nunca expone al cliente un
porcentaje de confianza técnico.

---

## Reglas de negocio propuestas

- **RN-01** — Buscar, por voz o por texto, **nunca** escribe en ninguna tabla
  de negocio. Es una operación de solo lectura de principio a fin.
- **RN-02** — Un producto candidato a sugerirse debe cumplir `active = true`
  y `available = true`. Un producto agotado o dado de baja no se sugiere bajo
  ninguna frase (Principio VIII).
- **RN-03** — El LLM solo puede referirse a categorías y productos que el
  servidor le envió en esa misma solicitud. Cualquier ID en la respuesta que
  no pertenezca a esa lista se descarta antes de tocar la base de datos.
- **RN-04** — Antes de responder al cliente, el servidor vuelve a consultar
  `active`/`available` de los IDs que el modelo sugirió. Un producto que se
  agotó entre la proyección y la respuesta no se muestra.
- **RN-05** — Una combinación de condiciones sin resultados no se relaja
  automáticamente a un subconjunto de ellas. El sistema comunica qué entendió
  y deja que el cliente decida cómo continuar.
- **RN-06** — Ante ambigüedad material (la interpretación cambia el
  resultado), el sistema pregunta antes de buscar, con opciones derivadas del
  catálogo real, nunca con un número de confianza expuesto al cliente.
- **RN-07** — El proveedor de modelo de lenguaje no recibe sesión, usuario,
  dirección, carrito, pedido, historial ni credenciales de ningún tipo — solo
  la frase del cliente y la proyección pública del catálogo permitido.
- **RN-08** — No se persiste audio crudo en ningún punto del flujo
  (Principio X). El consentimiento del micrófono se pide antes de activarlo.
- **RN-09** — Si el proveedor de modelo de lenguaje falla, se agota el
  tiempo de espera o la integración está deshabilitada por configuración, el
  menú, sus filtros manuales y el carrito siguen operando sin ninguna
  degradación.
- **RN-10** — La entrada de texto tiene un largo máximo y la solicitud está
  sujeta a un límite de **20 búsquedas cada 5 minutos por sesión**, para
  acotar el gasto que cada búsqueda genera en el proveedor externo (ver
  sección 8, DoS económico; decidido 2026-08-23).
- **RN-11** — Solo el rol `CLIENTE` puede invocar la búsqueda por voz o por
  texto. Los demás roles siguen usando el menú manual de E3 (decidido
  2026-08-23).

---

## Casos límite a cubrir

- Frase vacía o solo espacios.
- Frase que excede el largo máximo permitido.
- Transcripción de voz incompleta ("quiero algo con...").
- Nombre de producto que coincide parcialmente con dos productos distintos.
- Categoría desactivada mencionada por su nombre anterior.
- Todos los productos que cumplen la intención están agotados en ese momento.
- El modelo devuelve un ID que no estaba en la proyección enviada (intento de
  alucinación o de manipulación).
- La descripción de una categoría o producto contiene texto que intenta
  instruir al modelo ("ignora las reglas anteriores...") — inyección de
  prompt vía datos del propio negocio.
- Proveedor externo no responde dentro del tiempo límite.
- Proveedor externo responde con JSON que no cumple el esquema pactado.
- Micrófono denegado o no soportado por el navegador.
- Catálogo con menos de tres productos activos (los tramos de precio no
  discriminan, según RN-08 de HU-14).
- Búsqueda repetida muy seguido desde la misma sesión (límite de frecuencia).

---

## Explícitamente fuera de alcance (v1)

- **Agregar productos al carrito**: es HU-13, con su propia confirmación.
- **Embeddings o `pgvector`**: ambos documentos de análisis coinciden en
  diferirlos hasta tener evidencia de que la proyección completa del
  catálogo no alcanza (ver `analisis_codex.md` §14). Con el catálogo actual
  de decenas de productos no se justifican.
- **Un servicio de búsqueda o base de datos vectorial separada**: duplicaría
  infraestructura y fuente de verdad para un catálogo mono-local pequeño.
- **Memoria conversacional persistente entre búsquedas**: una aclaración se
  resuelve en el mismo intercambio o se reformula la búsqueda completa; no se
  guarda contexto de sesión a sesión.
- **Popularidad, valoraciones o historial de pedidos como criterio de
  recomendación**: no existen datos así en el producto ni la spec los pide.
- **Alérgenos certificados o información nutricional real**: el campo
  `ingredients` sigue siendo informativo (HU-02, HU-14), esta HU no lo
  reinterpreta.
- **Múltiples locales / búsqueda entre locales**: fuera de alcance de v1
  declarado en `docs/epicas-hu/EPICS.md`.
- **Traducción del catálogo o de las respuestas a otro idioma** (Principio
  II).

---

## 7 · El vacío de datos que esta HU resuelve: aptitudes dietéticas

Los dos documentos de análisis coinciden: **no se puede inferir con
seguridad** si un producto es apto para veganos a partir de `ingredients`,
porque ese campo es opcional, informativo y puede omitir componentes de
salsas, panes o contaminación cruzada. Ausencia de un ingrediente en el texto
no significa ausencia real.

`revision_claude.md` señaló un matiz que un booleano simple
(`product.vegan BOOLEAN NOT NULL DEFAULT FALSE`) no resuelve bien: hace
indistinguibles "el negocio declaró que no es vegano" y "el negocio nunca
marcó nada" — ambos casos quedan en `false`.

**Decisión (2026-08-23): vocabulario controlado desde v1**, no booleano. Se
modela con una tabla de aptitudes dietéticas y una relación muchos-a-muchos
con `Product`, cargando por ahora solo la aptitud "Vegano":

```
dietary_tag
  id      UUID
  name    String   -- "Vegano" para v1; abierto a agregar otras después
                       sin nueva migración de esquema

product_dietary_tag
  product_id      FK -> product
  dietary_tag_id  FK -> dietary_tag
```

La ausencia de una fila en `product_dietary_tag` significa "no declarado",
sin ambigüedad con "declarado que no". El negocio marca la aptitud
explícitamente al cargar o editar el producto; el LLM solo puede activar el
filtro, nunca deducir el valor — igual que ya establece esta sección más
arriba para el resto de las intenciones. Si el negocio pide más aptitudes
(sin gluten, vegetariano, sin lactosa) más adelante, se agregan como nuevas
filas de `dietary_tag`, sin tocar el esquema.

---

## 8 · Amenaza que la spec debe tratar explícitamente: gasto por abuso del endpoint

`revision_claude.md` señala que el análisis original menciona "rate limiting"
y "presupuesto/alerta de consumo" solo de forma operacional (sección 13), sin
tratarlo como amenaza de seguridad en su propia sección 10. Cada búsqueda
tiene un costo real de proveedor externo: un cliente que golpea el endpoint
repetidamente genera gasto, no solo carga de servidor. Esta HU lo trata como
requisito de seguridad verificable, con valores ya decididos (2026-08-23):

- **Proveedor y modelo**: Claude Haiku 4.5 vía API de Anthropic — el modelo
  más económico de la familia Claude, adecuado para clasificar una frase
  corta contra una lista acotada de categorías. FoodVoice es un proyecto de
  titulación con presupuesto de estudiante, no un producto comercial.
- **Límite de frecuencia**: 20 búsquedas cada 5 minutos por sesión (RN-10).
  Cubre a un cliente real probando y corrigiendo frases, sin dejar la puerta
  abierta a un script golpeando el endpoint.
- **Tope de gasto mensual**: menos de $15.000 CLP, con una alerta configurada
  en la consola de Anthropic — no un requisito que el código deba hacer
  cumplir en tiempo real, sino un techo operativo a vigilar.
- **Objetivo de latencia**: p95 ≤ 5 segundos, **a validar en la Fase 0** de
  implementación con Haiku 4.5 y el catálogo real, antes de darlo por
  definitivo como criterio de éxito verificable (así lo exige el punto 3 de
  `revision_claude.md`: no fijar un SLO sin medición real).

Quedan fuera de esta HU, por no ser requisito de ninguna spec: región de
procesamiento del proveedor y política de retención contractual — se rigen
por los términos estándar de la API de Anthropic, sin negociación especial
para un proyecto de este tamaño.

---

## Decisiones ya cerradas (2026-08-23)

Estaban listadas como bloqueantes en `E6-borrador-specify.md` y ya se
resolvieron antes de `/speckit.specify`:

- **Rol habilitado**: solo `CLIENTE` (RN-11).
- **Modelo de "vegano"**: vocabulario controlado, no booleano (sección 7).
- **Proveedor/modelo/SLO/presupuesto**: Claude Haiku 4.5, rate limit 20/5min,
  SLO p95 ≤ 5s a validar en Fase 0, tope $15.000 CLP/mes (sección 8).

## Preguntas abiertas para `/speckit.clarify`

Tomadas de `analisis_codex.md` §16 y `revision_claude.md` §2, sin resolver
aquí porque son decisiones de producto menores, no bloqueantes para arrancar
la spec:

1. ¿Un resultado exacto vacío puede mostrar alternativas cercanas en una
   sección aparte, o el sistema debe limitarse a comunicar cero resultados?
2. ¿Qué navegadores/dispositivos debe soportar la voz? Decide entre
   reconocimiento del navegador (`SpeechRecognition`, soporte limitado según
   MDN) o transcripción en servidor.
3. ¿Se permite conservar frases de texto para evaluación futura del sistema?
   Si sí, con qué consentimiento, finalidad, acceso y retención — nunca audio
   crudo (Principio X, no negociable).
4. ¿Cuál es el máximo de productos sugeridos por búsqueda y cómo se ordenan
   las recomendaciones abiertas cuando no existen popularidad ni
   valoraciones?
5. ¿Cómo continúa una aclaración pedida por el sistema — contexto efímero en
   el cliente, token corto del servidor, o el cliente simplemente reformula
   la frase completa? Ninguno de los dos análisis recomienda memoria
   conversacional persistente para v1.
6. ¿Quién es el dueño del corpus dorado de frases (Principio XI) y con qué
   cadencia se revalida cuando cambia el catálogo? `revision_claude.md`
   señala que el análisis original exige el corpus pero no asigna dueño.

---

## Corpus previo a implementar (Principio XI)

Antes de programar, la spec debe incorporar un corpus versionado de frases en
español de Chile —aprobado por quien el punto 9 designe como dueño—, que
cubra como mínimo: sinónimos y coloquialismos, errores de transcripción sin
tildes, intenciones simples y combinadas, nombres exactos/parciales/
inexistentes, categorías desactivadas, productos agotados/inactivos,
ambigüedades que deben derivar en aclaración, solicitudes veganas, exclusión
por ingredientes declarados, intentos de inyección de prompt, y entradas
vacías o fuera de dominio. Cada caso del corpus declara qué productos son
aceptables, qué filtros son obligatorios, si corresponde aclaración, y qué
resultados están prohibidos — no solo un resultado único, porque una
recomendación abierta admite varias respuestas correctas.
