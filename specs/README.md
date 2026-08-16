# Estado del producto · FoodVoice

Índice de las especificaciones del proyecto y de su avance. Cada épica se
especifica como una feature independiente de Spec Kit; las HU de la épica se
incorporan como escenarios y criterios de aceptación dentro de esa spec.

- Reglas de producto: [`.specify/memory/constitution.md`](../.specify/memory/constitution.md)
- Mapa completo de épicas y HU: [`docs/epicas-hu/EPICS.md`](../docs/epicas-hu/EPICS.md)
- Memoria técnica: [`CLAUDE.md`](../CLAUDE.md)

## Avance por épica

| Épica | HU | Spec | Estado |
| --- | --- | --- | --- |
| **E1 · Acceso y usuarios** | HU-08, HU-09, HU-10 | [`001-acceso-y-usuarios/`](./001-acceso-y-usuarios/) | **Terminada** · 138 / 138 tareas · construida y verificada, incluida la validación funcional a mano |
| E4 · Trazabilidad del pedido | HU-03 | — | Sin especificar |
| E3 · Administración de menú | HU-02, HU-14 | — | Sin especificar |
| E2 · Gestión de pedidos | HU-01, HU-11, HU-12 | — | Sin especificar |
| E6 · Búsqueda por voz | HU-06, HU-13 | — | Sin especificar |
| E5 · Reparto | HU-04 | — | Sin especificar |
| E7 · Cierre del servicio | HU-05 | — | Sin especificar |
| E8 · Controles y administración | HU-07 | — | Sin especificar |

El orden de la tabla es el orden sugerido de especificación (E1 → E4 → E3 → E2 →
E6 → E5 → E7 → E8): E1 es prerrequisito de casi todo lo demás, E4 define el
contrato de estados que E2, E5 y E7 consumen, y E3 debe existir antes que E2 y E6.

## E1 · Acceso y usuarios

Rama de trabajo: `001-acceso-y-usuarios`.

| Artefacto | Para qué sirve |
| --- | --- |
| [`spec.md`](./001-acceso-y-usuarios/spec.md) | Requisitos, reglas de negocio y criterios de éxito |
| [`plan.md`](./001-acceso-y-usuarios/plan.md) | Decisiones técnicas, estructura y fases de entrega |
| [`research.md`](./001-acceso-y-usuarios/research.md) | Las 13 decisiones técnicas con su fundamento |
| [`data-model.md`](./001-acceso-y-usuarios/data-model.md) | Entidades, transiciones y esquema Prisma |
| [`contracts/`](./001-acceso-y-usuarios/contracts/) | Endpoints HTTP y contratos de dominio compartidos |
| [`quickstart.md`](./001-acceso-y-usuarios/quickstart.md) | Puesta en marcha y validación funcional paso a paso |
| [`tasks.md`](./001-acceso-y-usuarios/tasks.md) | 138 tareas ordenadas por dependencia |
| [`verificacion.md`](./001-acceso-y-usuarios/verificacion.md) | Resultado de las tareas de verificación, con lo comprobado y lo pendiente |
| [`checklists/`](./001-acceso-y-usuarios/checklists/) | Calidad de requisitos por ámbito |

Fases de entrega: **A** cimientos (monorepo, `packages/shared`, esquema, semilla)
→ **B** HU-08 autenticación y sesión → **C** HU-09 gestión de usuarios y roles →
**D** HU-10 panel y reportes. Cada fase es verificable de forma independiente con
la sección correspondiente de `quickstart.md`.

**Por qué se da por terminada.** Las cuatro fases están construidas, las dos
capas automáticas pasan en verde —unitarios con sus umbrales de cobertura, e
integración contra PostgreSQL real— y la **validación funcional se ejecutó el
2026-08-15** con las esperas reales de 15 y 30 minutos, de modo que los cuatro
criterios sin cobertura automática —SC-001, SC-007, SC-036 y SC-038— quedan
verificados. El detalle está en
[`verificacion.md`](./001-acceso-y-usuarios/verificacion.md).

Sigue fuera de v1, por decisión declarada y no por omisión: la auditoría formal
de accesibilidad y las pruebas con lectores de pantalla reales (FR-039), y la
verificación funcional de las **métricas y reportes de pedidos**, que necesitan
que existan pedidos y por tanto esperan a E4/E2. Su superficie está construida y
responde vacía por diseño.

## Alcance de v1

- Mono-local: un solo negocio en la plataforma.
- Sin módulo de pago.
- Sin geolocalización; las direcciones son texto libre.
- Sin autorregistro: el administrador da de alta a todos los usuarios.

## Cómo actualizar este índice

Al terminar una épica o al abrir una nueva, se actualiza la tabla de avance. El
estado se expresa en términos observables (spec escrita, tareas generadas,
implementación terminada según el criterio de aceptación de su `quickstart.md`),
no en porcentajes estimados.
