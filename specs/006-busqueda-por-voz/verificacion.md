# Registro de verificación: E6 · Búsqueda por voz

**Fecha**: 2026-08-24 · **Ejecutado sobre**: `docker compose up --build` (api, web y postgres en
contenedores) en la rama `006-busqueda-por-voz`, con el catálogo de E3 ya sembrado (12 productos)
y la aptitud "Vegano" de E6 aplicada a dos de ellos (Sándwich Vegetariano de Berenjena, Ensalada
de Quinoa y Palta), tal como describe T035. `LLM_API_KEY` es una clave real de Anthropic con
acceso a `claude-haiku-4-5-20251001`.

Usuarios de prueba creados desde el panel de administración para este recorrido:
`cliente-e6@foodvoice.cl` (Cliente) y `negocio-e6@foodvoice.cl` (Negocio) — el catálogo sembrado no
traía ningún usuario de rol Negocio.

Este documento recoge el resultado de **T037**: los pasos V-01 a V-15 de `quickstart.md` más V-16
(agregado el 2026-08-24 junto con FR-028), recorridos contra la aplicación real, no contra el
código. **T037 queda completo**: 9 de los 16 pasos se verificaron en esta sesión con Claude
manejando el navegador; los 7 restantes —toda la Historia 2 (agregar por voz) más V-06 y V-13—
exigían un micrófono real que esta sesión no tiene (ver la aclaración de abajo) y los verificó
directamente el usuario (renato-quintupil), con micrófono real, el 2026-08-24, confirmando que
toda la funcionalidad de audio funcionó correctamente.

---

## Aclaración sobre quién ejecutó el recorrido, y su límite real

Lo hizo Claude, manejando el navegador real (Chrome, vía la extensión de automatización) contra
los contenedores levantados — no lectura de código ni de logs para juzgar el resultado de cada
paso, que es lo que el Principio IV exige. La lectura de código que aparece más abajo fue posterior,
solo para diagnosticar por qué un paso se congeló, no para sustituir su verificación funcional.

**Hallazgo de esta sesión, no un defecto**: al intentar V-07 escribiendo la frase en el campo de
texto y presionando "🎙️ Agregar al carrito por voz" (en vez de dictarla), el navegador quedó sin
responder durante más de un minuto. Investigando la causa en `busqueda-por-voz.tsx` (líneas 121–190
y 236–239): ese botón **siempre activa el reconocimiento de voz**, nunca reenvía el texto ya
escrito (comentario de diseño en las líneas 40–48, decisión posterior a la primera versión, ver
commit `1b5ea02`). Activar el micrófono dispara primero un `window.confirm()` de consentimiento
(FR-018, línea 140) — un diálogo nativo del navegador que las herramientas de automatización no
pueden resolver y que bloquea toda la pestaña hasta que alguien lo cierra a mano. Se recuperó
navegando a otra URL, sin pérdida de datos.

**Consecuencia práctica**: toda la Historia 2 (agregar al carrito por voz, V-07 a V-11) exige
micrófono real y no se puede recorrer por automatización de navegador ni escribiendo el texto en
vez de dictarlo — a diferencia de la Historia 1 (buscar), donde el campo de texto sí es un canal
completo (FR-009, verificado en V-01 a V-05 más abajo). Por la misma razón, V-06 (equivalencia
voz/texto en buscar) y V-13 (denegar el permiso del micrófono) tampoco se intentaron: ambos
requieren que un micrófono real y su diálogo de permiso del sistema operativo entren en juego.

**Nota sobre `quickstart.md`**: su V-07 dice "Decir o escribir «agrégame una napolitana»", lo que
sugiere que escribir alcanza. Por el diseño actual del componente, no alcanza: agregar por voz solo
acepta dictado nuevo en cada intento. No se trata de un defecto de la aplicación (la decisión está
documentada y es deliberada, ver commit `1b5ea02`) sino de una imprecisión en la guía de validación
manual, que convendría corregir en una futura revisión de `quickstart.md` para que quien la
recorra sepa de entrada que necesita un micrófono real para la Historia 2.

---

## Resumen

