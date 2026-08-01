# Acta de refinamiento y planificación — Sprint 1

> **Roles responsables:** Scrum Master (facilitación y mecánica) · Product Owner (alcance y valor)
> **Fecha de planificación:** 2026-07-31
> **Sprint 1:** semana del lunes 2026-08-03 al viernes 2026-08-07 (duración: 1 semana)

Proyecto unipersonal: la misma persona asume Product Owner, Scrum Master, Arquitecto de
Software y Developer. En cada actividad se declara el "sombrero" activo para mantener la
separación de responsabilidades (mitigación del riesgo R-02).

---

## 1. Sprint Goal

> *"Un usuario puede iniciar sesión con credenciales reales validadas por el backend y
> acceder, según su rol, a un espacio propio — sentando la base de identidad y persistencia
> sobre la que se construirá el flujo de pedidos."*

El objetivo es autenticación real de extremo a extremo, **no scaffolding**. Al cierre del
Sprint debe existir el flujo funcionando y demostrable en vivo.

---

## 2. Supuesto de capacidad y velocity

**Capacidad bruta:** ~40 h/semana (jornada completa).

| Concepto | Horas/sem | Justificación |
|---|---|---|
| Ceremonias | ~3 | Planning + 5 Dailies + Review + Retro |
| Gestión PO/SM | ~4 | Refinamiento, riesgos, actas, sincronía con el tablero |
| Arquitectura + *setup* | ~7 | **Solo Sprint 1**: scaffolding del monorepo, diagrama y primer ADR (backend HU-08) |
| Aprendizaje / *spikes* | ~4 | Stack nuevo: backend real, autenticación, persistencia |
| **Neto de desarrollo** | **~22** | Capacidad efectiva del Sprint 1 |

**Velocity inicial:** sin histórico, se estima de forma **conservadora en ~8 SP**. Es
provisional y se **recalibra al cierre del Sprint 1** con la velocity real (SP terminados
según la *Definition of Done*). Regla: no se sube el compromiso hasta medir al menos un
Sprint. En Sprints 2–4 el neto de desarrollo sube a ~28–30 h/semana al estar hecho el
*setup* inicial.

---

## 3. Compromiso del Sprint 1

**Compromiso firme: HU-08 — Autenticación y sesión (real, con backend) · 8 SP.**

Es la historia habilitadora (HU-01 depende de ella) y la de mayor riesgo técnico (R-01).
Abordarla primero es correcto en secuencia y en gestión de riesgo.

**Núcleo mínimo demostrable ("walking skeleton" de autenticación):**
- Backend (`services`) con persistencia real (PostgreSQL); contraseñas con **hash**, nunca en
  texto plano.
- Login que valida credenciales contra la base de datos y emite una sesión asociada al rol;
  cierre de sesión operativo.
- **En la web:** cada rol accede solo a sus vistas/acciones permitidas; una sesión inválida o
  expirada redirige al login.
- Integración de sesión en la app **móvil**: deseable, **no bloquea** el Sprint Goal; puede
  completarse en el Sprint 2.

**Stretch opcional (fuera del compromiso):** HU-11 — Registro de dirección/ubicación del
cliente (3 SP), independiente y de bajo riesgo. Se toma **solo si HU-08 cumple su DoD con
holgura**. No debe ponerse en riesgo el Sprint Goal por incluirla.

### Verificación contra la Definition of Ready (HU-08)
- [x] Historia con enunciado claro y criterios de aceptación verificables.
- [x] Justificada por valor (acceso por rol) y como habilitadora del backlog.
- [x] Estimada (8 SP) y priorizada (Alta, primera del MPV).
- [x] Dependencias identificadas: no depende de otras HU; habilita a HU-01.
- [x] Suficientemente pequeña para el Sprint tras acotarla al walking skeleton.

---

## 4. Descomposición en tareas (Sprint Backlog)

1. **Spike de autenticación (1 día):** validar el flujo auth + persistencia con el framework
   elegido antes de comprometer el detalle (mitigación de R-01).
2. *Scaffolding* del backend en `services/` e integración en el monorepo.
3. Modelo y migración de la entidad de usuarios (con rol) en PostgreSQL.
4. Registro/carga de usuarios de prueba con contraseña **hasheada** (*seed* verificable).
5. Endpoint de login: validación de credenciales y emisión de sesión asociada al rol.
6. Endpoint/acción de cierre de sesión.
7. Consumo del backend desde `apps/web`: pantalla de login y manejo de sesión.
8. Autorización por rol en la web: cada rol accede solo a lo permitido; redirección al login
   ante sesión inválida/expirada.
