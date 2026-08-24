# Guía de puesta en marcha y validación: E6 · Búsqueda por voz

Esta guía levanta la épica en local y recorre los **8 criterios de éxito** uno por uno. A
diferencia de E4, esta épica sí agrega variables de entorno nuevas (proveedor LLM) y datos de
semilla nuevos (aptitud dietética "Vegano").

## Requisitos previos

Los mismos de las épicas anteriores (Node.js 22 LTS, pnpm 9, Docker con Compose), más:

- **Una clave de la API de Anthropic** con acceso a Claude Haiku 4.5
  (`claude-haiku-4-5-20251001`). El arranque de `services/api` **falla sin ella**, igual que sin
  `DATABASE_URL` (D-064).
- Un catálogo cargado por la semilla de E3, con al menos un producto marcado con la aptitud
  "Vegano" (esta épica extiende esa semilla).

## Variables de entorno nuevas

Agregar a `.env` (y a `.env.example`, sin el valor real de la clave):

```bash
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-4-5-20251001
LLM_API_KEY=                 # obligatoria; el arranque falla sin ella (D-064)
LLM_TIMEOUT_MS=4000          # por omisión (D-065)
```

## Puesta en marcha

```bash
cp .env.example .env               # completar LLM_API_KEY con una clave real
pnpm install                       # agrega @anthropic-ai/sdk y @nestjs/throttler
docker compose up -d postgres
pnpm --filter api db:migrate       # crea dietary_tag, search_log y sus índices (D-059, D-060)
pnpm --filter api db:seed          # administrador (E1) + catálogo (E3) + aptitud "Vegano" (E6)
pnpm dev                           # api :3001 · web :3000
```

Alternativa íntegra en contenedores: `docker compose up --build` (con `LLM_API_KEY` ya en el
`.env` que Compose lee).

## Comprobaciones automáticas

```bash
pnpm test              # unitarios; falla si no se cumplen los umbrales de cobertura
pnpm test:integration  # API contra PostgreSQL efímera en Docker — el proveedor LLM se simula
pnpm lint && pnpm typecheck && pnpm build
```

La capa de integración **no llama al proveedor real** (`SemanticIntentProvider` se sustituye por
un doble de prueba determinista): mide allowlist, reconsulta de disponibilidad, rate limiting y
escritura de `search_log`, no la calidad de la interpretación. Esa calidad se mide aparte, en
"Evaluación con el modelo real" más abajo.

## Validación funcional

### Preparación

Una sesión de **cliente**, con el catálogo de E3 ya cargado y al menos:

- Un producto en el tramo económico y en una categoría de perfil de salud saludable.
- Un producto llamado de forma reconocible (p. ej. "Pizza Napolitana").
- Un producto marcado con la aptitud "Vegano" y otro sin marcar.
- Un producto que se pueda marcar como agotado durante la prueba (V-05).

### A · Cliente busca en lenguaje natural (Historia 1, P1)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Escribir «quiero algo económico y sano» en el campo de búsqueda | Los resultados son productos activos y disponibles, en el tramo económico y en una categoría de perfil de salud saludable (SC-001, SC-002) |
| **V-02** | Buscar «quiero una napolitana» (o el nombre real de un producto del catálogo) | Ese producto aparece entre los resultados |
| **V-03** | Buscar una frase ambigua, p. ej. «algo liviano» | El sistema pide una aclaración con opciones derivadas del catálogo, no una lista de resultados |
| **V-04** | Buscar una combinación sin ningún producto que la cumpla (p. ej. un tramo de precio y una categoría que no coexisten en el catálogo de prueba) | El sistema comunica que no encontró resultados y qué entendió, sin sustituir por productos que cumplen solo una condición |
| **V-05** | Marcar como agotado, desde otra sesión de negocio, un producto que cumplía la búsqueda de V-01, y repetir esa búsqueda | Ese producto ya no aparece entre los resultados |
| **V-06** | Repetir la frase de V-01 usando el micrófono (si el navegador lo soporta) en vez de escribirla | Mismo tipo de resultado que V-01 — no dos comportamientos distintos por canal |
| **V-16** | Sobre los resultados de una búsqueda (p. ej. V-01), hacer clic en el botón "Agregar" de una de las tarjetas, sin dictar ni escribir una frase de agregado | El producto queda en el carrito con cantidad 1, sin pasar por la pantalla de confirmación de la Historia 2 (FR-028) |

