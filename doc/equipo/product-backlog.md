# Product Backlog — FoodVoice

> **Rol responsable:** Product Owner
> **Estado de implementación del producto: 0%.** Este backlog se construye desde cero. Los
> documentos previos (AINC410, AINC421, AINC422) describen prototipos y módulos como
> "implementados", pero en la realidad **no existe código todavía**. Todo lo aquí listado
> es trabajo pendiente por construir.

---

## 1. Visión del producto

FoodVoice es una plataforma digital de delivery de alimentos que coordina a cuatro actores
—**cliente, local comercial, repartidor y administrador**— para mejorar la gestión de
pedidos, la trazabilidad del servicio y el proceso de reparto. La propuesta ataca cinco
causas raíz identificadas en el análisis del problema (diagrama de Ishikawa):

1. Uso de un **mapa físico en papel** para el reparto.
2. Gestión del local desde un **dispositivo fijo**.
3. Dependencia de una **sincronización manual del menú**.
4. **Baja automatización** del cierre del servicio.
5. **Dependencia total de conectividad** a internet.

**Visión:** *"Que cualquier pedido de FoodVoice sea creado, seguido y entregado de forma
digital, trazable y coordinada entre los cuatro actores, reemplazando los procesos manuales
por un flujo de estados verificable de extremo a extremo."*

### Alcance del MPV
El Mínimo Producto Viable prioriza las historias de mayor impacto sobre las causas raíz y
deja fuera funcionalidades complementarias para un sprint posterior.

> **⚠️ Cambio de alcance (decisión del Product Owner):** se aprobó **autenticación real
> con backend** (HU-08). Esto **adelanta la activación de `services` y la persistencia**
> respecto a lo planteado en AINC422 (que asumía prototipo en memoria sin backend). En
> consecuencia, el MPV incorpora un backend mínimo con base de datos para soportar usuarios
> y sesión, y las entidades del dominio pasan a persistirse en lugar de vivir solo en
> memoria. Este cambio debe documentarse ante el tribunal como una evolución justificada
> del alcance y evaluarse como riesgo por el Scrum Master.

---

## 2. Épicas

| ID | Épica | Descripción | En MPV |
|----|-------|-------------|--------|
| E1 | **Acceso y usuarios** | Autenticación, sesión, roles y gestión de usuarios | Parcial |
| E2 | **Gestión de pedidos** | Creación, aceptación y preparación de pedidos | Sí |
| E3 | **Administración de menú** | Alta/baja y disponibilidad de productos | Sí |
| E4 | **Trazabilidad del pedido** | Historial de estados de extremo a extremo | Sí |
| E5 | **Reparto y geolocalización** | Asignación, ubicación GPS y visualización en mapa | Sí |
| E6 | **Búsqueda por voz** | Búsqueda de productos asistida por voz | Sí |
| E7 | **Cierre del servicio** | Confirmación digital de entrega y conformidad/reclamo | No |
| E8 | **Controles y administración** | Controles de flujos críticos y supervisión | No |

---

## 3. Historias de usuario

> Formato: *"Como <rol>, quiero <objetivo> para <beneficio>"*.
> Los story points (SP) usan escala Fibonacci (1,2,3,5,8,13) y son **estimaciones
> preliminares**, sujetas a refinamiento en Sprint Planning.

### E2 · Gestión de pedidos

#### HU-01 — Gestión de pedidos con estado visible
**Como** cliente y local comercial, **quiero** crear y gestionar pedidos con su estado
siempre visible **para** coordinar la compra y preparación sin llamadas ni pasos manuales.

- **Épica:** E2 · **Prioridad:** Alta · **MPV:** Sí (web) · **SP:** 8
- **Causa raíz:** #4 (baja automatización) y general de gestión.
- **Justificación de prioridad:** es el flujo central del producto; sin pedidos no hay
  servicio. Habilita al resto de las historias.
