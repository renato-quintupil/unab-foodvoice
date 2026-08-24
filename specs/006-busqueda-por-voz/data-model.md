# Fase 1 · Modelo de Datos: E6 · Búsqueda por voz

Dos tablas nuevas, cero cambios sobre las tablas de E1/E2/E3/E9. `Product` gana una relación
entrante; ninguna columna existente cambia de tipo ni de significado.

## Tabla nueva 1 · `dietary_tag` (D-059)

Aptitud dietética. En v1, una única fila (`"Vegano"`), cargada por semilla — sin pantalla de
administración (Clarifications, `spec.md`, sesión 2026-08-23).

```prisma
model DietaryTag {
  id   String @id @default(uuid()) @db.Uuid
  /// Único valor en v1: "Vegano". Sin CRUD desde la interfaz (D-059).
  name String @unique(map: "dietary_tag_name_key")

  products Product[] @relation("productDietaryTags")

  @@map("dietary_tag")
}
```

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `text` | Único. Solo `"Vegano"` en v1 (semilla) |

## `product` · relación entrante nueva

```prisma
model Product {
  // … columnas existentes (E3), sin cambios …
  dietaryTags DietaryTag[] @relation("productDietaryTags")
}
```

Relación **implícita** muchos-a-muchos: Prisma crea y administra la tabla de unión
(`_productDietaryTags`) sin que el esquema la declare a mano — no hay columnas propias que
justificar (D-059). La ausencia de una fila en esa tabla de unión para un producto dado
significa **"no declarado"**, nunca "declarado que no cumple" (spec.md, Key Entities).

`ProductDto` (`packages/shared`) gana `dietaryTags: string[]` — los nombres de las aptitudes
marcadas, `[]` cuando no tiene ninguna. Viaja como nombres, no como IDs, porque en v1 la interfaz
no necesita referenciar la aptitud por su identificador (no hay pantalla que la edite).

## Tabla nueva 2 · `search_log` (D-060)

Telemetría de cada llamada a `POST /menu/search`. Nunca contiene la frase del cliente ni audio
(FR-027).

```prisma
enum SearchChannel {
  TEXT
  VOICE

  @@map("search_channel")
}

enum SearchIntent {
  SEARCH
  ADD

  @@map("search_intent")
}

enum SearchOutcome {
  RESULTS
  CLARIFICATION
  NO_RESULTS
  RESOLVED   // solo intent=ADD: se resolvió al menos un producto candidato (D-066: puede ser más de uno)
  NOT_FOUND  // solo intent=ADD: ningún candidato razonable
  ERROR      // timeout, JSON inválido tras el reintento, o error del proveedor

  @@map("search_outcome")
}

model SearchLog {
  id         String        @id @default(uuid()) @db.Uuid
  sessionId  String        @map("session_id") @db.Uuid
  channel    SearchChannel
  intent     SearchIntent
  outcome    SearchOutcome
  /// Tiempo total de la solicitud, incluida la reconsulta a PostgreSQL (SC-004).
  latencyMs  Int           @map("latency_ms")
  /// `null` cuando `outcome = ERROR` antes de recibir respuesta del proveedor.
  tokensUsed Int?          @map("tokens_used")
  /// Identificador exacto del modelo usado (D-057), para poder comparar versiones.
  model      String
  /// `null` salvo `outcome = ERROR`. Código interno, no el mensaje de error del proveedor.
  errorCode  String?       @map("error_code")
  createdAt  DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)

  session Session @relation(fields: [sessionId], references: [id], onDelete: Restrict)

  @@index([sessionId, createdAt], map: "search_log_session_id_created_at_idx")
  @@map("search_log")
}
```

`Session` (E1) gana la relación entrante `searchLogs SearchLog[]`; ninguna de sus columnas
existentes cambia.

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `uuid` | PK |
| `session_id` | `uuid` | FK → `session.id`, `Restrict` (mismo criterio que el resto del esquema) |
| `channel` | `search_channel` | `TEXT` \| `VOICE` |
| `intent` | `search_intent` | `SEARCH` \| `ADD` |
| `outcome` | `search_outcome` | Ver enum arriba |
| `latency_ms` | `int4` | ≥ 0 |
| `tokens_used` | `int4?` | `null` si no hubo respuesta del proveedor |
| `model` | `text` | p. ej. `"claude-haiku-4-5-20251001"` |
| `error_code` | `text?` | `null` salvo `outcome = ERROR` |
| `created_at` | `timestamptz(3)` | Por omisión, ahora |

Sin trigger append-only: a diferencia de `order_status_event` (E2), ninguna FR de esta épica exige
inmutabilidad del registro de telemetría — es un log operativo, no una fuente de verdad del
dominio de pedidos.

**Índice**: `(session_id, created_at)` sirve tanto para "búsquedas de esta sesión en la última
ventana" (si en el futuro se decide medir el rate limit desde la base en vez de en memoria, D-058)
como para agregaciones de SC-004/SC-007 por rango de fechas.

## Sin migración de las tablas de E1/E2/E3/E9

Ninguna columna de `product`, `category`, `session`, `cart`, `cart_line`, `order` ni
`order_status_event` cambia de tipo, se renombra o se elimina. `product` y `session` solo ganan
relaciones entrantes, que en PostgreSQL no requieren tocar la tabla que las recibe.

## Tipos nuevos · `packages/shared`

Ver `contracts/shared.md` para la forma completa (`SearchInterpretation`,
`SemanticSearchResponse`, `AddResolutionResponse`, `SearchChannel`, `SearchIntent`).

## Diagrama de flujo de escritura y lectura

```text
POST /menu/search  (intent: SEARCH | ADD)
        │
        ▼
MenuService.candidatosParaBusqueda()   ← SOLO active && available (D-061)
        │
        ▼
SemanticIntentProvider.interpretar()   ← proveedor externo, sin acceso a BD (D-057)
        │
        ▼
Filtrar contra allowlist en memoria (D-062)
        │
        ▼
Reconsultar active && available vigente (FR-006/FR-021)
        │
        ├──▶ construir SemanticSearchResponse | AddResolutionResponse
        │
        ▼
Escribir 1 fila en search_log (siempre, incluso en error) (D-060)
```

Ninguna escritura toca `product`, `cart`, `cart_line` ni `order`: la única tabla que esta épica
escribe es `search_log`. El agregado real al carrito (HU-13, Historia 2) ocurre en una llamada
**posterior y separada** del frontend a `POST /cart/lines` / `PATCH /cart/lines/:productId`
(E2, sin cambios — D-063), después de que el cliente confirma.
