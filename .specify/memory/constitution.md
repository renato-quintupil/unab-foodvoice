<!--
Sync Impact Report · enmienda 2026-08-17
- Versión: 1.1.0 → 2.0.0
- Tipo de cambio: MAJOR (redefinición incompatible de la máquina de estados del Principio XII)
- Principios modificados: XII · Trazabilidad del pedido de punta a punta
  La secuencia estrictamente lineal se reemplaza por una máquina única con dos ramas desde
  `creado`: aceptación hacia `en_preparacion` y rechazo hacia `rechazado`. El nuevo estado
  es terminal, solo puede alcanzarlo el negocio desde `creado` y exige un motivo no vacío,
  inmutable y visible para el cliente.
- Motivo: E2 · Gestión de pedidos necesita representar de forma trazable que el negocio no
  puede cumplir un pedido, en lugar de dejarlo pendiente indefinidamente o forzar una
  transición falsa hacia preparación.
- Secciones añadidas: ninguna.
- Secciones eliminadas: ninguna.
- Plantillas dependientes: sin cambios; leen la constitución vigente en tiempo de ejecución.
- TODOs diferidos: ninguno.

Sync Impact Report · enmienda 2026-08-16
- Versión: 1.0.0 → 1.1.0
- Tipo de cambio: MINOR (ampliación material de la guía del Principio VIII)
- Principios modificados: VIII · El catálogo y el stock son la única verdad, por local
  Se añade una § Alcance en v1 que declara cómo se aplica el principio mientras el producto
  sea mono-local y no tenga contador de unidades. No se redefine ni se relaja lo que el
  principio exige —que no se pueda mostrar ni pedir lo que no existe o no se puede preparar—;
  se declara con qué mecanismos se cumple hoy y qué exigiría un cambio de alcance.
- Motivo: el análisis de E3 (`/speckit-analyze`, hallazgo D1) detectó que el plan de esa épica
  asumía dos lecturas del principio —«stock» como interruptor de disponibilidad y ausencia de
  modelo de local— que la constitución no contemplaba por escrito. Antes que dejar la tensión
  en el plan de una épica, se declara aquí.
- Plantillas dependientes: sin cambios.
- TODOs diferidos: ninguno

Sync Impact Report · ratificación inicial
- Versión: N/A (plantilla) → 1.0.0
- Tipo de cambio: MAJOR (ratificación inicial de la constitución del proyecto)
- Principios añadidos:
  1. Simplicidad ante todo
  2. Idioma: todo en español
  3. Cero alcance fantasma
  4. Verificable por una persona no técnica
  5. Datos del usuario con respeto
  6. Voz primero, con paridad manual siempre (NO NEGOCIABLE)
  7. Entender la intención, no transcribir literal
  8. El catálogo y el stock son la única verdad, por local
  9. Confirmar antes de actuar y poder deshacer
  10. Privacidad y datos mínimos
  11. Calidad guiada por especificación (test-first)
  12. Trazabilidad del pedido de punta a punta
- Secciones añadidas: Alcance del Producto, Flujo de Trabajo y Puertas de Calidad, Gobernanza
- Secciones eliminadas: ninguna (plantilla genérica reemplazada por contenido concreto)
- Plantillas dependientes: no se modifican en este comando (se leen en tiempo de ejecución);
  revisar en el próximo uso de /speckit-specify, /speckit-plan y /speckit-tasks que sean
  coherentes con estos principios.
- TODOs diferidos: ninguno
-->

# Constitución de FoodVoice

## Contexto del Producto

