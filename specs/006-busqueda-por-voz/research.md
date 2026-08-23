# Investigación (Fase 0): Búsqueda por voz

Once decisiones, numeradas a continuación de las **D-054** que dejó E4 (`005-trazabilidad-pedido`).
Todas resuelven un `NEEDS CLARIFICATION` técnico del Contexto Técnico de `plan.md`. Las tres
decisiones de producto que eran bloqueantes antes de especificar (rol habilitado, modelo de
"vegano", proveedor/SLO del LLM) ya están fijadas en `spec.md`; aquí se traduce cada una a una
decisión de implementación concreta cuando corresponde.

---

## D-055 · Módulo nuevo `menu-search`, no una extensión de `menu`

**Decisión**: la búsqueda vive en `services/api/src/menu-search/` (`menu-search.module.ts`,
`.controller.ts`, `.service.ts`), un módulo nuevo que depende de `MenuModule` (E3) y de
`PrismaService`, no al revés.

**Motivo**: `MenuModule` (E3) es deliberadamente el único módulo de la API sin `@Roles` — lo
consultan los cuatro roles. Si la interpretación semántica, el proveedor externo, el rate
limiting y la telemetría vivieran ahí, todo consumidor de `MenuModule` (negocio, admin,
repartidor) cargaría dependencias de un proveedor de IA que nunca usa. El comentario que ya deja
`menu.service.ts` — "la vía que E6 añadirá pasará por aquí" — se refiere a un método nuevo que
`MenuService` expone para que `menu-search` lo consuma, no a que la lógica de búsqueda se escriba
dentro de `MenuService`.

**Alternativas evaluadas**: extender `MenuController`/`MenuService` directamente — rechazado por
la razón anterior; crear el módulo dentro de `cart/` porque HU-13 termina ahí — rechazado porque
la búsqueda (HU-06) no depende del carrito y CartModule ya tiene su propia superficie acotada
(HU-12).

---

## D-056 · Un solo endpoint, `POST /menu/search`, con `intent: 'SEARCH' | 'ADD'`

**Decisión**: HU-06 y HU-13 comparten `POST /menu/search`. El cuerpo lleva `intent`: `'SEARCH'`
(por omisión) para la Historia 1/3, `'ADD'` para la Historia 2. La forma de la respuesta cambia
según `intent`, pero la proyección del catálogo, la llamada al proveedor, la validación de
allowlist y la reconsulta de disponibilidad son el mismo código.

**Motivo**: HU-13 dice explícitamente "reutiliza esa misma búsqueda para resolver un producto
candidato" (spec.md, Historia 2). Duplicar el endpoint duplicaría también la proyección del
catálogo, la invocación al proveedor y la reconsulta — los cuatro puntos donde vive toda la
seguridad del diseño (allowlist, `active && available`). Con un único endpoint, esos cuatro
puntos existen una sola vez.

**Alternativas evaluadas**: dos endpoints (`/menu/search` y `/menu/search/resolve-add`) —
rechazado por la duplicación anterior; un único endpoint sin distinguir intención, dejando que el
frontend decida qué hacer con la interpretación — rechazado porque HU-13 necesita que el
**proveedor** extraiga también una cantidad («ponme dos»), un campo que la interpretación de
búsqueda (HU-06) no necesita y no debe exponer en sus resultados.

---

## D-057 · `SemanticIntentProvider` (interfaz) + adaptador Anthropic, Claude Haiku 4.5

**Decisión**: interfaz `SemanticIntentProvider` con un único método `interpretar(contexto):
Promise<InterpretacionCruda>`, y un adaptador `AnthropicSemanticIntentProvider` que la
implementa con `@anthropic-ai/sdk`, modelo `claude-haiku-4-5-20251001` (decidido con Renato,
`docs/epicas-hu/hu/HU-06-busqueda-asistida-por-voz.md`). La salida estructurada se fuerza con
**tool use** de la API de Anthropic (una única "tool" cuyo `input_schema` es el contrato de
`InterpretacionCruda`, con `tool_choice` forzado a esa tool): el modelo no puede responder con
texto libre, solo con el JSON que cumple el esquema declarado.

**Motivo**: la interfaz aísla `menu-search.service.ts` del SDK concreto (HU-06 §5.3,
`analisis_codex.md` §5.3): cambiar de proveedor o de modelo en el futuro no toca el servicio,
solo el adaptador y una variable de entorno. Forzar la tool evita depender de que el modelo
"decida" responder en JSON — es la diferencia entre pedirlo por instrucción de texto (frágil) y
que la API misma rechace cualquier otra forma de respuesta.

