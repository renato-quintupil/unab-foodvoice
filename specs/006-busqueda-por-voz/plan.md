# Plan de Implementación: E6 · Búsqueda por voz

**Rama**: `006-busqueda-por-voz` | **Fecha**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/006-busqueda-por-voz/spec.md`

## Resumen

E6 agrega un único endpoint de solo lectura, `POST /menu/search`, que interpreta una frase en
lenguaje natural con un modelo de lenguaje (Claude Haiku 4.5, sin acceso a la base de datos) y
devuelve productos reales del catálogo ya construido por E3, o una lista lista para que el
cliente agregue uno al carrito de E2 tras confirmar. Tres historias de usuario: buscar (P1),
agregar por voz (P2, reutiliza P1 más los endpoints de carrito ya existentes) y buscar por
aptitud vegana (P3, requiere un dato nuevo en el catálogo).

Las cinco decisiones que gobiernan el diseño:

1. **Un módulo nuevo, `menu-search`, no una extensión de `menu`.** Aísla la dependencia del
   proveedor externo, el rate limiting y la telemetría del resto de los cuatro roles que
   consultan el menú sin necesitarlos (D-055).
2. **Un solo endpoint para las dos historias con escritura potencial.** `intent: 'SEARCH' | 'ADD'`
   en el mismo `POST /menu/search` evita duplicar la proyección del catálogo, la llamada al
   proveedor y la reconsulta de disponibilidad — los cuatro puntos donde vive la seguridad del
   diseño (D-056).
3. **El proveedor de IA nunca agrega nada al carrito.** HU-13 reutiliza `POST /cart/lines` y
   `PATCH /cart/lines/:productId`, ya existentes desde E2, sin ningún endpoint de escritura nuevo
   (D-063).
4. **"Vegano" es un dato precargado, no administrable en v1** (decidido en `/speckit.clarify`,
   2026-08-23): una relación implícita muchos-a-muchos entre `Product` y `DietaryTag`, con una
   única fila de semilla (D-059).
5. **La telemetría nunca guarda la frase del cliente** (decidido en `/speckit.clarify`,
   2026-08-23): `search_log` solo metadatos técnicos — sesión, canal, resultado, latencia, tokens,
   modelo, error (D-060).

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios.

**Dependencias principales**: las ya presentes en el monorepo, más dos nuevas en
`services/api`: **`@anthropic-ai/sdk`** (adaptador del proveedor, D-057) y **`@nestjs/throttler`**
(rate limiting por sesión, D-058). Ninguna dependencia nueva en `apps/web` ni en `packages/shared`
— la voz usa la API `SpeechRecognition` del navegador (Assumptions, `spec.md`), sin librería.

**Almacenamiento**: PostgreSQL 16. **Con migración**: dos tablas nuevas, `dietary_tag` y
`search_log`, más la tabla de unión implícita `_productDietaryTags` que Prisma administra sola
(`data-model.md`). Ninguna tabla de E1/E2/E3/E9 cambia de forma.

**Pruebas**: se hereda la disposición de E1–E4. Unitarios con Vitest/Jest según paquete —incluida
la validación del esquema Zod, el filtrado de allowlist y el cálculo de `AddResolutionResponse`
con un doble de prueba del proveedor. Integración con Jest en `services/api/test/`, contra
PostgreSQL efímera en Docker, **sin llamar al proveedor real** (se sustituye
`SemanticIntentProvider` por un doble determinista) — cubre reconsulta de disponibilidad, rate
limiting y escritura de `search_log`. La calidad de la interpretación con el modelo real se mide
aparte, en la evaluación de `quickstart.md`, y no bloquea `pnpm test:integration`.

**Plataforma objetivo**: navegador desde 360 px de ancho y contenedores Linux, igual que las
épicas anteriores. La voz depende de `SpeechRecognition`, con soporte limitado según MDN — el
campo de texto es la vía garantizada en todo navegador (Principio VI).

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` como BFF frente
a `services/api`. Sin cambios de arquitectura. El proveedor de IA solo lo consulta
`services/api`; el navegador nunca ve la clave ni llama directamente a Anthropic.