FoodVoice es una herramienta para pedir productos a un restaurant o negocio de barrio.
Su característica esencial es que el cliente pueda pedir **hablando en lenguaje natural**
(por ejemplo: "quiero algo económico", "quiero comer sano", "quiero chatarra", "quiero pizza
napolitana", "sugiéreme algo rico", "sugiéreme algo sano"), que el sistema entienda la
**intención**, busque en el catálogo del local y muestre resultados acordes; el cliente puede
continuar por voz para agregar productos al carrito. La herramienta maneja trazabilidad de
pedidos y clasificación de productos o servicio mediante feedback del cliente.

## Principios Fundamentales

### I. Simplicidad ante todo

Ante dos soluciones posibles, se elige siempre la más simple. Esta es la versión 1 del
producto: no se introduce complejidad anticipada, ni se diseñan mecanismos para necesidades
hipotéticas futuras. Cada decisión técnica debe poder justificarse como la opción más simple
que resuelve el requisito actual.

**Razón**: anticipar complejidad antes de tener evidencia de que se necesita genera código
frágil, difícil de mantener y que retrasa la entrega de valor real al usuario.

### II. Idioma: todo en español

Todo el producto —interfaz, mensajes, confirmaciones, textos de voz, documentación de
usuario— se construye en español. Los identificadores técnicos (nombres de código, variables, funciones, nombres de carpetas) pueden mantenerse en su forma habitual (en inglés), pero cualquier texto visible o audible
para el cliente final DEBE estar en español.

**Razón**: el público objetivo de FoodVoice habla español; una interfaz mixta o traducida a
medias genera fricción y desconfianza.

### III. Cero alcance fantasma

No se implementa ninguna funcionalidad que no esté escrita en la especificación (spec)
vigente. Si durante el desarrollo surge una idea nueva o una mejora, se propone como cambio a
la spec; no se construye directamente en el código.

**Razón**: evita que el alcance del proyecto crezca sin control ni trazabilidad, y mantiene
la spec como la única fuente de verdad sobre lo que el producto hace.

### IV. Verificable por una persona no técnica

Cada criterio de éxito de cada funcionalidad DEBE poder comprobarse usando la aplicación
directamente (haciendo clic, hablando, mirando la pantalla), sin necesidad de leer código,
logs técnicos ni consultas a base de datos.

**Razón**: garantiza que "terminado" significa algo observable y demostrable para el
negocio, no solo para el equipo técnico.

### V. Datos del usuario con respeto

Solo se pide al usuario la información imprescindible para operar el pedido. No se
introducen claves, tokens ni secretos directamente en el código fuente; deben gestionarse
fuera del repositorio (variables de entorno, gestor de secretos).

**Razón**: minimizar la recolección de datos reduce riesgo y refuerza la confianza del
cliente; exponer secretos en el código es una vulnerabilidad de seguridad básica evitable.

### VI. Voz primero, con paridad manual siempre (NO NEGOCIABLE)

La voz es la forma preferida de interactuar, pero TODA acción disponible por voz DEBE tener
un equivalente manual (botones, formularios, listas) que funcione igual de bien. Si no hay
micrófono, no se otorgó permiso, o el navegador no soporta reconocimiento de voz, el cliente
debe poder completar el pedido íntegramente por la vía manual. Ninguna funcionalidad crítica
(buscar, seleccionar, agregar al carrito, pagar, hacer seguimiento del pedido) depende
exclusivamente de la voz.

**Razón**: la voz puede fallar por razones técnicas, de contexto (ruido, privacidad) o de
accesibilidad; condicionar el pedido a que la voz funcione excluye usuarios y genera pérdida
de ventas.

### VII. Entender la intención, no transcribir literal

El sistema DEBE mapear lo que dice el cliente a categorías de intención conocidas: precio,
salud, tipo de comida, plato específico o recomendación abierta. Si la intención no se
entiende con suficiente confianza, el sistema pregunta para aclarar; nunca inventa o asume la
existencia de un producto que no fue expresado o que no existe en el catálogo.

**Razón**: transcribir literalmente sin interpretar intención frustra al usuario que habla
de forma natural y no en comandos exactos; inventar productos rompe la confianza en el
sistema.

### VIII. El catálogo y el stock son la única verdad, por local

Solo se muestra o se permite agregar al carrito un producto que existe, está activo y tiene
stock disponible en el catálogo del local correspondiente. Cada local es dueño exclusivo de
su propio catálogo y stock; no se comparten ni se infieren datos entre locales. No se
inventa ni se sugiere ningún producto fuera de esta fuente de verdad.

**Razón**: mostrar productos inexistentes, inactivos o sin stock genera pedidos que no se
pueden cumplir y daña la confianza del cliente y del local.

**Alcance en v1** (enmienda 1.1.0). El principio se cumple íntegro con dos mecanismos que
conviene declarar, para que ninguna épica tenga que interpretarlos por su cuenta:

1. **«Stock disponible» se implementa como un interruptor de disponibilidad por producto, no
   como un contador de unidades.** Lo que el principio exige de fondo —que no se pueda mostrar
   como pedible algo que el local no puede preparar— queda cumplido: un producto no disponible
   se muestra marcado y no se puede pedir. Un contador exigiría descontarlo al confirmar el
   pedido, devolverlo al cancelarlo y decidir qué hacer con las reservas, sin que ninguna
   historia de usuario lo pida (Principio I, Principio III). Introducirlo sería un requisito
   propio, no un detalle de implementación.
2. **«Por local» no se modela mientras el producto sea mono-local.** v1 tiene un único
   catálogo y no lo segmenta. La exigencia de fondo —que no se compartan ni se infieran datos
   entre locales— se cumple de forma trivial cuando solo hay uno. **En el momento en que exista
   un segundo local, esta excepción caduca**: el catálogo, la disponibilidad y toda consulta
   deberán segmentarse por local antes de admitir el segundo, y no después.

Ninguna de las dos es permiso para mostrar o permitir pedir algo que no existe, no está activo
o no se puede preparar. Esa parte del principio no admite excepción de alcance.

### IX. Confirmar antes de actuar y poder deshacer

Antes de agregar cualquier producto al carrito, el sistema muestra al cliente lo que entendió
(el producto interpretado a partir de su intención) para que confirme o corrija. El carrito
DEBE estar siempre visible y ser editable manualmente en cualquier momento, incluyendo
eliminar o modificar cantidades.

**Razón**: la interpretación de lenguaje natural no es infalible; confirmar antes de actuar y
permitir deshacer evita pedidos erróneos y da control real al cliente.

### X. Privacidad y datos mínimos

Se pide consentimiento explícito antes de usar el micrófono. No se guarda audio crudo del
cliente. Datos como celular y direcciones se guardan de forma mínima y con un propósito claro
y declarado. Las direcciones se almacenan por ahora solo como texto libre, dejando el diseño
preparado para incorporar geolocalización en el futuro, sin implementarla todavía.

**Razón**: reducir la retención de datos sensibles (especialmente audio) limita el impacto de
una eventual brecha de seguridad y respeta la privacidad del cliente.

### XI. Calidad guiada por especificación (test-first)

Cada categoría de intención reconocida y cada flujo crítico del producto DEBEN tener
criterios de aceptación escritos en formato Gherkin, junto con frases de ejemplo
representativas, ANTES de comenzar a programar la funcionalidad correspondiente.

**Razón**: definir el comportamiento esperado antes de codificar evita ambigüedad,
retrabajo y funcionalidades que no coinciden con la intención original del negocio.

### XII. Trazabilidad del pedido de punta a punta

Todo pedido DEBE seguir una máquina de estados única con exactamente estas transiciones:

- `creado → en_preparacion`
- `creado → rechazado`
- `en_preparacion → asignado_repartidor`
- `asignado_repartidor → entregado`
- `entregado → cerrado`

No se permite ninguna otra transición. `rechazado` y `cerrado` son estados terminales. El
negocio solo puede rechazar un pedido desde `creado`; el rechazo DEBE incluir un motivo de
texto no vacío, que queda inmutable y visible para el cliente. Un pedido rechazado no se
acepta, no se reabre y no pasa por `cerrado`. Un pedido de la rama aceptada se cierra
únicamente cuando el repartidor marca la entrega como realizada.

Cada cambio de estado DEBE registrarse en un historial que solo permite agregar entradas
nuevas; el historial nunca se edita ni se borra.

**Razón**: una trazabilidad íntegra y no editable es indispensable para resolver disputas,
auditar el servicio y dar visibilidad honesta del estado del pedido al cliente y al local.
Registrar el rechazo con su causa evita que un pedido imposible de cumplir quede pendiente
indefinidamente o aparente haber entrado en preparación.

## Flujo de Trabajo y Puertas de Calidad

Toda funcionalidad nueva o modificada DEBE pasar por: (1) especificación con criterios de
aceptación en Gherkin y frases de ejemplo (Principio XI) antes de implementarse; (2)
verificación manual por una persona no técnica usando la aplicación (Principio IV) antes de
darse por completada; (3) revisión de que no introduce alcance no escrito en la spec
(Principio III). Cualquier funcionalidad de voz debe demostrar su equivalente manual
funcionando (Principio VI) antes de aprobarse.

## Gobernanza

Esta constitución prevalece sobre cualquier otra práctica, plantilla o convención del
proyecto en caso de conflicto. Toda spec, plan o tarea generada por Spec Kit para FoodVoice
DEBE ser consistente con estos principios; si un plan de implementación se aparta de un
principio, la desviación debe justificarse explícitamente y, de no ser justificable, el plan
se ajusta.

**Enmiendas**: cualquier cambio a esta constitución (añadir, modificar o eliminar un
principio o sección) se propone explícitamente, se documenta en el Sync Impact Report al
inicio de este archivo, y se refleja en un incremento de versión según semver:

- MAJOR: eliminación o redefinición incompatible de un principio existente.
- MINOR: adición de un nuevo principio o sección, o ampliación material de una guía existente.
- PATCH: aclaraciones, correcciones de redacción o ajustes no semánticos.

**Revisión de cumplimiento**: antes de aprobar un plan de implementación o una tarea, se
verifica su alineación con los principios de esta constitución, en particular los marcados
como NO NEGOCIABLE.

**Versión**: 2.0.0 | **Ratificada**: 2026-08-13 | **Última enmienda**: 2026-08-17
