---
description: "Lista de tareas de implementación: E6 · Búsqueda por voz"
---

# Tareas: E6 · Búsqueda por voz

**Entrada**: documentos de diseño de `specs/006-busqueda-por-voz/`.

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/) y [quickstart.md](./quickstart.md).

**Pruebas**: se incluyen obligatoriamente, igual que en E1–E4. El Principio XI exige especificar
antes de programar; la allowlist, la reconsulta de disponibilidad, el rate limiting y el filtro
de aptitud vegana son la lógica con más riesgo de esta épica y se prueban con integración real
contra PostgreSQL, sustituyendo `SemanticIntentProvider` por un doble de prueba determinista (el
proveedor real no se prueba en la batería automática, ver `plan.md` § Contexto Técnico). En cada
fase se escriben las pruebas y se comprueba que fallen antes de implementar.

**Organización**: una fase por historia, en orden de prioridad: buscar (P1) → agregar por voz
(P2) → aptitud vegana (P3). Hay fase de migración (Fase 2): dos tablas nuevas y dos dependencias
nuevas, a diferencia de E4.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: tarea paralelizable por usar archivos distintos y no depender de otra tarea incompleta.
- **[US1]**: Historia 1 · Cliente busca comida hablando o escribiendo en lenguaje natural (P1).
- **[US2]**: Historia 2 · Cliente agrega un producto al carrito por voz (P2).
- **[US3]**: Historia 3 · Cliente busca productos aptos para veganos (P3).

## Convenciones de ruta