- **Criterios de aceptación:**
  - [ ] Dado un cliente con productos en el carrito, cuando confirma el pedido, entonces se
        crea con estado inicial **"creado"** y un identificador único.
  - [ ] Dado un pedido "creado", cuando el local lo revisa, entonces puede **aceptarlo**
        (pasa a "aceptado") o rechazarlo con motivo.
  - [ ] Dado un pedido "aceptado", cuando el local inicia la preparación, entonces cambia a
        **"en preparación"**.
  - [ ] El estado del pedido es visible en todo momento para cliente y local.
  - [ ] No se puede crear un pedido sin al menos un producto disponible y una dirección.

#### HU-11 — Registro de dirección y ubicación del cliente
**Como** cliente, **quiero** registrar mi dirección y ubicación al crear el pedido **para**
que el repartidor pueda encontrarme sin errores.

- **Épica:** E2 · **Prioridad:** Alta · **MPV:** Sí (web) · **SP:** 3
- **Causa raíz:** #1 (mapa físico).
- **Estado:** ✅ **Aprobada** (originalmente propuesta; validada por el Product Owner).
- **Criterios de aceptación:**
  - [ ] El cliente ingresa una dirección textual obligatoria al confirmar el pedido.
  - [ ] Opcionalmente, la dirección se asocia a coordenadas (para HU-04).
  - [ ] Si no hay coordenadas, el pedido igual se crea con la dirección textual como respaldo.

### E3 · Administración de menú

#### HU-02 — Administración de menú
**Como** local comercial, **quiero** administrar la disponibilidad de mis productos **para**
que el cliente solo vea y pida lo que realmente puedo preparar.

- **Épica:** E3 · **Prioridad:** Alta · **MPV:** Sí (web) · **SP:** 5
- **Causa raíz:** #3 (sincronización del menú).
- **Justificación de prioridad:** evita pedidos inválidos y reprocesos; alto impacto en la
  experiencia y en la operación del local.
- **Criterios de aceptación:**
  - [ ] El local puede crear, editar, activar y desactivar productos (nombre, precio, categoría).
  - [ ] Un producto desactivado **no aparece** en el catálogo del cliente.
  - [ ] Los cambios de disponibilidad se reflejan de inmediato en la vista del cliente.
  - [ ] No se puede agregar al carrito un producto inactivo.

### E4 · Trazabilidad del pedido

#### HU-03 — Trazabilidad del pedido
**Como** administrador y actores del pedido, **quiero** un historial de todos los estados
por los que pasa un pedido **para** dar seguimiento y auditar el servicio.

- **Épica:** E4 · **Prioridad:** Alta · **MPV:** Sí (web) · **SP:** 5
- **Causa raíz:** general (trazabilidad).
- **Justificación de prioridad:** es un objetivo específico central del proyecto y sustenta
  la evaluación de las métricas ("100% de pedidos con historial").
- **Criterios de aceptación:**
  - [ ] Cada cambio de estado registra: estado, fecha/hora y actor que lo produjo.
  - [ ] Estados soportados: creado, aceptado, en preparación, en reparto, entregado, cerrado.
  - [ ] El historial de un pedido es consultable en orden cronológico.
  - [ ] Ningún estado puede saltarse fuera del orden definido (transiciones válidas).

### E5 · Reparto y geolocalización

#### HU-04 — Geolocalización móvil del repartidor
**Como** repartidor, **quiero** ver el pedido asignado y la ubicación del cliente en un mapa
usando el GPS **para** llegar al destino sin usar un mapa físico.

- **Épica:** E5 · **Prioridad:** Alta · **MPV:** Sí (móvil) · **SP:** 8
- **Causa raíz:** #1 (mapa físico).
- **Justificación de prioridad:** es el diferenciador logístico y ataca directamente la
  causa raíz más visible. Depende de capacidades reales del dispositivo.
- **Criterios de aceptación:**
  - [ ] El repartidor ve la lista de pedidos asignados con su dirección.
  - [ ] La app solicita permiso de ubicación explicando su propósito.
  - [ ] Con permiso concedido, se obtiene la ubicación real por GPS (`expo-location`).
  - [ ] La dirección del cliente se visualiza en un mapa digital.
  - [ ] Si el permiso se niega, la app ofrece la dirección textual como alternativa (no se bloquea).

