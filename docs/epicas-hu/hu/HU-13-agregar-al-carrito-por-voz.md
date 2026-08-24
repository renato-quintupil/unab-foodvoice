# HU-13 — Agregar al carrito por voz

> Borrador de historia de usuario, preparatorio de la spec de **E6 · Búsqueda
> por voz**. Material de entrada para `/speckit.specify`, no la spec en sí.
> Se apoya en los mismos dos documentos que HU-06:
> [`analisis_codex.md`](../analisis_foodvoice/analisis_codex.md) §9 (flujo
> propuesto) y [`revision_claude.md`](../analisis_foodvoice/revision_claude.md).
> Se lee **después** de [HU-06](./HU-06-busqueda-asistida-por-voz.md)
> (búsqueda asistida por voz, misma épica, HU previa): HU-13 no repite la
> interpretación de la frase, la reutiliza.

**Como** cliente, **quiero** decir «agrégame una napolitana» o «ponme dos de
esas» y que el sistema me muestre exactamente qué va a agregar —producto,
cantidad, precio vigente— para confirmar con una palabra o un toque, en vez de
tener que buscar el producto, tocarlo y ajustar la cantidad a mano.

| Campo | Valor |
| --- | --- |
| **Épica** | E6 · Búsqueda por voz |
| **Depende de** | HU-06 (resuelve qué producto interpretó la frase), HU-12 de E2 (el carrito editable manual ya existe y ya valida disponibilidad y precio al agregar) |
| **Consume** | El mismo endpoint de búsqueda de HU-06 para resolver el producto, y el servicio de carrito que E2 ya construyó — **sin endpoint de escritura propio** |
| **Consumida por** | Nadie más dentro del mapa de HU actual |

**Justificación de orden**: HU-13 es la segunda HU de E6 porque necesita que
HU-06 ya sepa interpretar una frase y resolver un producto real, y necesita
que el carrito de HU-12 (E2) ya exista con sus propias reglas de
disponibilidad y precio — HU-13 no las reimplementa, las reutiliza.

---

## Lo que esta HU es y lo que no es

**Esta HU no crea un endpoint de escritura nuevo para el carrito.** El
carrito ya tiene el suyo desde E2 (HU-12), con sus propias validaciones de
disponibilidad y recálculo de precio en cada lectura. Lo que agrega HU-13 es
la ruta por la que una frase hablada o escrita llega a invocar ese mismo
servicio — nunca un camino paralelo que lo esquive.

**El LLM no llama al carrito.** No tiene esa herramienta ni esa capacidad.
La secuencia siempre pasa por una confirmación explícita del cliente antes de
tocar el carrito (Principio IX): el modelo interpreta intención, el servidor
resuelve el producto, la interfaz muestra lo entendido, el cliente confirma,
y **recién ahí** se invoca el servicio de carrito existente — con sus
validaciones intactas.

**Esta HU no reinterpreta qué es un producto válido.** Reutiliza
exactamente las mismas reglas que HU-06 ya exige: `active && available` en el
momento de sugerir, y una segunda validación —la que el carrito ya hace desde
E2— en el momento de confirmar. La doble validación no es redundancia
accidental: existe porque un producto puede agotarse entre que se sugiere y
que se confirma.

---

## Qué ya existe en el sistema (2026-08-23)

- **El carrito (E2, HU-12) ya valida disponibilidad y precio en cada
  lectura**, sin congelarlos (`CLAUDE.md`, "Lo que E2 añadió al código"). Ya
  rechaza agregar un producto agotado o dado de baja. HU-13 no necesita
  tocar esa lógica; necesita invocarla después de la confirmación.
- **No existe todavía ninguna vía de voz hacia el carrito.** El único camino
  de alta hoy es manual: elegir producto en `/menu`, ajustar cantidad,
  agregar. HU-13 agrega el primer camino que empieza en una frase.