9. Contratos de tipos compartidos en `package/shared` (usuario, rol, sesión).
10. Evidencia de demostración para la Sprint Review (guion de la demo).

---

## 5. Criterios de cierre del Sprint (Definition of Done aplicable)

Al finalizar debe poder demostrarse en vivo que:
1. Un usuario se autentica con credenciales **validadas por el backend real** y obtiene una
   sesión asociada a su rol.
2. Las credenciales se almacenan con **hash** y persisten en base de datos (verificable
   reiniciando el backend: los usuarios siguen existiendo).
3. Un intento con credenciales inválidas es rechazado.
4. En la web, cada rol accede solo a lo permitido y una sesión inválida/expirada redirige al
   login.
5. Existe cierre de sesión funcional.
6. El backend está integrado al monorepo y consumido por al menos una app.

**Medición de velocity:** al cierre se registran los SP realmente terminados según DoD; ese
dato reemplaza a la velocity estimada y recalibra el compromiso del Sprint 2.

---

## 6. Riesgos del Sprint y mitigaciones

Enlace al registro completo en `registro-de-riesgos.md`.

| Riesgo | Nivel | Mitigación de la semana |
|---|---|---|
| **R-01** Complejidad de la autenticación real | 9 · Alto | Framework maduro (no seguridad artesanal) + *spike* de 1 día. Contingencia: degradar a auth con *seed* verificable y declarar deuda técnica. |
| **R-05** Plazos fijos S4/S8/S12 | 6 · Alto | Si hay retraso, se recorta el alcance del incremento, **nunca la fecha del hito**. |
| **R-10** Sobre-compromiso del MPV | 6 · Alto | Compromiso conservador de 8 SP; prohibido subirlo hasta medir la velocity real. |

---

## 7. Roadmap tentativo hacia el Hito 1 (S4)

| Sprint | HU (SP) | Total SP | Foco / entregable |
|---|---|---|---|
| **S1** | HU-08 (8) | 8 | Autenticación real + backend base + monorepo (habilitador) |
| **S2** | HU-01 (8) + HU-11 (3) | 11 | Pedidos con estado + dirección del cliente |
| **S3** | HU-02 (5) + HU-03 (5) | 10 | Menú + trazabilidad de estados |
| **S4** | HU-04 (8) + HU-06 (5) | 13 | Geolocalización móvil + búsqueda por voz |

**Lectura honesta:** 42 SP en 4 semanas ≈ 10,5 SP/semana promedio, por encima de la velocity
conservadora (8). El plan es **realizable pero tenso**. Los ítems con mayor riesgo de no
entrar a S4 son los del Sprint 4 —HU-04 (móvil) y HU-06 (voz)— por ser los últimos y
tecnológicamente nuevos. Si algo no cabe, se difiere primero **HU-06** (prioridad Media, no
bloquea el flujo) y HU-04 se demuestra de forma parcial. La velocity medida al final del
Sprint 1 confirmará o corregirá este reparto.

---

## 8. Plan de ceremonias de la semana

| Ceremonia | Cuándo | Duración | Adaptación unipersonal |
|---|---|---|---|
| Sprint Planning | Lunes AM | ~45 min | Fijar Sprint Goal, seleccionar HU-08 y descomponer en tareas |
| Daily | Diario | 5–10 min | Auto-registro escrito (hecho / hoy / impedimentos) en bitácora |
| Refinement | Miércoles | ~30 min | Preparar la HU del Sprint siguiente para que cumpla la DoR |
| Sprint Review | Viernes PM | ~30 min | Demo del incremento; ante el tribunal en semanas de hito |
| Retrospective | Viernes PM | ~20 min | Una mejora accionable + recalibrar velocity y riesgos |

En cada ceremonia se declara el "sombrero" activo para mantener la separación de roles.

---

## 9. Acuerdos de la planificación

1. Se aprueba el Sprint 1 con compromiso firme **HU-08** (walking skeleton de autenticación)
   y **HU-11 como stretch opcional** que no compromete el Sprint Goal.
2. La velocity de 8 SP es provisional; se recalibra con datos reales al cierre del Sprint 1.
3. El primer entregable arquitectónico (diagrama base y ADR que justifica el backend
   adelantado por HU-08) se produce dentro de este Sprint como parte del *setup*.
4. Cualquier retraso ajusta el alcance del incremento, no la fecha de los hitos.