| Paso | Historia | Qué exige | Estado |
|---|---|---|---|
| V-01 a V-05 | H1 · Buscar | Búsqueda en lenguaje natural por texto | ✅ Verificado (Claude) |
| V-06 | H1 · Buscar | Equivalencia voz/texto | ✅ Verificado (usuario, micrófono real) |
| V-07 a V-11 | H2 · Agregar por voz | Confirmar/cancelar un agregado dictado | ✅ Verificado (usuario, micrófono real) |
| V-12 | H3 · Aptitud vegana | Filtrar por "Vegano" | ✅ Verificado (Claude) |
| V-13 | Resiliencia | Denegar permiso del micrófono | ✅ Verificado (usuario, micrófono real) |
| V-14 | Resiliencia | Proveedor LLM no disponible | ✅ Verificado (Claude) |
| V-15 | Límite de frecuencia | 21 búsquedas en <5 min | ✅ Verificado (Claude) |
| V-16 | H1 · Buscar (FR-028) | Agregar manualmente un resultado, sin dictar | ✅ Verificado (Claude) |

**16 de 16 pasos verificados, 0 defectos encontrados.** Nueve los recorrió Claude manejando el
navegador contra la aplicación real; los siete que exigían un micrófono real (V-06, V-07–V-11,
V-13) los recorrió directamente el usuario (renato-quintupil) el 2026-08-24, confirmando que la
funcionalidad de audio completa —buscar por voz, agregar por voz, confirmar, cancelar, ambigüedad
de producto, producto agotado durante la confirmación, y denegar el permiso del micrófono—
funcionó correctamente, sin defectos encontrados. **T037 queda cerrado.**

---

## A · Cliente busca en lenguaje natural (Historia 1, P1)

Sesión: `cliente-e6@foodvoice.cl`.

| Paso | Frase / acción | Resultado |
|---|---|---|
| V-01 | «quiero algo económico y sano» | ✅ Único resultado: Sándwich Vegetariano de Berenjena — Sándwiches · Saludable · Económico · Vegano. Activo y disponible, tramo económico, categoría de perfil saludable (SC-001, SC-002) |
| V-02 | «quiero una napolitana» | ✅ Pizza Napolitana aparece entre los resultados |
| V-03 | «algo liviano» (ambigua) | ✅ El sistema pidió aclaración: «¿Qué tipo de comida liviana prefieres?» con opciones derivadas del catálogo (Ensaladas, Sándwiches ligeros, Pizzas con verduras), no una lista de resultados |
| V-04 | «quiero una pizza barata que cueste menos de 3000 pesos» (combinación imposible: ninguna pizza del catálogo baja de $7.990) | ✅ «No encontré productos que cumplan lo que pediste. Prueba con otra frase o usa los filtros del menú.» — no sustituyó por productos que solo cumplen una condición |
| V-05 | Se marcó "Sándwich Vegetariano de Berenjena" como agotado desde la sesión de negocio (`negocio-e6@foodvoice.cl`, botón "Marcar agotado"), y se repitió la búsqueda de V-01 desde una sesión de cliente nueva | ✅ El producto agotado ya no apareció; el resultado pasó a ser otro producto del mismo perfil (Ensalada Caprese — Económico). Se restauró el producto a disponible ("Reponer") al terminar |
| V-06 | Repetir V-01 por voz | ✅ Verificado por el usuario con micrófono real (2026-08-24): mismo tipo de resultado que V-01, sin diferencia de comportamiento entre canales |
| V-16 | Sobre los resultados de «quiero algo económico y sano», clic en "Agregar" del Sándwich Vegetariano de Berenjena, sin dictar ni escribir una frase de agregado (FR-028, agregado el 2026-08-24 tras pedido explícito del usuario) | ✅ El botón mostró "Agregado al carrito.", y `/cliente/carrito` confirmó el producto con cantidad 1 y precio $3.990 — sin pasar por la pantalla de confirmación de la Historia 2. Carrito vaciado al terminar |

**Metodología de V-05**: "otra sesión de negocio" se ejecutó cambiando la sesión del mismo
navegador (cerrar sesión de cliente, iniciar como negocio, marcar agotado, cerrar sesión de negocio,
iniciar de nuevo como cliente) en vez de dos pestañas simultáneas, porque la cookie de sesión es
única por navegador (mismo criterio ya usado en `specs/005-trazabilidad-pedido/verificacion.md`
para "un segundo cliente"). Como V-05 no depende de que ambas sesiones estén activas al mismo
tiempo —solo de que el estado de disponibilidad cambie entre una búsqueda y la siguiente—, el orden
secuencial no invalida el resultado.

---

## B · Cliente agrega al carrito por voz (Historia 2, P2)

Verificado por el usuario (renato-quintupil) con micrófono real el 2026-08-24 — esta sesión no
pudo recorrerlos por sí sola, ver la aclaración de arriba sobre por qué no se pueden simular con
texto ni con automatización de navegador.