### E6 · Búsqueda por voz

#### HU-06 — Búsqueda asistida por voz
**Como** cliente, **quiero** buscar productos hablando **para** encontrar lo que quiero de
forma más rápida y accesible.

- **Épica:** E6 · **Prioridad:** Media · **MPV:** Sí (web) · **SP:** 5
- **Causa raíz:** — (elemento diferenciador / accesibilidad).
- **Justificación de prioridad:** aporta valor diferenciador e innovación, pero no bloquea
  el flujo de compra; por eso Media pese a estar en el MPV.
- **Criterios de aceptación:**
  - [ ] El cliente activa la búsqueda por voz y el sistema transforma la voz en texto (Web Speech API).
  - [ ] El texto reconocido filtra el catálogo de productos.
  - [ ] Existe **búsqueda textual tradicional como alternativa obligatoria**.
  - [ ] Si el navegador no soporta la API, la búsqueda por voz se oculta sin romper la pantalla.

### E7 · Cierre del servicio

#### HU-05 — Cierre digital del servicio
**Como** cliente y repartidor, **quiero** confirmar digitalmente la entrega y registrar
conformidad o reclamo **para** cerrar el servicio de forma trazable.

- **Épica:** E7 · **Prioridad:** Media · **MPV:** No (próximo sprint) · **SP:** 5
- **Causa raíz:** #4 (baja automatización del cierre).
- **Justificación de prioridad:** importante para la trazabilidad completa, pero se difiere
  para acotar el primer incremento a los flujos de mayor impacto.
- **Criterios de aceptación:**
  - [ ] El repartidor marca la entrega como realizada (estado "entregado").
  - [ ] El cliente confirma conformidad o registra un reclamo con observación.
  - [ ] El pedido pasa a estado "cerrado" al registrarse la conformidad.
  - [ ] Un reclamo queda registrado y asociado al pedido para su control.

### E8 · Controles y administración

#### HU-07 — Controles de flujos críticos
**Como** administrador, **quiero** controles definidos sobre los flujos críticos **para**
evitar pedidos incompletos, inconsistentes o sin trazabilidad.

- **Épica:** E8 · **Prioridad:** Media · **MPV:** No (próximo sprint) · **SP:** 5
- **Causa raíz:** general (control y calidad).
- **Justificación de prioridad:** refuerza la robustez del sistema; se difiere hasta tener
  los flujos base construidos.
- **Criterios de aceptación:**
  - [ ] Validación de datos completos en la creación del pedido.
  - [ ] Solo se muestran productos activos en el catálogo.
  - [ ] Cada aceptación/cambio de estado registra fecha, hora y actor.
  - [ ] Existe una vista de controles/incidencias para el administrador.

### E1 · Acceso y usuarios

> Estas historias no estaban en los documentos como HU formales; el Product Owner las
> **aprobó** al reconocer que un sistema con cuatro roles las necesita.

#### HU-08 — Autenticación y sesión
**Como** usuario (cualquier rol), **quiero** iniciar sesión **para** acceder a las
funciones que me corresponden según mi rol.

- **Épica:** E1 · **Prioridad:** Alta · **MPV:** Sí · **SP:** 8
- **Estado:** ✅ **Aprobada — autenticación real con backend.**
- **Decisión de alcance:** se optó por **autenticación real** (no simulada). Esto **activa
  `services` y la persistencia dentro del MPV**, ampliando el alcance del primer incremento
  respecto a AINC422. Debe reflejarse en el diseño de arquitectura y en el registro de riesgos.
- **Criterios de aceptación:**
  - [ ] El usuario inicia sesión con credenciales validadas por el backend y obtiene una
        sesión asociada a su rol.
  - [ ] Cada rol solo accede a las vistas y acciones permitidas (autorización por rol).
  - [ ] Las credenciales se almacenan de forma segura (hash, nunca en texto plano).
  - [ ] Cierre de sesión disponible; una sesión inválida/expirada redirige al login.

#### HU-09 — Gestión de usuarios y roles
**Como** administrador, **quiero** gestionar usuarios y sus roles **para** controlar quién
participa en la plataforma.