- **HU-06 (misma épica, HU previa) todavía no está implementada** — este
  documento asume que su endpoint de búsqueda (`POST /menu/search` o el
  contrato que su spec fije) ya devuelve una interpretación estructurada y
  productos candidatos antes de que HU-13 pueda construirse sobre él.
- **La confirmación antes de actuar (Principio IX) ya es un patrón
  establecido** en el proyecto: E2 exige confirmar un pedido antes de
  enviarlo. HU-13 aplica el mismo patrón a la escala de un solo producto,
  no lo inventa.

---

## El flujo que esta HU debe seguir

Tomado de `analisis_codex.md` §9, sin cambios porque ninguno de los dos
análisis lo objeta:

1. El cliente dice o escribe algo con intención de agregar, no solo de
   explorar: «agrégame una napolitana», «ponme dos de esas», «quiero pedir la
   pizza que me mostraste».
2. El servidor interpreta la intención (reutilizando HU-06) y resuelve **un**
   producto candidato — o pide aclaración si hay más de uno razonable, igual
   que en HU-06.
3. El servidor confirma que ese producto **sigue** activo y disponible en
   este instante (no el estado que tenía cuando se sugirió).
4. La interfaz muestra producto, cantidad interpretada y precio **vigente**,
   nunca el precio que pudo haberse mostrado antes.
5. El cliente confirma o corrige — cantidad, producto, o cancela.
6. Solo entonces se invoca el servicio de carrito existente de E2.
7. El servicio de carrito **vuelve a validar** disponibilidad y precio antes
   de agregar — su propia autoridad final, sin importar qué haya dicho el
   paso 3.

```
"agrégame una napolitana"
        │
        ▼
  HU-06: interpretar + resolver 1 producto candidato
        │
        ▼
  Confirmar que sigue activo y disponible AHORA
        │
        ▼
  Mostrar: producto + cantidad + precio vigente
        │
        ▼
  Cliente confirma ──▶ Servicio de carrito de E2 (ya existente)
        │                       │
        ▼                       ▼
  Cliente corrige/cancela   E2 revalida disponibilidad y precio (autoridad final)
```

La doble validación (pasos 3 y 7) es intencional, no una duplicación a
limpiar: entre que el cliente ve la confirmación y la aprieta, el producto
puede agotarse. El rechazo del carrito, no el de la búsqueda, es la autoridad
final — es el mismo servicio que ya usa el flujo manual, así que no hay dos
fuentes de verdad sobre disponibilidad.

---

## Reglas de negocio propuestas

- **RN-01** — Agregar al carrito por voz **nunca** ocurre sin una
  confirmación explícita del cliente posterior a ver producto, cantidad y
  precio vigentes (Principio IX). Una frase que suena a orden directa
  («agrégalo») sigue mostrando la confirmación; el sistema no interpreta la
  frase inicial como la confirmación misma.
- **RN-02** — El servicio de carrito invocado es el mismo que usa el flujo
  manual de E2 (HU-12). HU-13 no crea un servicio de escritura paralelo ni
  duplica sus reglas de disponibilidad o precio.
- **RN-03** — Antes de mostrar la confirmación, el servidor revalida que el
  producto siga `active && available`. Si dejó de estarlo, se comunica esto
  en vez de mostrar una confirmación para algo que ya no se puede agregar.
- **RN-04** — El precio mostrado en la confirmación es siempre el vigente en
  ese instante, nunca uno capturado en un paso anterior de la conversación.
- **RN-05** — Si la frase resuelve más de un producto candidato razonable
  («agrégame una pizza» con varias pizzas en el catálogo), el sistema pide
  aclaración antes de armar cualquier confirmación — mismo criterio de
  ambigüedad que RN-06 de HU-06.
- **RN-06** — Si la frase no especifica cantidad, se asume 1 y queda visible
  y editable en la pantalla de confirmación, nunca oculta.
