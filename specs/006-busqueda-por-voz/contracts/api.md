# Contrato HTTP: búsqueda por voz (E6)

Amplía la superficie declarada en
[`../../002-administracion-menu-productos/contracts/api.md`](../../002-administracion-menu-productos/contracts/api.md)
(menú) y en
[`../../003-gestion-pedidos/contracts/api.md`](../../003-gestion-pedidos/contracts/api.md)
(carrito), cuyas convenciones —formato de error, versionado (`/api/v1`), fechas ISO 8601— rigen
aquí sin cambios. **Un solo endpoint nuevo**, `POST /menu/search` (D-056). HU-13 no agrega ningún
endpoint de escritura: reutiliza `POST /cart/lines` y `PATCH /cart/lines/:productId`, ya
documentados en el contrato de E2 (D-063).

## Quién puede llamar a qué

| Ruta | Roles admitidos | Guard | Restricción adicional |
|---|---|---|---|
| `POST /menu/search` | **Solo `CLIENTE`** | `SessionGuard` + `RolesGuard(CLIENTE)` + `SearchThrottlerGuard` | 20 solicitudes / 5 min por sesión (FR-014, D-058) |

## `POST /api/v1/menu/search`

Body: `SearchRequest` (`contracts/shared.md`).

```json
{
  "query": "quiero una pizza sana y económica",
  "channel": "VOICE",
  "intent": "SEARCH"
}
```

- `query`: 1–300 caracteres tras recortar espacios (FR-015). Vacío o excedido → `400`.
- `channel`: `TEXT` \| `VOICE` — solo para telemetría (`search_log.channel`); nunca cambia el
  resultado de la búsqueda (FR-009: ambos canales son la misma solicitud).
- `intent`: `SEARCH` (Historia 1/3) o `ADD` (Historia 2). Por omisión, `SEARCH`.

### Respuesta `200`, `intent: "SEARCH"` → `SemanticSearchResponse`

Tres formas posibles, discriminadas por `status`:

```json
{
  "status": "RESULTS",
  "interpretation": {
    "priceTier": "ECONOMICO",
    "foodTypeCategoryId": "…",
    "healthProfileCategoryId": "…",
    "vegan": null,
    "productTerms": [],
    "openRecommendation": false
  },
  "items": [ /* ProductDto[], reales, active && available (FR-006, FR-007) */ ]
}
```

```json
{
  "status": "CLARIFICATION",
  "question": "¿Te refieres a algo saludable o a una porción pequeña?",
  "options": ["Saludable", "Porción pequeña"]
}
```

```json
{
  "status": "NO_RESULTS",
  "interpretation": { "priceTier": "ECONOMICO", "foodTypeCategoryId": "…", "healthProfileCategoryId": null, "vegan": null, "productTerms": [], "openRecommendation": false }
}
```

### Respuesta `200`, `intent: "ADD"` → `AddResolutionResponse`

```json
{ "status": "RESOLVED", "item": { /* ProductDto */ }, "quantity": 2 }
```

```json
{ "status": "CLARIFICATION", "question": "¿Cuál de estas pizzas?", "options": ["Napolitana", "Margarita"] }
```

```json
{ "status": "NOT_FOUND" }
```

`AddResolutionResponse` **nunca** agrega nada al carrito (FR-008, FR-019–FR-021). Es responsabilidad
del frontend, tras la confirmación explícita del cliente (FR-020), llamar a `POST /cart/lines` y,
si `quantity > 1`, a `PATCH /cart/lines/:productId` (D-063) — ambos ya documentados en
`003-gestion-pedidos/contracts/api.md`.

## Códigos de error que E6 añade

| HTTP | `code` | Significado | Origen |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | `query` vacío, solo espacios, o mayor a 300 caracteres | Zod (`SearchRequestSchema`) |
| 429 | `TOO_MANY_REQUESTS` | Más de 20 solicitudes en 5 minutos para la sesión (FR-014) | `SearchThrottlerGuard` |
| 503 | `SEARCH_UNAVAILABLE` | Timeout, error del proveedor, o JSON inválido tras el reintento (FR-016, D-065) | `menu-search.service.ts` |

Ninguno de los tres bloquea `GET /menu/products` ni los endpoints de `cart` — son específicos de
`POST /menu/search` y no afectan al resto de la API (FR-016, SC-005). El mensaje de `429` y de
`503` usan `MSG_LIMITE_BUSQUEDAS` y `MSG_BUSQUEDA_NO_DISPONIBLE` respectivamente
(`contracts/shared.md`).

## Lo que este endpoint garantiza, y por qué (trazabilidad a la spec)

| Garantía | FR | Dónde se implementa |
|---|---|---|
| El proveedor solo recibe categorías activas y productos `active && available` | FR-003 | `MenuService.candidatosParaBusqueda()` (D-061) |
| Ningún ID fuera de lo enviado llega a construir la respuesta | FR-005 | Filtro por `Set` en memoria (D-062) |
| Los resultados reflejan disponibilidad **al responder**, no al proyectar | FR-006, FR-007, FR-021 | Reconsulta de Prisma después de filtrar (D-062) |
| Cero escrituras en `product`, `cart`, `cart_line`, `order` | FR-008 | Solo se escribe `search_log` (D-060) |
| Mismo resultado por voz o por texto | FR-009 | `channel` no participa de ningún `where` |
| Resultado vacío no se relaja solo | FR-010 | Sin lógica de relajación de filtros en el servicio |
| Ambigüedad pregunta antes de listar | FR-011 | Rama `CLARIFICATION` de la tool forzada (D-057) |
| Aptitud dietética nunca inferida | FR-012, FR-013 | `vegan` en `SearchInterpretation` solo se activa si el proveedor lo marcó explícito; el filtro real es `dietaryTags: { some: { name: 'Vegano' } }` en Prisma, no una heurística sobre `ingredients` |
| 20 solicitudes / 5 min por sesión | FR-014 | `SearchThrottlerGuard` (D-058) |
| Largo máximo de `query` | FR-015 | `SearchRequestSchema` |
| Caída del proveedor no bloquea el resto | FR-016 | `503` acotado a este endpoint; `GET /menu/products` y `cart/*` no lo consultan |

## Diagrama de secuencia

```text
apps/web                 services/api                         Anthropic (Claude Haiku 4.5)
   │                          │                                          │
   │ POST /menu/search        │                                          │
   ├─────────────────────────►│                                          │
   │                          │ candidatosParaBusqueda()                │
   │                          │ (active && available, D-061)            │
   │                          │                                          │
   │                          │ interpretar(contexto) ──────────────────►│
   │                          │◄───────────── tool_use forzado (D-057) ──┤
   │                          │ filtrar allowlist (D-062)                │
   │                          │ reconsultar active && available          │
   │                          │ escribir 1 fila en search_log (D-060)    │
   │◄─────────────────────────┤                                          │
   │ SemanticSearchResponse   │                                          │
   │ o AddResolutionResponse  │                                          │
   │                          │                                          │
   │ (solo si ADD y confirma) │                                          │
   │ POST /cart/lines         │                                          │
   │ PATCH /cart/lines/:id    │  ← endpoints de E2, sin cambios (D-063)  │
   ├─────────────────────────►│                                          │
```
