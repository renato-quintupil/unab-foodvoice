# Registro de riesgos — FoodVoice

> **Rol responsable:** Scrum Master
> **Marco de referencia:** PMBOK (PMI, 2021, 7.ª ed.), dominio de *Incertidumbre* y
> prácticas de gestión de riesgos, integradas al marco **Scrum** (Schwaber & Sutherland, 2020).
> **Estado del proyecto:** MPV en construcción desde cero (0% implementado). Este registro
> se mantiene vivo y se revisa en los eventos de Scrum.

---

## 1. Propósito y contexto

Este documento es el **registro de riesgos** del proyecto de título **FoodVoice**. Su
propósito es **identificar, analizar, priorizar y planificar la respuesta** a los eventos
inciertos que —de materializarse— afectarían los objetivos del proyecto (alcance del MPV,
calidad, plazos institucionales y valor académico ante el tribunal).

En un proyecto Scrum la gestión de riesgos **no es un documento estático**: es una práctica
continua que el **Scrum Master** sostiene y actualiza a lo largo de los Sprints. Se apoya en
el enfoque de PMBOK (PMI, 2021) para dar rigor metodológico —categorización, análisis
cualitativo y estrategias de respuesta— sin renunciar a la naturaleza adaptativa de Scrum:
los riesgos se revisan en el **Refinement**, se consideran al fijar el **Sprint Goal** en el
**Planning**, se vigilan en el **Daily** y se evalúan como parte de la inspección del
**Review** y de la mejora del proceso en la **Retrospective**.

El registro se conecta directamente con las decisiones abiertas del proyecto (ver
`product-backlog.md`, secciones 6 y 8): el cambio de alcance por autenticación real (HU-08),
la condición unipersonal del equipo, la doble fuente de verdad del backlog y las brechas de
cobertura del Ishikawa. Estos no son riesgos hipotéticos: son **riesgos vivos ya
identificados** que aquí quedan formalizados.

---

## 2. Metodología

### 2.1 Categorías de riesgo
Cada riesgo se clasifica en una de tres categorías, coherentes con el enunciado del rol de
Scrum Master del proyecto:

- **Técnico:** relativo a la tecnología, la arquitectura, la integración o la calidad.
- **Operativo:** relativo a la ejecución diaria, la infraestructura, los datos o los entornos.
- **Gestión:** relativo a la planificación, el alcance, los plazos, los roles y la coherencia
  metodológica.

### 2.2 Escala de probabilidad e impacto
Se usa un **análisis cualitativo** con tres niveles, cada uno con un valor numérico para
poder calcular el nivel de riesgo:

| Nivel | Probabilidad (P) | Impacto (I) | Valor |
|-------|------------------|-------------|-------|
| **Baja** | Es poco esperable que ocurra | Efecto menor, absorbible sin alterar el Sprint | **1** |
| **Media** | Puede ocurrir en algún Sprint | Efecto notorio en plazo, alcance o calidad | **2** |
| **Alta** | Es muy esperable que ocurra | Efecto grave: compromete un hito o el MPV | **3** |

### 2.3 Cálculo del nivel de riesgo
El **nivel de riesgo** resulta de multiplicar probabilidad por impacto:

> **Nivel = Probabilidad (P) × Impacto (I)**

| Producto P × I | Nivel de riesgo | Prioridad de atención |
|----------------|-----------------|-----------------------|
| 1 – 2 | **Bajo** | Aceptar / vigilar |
| 3 – 4 | **Medio** | Planificar respuesta |
| 6 – 9 | **Alto** | Respuesta prioritaria y seguimiento activo |

### 2.4 Estrategias de respuesta (PMBOK, para amenazas)
Para cada riesgo se elige **una estrategia principal**:

- **Evitar:** eliminar la causa o cambiar el plan para que la amenaza no pueda ocurrir.
- **Mitigar:** reducir la probabilidad y/o el impacto a un nivel aceptable.
- **Transferir:** trasladar el impacto a un tercero (un servicio, una librería, una plataforma).
- **Aceptar:** convivir con el riesgo (activa, con plan de contingencia, o pasiva).

Cada riesgo declara además una **acción preventiva** (antes de que ocurra, para reducir P o I)
y una **acción correctiva / de contingencia** (si el riesgo se materializa).

---

## 3. Registro de riesgos (R-01 a R-10)

> **P** = Probabilidad · **I** = Impacto · **Nivel** = P × I · Valores: Baja/Media/Alta = 1/2/3.

### R-01 — Cambio de alcance por autenticación real (HU-08)
- **Categoría:** Técnico / Gestión
- **Descripción:** La decisión del Product Owner de implementar **autenticación real con
  backend** (HU-08) adelanta la activación de `services` y de la persistencia respecto a lo
  previsto en AINC422 (que asumía prototipo en memoria). Esto **aumenta la complejidad
  técnica** del primer incremento (API, base de datos PostgreSQL, hashing, autorización por
  rol, integración web/móvil con la API).
