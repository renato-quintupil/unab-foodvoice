# Evaluación con el modelo real (T038, SC-001, SC-004, SC-007)

Corpus usado: [`corpus-aceptacion.md`](./corpus-aceptacion.md), 15 frases contra
`POST /menu/search` con `intent: SEARCH`, `LLM_API_KEY` real, modelo
`claude-haiku-4-5-20251001`, ejecutado desde una sesión de cliente real
(`debug-cliente@foodvoice.cl`) el 2026-08-23/24.

## Corrida 1 (encontró un defecto real)

15/15 solicitudes con `HTTP 200`, salvo la última: **`quiero una pizza`
devolvió `502` a los 10s** (cortada por el plazo del proxy BFF), aunque
`services/api` la había resuelto en paralelo con `HTTP 200` a los **13.157 s**
(visible en su log, no en la respuesta que llegó al navegador).

```
n=15  min=1207ms  max=13157ms  avg=2618ms  p95=6007ms
```

**p95 = 6.007 s > 5 s → SC-004 no se cumplía.**

### Causa raíz

`AnthropicSemanticIntentProvider` construye el cliente con
`new Anthropic({ apiKey })`, sin desactivar el reintento propio del SDK
(`maxRetries`, **2 por omisión**, con backoff). Eso se sumaba al único
reintento explícito que ya hace `llamarConReintento` (D-065), pudiendo
encadenar hasta 2 (nuestro reintento) × 3 (intentos del SDK, con backoff
entre ellos) llamadas HTTP reales para una sola solicitud — sin que ningún
log lo señalara como "reintento", solo como una latencia anormalmente alta.

### Corrección

`services/api/src/menu-search/providers/anthropic-semantic-intent.provider.ts`:
`new Anthropic({ apiKey, maxRetries: 0 })`. El único reintento ahora es el que
D-065 documenta y controla (`MAX_INTENTOS = 2`), acotando el peor caso a
`2 × LLM_TIMEOUT_MS` (2 × 4.000 ms = 8 s), bajo los 10 s del proxy BFF.

## Corrida 2 (mismo corpus, después de la corrección)

15/15 solicitudes con `HTTP 200`, sin ningún `502`.

```
n=15  min=1122ms  max=3969ms  avg=2021ms  p95=3100ms
```

**p95 = 3.1 s ≤ 5 s → SC-004 se cumple**, con margen (el peor caso individual,
3.969 s, también queda bajo el umbral).

## SC-001 · Corrección semántica (frases no ambiguas)

Las 10 frases no ambiguas del corpus (F01–F10) devolvieron el producto
esperado entre sus primeros 3 resultados en **10/10 casos (100%)** — sobre el
90% exigido. Detalle en `corpus-aceptacion.md`; una observación menor sin
impacto en el criterio: F09 ("quiero una pizza saludable") incluyó además
"Pizza de Verduras Asadas" (perfil "Equilibrado", no "Saludable") junto al
producto correcto — no es un fallo de SC-001 porque el producto esperado sí
está en el top-3, pero vale registrarlo como una imprecisión de clasificación
a vigilar si se amplía el corpus más adelante.

## SC-007 · Proyección de costo mensual

`search_log.tokens_used` de la corrida 2 (post-corrección): **promedio 4.464
tokens/búsqueda** (input + output combinados; el esquema de `search_log` no
separa ambos — D-060 solo registra el total).

Tarifa publicada de Claude Haiku 4.5 al momento de este análisis: **$1 USD /
MTok de entrada, $5 USD / MTok de salida**. Como no se mide el desglose real,
se acotan dos escenarios:

| Escenario | Costo/búsqueda (USD) | Costo/búsqueda (CLP, ≈950 CLP/USD) |
|---|---|---|
| Peor caso (100% tokens de salida) | $0,0223 | ≈ 21,2 CLP |
| Estimado realista (~95% entrada / 5% salida, dado que cada solicitud envía el catálogo completo como contexto y responde con un JSON compacto) | $0,0054 | ≈ 5,1 CLP |

Con el tope de **$15.000 CLP/mes** (SC-007):

| Escenario | Búsquedas/mes hasta el tope |
|---|---|
| Peor caso | ≈ 707 |
| Estimado realista | ≈ 2.941 |

**Ambos escenarios exceden por lejos el volumen esperado del entorno de
referencia** (proyecto de titulación: pruebas manuales y demostraciones, no
tráfico de producción con usuarios reales) — SC-007 se da por cumplido bajo
ese supuesto de volumen, con dos advertencias explícitas:

1. La tarifa CLP/USD (≈950) y la tarifa por MTok son las vigentes al momento
   de este análisis (2026-08-24); ambas pueden cambiar. La alerta de
   presupuesto en la consola de Anthropic (ya configurada, spec.md § 8) es la
   defensa real contra una desviación, no esta proyección puntual.
2. Si el volumen real de uso creciera más allá de una demo/evaluación —por
   ejemplo, si el proyecto pasara a producción con tráfico de clientes
   reales— esta proyección debe rehacerse con el volumen real observado en
   `search_log`, no con el supuesto de "entorno de referencia" usado acá.

## Veredicto

- **SC-001**: cumple (10/10 frases no ambiguas, 100% ≥ 90%).
- **SC-004**: cumple tras la corrección de `maxRetries` (p95 = 3,1 s ≤ 5 s).
- **SC-007**: cumple bajo el supuesto de volumen de un entorno de referencia
  (proyecto de titulación), con las dos advertencias de arriba.

T038 queda completa. El ajuste de `maxRetries: 0` se documenta también como
corrección de código, no solo como hallazgo de esta evaluación.