**Objetivos de rendimiento**: SC-004 (p95 ≤ 5 s) y SC-007 (< $15.000 CLP/mes) son objetivos que
**se validan con mediciones reales** contra Claude Haiku 4.5 antes de darse por definitivos —no se
verifican solo leyendo el código (`quickstart.md` § Evaluación con el modelo real).

**Restricciones**: sin vectores/`pgvector` (fuera de alcance de v1, Assumptions); sin
administración de aptitudes dietéticas desde la interfaz (Clarifications, spec.md); una sola
llamada al proveedor por búsqueda, con un reintento acotado ante JSON inválido (D-065); límite de
frecuencia de 20 solicitudes / 5 min por sesión (FR-014); `LLM_API_KEY` obligatoria al arranque,
sin interruptor operativo adicional (D-064).

**Escala/Alcance**: un endpoint nuevo (`POST /menu/search`), dos tablas nuevas
(`dietary_tag`, `search_log`), un campo nuevo en `ProductDto` (`dietaryTags`), y las pantallas de
`apps/web` que consumen ese endpoint desde `/menu` (campo de búsqueda, estados de resultado,
aclaración, confirmación de agregado). Ningún endpoint ni tabla de E1–E4 cambia.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Un solo endpoint para dos intents en vez de dos endpoints casi idénticos (D-056); sin pantalla de administración de aptitudes dietéticas hasta que una HU la pida (D-059); sin interruptor operativo que ninguna HU exige (D-064); rate limiting con una librería ya probada (`@nestjs/throttler`) en vez de una implementación a mano. |
| **II · Idioma: todo en español** | Cuatro mensajes fijos nuevos en `packages/shared/src/messages/es.ts` (`contracts/shared.md`); la interpretación (`SearchInterpretation`) nunca se muestra en inglés — la interfaz construye las etiquetas visibles a partir de datos estructurados, no de texto del modelo (FR-004, HU-06 §6.3). |
| **III · Cero alcance fantasma** | Sin memoria conversacional persistente, sin múltiples productos por frase, sin edición/eliminación de carrito por voz, sin vectores — las cinco exclusiones explícitas de `spec.md` se respetan en el diseño: ninguna aparece en `data-model.md` ni en `contracts/`. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre las 8 SC con pasos manuales (V-01 a V-15) sobre la interfaz, sin requerir leer código ni consola. |
| **V · Datos del usuario con respeto** | `search_log` nunca guarda la frase ni el audio (D-060, FR-027) — la decisión de mayor impacto en privacidad de esta épica quedó cerrada explícitamente en `/speckit.clarify`. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | El campo de texto y los filtros manuales de E3 siguen disponibles en todo momento (V-13); ninguna acción crítica (buscar, agregar, ver el carrito) depende exclusivamente de la voz. |
| **VII · Entender la intención, no transcribir literal** | `SearchInterpretation` es exactamente las categorías de intención del principio (precio, salud, tipo de comida, plato específico, recomendación abierta) — no hay un sexto campo que las exceda (contracts/shared.md). Ante ambigüedad, `CLARIFICATION` antes que adivinar (FR-011). |
| **VIII · El catálogo y el stock son la única verdad, por local** | `MenuService.candidatosParaBusqueda()` filtra `active && available` antes de proyectar (D-061); se reconsulta ese mismo filtro antes de responder (D-062) y otra vez al confirmar el carrito (E2, sin cambios). Ningún producto agotado puede llegar a `items` ni a `AddResolutionResponse`. |
| **IX · Confirmar antes de actuar y poder deshacer** | `AddResolutionResponse` nunca escribe; la confirmación en pantalla (FR-020) es un paso de `apps/web` previo a `POST /cart/lines`, y cancelar no llama a ningún endpoint (FR-023). |
| **X · Privacidad y datos mínimos** | Consentimiento del micrófono antes de activarlo (FR-018, ya lo exige el navegador vía `SpeechRecognition`); sin audio crudo en ningún punto (FR-017); `search_log` sin frase ni audio (D-060). |
| **XI · Calidad guiada por especificación (test-first)** | Los criterios de aceptación Gherkin-equivalentes de las tres historias preceden al diseño; `quickstart.md` exige un corpus de frases aprobado antes de la evaluación con el modelo real (Fase de validación funcional, más abajo). |
| **XII · Trazabilidad del pedido de punta a punta** | No aplica: E6 no toca `order` ni `order_status_event`. El agregado al carrito (HU-13) termina en `cart_line`, no en un pedido — el pedido nace recién cuando el cliente confirma su compra completa (E2), fuera del alcance de esta épica. |