| Paso | Qué debía ocurrir | Estado |
|---|---|---|
| V-07 | Confirmación con producto, cantidad 1 y precio vigente (SC-006) | ✅ Verificado |
| V-08 | Confirmar deja el producto en el carrito con esa cantidad y precio | ✅ Verificado |
| V-09 | Cancelar deja el carrito exactamente igual que antes de la frase | ✅ Verificado |
| V-10 | Producto marcado agotado mientras la confirmación está abierta: al confirmar, se rechaza con el mismo mensaje del flujo manual | ✅ Verificado |
| V-11 | Frase ambigua entre varios candidatos: pide aclaración antes de mostrar cualquier confirmación | ✅ Verificado |

---

## C · Cliente busca por aptitud vegana (Historia 3, P3)

Sesión: `cliente-e6@foodvoice.cl`.

| Paso | Frase / acción | Resultado |
|---|---|---|
| V-12 | «quiero algo para vegano» | ✅ Único resultado: Ensalada de Quinoa y Palta — Ensaladas · Saludable · Medio · Vegano. Ningún producto sin la etiqueta "Vegano" apareció (SC-008) |

---

## D · Resiliencia sin voz ni proveedor (SC-005)

| Paso | Acción | Resultado |
|---|---|---|
| V-13 | Denegar el permiso del micrófono en el navegador | ✅ Verificado por el usuario con micrófono real (2026-08-24): el campo de texto y los filtros manuales del menú siguieron operativos con el permiso denegado |
| V-14 | Se cambió `LLM_API_KEY` a un valor inválido en `.env` y se reinició el contenedor `api` (`docker compose up -d api`); con la API saludable pero la clave inválida, se buscó «quiero una ensalada» | ✅ «No pudimos interpretar tu búsqueda en este momento. Mientras tanto, puedes usar los filtros del menú.» — mensaje recuperable en español. Se verificó además que el catálogo completo y sus filtros manuales (pestaña "Catálogo completo") seguían operativos con la clave inválida. Se restauró `LLM_API_KEY` real y se reinició `api`, quedando `healthy` |

---

## E · Límite de frecuencia (FR-014)

| Paso | Acción | Resultado |
|---|---|---|
| V-15 | 21 solicitudes seguidas de `POST /menu/search` desde la misma sesión de cliente (vía `fetch` en la consola de la página, para no depender de 21 clics manuales) | ✅ Las primeras 20 respondieron `200`; la 21ª respondió `429`, confirmado leyendo las solicitudes de red de la pestaña |

---

## Cobertura de los criterios de éxito

| Criterio | Pasos que lo cubren | Estado |
|---|---|---|
| SC-001 (≥90% top-3 en frases no ambiguas del corpus) | Evaluación con el modelo real (T038, ver `evaluacion-modelo-real.md`), V-01/V-02 como muestra manual | ✅ |
| SC-002 (0% de resultados inactivos/no disponibles) | V-01, V-05 | ✅ |
| SC-003 (100% de búsquedas sin escritura salvo confirmación) | V-01 a V-09 (ninguna escribe carrito salvo V-08 tras confirmar) | ✅ |
| SC-004 (p95 ≤ 5 s) | Evaluación con el modelo real (T038) | ✅ |
| SC-005 (pedido completable sin voz ni proveedor) | V-13, V-14 | ✅ |
| SC-006 (100% de agregados muestran confirmación con precio vigente) | V-07 | ✅ |
| SC-007 (costo mensual < $15.000 CLP) | Evaluación con el modelo real (T038) | ✅ |
| SC-008 (aptitud vegana correcta al 100%/0%) | V-12 | ✅ |
| FR-028 (agregar un resultado con un clic, sin dictar) | V-16 | ✅ |

---

## Cierre de T037

Los 16 pasos de `quickstart.md` (V-01 a V-16) quedaron verificados el 2026-08-24, sin ningún
defecto: 9 recorridos por Claude contra la aplicación real, y los 7 que exigían micrófono real
(V-06, V-07–V-11, V-13) recorridos directamente por el usuario (renato-quintupil), también contra
la aplicación real. **T037 queda cerrado.** Corresponde ahora T039 (actualizar `specs/README.md` y
`CLAUDE.md` con E6 como terminada) y el tag de release `v0.6.0`.

### Lo que queda fuera de este registro por decisión ya declarada

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1, heredado de
  E1/E3/E2/E9/E4.
