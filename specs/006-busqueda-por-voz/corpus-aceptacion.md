# Corpus de frases de aceptación (Principio XI)

**Dueño**: responsable de producto del proyecto (spec.md § Assumptions —
"Dueño del corpus de aceptación"). Redactado por Claude Sonnet 5 a partir del
catálogo real sembrado (`prisma/seed/catalogo.ts`) para ejecutar la
evaluación de T038; queda pendiente de revisión del dueño la próxima vez que
el catálogo cambie de forma relevante, como ya prevé esa misma sección.

Este corpus se usa para:

- **SC-001**: ≥90% de las frases **no ambiguas** devuelven el producto
  correcto entre sus primeros 3 resultados.
- **SC-004**: p95 de latencia de todas las frases (ambiguas o no) ≤ 5s.
- **SC-007**: proyección de costo mensual desde `search_log.tokens_used` de
  todas las frases.

## Catálogo de referencia (activo y disponible al momento de correr el corpus)

| Producto | Precio | Tipo | Perfil de salud | Aptitud |
|---|---|---|---|---|
| Ensalada Caprese | $4.590 | Ensaladas | Equilibrado | — |
| Ensalada César con Pollo | $5.990 | Ensaladas | Equilibrado | — |
| Ensalada Mediterránea | $5.490 | Ensaladas | Saludable | — |
| Ensalada de Quinoa y Palta | $6.490 | Ensaladas | Saludable | Vegano |
| Pizza Cuatro Quesos | $10.990 | Pizzas | Indulgente | — |
| Pizza Napolitana | $8.990 | Pizzas | Indulgente | — |
| Pizza de Champiñones y Rúcula | $8.490 | Pizzas | Saludable | — |
| Pizza de Verduras Asadas | $7.990 | Pizzas | Equilibrado | — |
| Sándwich Barros Luco | $6.990 | Sándwiches | Indulgente | — |
| Sándwich Chacarero | $3.490 | Sándwiches | Indulgente | — |
| Sándwich Vegetariano de Berenjena | $3.990 | Sándwiches | Saludable | Vegano |
| Sándwich de Pollo Grillado | $4.290 | Sándwiches | Equilibrado | — |

## Frases no ambiguas (cuentan para SC-001)

| # | Frase | Producto correcto esperado (top-3) |
|---|---|---|
| F01 | quiero una pizza napolitana | Pizza Napolitana |
| F02 | quiero un sándwich chacarero | Sándwich Chacarero |
| F03 | quiero una ensalada césar con pollo | Ensalada César con Pollo |
| F04 | quiero un sándwich barros luco | Sándwich Barros Luco |
| F05 | quiero una ensalada caprese | Ensalada Caprese |
| F06 | quiero algo vegano | Ensalada de Quinoa y Palta o Sándwich Vegetariano de Berenjena |
| F07 | quiero un sándwich vegano | Sándwich Vegetariano de Berenjena |
| F08 | quiero una ensalada saludable | Ensalada Mediterránea o Ensalada de Quinoa y Palta |
| F09 | quiero una pizza saludable | Pizza de Champiñones y Rúcula |
| F10 | quiero el sándwich más económico | Sándwich Chacarero |

## Frases ambiguas (no cuentan para SC-001, sí para SC-004/SC-007)

| # | Frase | Resultado esperado |
|---|---|---|
| F11 | algo liviano | CLARIFICATION |
| F12 | quiero algo rico | CLARIFICATION o RESULTS con recomendación abierta — ambas válidas, lo que no debe pasar es un error |

## Fuera de dominio (no cuenta para SC-001)

| # | Frase | Resultado esperado |
|---|---|---|
| F13 | quiero un helado | NO_RESULTS |

## Recomendación abierta

| # | Frase | Resultado esperado |
|---|---|---|
| F14 | sorpréndeme con algo saludable y económico | RESULTS con `openRecommendation: true` |
| F15 | quiero una pizza | RESULTS con las 4 pizzas del catálogo (intención de categoría, FR exige enumerar `productIds`) |