- **Épica:** E1 · **Prioridad:** Media · **MPV:** No · **SP:** 5
- **Estado:** ✅ **Aprobada** (fuera del MPV).
- **Criterios de aceptación:**
  - [ ] El administrador puede crear, editar y desactivar usuarios.
  - [ ] Puede asignar el rol (cliente, local, repartidor, administrador).

#### HU-10 — Panel y reportes del administrador
**Como** administrador, **quiero** un panel con reportes y trazabilidad consolidada **para**
supervisar la operación general.

- **Épica:** E1/E8 · **Prioridad:** Media · **MPV:** No · **SP:** 5
- **Estado:** ✅ **Aprobada** (fuera del MPV).
- **Criterios de aceptación:**
  - [ ] Vista consolidada de pedidos por estado.
  - [ ] Indicadores básicos: pedidos por estado, reclamos, productos inactivos.

---

## 4. Backlog priorizado (vista rápida)

| # | ID | Historia | Épica | Prioridad | MPV | Plataforma | SP | Estado |
|---|----|----------|-------|-----------|-----|-----------|----|--------|
| 1 | HU-08 | Autenticación y sesión (real, con backend) | E1 | Alta | Sí | Web/Móvil | 8 | ✅ Aprobada |
| 2 | HU-01 | Gestión de pedidos con estado visible | E2 | Alta | Sí | Web | 8 | ✅ Aprobada |
| 3 | HU-04 | Geolocalización móvil del repartidor | E5 | Alta | Sí | Móvil | 8 | ✅ Aprobada |
| 4 | HU-02 | Administración de menú | E3 | Alta | Sí | Web | 5 | ✅ Aprobada |
| 5 | HU-03 | Trazabilidad del pedido | E4 | Alta | Sí | Web | 5 | ✅ Aprobada |
| 6 | HU-11 | Registro de dirección/ubicación del cliente | E2 | Alta | Sí | Web | 3 | ✅ Aprobada |
| 7 | HU-06 | Búsqueda asistida por voz | E6 | Media | Sí | Web | 5 | ✅ Aprobada |
| 8 | HU-05 | Cierre digital del servicio | E7 | Media | No | Web/Móvil | 5 | ✅ Aprobada |
| 9 | HU-07 | Controles de flujos críticos | E8 | Media | No | Web | 5 | ✅ Aprobada |
| 10 | HU-09 | Gestión de usuarios y roles | E1 | Media | No | Web | 5 | ✅ Aprobada |
| 11 | HU-10 | Panel y reportes del administrador | E1/E8 | Media | No | Web | 5 | ✅ Aprobada |

---

## 5. Mapeo para carga en Jira

Cada épica se crea como issue tipo **Epic**; cada HU como **Story** vinculada a su épica.

| Elemento | Tipo de issue Jira | Épica padre |
|----------|--------------------|-------------|
| E1 Acceso y usuarios | Epic | — |
| E2 Gestión de pedidos | Epic | — |
| E3 Administración de menú | Epic | — |
| E4 Trazabilidad del pedido | Epic | — |
| E5 Reparto y geolocalización | Epic | — |
| E6 Búsqueda por voz | Epic | — |
| E7 Cierre del servicio | Epic | — |
| E8 Controles y administración | Epic | — |
| HU-01 | Story | E2 |
| HU-02 | Story | E3 |
| HU-03 | Story | E4 |
| HU-04 | Story | E5 |
| HU-05 | Story | E7 |
| HU-06 | Story | E6 |
| HU-07 | Story | E8 |
| HU-08 | Story | E1 |
| HU-09 | Story | E1 |
| HU-10 | Story | E1 |
| HU-11 | Story | E2 |

> **Sugerencia de campos Jira por Story:** Resumen (título de la HU), Descripción (enunciado
> "Como… quiero… para…"), Criterios de aceptación (checklist), Prioridad, Story Points, y
> etiquetas: `mvp` / `sprint-posterior`, plataforma (`web`/`movil`) y causa raíz.

---