### B · Cliente agrega al carrito por voz (Historia 2, P2)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-07** | Decir o escribir «agrégame una napolitana» (usar el nombre real de un producto activo y disponible) | Aparece una pantalla de confirmación con el producto, cantidad 1 y el precio vigente (SC-006) |
| **V-08** | Confirmar esa pantalla | El producto queda en el carrito con esa cantidad y precio |
| **V-09** | Repetir V-07 con una frase que no especifica cantidad, cancelar en la pantalla de confirmación en vez de aprobar | El carrito queda exactamente igual que antes de la frase |
| **V-10** | Desde otra sesión de negocio, marcar como agotado el producto que se está confirmando en una pantalla de agregado abierta, y luego confirmar | El sistema rechaza agregarlo con el mismo mensaje que usa el flujo manual de carrito |
| **V-11** | Decir «agrégame una pizza» cuando el catálogo tiene más de una pizza activa | El sistema pide una aclaración antes de mostrar cualquier confirmación |

### C · Cliente busca por aptitud vegana (Historia 3, P3)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-12** | Buscar «quiero algo para vegano» | Aparece el producto marcado como "Vegano"; el producto sin marcar, aunque no tenga ingredientes de origen animal declarados, NO aparece (SC-008) |

### D · Resiliencia sin voz ni proveedor (SC-005)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-13** | Denegar el permiso del micrófono en el navegador | El campo de texto y los filtros manuales del menú siguen operativos |
| **V-14** | Detener temporalmente el acceso a la API de Anthropic (por ejemplo, usando una `LLM_API_KEY` inválida en una segunda instancia de prueba) y buscar algo | El sistema muestra un error recuperable en español; el menú, sus filtros y el carrito manual siguen funcionando sin ningún paso bloqueado |

### E · Límite de frecuencia (FR-014)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-15** | Ejecutar 21 búsquedas seguidas en menos de 5 minutos, desde la misma sesión | Las primeras 20 responden normalmente; la 21ª responde `429` con el mensaje de límite de búsquedas |

## Evaluación con el modelo real (SC-004, SC-007)

A diferencia de las validaciones anteriores, estas dos no son un paso manual único sino una
medición que se corre antes de dar el SLO por definitivo (HU-06 §8, `revision_claude.md` punto 3):

1. Ejecutar el corpus de frases de aceptación (Principio XI) contra `POST /menu/search` con
   `LLM_API_KEY` real, registrando la latencia de cada respuesta desde `search_log.latency_ms`.
2. Calcular el percentil 95 de esas latencias. **SC-004 exige ≤ 5 segundos.** Si no se cumple,
   ajustar `LLM_TIMEOUT_MS` o revisar el tamaño de la proyección enviada (D-061) antes de dar la
   épica por verificada.
3. Sumar `search_log.tokens_used` de todo el corpus y convertir a costo según la tarifa vigente de
   Claude Haiku 4.5; proyectar a un mes de uso esperado. **SC-007 exige mantenerse bajo $15.000
   CLP/mes**, con la alerta de la consola de Anthropic ya configurada.

## Trazabilidad criterio → pasos

| Criterio de éxito | Pasos |
|---|---|
| SC-001 (≥90% top-3 en frases no ambiguas del corpus) | Evaluación con el modelo real, más V-01/V-02 como muestra manual |
| SC-002 (0% de resultados inactivos/no disponibles) | V-01, V-05 |
| SC-003 (100% de búsquedas sin escritura salvo confirmación) | V-01 a V-09 (ninguna escribe carrito salvo V-08 tras confirmar) |
| SC-004 (p95 ≤ 5 s) | Evaluación con el modelo real |
| SC-005 (pedido completable sin voz ni proveedor) | V-13, V-14 |
| SC-006 (100% de agregados muestran confirmación con precio vigente) | V-07 |
| SC-007 (costo mensual < $15.000 CLP) | Evaluación con el modelo real |
| SC-008 (aptitud vegana correcta al 100%/0%) | V-12 |

FR-028 (agregar manualmente un resultado de búsqueda, con un clic) no tiene un criterio de éxito
numerado propio — se cubre con V-16.