**Alternativas evaluadas**: prompt de texto libre parseado con una expresión regular — rechazado,
no da garantías de estructura y viola FR-004 (el modelo solo puede devolver la estructura
pactada); SDK de OpenAI o Gemini — descartado por la decisión ya tomada del proveedor.

---

## D-058 · Rate limiting con `@nestjs/throttler`, seguimiento por sesión

**Decisión**: se agrega la dependencia `@nestjs/throttler` y un guard propio,
`SearchThrottlerGuard`, que extiende `ThrottlerGuard` sobreescribiendo `getTracker()` para usar
`req.sesion.id` (ya disponible tras `SessionGuard`) en vez de la IP. Configuración: 20 solicitudes
por 300 segundos (FR-014), aplicada solo sobre `POST /menu/search`.

**Motivo**: FR-014 exige el límite **por sesión**, no por IP — varias sesiones legítimas pueden
compartir una IP (red compartida, NAT de un local), y limitar por IP penalizaría a clientes que no
abusaron de nada. `@nestjs/throttler` ya resuelve la ventana deslizante y el conteo en memoria; no
hace falta escribir eso a mano.

**Alternativas evaluadas**: contador en una columna de `Session` incrementada en cada búsqueda —
rechazado por escribir en la tabla de sesión en cada solicitud de lectura, además de tener que
implementar la ventana deslizante a mano; límite por IP — rechazado por la razón de arriba;
límite por `userId` en vez de por sesión — rechazado porque FR-014 fija "por sesión", y un
usuario con dos sesiones activas (dos pestañas) tiene dos ventanas independientes por diseño.

**Nota de despliegue**: el límite en memoria asume una sola instancia del proceso `api`, que es la
topología vigente de `docker-compose.yml` (Principio I: no se anticipa una topología horizontal
que el proyecto no tiene).

---

## D-059 · Aptitud dietética: relación implícita muchos-a-muchos, sin administración

**Decisión** (ya cerrada en `/speckit.clarify`, 2026-08-23): `DietaryTag` es un modelo Prisma con
solo `id` y `name`, relacionado con `Product` por una relación **implícita** muchos-a-muchos
(`dietaryTags DietaryTag[]` en ambos lados). Prisma administra la tabla de unión sin que el
esquema la declare a mano. En v1 existe una única fila, `"Vegano"`, cargada por semilla. No hay
controlador, endpoint ni pantalla para crear, editar o desactivar aptitudes.

**Motivo**: es el modelo de datos más simple que cumple FR-012/FR-013 y que no exige migrar de
nuevo si el negocio pide más aptitudes después — la tabla ya existe, solo faltaría la pantalla de
administración, no un cambio de esquema.

**Alternativas evaluadas**: columna booleana `product.vegan` — descartada explícitamente en HU-06
§7 (hace indistinguible "declarado no vegano" de "nunca marcado"); relación explícita
`ProductDietaryTag` con columnas propias — descartada por YAGNI, ninguna FR pide metadatos sobre
la asociación (quién la marcó, cuándo); pantalla de administración completa, igual que categorías
de E3 — descartada en la sesión de `/speckit.clarify` (Clarifications, spec.md) por alcance.

---

## D-060 · Telemetría en `search_log`, solo metadatos técnicos

**Decisión** (ya cerrada en `/speckit.clarify`, 2026-08-23): cada llamada a `POST /menu/search`
escribe una fila en `search_log` con `sessionId`, `channel`, `intent`, `outcome`, `latencyMs`,
`tokensUsed`, `model` y `errorCode` — nunca la frase del cliente, nunca el audio (FR-027). Se
escribe siempre, incluidos los casos de error o timeout del proveedor, para poder medir SC-004
(SLO de latencia) y SC-007 (gasto mensual) con datos reales.

**Motivo**: una frase de búsqueda puede revelar preferencias alimentarias del cliente (Principio
X); el registro se diseña para que sea imposible reconstruir qué pidió alguien a partir de él.

**Alternativas evaluadas**: registrar también la frase transcrita, para poder auditar por qué una
búsqueda salió mal — rechazada en la sesión de `/speckit.clarify`; no registrar nada y depender
solo de los contadores del proveedor (consola de Anthropic) — rechazada porque no permite medir
SC-004 por canal (voz vs. texto) ni correlacionar con sesiones del propio sistema.

---

## D-061 · Proyección de candidatos: `MenuService.candidatosParaBusqueda()`

**Decisión**: se agrega un método nuevo a `MenuService` (E3, `menu.service.ts`), separado de
`consultar()`, que devuelve únicamente productos `active: true, available: true` con su
categoría, ingredientes y tramo de precio — la proyección exacta que recibe el proveedor. Vive en
`MenuService` y no en `menu-search.service.ts` porque reutiliza `calcularCortes()` de
`products/price-tier.ts` con la misma transacción que ya usa `consultar()`.