## 6. Sincronización con Jira (mapeo real y fuente canónica)

El backlog fue volcado al proyecto Jira **"UNAB FoodVoice"** (clave `SCRUM`,
*team-managed / next-gen*). Esta sección registra el mapeo real y la política de coherencia
para evitar el riesgo de tener **dos fuentes de verdad** desincronizadas.

### 6.1 Fuente canónica
- **Este documento (`doc/equipo/product-backlog.md`) es la fuente canónica** del backlog:
  contiene el enunciado de valor, la trazabilidad a las causas raíz del Ishikawa, la
  justificación de prioridad y de alcance del MPV, los criterios de aceptación y la DoR/DoD.
  Está versionado en Git, por lo que su historial es auditable ante el tribunal.
- **Jira es el espejo operativo de ejecución**: tablero, workflow, estados, asignación y
  reportes de sprint (burndown/velocity). Se actualiza durante los Sprints.
- **Regla de precedencia:** ante discrepancia, prevalece el `.md`. Todo cambio de alcance,
  prioridad o estimación se decide y se registra **primero** aquí y luego se refleja en Jira.

### 6.2 Mapeo HU/Épica → clave de issue

| Elemento | Clave Jira | Tipo | Padre |
|----------|-----------|------|-------|
| E1 Acceso y usuarios | SCRUM-2 | Epic | — |
| E2 Gestión de pedidos | SCRUM-3 | Epic | — |
| E3 Administración de menú | SCRUM-4 | Epic | — |
| E4 Trazabilidad del pedido | SCRUM-5 | Epic | — |
| E5 Reparto y geolocalización | SCRUM-6 | Epic | — |
| E6 Búsqueda por voz | SCRUM-7 | Epic | — |
| E7 Cierre del servicio | SCRUM-8 | Epic | — |
| E8 Controles y administración | SCRUM-9 | Epic | — |
| HU-08 Autenticación y sesión | SCRUM-10 | Story | SCRUM-2 |
| HU-01 Gestión de pedidos | SCRUM-11 | Story | SCRUM-3 |
| HU-04 Geolocalización del repartidor | SCRUM-12 | Story | SCRUM-6 |
| HU-02 Administración de menú | SCRUM-13 | Story | SCRUM-4 |
| HU-03 Trazabilidad del pedido | SCRUM-14 | Story | SCRUM-5 |
| HU-11 Dirección/ubicación del cliente | SCRUM-15 | Story | SCRUM-3 |
| HU-06 Búsqueda por voz | SCRUM-16 | Story | SCRUM-7 |
| HU-05 Cierre digital del servicio | SCRUM-17 | Story | SCRUM-8 |
| HU-07 Controles de flujos críticos | SCRUM-18 | Story | SCRUM-9 |
| HU-09 Gestión de usuarios y roles | SCRUM-19 | Story | SCRUM-2 |
| HU-10 Panel y reportes del administrador | SCRUM-20 | Story | SCRUM-2 |

> El identificador funcional **HU-xx / Exx es el estable**; la clave `SCRUM-nn` es
> secundaria y depende del proyecto Jira. Al citar el backlog ante el tribunal se usa el
> ID funcional, y esta tabla actúa como diccionario de equivalencias.

### 6.3 Story Points y Prioridad en Jira
Al ser un proyecto *team-managed*, los Story Points y la Prioridad quedaron **dentro de la
descripción y como labels** (`mvp`/`sprint-posterior`, `web`/`movil`, `prioridad-*`,
`causa-raiz-*`), no como campos nativos.

**Recomendación (para el refinamiento con el Scrum Master):** habilitar la **estimación por
Story Points nativa** del tablero (*Configuración del tablero → Estimación → Story points*),
disponible en proyectos team-managed. Esto es necesario para obtener burndown/velocity
reales, valor metodológico exigible por la rúbrica. Mientras no se habilite, **el SP y la
prioridad canónicos son los de este documento** (Sección 4) y los labels de Jira solo los
replican. Cualquiera sea la opción elegida, debe quedar registrada como decisión.

---

## 7. Definition of Ready (DoR) y Definition of Done (DoD)