- **P:** Alta (3) · **I:** Alta (3) · **Nivel: 9 — Alto**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** Aislar un **backend mínimo** (solo auth + sesión + usuarios) para el
  Sprint 1; construir HU-08 primero por ser habilitadora; usar frameworks maduros (Express o
  Django) y no reinventar la seguridad. Reflejar el nuevo alcance en el diseño de arquitectura.
- **Acción correctiva:** Si el backend no está listo para el hito, degradar temporalmente a
  autenticación con datos *seed* verificables y documentar el desfase como deuda técnica
  declarada ante el tribunal.
- **Responsable:** Scrum Master (seguimiento) / Developer (ejecución)

### R-02 — Sobrecarga y sesgo de rol por equipo unipersonal
- **Categoría:** Gestión
- **Descripción:** Una sola persona asume **Product Owner, Scrum Master y Developer** más
  todos los perfiles técnicos. Riesgo de **sobrecarga** (capacidad real inferior a la
  planificada) y de **sesgo de rol** (que el criterio de un rol contamine a otro; p. ej., que
  el Developer se auto-otorgue alcance sin control del PO).
- **P:** Alta (3) · **I:** Media (2) · **Nivel: 6 — Alto**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** Técnica de los **"sombreros"**: declarar explícitamente qué rol está
  activo y registrar cada decisión en el artefacto que corresponde (`product-backlog.md` para
  el PO, este registro para el SM). Planificar la capacidad con holgura realista por Sprint.
- **Acción correctiva:** Si la capacidad se satura, reducir el alcance del Sprint (nunca la
  calidad ni la DoD) y renegociar el Sprint Goal con el "sombrero" de PO, dejando acta.
- **Responsable:** Scrum Master

### R-03 — Doble fuente de verdad del backlog (.md vs Jira)
- **Categoría:** Gestión
- **Descripción:** El backlog vive en `product-backlog.md` (canónico) y espejado en Jira
  (proyecto "UNAB FoodVoice", clave `SCRUM`). Riesgo de **desincronización** entre ambos
  (prioridades, SP o estados divergentes), que resta credibilidad de la trazabilidad ante el
  tribunal.
- **P:** Media (2) · **I:** Media (2) · **Nivel: 4 — Medio**
- **Estrategia:** **Evitar**
- **Acción preventiva:** Sostener la **regla de precedencia** (sección 6.1 del backlog): el
  `.md` es la fuente canónica y prevalece; todo cambio se decide primero en el `.md` y luego
  se refleja en Jira. Usar el **ID funcional HU-xx/Exx** como identificador estable.
- **Acción correctiva:** Ante discrepancia detectada, reconciliar tomando el `.md` como
  verdad y corregir Jira; registrar la incidencia en la Retrospective.
- **Responsable:** Scrum Master

### R-04 — Causas raíz #2 y #5 del Ishikawa sin HU dedicada
- **Categoría:** Gestión
- **Descripción:** Las causas raíz **#2 (gestión del local desde dispositivo fijo)** y **#5
  (dependencia total de conectividad)** no tienen una HU que las ataque de forma directa
  (backlog, sección 8). Riesgo de **brecha de coherencia problema–solución**: el tribunal
  puede objetar que la solución no cubre todo el problema planteado.