### Estado de la enmienda constitucional

`.specify/memory/constitution.md` sigue en versión **2.0.0** (2026-08-17); E6 no requiere ninguna
enmienda — no redefine ningún principio, solo lo implementa.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, `contracts/` y `quickstart.md`.
**PASS: sin violaciones constitucionales.** Se comprobó expresamente:

- Ningún artefacto de Fase 1 introduce una segunda vía de agregar al carrito: `contracts/api.md`
  documenta explícitamente que `AddResolutionResponse` no escribe.
- El campo `dietaryTags` en `ProductDto` es aditivo — ningún tipo existente se modifica de forma
  incompatible (`contracts/shared.md`).
- `search_log` no tiene ninguna columna de texto libre proveniente del cliente (`data-model.md`).

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/006-busqueda-por-voz/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D-055 a D-065
├── data-model.md         # Fase 1: dietary_tag, search_log, campo nuevo en ProductDto
├── quickstart.md         # Fase 1: puesta en marcha, 8 SC, evaluación con el modelo real
├── contracts/
│   ├── api.md            # POST /menu/search + reutilización de cart/* (E2)
│   └── shared.md          # Enums, esquema Zod, tipos de salida, mensajes nuevos
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos y grupos que E6 crea o modifica.

```text
packages/shared/src/
├── enums/
│   └── search.ts                     # NUEVO · SearchChannel, SearchIntent
├── schemas/
│   └── search.ts                     # NUEVO · SearchRequestSchema
├── messages/
│   └── es.ts                         # MODIFICADO · 4 mensajes nuevos
├── types/
│   └── api.ts                        # MODIFICADO · SearchInterpretation, SemanticSearchResponse,
│                                      #   AddResolutionResponse, ProductDto.dietaryTags
└── index.ts                          # MODIFICADO · superficie pública

services/api/
├── prisma/
│   ├── schema.prisma                 # MODIFICADO · DietaryTag, SearchLog, enums, relaciones
│   ├── migrations/                   # NUEVO · dietary_tag, search_log, _productDietaryTags
│   └── seed/
│       └── catalogo.ts               # MODIFICADO · marca al menos un producto como "Vegano"
├── src/
│   ├── config/
│   │   └── env.validation.ts         # MODIFICADO · LLM_API_KEY obligatoria (D-064)
│   ├── menu/
│   │   └── menu.service.ts           # MODIFICADO · candidatosParaBusqueda() (D-061)
│   ├── products/
│   │   └── products.service.ts       # MODIFICADO · productoADto incluye dietaryTags
│   └── menu-search/                  # NUEVO
│       ├── menu-search.module.ts
│       ├── menu-search.controller.ts # POST /menu/search
│       ├── menu-search.service.ts    # allowlist, reconsulta, search_log
│       ├── search-throttler.guard.ts # rate limit por sesión (D-058)
│       └── providers/
│           ├── semantic-intent.provider.ts            # interfaz (D-057)
│           └── anthropic-semantic-intent.provider.ts  # adaptador Claude Haiku 4.5
└── test/
    └── menu-search-*.integration-spec.ts  # NUEVO · allowlist, reconsulta, rate limit, search_log

apps/web/src/app/
└── menu/
    └── _components/
        ├── busqueda-por-voz.tsx       # NUEVO · campo de texto/voz, estados de resultado
        └── confirmacion-agregado.tsx  # NUEVO · pantalla de confirmación (HU-13)
```

**Decisión de estructura**: `menu-search` es un módulo nuevo, no una extensión de `menu` ni de
`cart` (D-055). `apps/web` no gana una ruta nueva: el campo de búsqueda vive dentro de `/menu`
(ya despachada por rol desde E9), como un componente adicional junto a los filtros manuales
existentes — coherente con que la búsqueda y los filtros conviven en la misma pantalla (Principio
VI).