Criterios transversales que aplican a **toda** historia, complementarios a sus criterios de
aceptación específicos. Su ausencia es una observación frecuente de tribunal; se explicitan aquí.

### 7.1 Definition of Ready — una HU puede entrar a un Sprint solo si:
- [ ] Tiene enunciado en formato *"Como… quiero… para…"* con rol, objetivo y beneficio claros.
- [ ] Tiene criterios de aceptación verificables (formato Gherkin *Dado/Cuando/Entonces*).
- [ ] Está vinculada a una causa raíz o justificada como valor diferenciador.
- [ ] Está estimada en Story Points y priorizada.
- [ ] Sus **dependencias** están identificadas (p. ej., HU-01 depende de HU-08; HU-04 depende de HU-11).
- [ ] Es lo bastante pequeña para completarse dentro de un Sprint (si no, se divide).
- [ ] Existe un mockup o referencia de diseño cuando aplica (rol de Diseño UI/UX).

### 7.2 Definition of Done — una HU se considera terminada solo si:
- [ ] Todos sus criterios de aceptación se cumplen y fueron verificados por QA.
- [ ] El código está integrado a la rama principal sin romper la build.
- [ ] Cuenta con validación funcional (checklist de `qa-tester`) documentada.
- [ ] La trazabilidad quedó registrada (estado de la HU actualizado en Jira y `.md` si cambió el alcance).
- [ ] No introduce regresiones en las HU ya entregadas.
- [ ] La documentación mínima asociada (si aplica) está actualizada.

---

## 8. Resumen ejecutivo

- **Épicas:** 8 (E1–E8), todas aprobadas.
- **Historias totales:** 11 → 7 canónicas (HU-01…HU-07) + 4 aprobadas tras propuesta
  (HU-08, HU-09, HU-10, HU-11). **Todas aprobadas.**
- **Historias en el MPV (7):** HU-08, HU-01, HU-04, HU-02, HU-03, HU-11, HU-06.
- **Story points del MPV:** 8 + 8 + 8 + 5 + 5 + 3 + 5 = **42 SP**.
- **Fuera del MPV (4):** HU-05, HU-07, HU-09, HU-10 (20 SP).

### Decisiones del Product Owner (registradas)
1. ✅ Se aprueban las 4 historias propuestas (HU-08, HU-09, HU-10, HU-11).
2. ✅ Acceso por rol vía **autenticación real con backend** → **`services` y persistencia
   entran al MPV**, ampliando el alcance respecto a AINC422 (que asumía estado en memoria).
3. ⏳ El objetivo del **Sprint 1** se fijará **tras el refinamiento con el Scrum Master**
   (estimación, capacidad, orden de construcción y riesgos del nuevo alcance con backend).

### Cobertura de las cinco causas raíz (trazabilidad al Ishikawa)
| Causa raíz | HU que la ataca |
|---|---|
| #1 Mapa físico en papel | HU-04, HU-11 |
| #2 Gestión del local desde dispositivo fijo | **Sin HU dedicada** (cubierta parcialmente al ofrecer web responsiva) |
| #3 Sincronización manual del menú | HU-02 |
| #4 Baja automatización del cierre | HU-01, HU-05 |
| #5 Dependencia total de conectividad | **Sin HU dedicada** (el modo offline queda fuera del MPV) |

> **Observación para el tribunal:** las causas #2 y #5 no tienen una HU que las ataque de
> forma directa. Debe decidirse conscientemente si se difieren (y declararlo como límite
> del alcance) o se crea una HU para cada una. Dejarlo implícito es un riesgo de coherencia
> entre el problema planteado (Ishikawa) y la solución propuesta (backlog).

### Implicancias del nuevo alcance (para refinamiento)
- El rol de servicios backend deja de estar inactivo: se requiere un backend mínimo (auth +
  persistencia de usuarios, y probablemente pedidos/productos/estados).
- Debe definirse la gestión del monorepo y cómo `apps/web` y `apps/mobile` consumen la API.
- El registro de riesgos debe incorporar el riesgo de mayor complejidad por adelantar backend.