El monorepo existente usa `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
pruebas de integración viven en `services/api/test/*.integration-spec.ts` contra PostgreSQL; las
de componente en `apps/web/tests/*.test.tsx`. Dependencias nuevas: `@anthropic-ai/sdk` y
`@nestjs/throttler` en `services/api`. Variables de entorno nuevas: `LLM_PROVIDER`, `LLM_MODEL`,
`LLM_API_KEY`, `LLM_TIMEOUT_MS`.

---

## Fase 1: Preparación

**Propósito**: dependencias y configuración base, sin tocar todavía ningún archivo de dominio.

- [X] T001 Agregar `@anthropic-ai/sdk` y `@nestjs/throttler` a `services/api/package.json` y correr `pnpm install`
- [X] T002 [P] Agregar `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_TIMEOUT_MS` a `.env.example`, con un comentario explicando que `LLM_API_KEY` es obligatoria (D-064)
- [X] T003 Agregar `LLM_API_KEY` a `OBLIGATORIAS` en `services/api/src/config/env.validation.ts`, con el mismo mensaje de error que ya usa `DATABASE_URL` (D-064)
- [X] T004 Ejecutar la línea base de `specs/006-busqueda-por-voz/quickstart.md` —`pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`—, registrar el resultado y detener la implementación si existe un fallo preexistente

---

## Fase 2: Cimientos bloqueantes

**Propósito**: esquema de base de datos, contratos compartidos y el adaptador del proveedor —lo
que las tres historias consumen.

**⚠️ CRÍTICO**: ninguna historia empieza hasta completar esta fase.

- [X] T005 Agregar a `services/api/prisma/schema.prisma`: modelo `DietaryTag`, relación implícita `Product.dietaryTags`, enums `SearchChannel`/`SearchIntent`/`SearchOutcome`, modelo `SearchLog` con FK a `Session`, y la relación entrante `Session.searchLogs` (según `data-model.md`)
- [X] T006 Correr `pnpm --filter api db:migrate` para generar la migración de `dietary_tag`, `search_log` y la tabla de unión implícita (depende de T005)
- [X] T007 [P] Crear `packages/shared/src/enums/search.ts` con `SearchChannel` y `SearchIntent` (objetos `as const`, según `contracts/shared.md`)
- [X] T008 [P] Crear `packages/shared/src/schemas/search.ts` con `SearchRequestSchema` (`query` 1–300 caracteres, `channel`, `intent` con valor por omisión `SEARCH`)
- [X] T009 [P] Agregar `MSG_BUSQUEDA_VACIA`, `MSG_BUSQUEDA_MUY_LARGA`, `MSG_LIMITE_BUSQUEDAS` y `MSG_BUSQUEDA_NO_DISPONIBLE` a `packages/shared/src/messages/es.ts`
- [X] T010 Agregar `SearchInterpretation`, `SemanticSearchResponse`, `AddResolutionResponse` y el campo `dietaryTags: string[]` en `ProductDto`, en `packages/shared/src/types/api.ts` (depende de T007)
- [X] T011 Exportar los símbolos nuevos de T007–T010 desde `packages/shared/src/index.ts`
- [X] T012 [P] Agregar `MenuService.candidatosParaBusqueda()` en `services/api/src/menu/menu.service.ts`: reutiliza `calcularCortes()` y filtra `active: true, available: true` (D-061; depende de T006)
- [X] T013 [P] Actualizar `productoADto` en `services/api/src/products/products.service.ts` para incluir `dietaryTags` (nombres de las aptitudes marcadas) (depende de T006, T010)
- [X] T014 Crear la interfaz `SemanticIntentProvider` en `services/api/src/menu-search/providers/semantic-intent.provider.ts`, con un método `interpretar(contexto, intent)` que declara la forma de entrada (proyección del catálogo, frase) y de salida (`InterpretacionCruda`, con `quantity` opcional solo relevante para `intent: 'ADD'`)
- [X] T015 Implementar `AnthropicSemanticIntentProvider` en `services/api/src/menu-search/providers/anthropic-semantic-intent.provider.ts`: usa `@anthropic-ai/sdk`, modelo de `LLM_MODEL`, tool use forzado contra el esquema de `InterpretacionCruda`, timeout de `LLM_TIMEOUT_MS` y un reintento ante JSON inválido (D-057, D-065; depende de T014)
- [X] T016 Crear `services/api/src/menu-search/menu-search.module.ts`: registra `ThrottlerModule` (D-058), el proveedor `SemanticIntentProvider` inyectado como `AnthropicSemanticIntentProvider`, e importa `MenuModule`/`PrismaService` (depende de T015)

**Punto de control**: `packages/shared` y `services/api` compilan; la migración corre limpia
sobre una base vacía. Las historias pueden comenzar.

---

## Fase 3: Historia de Usuario 1 — Cliente busca comida hablando o escribiendo (P1) 🎯 MVP

**Objetivo**: `POST /menu/search` con `intent: 'SEARCH'` interpreta una frase y devuelve
productos reales, activos y disponibles, o pide aclaración, o comunica que no encontró nada.

**Prueba independiente**: con el catálogo de E3 cargado y una sesión de cliente, se completan
V-01 a V-06 de `quickstart.md`: búsquedas simples, ambigüedad, resultado vacío, producto agotado
entre proyección y respuesta, y equivalencia voz/texto.

### Pruebas de US1

> **NOTA: escribir estas pruebas primero y comprobar que fallan antes de implementar.**

- [X] T017 [P] [US1] Crear las pruebas fallidas de `POST /menu/search` (`intent: SEARCH`) en `services/api/test/menu-search-search.integration-spec.ts`, con un doble de `SemanticIntentProvider`: `RESULTS` solo con productos `active && available`, IDs fuera de la proyección descartados (allowlist), `CLARIFICATION` cuando el doble lo indica, `NO_RESULTS` sin relajar condiciones, `400` con `query` vacío o de más de 300 caracteres, `429` a partir de la solicitud 21 en 5 minutos, y una fila nueva en `search_log` sin la frase del cliente en ninguna columna
- [X] T018 [P] [US1] Crear las pruebas fallidas del componente de búsqueda en `apps/web/tests/busqueda-por-voz.test.tsx`: renderiza los tres estados (resultados, aclaración, sin resultados), funciona escribiendo texto sin usar el micrófono, y sigue disponible si `POST /menu/search` responde `503`

### Implementación de US1

- [X] T019 [US1] Implementar `buscar(sesion, datos)` en `services/api/src/menu-search/menu-search.service.ts`: arma la proyección con `candidatosParaBusqueda()` (T012), invoca `SemanticIntentProvider.interpretar(..., 'SEARCH')`, filtra la respuesta contra un `Set` de IDs enviados (D-062), reconsulta `active && available` de los candidatos filtrados, arma `SemanticSearchResponse` y escribe una fila en `search_log` con `outcome` correspondiente (incluido `ERROR` ante timeout o JSON inválido tras el reintento) (depende de T012, T015, T016)
- [X] T020 [US1] Crear `SearchThrottlerGuard` en `services/api/src/menu-search/search-throttler.guard.ts`, extendiendo `ThrottlerGuard` con `getTracker()` sobre `req.sesion.id` en vez de IP, límite 20/300s (D-058; depende de T016)
- [X] T021 [US1] Crear `POST /menu/search` en `services/api/src/menu-search/menu-search.controller.ts`, con `@Roles(CLIENTE)`, `SessionGuard`, `RolesGuard`, `SearchThrottlerGuard` y `ZodValidationPipe(SearchRequestSchema)`, delegando a `menu-search.service.ts` según `intent` (depende de T019, T020)
- [X] T022 [US1] Crear `apps/web/src/app/menu/_components/busqueda-por-voz.tsx`: campo de texto, botón de micrófono con `SpeechRecognition` y consentimiento explícito antes de activarlo (FR-018), transcripción editable, y los tres estados de `SemanticSearchResponse` (depende de T021)
- [X] T023 [US1] Integrar `busqueda-por-voz.tsx` en `apps/web/src/app/menu/page.tsx`, junto a los filtros manuales existentes de E3, sin ocultarlos (Principio VI; depende de T022)

**Punto de control**: un cliente puede buscar por voz o texto y ver productos reales, una
aclaración, o cero resultados. US1 es demostrable por sí sola.

---

## Fase 4: Historia de Usuario 2 — Cliente agrega un producto al carrito por voz (P2)

**Objetivo**: `POST /menu/search` con `intent: 'ADD'` resuelve un único producto candidato y una
cantidad; el frontend confirma y recién ahí llama a los endpoints de carrito ya existentes de E2.

**Prueba independiente**: con un producto activo y disponible, se completan V-07 a V-11 de
`quickstart.md`: confirmar, cancelar, producto que se agota entre sugerencia y confirmación, y
ambigüedad de producto.

### Pruebas de US2

- [X] T024 [P] [US2] Crear las pruebas fallidas de `POST /menu/search` (`intent: ADD`) en `services/api/test/menu-search-add.integration-spec.ts`: `RESOLVED` con `quantity` ≥ 1 (por omisión 1 si la frase no la especifica, FR-024), `CLARIFICATION` con más de un candidato razonable, `NOT_FOUND` sin candidato, y que ninguna llamada a este endpoint escribe en `cart` ni `cart_line`
- [X] T025 [P] [US2] Crear las pruebas fallidas del flujo de confirmación en `apps/web/tests/busqueda-por-voz.test.tsx` (bloque "agregar por voz", cubriendo `confirmacion-agregado.tsx`): muestra producto, cantidad y precio vigentes; confirmar llama a `POST /cart/lines` (y a `PATCH /cart/lines/:productId` si `quantity > 1`); cancelar no llama a ningún endpoint de escritura — consolidado en el mismo archivo que T018 en vez de un archivo separado, para probar la integración real entre búsqueda y confirmación

### Implementación de US2

- [X] T026 [US2] Extender `menu-search.service.ts` con la rama `intent: 'ADD'`: invoca `SemanticIntentProvider.interpretar(..., 'ADD')`, resuelve un único candidato (o `CLARIFICATION`/`NOT_FOUND`), revalida `active && available` inmediatamente antes de responder (FR-021), y arma `AddResolutionResponse` sin escribir en `cart` (depende de T019)
- [X] T027 [US2] Crear `apps/web/src/app/menu/_components/confirmacion-agregado.tsx`: muestra producto/cantidad/precio de `AddResolutionResponse`, cantidad editable, y al confirmar llama `POST /cart/lines` seguido de `PATCH /cart/lines/:productId` si la cantidad final es mayor a 1 (D-063; depende de T026)
- [X] T028 [US2] Conectar `busqueda-por-voz.tsx` para invocar `intent: 'ADD'` (botón "Agregar al carrito por voz", sobre el mismo texto ya escrito o dictado) y abrir `confirmacion-agregado.tsx` cuando el servidor resuelve `RESOLVED` (depende de T022, T027)

**Punto de control**: un cliente puede agregar un producto al carrito con una frase y una
confirmación explícita; cancelar no cambia el carrito. US1 y US2 funcionan de forma
independiente.

---

## Fase 5: Historia de Usuario 3 — Cliente busca productos aptos para veganos (P3)

**Objetivo**: el negocio puede marcar un producto como vegano; el cliente que busca «algo para
vegano» solo recibe productos marcados, nunca inferidos de los ingredientes.

**Prueba independiente**: con un producto marcado como vegano y otro sin marcar, se completa
V-12 de `quickstart.md`.

### Pruebas de US3

- [X] T029 [P] [US3] Crear las pruebas fallidas de aptitud vegana en `services/api/test/menu-search-vegan.integration-spec.ts`: `POST /menu/search` con `intent: SEARCH` y una interpretación `vegan: true` solo devuelve productos con `dietaryTags` que incluyen `"Vegano"`, nunca uno sin esa marca aunque no declare ingredientes de origen animal
- [X] T030 [P] [US3] Extender `apps/web/tests/productos.test.tsx`: el formulario de alta/edición de producto incluye un checkbox "Apto para veganos" que se guarda correctamente y llega tildado al editar un producto ya marcado

### Implementación de US3

- [X] T031 [US3] En `menu-search.service.ts`, cuando `SearchInterpretation.vegan === true`, agregar `dietaryTags: { some: { name: 'Vegano' } }` a la reconsulta de Prisma como filtro adicional de defensa (no solo confiar en que el modelo ya excluyó los no marcados) (depende de T019)
- [X] T032 [US3] Agregar `vegan?: boolean` a `CamposProducto` en `packages/shared/src/schemas/product.ts` (`CreateProductSchema`/`UpdateProductSchema`)
- [X] T033 [US3] Actualizar `ProductsService.crear`/`editar` en `services/api/src/products/products.service.ts` para conectar o desconectar la relación `dietaryTags` con la fila `"Vegano"` de `DietaryTag` según el campo `vegan` recibido (depende de T005, T032) — cubierto además por `services/api/test/products-dietary-tags.integration-spec.ts`, que detectó y evitó un error real de Prisma (`set` no es válido en un `create` anidado)
- [X] T034 [US3] Agregar el checkbox "Apto para veganos" a `apps/web/src/app/negocio/productos/_components/formulario-producto.tsx`, reutilizado por `nuevo/page.tsx` y `[id]/editar/page.tsx` (depende de T033)
- [X] T035 [US3] Actualizar `services/api/prisma/seed/catalogo.ts` para crear la fila `DietaryTag` `"Vegano"` y marcar dos productos de la semilla (Sándwich Vegetariano de Berenjena, Ensalada de Quinoa y Palta) (depende de T005)

**Punto de control**: las tres historias funcionan de forma independiente y completa.

---

## Fase Final: Validación funcional y cierre

**Propósito**: cerrar la épica con los 15 pasos manuales, la evaluación con el modelo real, y
actualizar el estado del producto.

- [X] T036 Ejecutar `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`; deben pasar en verde antes de la validación manual
- [ ] T037 Recorrer V-01 a V-15 de `specs/006-busqueda-por-voz/quickstart.md` con sesiones reales de cliente y negocio; registrar el resultado en `specs/006-busqueda-por-voz/verificacion.md`
- [X] T038 Ejecutar la evaluación con el modelo real de `quickstart.md` § Evaluación con el modelo real: correr el corpus de frases de aceptación (Principio XI) contra Claude Haiku 4.5, medir el p95 de `search_log.latency_ms` (SC-004) y proyectar el costo mensual desde `search_log.tokens_used` (SC-007); documentar el resultado y, si no se cumple el SLO, ajustar `LLM_TIMEOUT_MS` antes de continuar
- [ ] T039 Actualizar `specs/README.md` y `CLAUDE.md` (§ Estado del código) para reflejar E6 como terminada, con el mismo nivel de detalle que E1/E2/E3/E4/E9

**Nota sobre T036–T039 (2026-08-24)**: T036 corrió completo dos veces sobre el monorepo real
—`pnpm typecheck`, `pnpm lint`, `pnpm test` (233 + 143 + 210 = 586 unitarios, todos con sus
umbrales de cobertura) y `pnpm test:integration` (613 pruebas de integración contra PostgreSQL
efímera)—, la primera corrida encontró un test desactualizado
(`products-price-forward.integration-spec.ts`, que no conocía las tablas `dietary_tag`,
`_productDietaryTags` y `search_log` que E6 agregó al esquema) y se corrigió antes de la segunda
corrida, que quedó en verde. T038 corrió el corpus de `corpus-aceptacion.md` (15 frases) dos
veces contra Claude Haiku 4.5 real: la primera detectó un defecto real de latencia de cola
(p95 = 6,0 s, `502` del proxy en la frase más lenta) causado por el reintento propio del SDK de
Anthropic sumado al reintento explícito de D-065; corregido con `maxRetries: 0` en el cliente. La
segunda corrida, ya con la corrección, dio p95 = 3,1 s (SC-004 cumple) y una proyección de costo
muy por debajo de $15.000 CLP/mes para el volumen esperado de un entorno de referencia (SC-007
cumple). Detalle completo en `specs/006-busqueda-por-voz/evaluacion-modelo-real.md`. **T037 sigue
pendiente**: requiere una persona ejecutando la aplicación en un navegador con micrófono real,
incluidos los casos de dos sesiones simultáneas (V-05, V-10) y de denegar el permiso del
micrófono (V-13), que esta sesión no puede completar por sí sola. T039 queda para después de T037,
mismo criterio que ya aplicó E1 (`CLAUDE.md` § Releases): no se marca la épica como terminada sin
la validación manual.

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias — puede iniciar de inmediato.
- **Cimientos (Fase 2)**: depende de la Fase 1 — bloquea las tres historias.
- **Historias de usuario (Fase 3+)**: todas dependen de la Fase 2.
  - US2 depende de que exista `menu-search.service.ts` (T019, de US1), porque `intent: 'ADD'` es
    una rama del mismo servicio (D-056) — no es independiente de la implementación de US1, aunque
    sí es **demostrable** de forma independiente una vez que ambas existen.
  - US3 depende de T019 (misma razón) y de la migración de Fase 2 (T005/T006).
- **Validación funcional (Fase Final)**: depende de que las tres historias estén completas.

### Dependencias dentro de cada historia

- Pruebas antes que implementación (deben fallar primero).
- Proveedor y proyección del catálogo (Fase 2) antes que el servicio de búsqueda.
- Servicio antes que guard/controlador; controlador antes que componente de interfaz; componente
  antes que su integración en `/menu`.

### Oportunidades de paralelismo

- T007, T008, T009 tocan archivos distintos de `packages/shared` y son paralelizables entre sí,
  una vez lista la migración (T006) si sus tipos dependen de ella (T010 sí depende de T007).
- T012 y T013 tocan archivos distintos de `services/api` y son paralelizables entre sí.
- Las pruebas de cada historia (T017+T018, T024+T025, T029+T030) son paralelizables entre sí.

---

## Ejemplo de ejecución en paralelo: Historia 1

```bash
# Pruebas de US1 en paralelo:
Task: "Pruebas fallidas de POST /menu/search (intent SEARCH) en services/api/test/menu-search-search.integration-spec.ts"
Task: "Pruebas fallidas del componente de búsqueda en apps/web/tests/busqueda-por-voz.test.tsx"
```

---

## Estrategia de implementación

### MVP primero (solo Historia 1)

1. Completar Fase 1: Preparación.
2. Completar Fase 2: Cimientos (bloqueante — incluye migración y adaptador del proveedor).
3. Completar Fase 3: Historia 1 (buscar).
4. **Detenerse y validar**: V-01 a V-06 de `quickstart.md` de forma independiente.
5. Demostrar si corresponde antes de continuar con agregar por voz y aptitud vegana.

### Entrega incremental

1. Preparación + Cimientos → base lista, con el proveedor ya configurado.
2. Historia 1 (buscar) → validar de forma independiente → demostrar (MVP).
3. Historia 2 (agregar por voz) → validar de forma independiente → demostrar.
4. Historia 3 (aptitud vegana) → validar de forma independiente → demostrar.
5. Fase Final → evaluación con el modelo real y cierre del estado del producto.

---

## Notas

- [P] = archivos distintos, sin dependencias entre sí.
- [Historia] traza cada tarea a su historia de usuario.
- Cada historia debe quedar completable y verificable de forma independiente, aunque US2 y US3
  comparten el servicio central que construye US1 (D-056) — la independencia es de
  demostración/validación, no de que cada una tenga su propio servicio desde cero.
- Verificar que las pruebas fallen antes de implementar.
- Confirmar (commit) tras cada tarea o grupo lógico.
- Detenerse en cada punto de control para validar la historia de forma independiente.
- Evitar: tareas vagas, conflictos de archivo entre tareas paralelas, y —particular de esta
  épica— cualquier tarea que agregue una segunda vía de escribir en `cart`/`cart_line` fuera de
  los endpoints ya existentes de E2 (D-063).