- **P:** Media (2) · **I:** Alta (3) · **Nivel: 6 — Alto**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** El SM hace visible la brecha; el PO decide conscientemente entre
  **diferir y declarar el límite de alcance** (web responsiva cubre parcialmente #2; el modo
  offline queda fuera del MPV para #5) o **crear una HU** para cada causa. La decisión se
  documenta antes del Hito 1.
- **Acción correctiva:** Si el tribunal objeta, presentar la decisión ya documentada como
  límite de alcance justificado, no como omisión.
- **Responsable:** Scrum Master (visibilizar) / Product Owner (decidir)

### R-05 — Plazos institucionales fijos (S4/S8/S12) vs. capacidad real
- **Categoría:** Gestión
- **Descripción:** Las Sumativas **S4, S8 y S12** son hitos **inamovibles** alineados con las
  Sprint Reviews. Si la capacidad real (agravada por R-01 y R-02) no alcanza, se llega a un
  hito **sin incremento demostrable**.
- **P:** Media (2) · **I:** Alta (3) · **Nivel: 6 — Alto**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** Planificar cada Sprint con el hito como fecha límite; priorizar
  siempre las HU habilitadoras y de mayor valor; mantener un incremento **potencialmente
  entregable** en todo momento (evitar trabajo a medio terminar).
- **Acción correctiva:** Ante retraso, recortar alcance del incremento (no la fecha del hito)
  y demostrar lo terminado con calidad, declarando lo diferido como backlog restante.
- **Responsable:** Scrum Master

### R-06 — Dependencias entre HU mal ordenadas
- **Categoría:** Técnico / Gestión
- **Descripción:** Existen dependencias declaradas (HU-01 depende de HU-08; HU-04 depende de
  HU-11). Un **orden de construcción incorrecto** en el Sprint bloquearía historias por falta
  de su prerequisito, generando retrabajo o trabajo detenido.
- **P:** Media (2) · **I:** Media (2) · **Nivel: 4 — Medio**
- **Estrategia:** **Evitar**
- **Acción preventiva:** Respetar la **DoR** (sección 7.1 del backlog): ninguna HU entra a un
  Sprint sin dependencias identificadas. Secuenciar en el Planning: HU-08 → HU-01; HU-11 → HU-04.
- **Acción correctiva:** Reordenar el Sprint Backlog en el Daily si se detecta un bloqueo por
  dependencia; adelantar la HU habilitadora pendiente.
- **Responsable:** Scrum Master (facilita orden) / Developer

### R-07 — Curva de aprendizaje de tecnologías nuevas (React Native/Expo, Web Speech API)
- **Categoría:** Técnico
- **Descripción:** El MPV usa **React Native + Expo** (móvil), **expo-location** (GPS) y
  **Web Speech API** (voz). La **curva de aprendizaje** y las incompatibilidades por
  plataforma/navegador pueden consumir más tiempo del estimado.
- **P:** Media (2) · **I:** Media (2) · **Nivel: 4 — Medio**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** Construir **spikes** o prototipos técnicos acotados antes de estimar
  en firme; preferir APIs con soporte amplio; documentar entornos de prueba.
- **Acción correctiva:** Si una API no rinde, aplicar el *fallback* ya previsto en los
  criterios de aceptación (búsqueda textual para HU-06; dirección textual para HU-04).
- **Responsable:** Developer / Scrum Master (seguimiento)

### R-08 — Geolocalización dependiente de hardware y permisos
- **Categoría:** Técnico / Operativo
- **Descripción:** HU-04 depende de **GPS real y del permiso de ubicación** del dispositivo.
  Un permiso denegado, hardware sin señal o restricciones del emulador pueden impedir demostrar
  la funcionalidad en la Review.
- **P:** Media (2) · **I:** Media (2) · **Nivel: 4 — Medio**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** Solicitar el permiso explicando su propósito; probar en dispositivo
  físico además del emulador; tener coordenadas de prueba reproducibles para la demo.
- **Acción correctiva:** Aplicar el criterio de aceptación de HU-04: si el permiso se niega,
  ofrecer la **dirección textual** como alternativa sin bloquear la app.
- **Responsable:** Developer

### R-09 — Pérdida de código o datos (repositorio / entorno)
- **Categoría:** Operativo
- **Descripción:** Pérdida del repositorio, corrupción del entorno local o borrado de la base
  de datos del backend nuevo, con **pérdida de trabajo** e imposibilidad de reconstruir la
  trazabilidad (código, historial Git, evidencias).
- **P:** Baja (1) · **I:** Alta (3) · **Nivel: 3 — Medio**
- **Estrategia:** **Transferir / Mitigar**
- **Acción preventiva:** Repositorio remoto en GitHub con *commits* frecuentes y descriptivos;
  no versionar secretos; *seeds* y migraciones de base de datos versionados; respaldos del
  contenido crítico.
- **Acción correctiva:** Restaurar desde el remoto o desde el último respaldo; regenerar la
  base con las migraciones y *seeds* versionados.
- **Responsable:** Developer (infra) / Scrum Master (política)

### R-10 — Alcance del MPV mayor que la capacidad real (sobre-compromiso)
- **Categoría:** Gestión
- **Descripción:** El MPV comprende **7 HU / 42 SP**. Con equipo unipersonal (R-02) y backend
  adelantado (R-01), existe el riesgo de **comprometer más de lo alcanzable** por Sprint,
  arrastrando trabajo entre Sprints y erosionando la calidad o la DoD.
- **P:** Media (2) · **I:** Alta (3) · **Nivel: 6 — Alto**
- **Estrategia:** **Mitigar**
- **Acción preventiva:** Estimar la **velocity** real tras el primer Sprint y ajustar el
  compromiso; fijar Sprint Goals modestos y verificables; usar burndown/velocity de Jira
  (previa habilitación de SP nativos, sección 6.3 del backlog).
- **Acción correctiva:** Renegociar el contenido del Sprint con el "sombrero" de PO y devolver
  al Product Backlog lo no abordable, sin sacrificar la DoD.
- **Responsable:** Scrum Master

---

## 4. Priorización y matriz de calor

### 4.1 Tabla resumen (ordenada por nivel de riesgo)

| ID | Riesgo | Categoría | P | I | Nivel | Estrategia |
|----|--------|-----------|---|---|-------|------------|
| **R-01** | Cambio de alcance por auth real (HU-08) | Técnico/Gestión | 3 | 3 | **9 · Alto** | Mitigar |
| **R-02** | Sobrecarga y sesgo de rol (unipersonal) | Gestión | 3 | 2 | **6 · Alto** | Mitigar |
| **R-04** | Causas raíz #2 y #5 sin HU dedicada | Gestión | 2 | 3 | **6 · Alto** | Mitigar |
| **R-05** | Plazos fijos S4/S8/S12 vs. capacidad | Gestión | 2 | 3 | **6 · Alto** | Mitigar |
| **R-10** | Alcance del MPV > capacidad real | Gestión | 2 | 3 | **6 · Alto** | Mitigar |
| **R-03** | Doble fuente de verdad (.md vs Jira) | Gestión | 2 | 2 | **4 · Medio** | Evitar |
| **R-06** | Dependencias entre HU mal ordenadas | Técnico/Gestión | 2 | 2 | **4 · Medio** | Evitar |
| **R-07** | Curva de tecnologías nuevas | Técnico | 2 | 2 | **4 · Medio** | Mitigar |
| **R-08** | Geolocalización: hardware y permisos | Técnico/Operativo | 2 | 2 | **4 · Medio** | Mitigar |
| **R-09** | Pérdida de código o datos | Operativo | 1 | 3 | **3 · Medio** | Transferir/Mitigar |

### 4.2 Matriz de calor (probabilidad × impacto)

Cada celda ubica los riesgos según su probabilidad (filas) e impacto (columnas). Las zonas
**Alto** concentran la atención prioritaria del Scrum Master.

| P \ I | Impacto Bajo (1) | Impacto Medio (2) | Impacto Alto (3) |
|-------|------------------|-------------------|------------------|
| **Prob. Alta (3)** | — *(3 · Medio)* | **R-02** *(6 · Alto)* | **R-01** *(9 · Alto)* |
| **Prob. Media (2)** | — *(2 · Bajo)* | R-03, R-06, R-07, R-08 *(4 · Medio)* | **R-04, R-05, R-10** *(6 · Alto)* |
| **Prob. Baja (1)** | — *(1 · Bajo)* | — *(2 · Bajo)* | R-09 *(3 · Medio)* |

- **Zona Alta (6–9):** R-01, R-02, R-04, R-05, R-10 → respuesta prioritaria y seguimiento activo.
- **Zona Media (3–4):** R-03, R-06, R-07, R-08, R-09 → respuesta planificada y vigilancia.
- **Zona Baja (1–2):** sin riesgos actualmente en esta zona.

> **Observación:** ninguno de los diez riesgos es de nivel Bajo. Es coherente con un proyecto
> de título que, además, adelantó alcance (backend real) y opera con equipo unipersonal: la
> gestión de riesgos es, por tanto, una actividad de primer orden y no un mero formalismo.

---

## 5. Seguimiento del registro en los eventos de Scrum

El registro es **vivo**: se inspecciona y adapta con la misma cadencia que el resto del marco.

| Evento Scrum | Qué se hace con los riesgos |
|--------------|-----------------------------|
| **Refinement** | Revisar riesgos por HU antes de que entren al Sprint (parte de la DoR); identificar nuevos. |
| **Sprint Planning** | Considerar los riesgos Altos al fijar el Sprint Goal y la capacidad comprometida. |
| **Daily Scrum** | Reportar impedimentos y disparadores de riesgo del día; el SM registra los materializados. |
| **Sprint Review** | Al coincidir con los hitos S4/S8/S12, evidenciar cómo se gestionaron los riesgos ante el tribunal. |
| **Sprint Retrospective** | Evaluar la efectividad de las respuestas; actualizar P/I; cerrar riesgos superados y abrir nuevos. |

**Cadencia mínima de revisión:** una vez por Sprint (en la Retrospective) y siempre que un
cambio de alcance, una decisión del PO o un impedimento nuevo lo justifique. Cada actualización
queda versionada en Git, de modo que la evolución del registro es **auditable ante el tribunal**.

---

## 6. Referencias
- Project Management Institute. (2021). *A guide to the project management body of knowledge (PMBOK guide)* (7.ª ed.). PMI.
- Schwaber, K., & Sutherland, J. (2020). *The Scrum Guide: The definitive guide to Scrum.* Scrum.org.
- Sommerville, I. (2016). *Software engineering* (10.ª ed.). Pearson.