- **RN-07** — Cancelar en la pantalla de confirmación no dispara ninguna
  escritura. El estado del carrito queda idéntico a como estaba antes de la
  frase.
- **RN-08** — El LLM no recibe ninguna herramienta ni capacidad para invocar
  el servicio de carrito directamente. Su única salida posible es la misma
  estructura de interpretación que ya define HU-06.
- **RN-09** — Si el carrito rechaza la operación en el paso final (producto
  agotado entre la confirmación y el envío, por ejemplo), el mensaje de
  rechazo es el mismo mensaje en español que ya usa el flujo manual de E2 —
  no un mensaje nuevo y distinto para la vía de voz.

---

## Casos límite a cubrir

- El producto se agota entre que se muestra la confirmación y que el cliente
  la aprueba.
- El producto se da de baja (`active = false`) en esa misma ventana.
- La frase pide una cantidad ambigua o no numérica («ponme varias», «hartas»).
- La frase pide agregar un producto que ya está en el carrito (¿suma
  cantidad o pregunta?).
- El cliente corrige la cantidad en la pantalla de confirmación antes de
  aprobar.
- El cliente dice «cancela» o cierra la pantalla de confirmación sin decidir.
- Una frase ambigua entre "buscar" y "agregar" («quiero una napolitana», sin
  verbo de acción explícito) — decide si HU-13 asume intención de agregar o
  si siempre pasa primero por resultados de HU-06.
- Doble confirmación accidental por reenvío de la misma solicitud
  (idempotencia de la operación de agregar).
- El carrito ya tiene una cantidad máxima o regla propia de E2 que la nueva
  unidad excedería.

---

## Explícitamente fuera de alcance (v1)

- **Cualquier endpoint de escritura nuevo sobre el carrito**: se reutiliza el
  de E2 (HU-12) sin excepción.
- **Modificar o eliminar ítems del carrito por voz**: esta HU cubre agregar;
  editar cantidades o quitar productos ya tiene su vía manual en HU-12 y no
  hay HU que pida su equivalente por voz.
- **Confirmar o enviar el pedido completo por voz**: es un paso posterior de
  HU-01/HU-12 (E2), no de esta HU. HU-13 termina en "el producto quedó en el
  carrito", no en "el pedido se envió".
- **Recordar entre sesiones lo que el cliente suele pedir** (recomendaciones
  basadas en historial): no existe esa fuente de datos ni la pide ninguna HU.
- **Agregar más de un producto en una sola frase** («ponme una pizza y una
  bebida»), salvo que la spec decida explícitamente soportarlo — por defecto
  se asume una intención de agregar por frase, y la spec debe declararlo si
  cambia.

---

## Preguntas abiertas para `/speckit.clarify`

Específicas de HU-13, además de las que ya deja abiertas HU-06 (que también
aplican aquí porque HU-13 depende de su resolución):

1. ¿Una frase con múltiples productos («una pizza y una bebida») se soporta
   desde v1 o se limita explícitamente a un producto por confirmación?
2. ¿«Agrégame otra» sin contexto nuevo debe interpretarse contra el último
   producto mostrado en la sesión, o siempre exige repetir el nombre del
   producto? Depende de cómo HU-06 resuelva su pregunta abierta 5 (cómo
   continúa una aclaración / continuidad de contexto).
3. ¿Qué pasa si el cliente pide agregar un producto que ya tiene en el
   carrito: se suma la cantidad automáticamente o el sistema pregunta?
4. ¿Existe un máximo de cantidad por confirmación de voz, distinto o igual al
   que ya tenga (si tiene) el carrito manual de HU-12?
5. ¿La confirmación debe poder hacerse también por voz («sí, agrégalo») o
   solo por interacción manual (botón/toque) sobre la pantalla de
   confirmación? Ambos análisis no fuerzan una respuesta; es una decisión de
   producto sobre cuánto se profundiza el canal de voz en este paso
   específico.
