# Registro de verificación: E6 · Búsqueda por voz

**Fecha**: 2026-08-24 · **Ejecutado sobre**: `docker compose up --build` (api, web y postgres en
contenedores) en la rama `006-busqueda-por-voz`, con el catálogo de E3 ya sembrado (12 productos)
y la aptitud "Vegano" de E6 aplicada a dos de ellos (Sándwich Vegetariano de Berenjena, Ensalada
de Quinoa y Palta), tal como describe T035. `LLM_API_KEY` es una clave real de Anthropic con
acceso a `claude-haiku-4-5-20251001`.

Usuarios de prueba creados desde el panel de administración para este recorrido:
`cliente-e6@foodvoice.cl` (Cliente) y `negocio-e6@foodvoice.cl` (Negocio) — el catálogo sembrado no
traía ningún usuario de rol Negocio.

Este documento recoge el resultado de **T037**: los 15 pasos V-01 a V-15 de `quickstart.md`,
recorridos contra la aplicación real, no contra el código. **T037 queda parcialmente completo**:
8 de los 15 pasos se verificaron en esta sesión; los 7 restantes —toda la Historia 2 (agregar por
voz) más V-06 y V-13— requieren una persona con micrófono real, por la razón que se explica abajo.

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
| V-01 a V-05 | H1 · Buscar | Búsqueda en lenguaje natural por texto | ✅ Verificado |
| V-06 | H1 · Buscar | Equivalencia voz/texto | ⏳ Pendiente — requiere micrófono real |
| V-07 a V-11 | H2 · Agregar por voz | Confirmar/cancelar un agregado dictado | ⏳ Pendiente — requiere micrófono real |
| V-12 | H3 · Aptitud vegana | Filtrar por "Vegano" | ✅ Verificado |
| V-13 | Resiliencia | Denegar permiso del micrófono | ⏳ Pendiente — requiere micrófono real |
| V-14 | Resiliencia | Proveedor LLM no disponible | ✅ Verificado |
| V-15 | Límite de frecuencia | 21 búsquedas en <5 min | ✅ Verificado |

**8 de 15 pasos verificados, 0 defectos encontrados en los verificados.** Los 7 pendientes están
fuera del alcance de lo que esta sesión puede recorrer por sí sola (mismo límite ya anticipado en
`tasks.md`, nota de T036–T039).

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
| V-06 | Repetir V-01 por voz | ⏳ Pendiente — requiere micrófono real (ver aclaración arriba) |

**Metodología de V-05**: "otra sesión de negocio" se ejecutó cambiando la sesión del mismo
navegador (cerrar sesión de cliente, iniciar como negocio, marcar agotado, cerrar sesión de negocio,
iniciar de nuevo como cliente) en vez de dos pestañas simultáneas, porque la cookie de sesión es
única por navegador (mismo criterio ya usado en `specs/005-trazabilidad-pedido/verificacion.md`
para "un segundo cliente"). Como V-05 no depende de que ambas sesiones estén activas al mismo
tiempo —solo de que el estado de disponibilidad cambie entre una búsqueda y la siguiente—, el orden
secuencial no invalida el resultado.

---

## B · Cliente agrega al carrito por voz (Historia 2, P2)

| Paso | Estado |
|---|---|
| V-07 a V-11 | ⏳ Pendientes — requieren micrófono real; ver la aclaración de arriba sobre por qué no se pudieron recorrer con texto ni con automatización de navegador |

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
| V-13 | Denegar el permiso del micrófono en el navegador | ⏳ Pendiente — requiere micrófono real y su diálogo de permiso del sistema operativo |
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
| SC-003 (100% de búsquedas sin escritura salvo confirmación) | V-01 a V-05, V-12 (ninguna escribió carrito) | ✅ para lo verificado; V-07 a V-09 (el resto de esta cobertura) pendientes |
| SC-004 (p95 ≤ 5 s) | Evaluación con el modelo real (T038) | ✅ |
| SC-005 (pedido completable sin voz ni proveedor) | V-14 verificado; V-13 pendiente | ⏳ parcial |
| SC-006 (100% de agregados muestran confirmación con precio vigente) | V-07 | ⏳ pendiente |
| SC-007 (costo mensual < $15.000 CLP) | Evaluación con el modelo real (T038) | ✅ |
| SC-008 (aptitud vegana correcta al 100%/0%) | V-12 | ✅ |

---

## Lo que queda pendiente para cerrar T037

Los 7 pasos pendientes (V-06, V-07–V-11, V-13) exigen una persona con micrófono real frente a la
aplicación:

1. **V-06**: repetir la búsqueda de V-01 dictándola en vez de escribirla, y confirmar que el
   resultado es del mismo tipo.
2. **V-07 a V-11**: todo el flujo de agregar al carrito por voz — confirmar, cancelar, producto que
   se agota entre sugerencia y confirmación (con la misma técnica de sesión secuencial de V-05,
   pero cuidando de volver a la sesión de cliente **antes** de tocar "Confirmar", ya que la cookie
   de sesión es única por navegador), y ambigüedad de producto con más de una pizza activa.
3. **V-13**: denegar el permiso del micrófono en la configuración del navegador y confirmar que el
   campo de texto y los filtros manuales del menú siguen operativos.

Con estos 7 pasos completados y registrados en una actualización de este documento, T037 queda
cerrado y recién ahí corresponde ejecutar T039 (actualizar `specs/README.md` y `CLAUDE.md`) y el
tag de release `v0.6.0`, siguiendo el mismo criterio que ya aplicó E1 en su momento: no se declara
una épica verificada sin que su validación funcional esté completa.

### Lo que queda fuera de este registro por decisión ya declarada

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de v1, heredado de
  E1/E3/E2/E9/E4.