## Fases de entrega

### Fase A · Contratos y esquema (habilitante)

`packages/shared` (enums, esquema Zod, tipos, mensajes) y la migración de Prisma
(`dietary_tag`, `search_log`, relación con `Product`/`Session`). Sin código de negocio todavía.
Cubre la base de `contracts/shared.md` y `data-model.md`.

### Fase B · Proveedor y proyección del catálogo (habilitante)

`SemanticIntentProvider` (interfaz) + `AnthropicSemanticIntentProvider` (adaptador), configuración
de entorno (`LLM_*`), y `MenuService.candidatosParaBusqueda()`. Sin endpoint todavía — se puede
probar con un test unitario que llama al proveedor directamente contra un catálogo de ejemplo.

### Fase C · HU-06 (Historia 1, P1) — búsqueda

`POST /menu/search` con `intent: 'SEARCH'`, `SearchThrottlerGuard`, escritura de `search_log`.
Componente `busqueda-por-voz.tsx` en `/menu`, con los tres estados de respuesta (resultados,
aclaración, sin resultados) y el reconocimiento de voz del navegador. Cubre FR-001, FR-003 a
FR-011, FR-014 a FR-018.

### Fase D · HU-13 (Historia 2, P2) — agregar por voz

`intent: 'ADD'` sobre el mismo endpoint. Componente `confirmacion-agregado.tsx`, que llama a
`POST /cart/lines` y, si corresponde, a `PATCH /cart/lines/:productId` tras la confirmación
explícita del cliente. Cubre FR-019 a FR-026.

### Fase E · HU-06 (Historia 3, P3) — aptitud vegana

Campo `vegan` en `SearchInterpretation`, traducido a `dietaryTags: { some: { name: 'Vegano' } }`
en la reconsulta de Prisma. Semilla actualizada con al menos un producto marcado. Cubre FR-012,
FR-013.

### Fase F · Validación funcional

Ejecutar `quickstart.md` completo: los 15 pasos manuales (V-01 a V-15) y la evaluación con el
modelo real (SC-004, SC-007) contra Claude Haiku 4.5 y el corpus de frases de aceptación
(Principio XI).

## Complexity Tracking

La puerta constitucional pasa sin violaciones que justificar. No hay tabla de excepciones.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El SLO de 5 s (SC-004) no se cumple con el catálogo real una vez cargado con más productos | Medio: criterio de éxito declarado pero no verificado | Medición explícita en `quickstart.md` antes de dar la épica por verificada; `LLM_TIMEOUT_MS` configurable sin redeploy de código |
| El costo mensual supera $15.000 CLP si el rate limit no basta | Medio: incumple SC-007 | Alerta configurada en la consola de Anthropic (fuera del código); `LLM_TIMEOUT_MS` y el límite de 20/5min acotan el peor caso por sesión |
| Un producto sin ingredientes de origen animal declarados se confunde con "vegano" en el frontend o en el prompt | Alto: FR-013 exige exactamente lo contrario | El filtro real de Prisma es `dietaryTags: { some: { name: 'Vegano' } }`, nunca una heurística sobre `ingredients`; prueba de integración específica (V-12, `contracts/api.md`) |
| El proveedor devuelve un JSON que no cumple el esquema de la tool forzada de forma persistente | Medio: búsquedas fallando en `503` | Un reintento acotado (D-065); `search_log.outcome = ERROR` permite detectar la tasa de fallo antes de que sea un problema de producción |
| Rate limiting en memoria dejaría de funcionar si `services/api` corriera en más de una instancia | Bajo hoy, alto si cambia la topología | Documentado en D-058 como supuesto explícito de la topología vigente (`docker-compose.yml`), no un olvido |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Tipos y esquema Zod compartidos; migración de `dietary_tag`/`search_log` | A |
| `SemanticIntentProvider`, adaptador Anthropic, `candidatosParaBusqueda()` | B |
| FR-001, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-014, FR-015, FR-016, FR-017, FR-018 | C |
| FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026 | D |
| FR-012, FR-013 | E |
| SC-001 a SC-008 | F |

Los 8 criterios de éxito se trazan uno a uno en `quickstart.md`.