**Motivo**: `consultar()` (E3) incluye agotados a propósito, para la vista manual del cliente.
HU-06 exige `active && available` estrictos (RN-02) — la búsqueda por voz nunca puede sugerir un
producto agotado. Tener dos métodos explícitos evita que un cambio futuro en `consultar()` afecte
sin querer a lo que ve el proveedor de IA.

**Alternativas evaluadas**: filtrar en memoria el resultado de `consultar()` dentro de
`menu-search.service.ts` — rechazado porque duplicaría la lógica de tramo de precio y dejaría dos
lugares que "saben" cuál es el filtro correcto de candidatos, en vez de uno.

---

## D-062 · Allowlist en memoria, sin segunda consulta previa a la reconsulta

**Decisión**: `menu-search.service.ts` arma un `Set<string>` con los IDs de categorías y
productos que efectivamente se enviaron al proveedor en esa solicitud. La respuesta del modelo se
filtra contra ese `Set` antes de construir cualquier `where` de Prisma. No hay una consulta
adicional "¿este ID existe?" — la única consulta después del filtrado es la reconsulta de
`active && available` (D-061, FR-006).

**Motivo**: es el mecanismo más simple que cumple FR-005 sin una ida y vuelta extra a la base de
datos: los IDs "permitidos" ya están en memoria porque son los mismos que se acaban de leer para
construir la proyección.

---

## D-063 · HU-13 no crea ningún endpoint de escritura

**Decisión**: cuando `intent: 'ADD'` resuelve un único producto, `apps/web` llama, en este orden,
a los endpoints **ya existentes** de E2: `POST /cart/lines` (agrega 1 unidad; si el producto no
estaba en el carrito, lo crea) y, si la cantidad interpretada es mayor a 1, `PATCH
/cart/lines/:productId` con la cantidad absoluta resultante. `services/api` no gana ningún
endpoint de escritura en esta épica.

**Motivo**: `CartService.agregarLinea()` (E2) ya sube la cantidad en 1 si la línea existe
(`update: { quantity: { increment: 1 } }`), que es exactamente el comportamiento que la spec fija
para "producto que ya está en el carrito" (Assumptions, spec.md). Reutilizarlo cumple FR-022
literalmente: "sin un endpoint de escritura nuevo y paralelo".

**Alternativas evaluadas**: un endpoint `POST /menu/search/add` que internamente llame a
`CartService` — rechazado porque duplica una decisión de autorización (`@Roles(CLIENTE)`) que ya
existe en `CartController`, sin ganar nada a cambio.

---

## D-064 · `LLM_API_KEY` obligatoria al arranque, sin interruptor operativo adicional

**Decisión**: `LLM_API_KEY` se agrega a `OBLIGATORIAS` en `env.validation.ts`, igual que
`DATABASE_URL`. Sin ella, `services/api` no arranca — mismo criterio que el resto de la
configuración del proyecto ("sin arranque degradado ni valor de reserva").

**Motivo**: es la política ya vigente del proyecto (`env.validation.ts`) y evita construir un
interruptor de "búsqueda deshabilitada" que ninguna HU pide (Principio I, Principio III). La
resiliencia que exige FR-016 es ante **fallos en tiempo de ejecución** del proveedor (timeout,
error, JSON inválido) — con la clave configurada, el arranque siempre es completo o falla
explícitamente, como el resto de la API.

**Alternativas evaluadas**: variable `LLM_SEARCH_ENABLED` para apagar la funcionalidad sin
redeploy — descartada por no estar pedida por ninguna HU ni FR; sería alcance fantasma.

---

## D-065 · Timeout corto y un reintento acotado

**Decisión**: `LLM_TIMEOUT_MS` (variable de entorno, valor por omisión `4000`) limita cada llamada
al proveedor. Si la respuesta no cumple el esquema de la tool forzada, se reintenta **una vez**
con la misma solicitud; si vuelve a fallar, o si se agota el tiempo, `POST /menu/search` responde
`503` con un mensaje recuperable en español (FR-016), y `search_log` registra el `errorCode`
correspondiente.

**Motivo**: 4000 ms deja margen bajo el SLO de 5 s (SC-004, a validar con mediciones reales en la
Fase de validación funcional) para el resto de la solicitud (red, serialización, reconsulta a
PostgreSQL). Un solo reintento —no una cola de reintentos— evita que una racha de timeouts del
proveedor multiplique el gasto medido en SC-007.

**Alternativas evaluadas**: reintentos exponenciales — rechazado por Principio I y porque
incrementa el costo por búsqueda fallida, justo lo que RN-10/FR-014 buscan acotar.
