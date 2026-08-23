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
| **E3 · Administración de menú** | HU-02, HU-14 | [`002-administracion-menu-productos/`](./002-administracion-menu-productos/) | **Terminada** · 88 / 88 tareas · construida y verificada, incluidos los 56 pasos de validación funcional |
| **E2 · Gestión de pedidos** | HU-01, HU-11, HU-12 | [`003-gestion-pedidos/`](./003-gestion-pedidos/) | **Terminada** · 108 / 108 tareas · construida y verificada, incluida la validación funcional a mano |
| **E4 · Trazabilidad del pedido** | HU-03 | [`005-trazabilidad-pedido/`](./005-trazabilidad-pedido/) | **Terminada** · 27 / 27 tareas · construida y verificada, incluidos los 12 pasos de validación funcional |
| E6 · Búsqueda por voz | HU-06, HU-13 | — | Sin especificar |
| E5 · Reparto | HU-04 | — | Sin especificar |
| E7 · Cierre del servicio | HU-05 | — | Sin especificar |
| E8 · Controles y administración | HU-07 | — | Sin especificar |
| **E9 · Navegación y experiencia visual** *(transversal)* | HU-15, HU-16 | [`004-navegacion-por-rol/`](./004-navegacion-por-rol/) | **Terminada** · 35 / 35 tareas · construida y verificada, incluidos los 26 pasos de validación funcional |

El orden de la tabla es el orden sugerido de especificación (E1 → E3 → E2 → E4 →
E6 → E5 → E7 → E8): E1 es prerrequisito de casi todo lo demás, E3 debe existir
antes que E2 y E6 (no hay pedido ni búsqueda sin catálogo), y E2 crea la entidad
Pedido sobre la cual E4 registra el historial. El contrato de estados que E2, E5 y
E7 consumen no condiciona este orden, porque ya está construido en
`packages/shared` desde E1.

**E9 queda fuera de esa secuencia**: es transversal, envuelve con navegación las
pantallas que E1+E3+E2 ya construyeron en vez de agregar una capacidad de negocio
nueva. No bloquea ni depende de E4/E5/E6/E7/E8.

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

## E3 · Administración de menú

Rama de trabajo: `002-administracion-menu-productos`.

| Artefacto | Para qué sirve |
| --- | --- |
| [`spec.md`](./002-administracion-menu-productos/spec.md) | Requisitos, reglas de negocio y criterios de éxito |
| [`plan.md`](./002-administracion-menu-productos/plan.md) | Decisiones técnicas, estructura y fases de entrega |
| [`research.md`](./002-administracion-menu-productos/research.md) | Las decisiones D-020 a D-033 con su fundamento |
| [`data-model.md`](./002-administracion-menu-productos/data-model.md) | Categoría, Producto, índices y esquema Prisma |
| [`contracts/`](./002-administracion-menu-productos/contracts/) | Los doce endpoints y los contratos compartidos |
| [`quickstart.md`](./002-administracion-menu-productos/quickstart.md) | Puesta en marcha y los 56 pasos de validación funcional |
| [`tasks.md`](./002-administracion-menu-productos/tasks.md) | 88 tareas ordenadas por dependencia |
| [`verificacion.md`](./002-administracion-menu-productos/verificacion.md) | Resultado de la validación, con los dos defectos que encontró |
| [`checklists/`](./002-administracion-menu-productos/checklists/) | Calidad de requisitos y del contenido del catálogo |

Fases de entrega: **cimientos** (contratos compartidos y esquema) → **HU-14**
clasificación, que es el MVP y se demuestra sola → **HU-02** administración del
menú → **consulta del menú**, que cierra los escenarios de las dos historias →
**semilla y cierre**.

**Por qué se da por terminada.** Las cinco fases están construidas, las dos capas
automáticas pasan en verde —439 pruebas unitarias y 434 de integración en 38
baterías contra PostgreSQL real— y la **validación funcional se ejecutó el
2026-08-16**, los 56 pasos, de modo que los ocho criterios sin cobertura
automática quedan verificados. **Encontró dos defectos reales** que ninguna
prueba automática detectaba —la baja de un producto no llegaba a confirmar nada,
y el rechazo de la reactivación se anunciaba dos veces—, ambos corregidos y ahora
cubiertos por pruebas. El detalle está en
[`verificacion.md`](./002-administracion-menu-productos/verificacion.md).

Sigue fuera de v1: la auditoría formal de accesibilidad (heredada de E1) y la
mitad de SC-023 que mira pedidos ya emitidos, que espera a E2. La apuesta central
de la épica —que una descripción en prosa bien escrita baste para la búsqueda por
voz, sin diccionario de sinónimos— **la confirma o la refuta E6**, no E3: aquí no
hay modelo al que preguntar, y así está declarado en el supuesto 27 de la spec.

## E2 · Gestión de pedidos

Rama de trabajo: `003-gestion-pedidos`.

| Artefacto | Para qué sirve |
| --- | --- |
| [`spec.md`](./003-gestion-pedidos/spec.md) | Requisitos, reglas de negocio y criterios de éxito |
| [`plan.md`](./003-gestion-pedidos/plan.md) | Decisiones técnicas, estructura y fases de entrega |
| [`data-model.md`](./003-gestion-pedidos/data-model.md) | Carrito, Dirección, Pedido, historial y esquema Prisma |
| [`contracts/`](./003-gestion-pedidos/contracts/) | Endpoints HTTP y contratos compartidos de E2 |
| [`quickstart.md`](./003-gestion-pedidos/quickstart.md) | Puesta en marcha y los 40 pasos de validación funcional |
| [`tasks.md`](./003-gestion-pedidos/tasks.md) | 108 tareas ordenadas por dependencia |
| [`verificacion.md`](./003-gestion-pedidos/verificacion.md) | Resultado de la validación, con el defecto que encontró |
| [`checklists/`](./003-gestion-pedidos/checklists/) | Calidad de requisitos y de la lógica de negocio |

Fases de entrega: **cimientos** (contrato de estados, esquema y las seis tablas)
→ **HU-12** carrito editable, el MVP → **HU-11** direcciones etiquetadas,
consistentes bajo carrera → **HU-01** pedido con estado visible, que depende de
carrito y dirección → **cierre**.

**Por qué se da por terminada.** Las tres historias están construidas, las dos
capas automáticas pasan en verde —301 pruebas unitarias y 587 de integración en
73 baterías contra PostgreSQL real, con cobertura explícita de concurrencia,
atomicidad y el historial de estados append-only— y la **validación funcional se
ejecutó el 2026-08-18**, los 40 pasos de `quickstart.md`. **Encontró un defecto
real** que ninguna prueba automática detectaba —el error de una dirección
puntual demasiado corta se mostraba en inglés, no en español—, corregido y
cubierto por una prueba nueva. El detalle está en
[`verificacion.md`](./003-gestion-pedidos/verificacion.md).

No hay pantalla ni endpoint de consulta del historial de estados en E2, por
diseño: lo incorpora E4. Sigue fuera de v1, heredado de E1/E3: la auditoría
formal de accesibilidad y las pruebas con lectores de pantalla reales.

## E4 · Trazabilidad del pedido

Rama de trabajo: `005-trazabilidad-pedido`.

| Artefacto | Para qué sirve |
| --- | --- |
| [`spec.md`](./005-trazabilidad-pedido/spec.md) | Requisitos, escenarios y criterios de éxito de HU-03 |
| [`plan.md`](./005-trazabilidad-pedido/plan.md) | Decisiones técnicas (D-051 a D-054) y fases de entrega |
| [`data-model.md`](./005-trazabilidad-pedido/data-model.md) | `OrderStatusEventDto`/`OrderDetailDto`, sin cambio de esquema |
| [`contracts/`](./005-trazabilidad-pedido/contracts/) | Los tres endpoints de detalle y el contrato compartido |
| [`quickstart.md`](./005-trazabilidad-pedido/quickstart.md) | Puesta en marcha y los 12 pasos de validación funcional |
| [`tasks.md`](./005-trazabilidad-pedido/tasks.md) | 27 tareas ordenadas por historia |
| [`verificacion.md`](./005-trazabilidad-pedido/verificacion.md) | Resultado de la validación — sin defectos encontrados |

Fases de entrega: **A** contrato compartido (habilitante) → **B** HU-03 cliente, el MVP → **C**
HU-03 negocio → **D** HU-03 administrador, que extiende el reporte de HU-10 → **E** validación
funcional, que también cierra la verificación pendiente de HU-10.

**Por qué se da por terminada.** Las tres historias están construidas — tres endpoints `GET` de
solo lectura (`/orders/:id`, `/business/orders/:id`, `/admin/dashboard/orders/:id`) y tres
pantallas de detalle nuevas—, las dos capas automáticas pasan en verde —130 pruebas unitarias de
`services/api` más la suite completa de `apps/web`, y 76 baterías de integración contra
PostgreSQL real, incluidas las tres nuevas de esta épica—, y la **validación funcional se
ejecutó el 2026-08-23**, los 12 pasos de `quickstart.md`. **No encontró ningún defecto**: el
control de acceso (404 indistinguible para pedido ajeno o inexistente, mono-local sin filtro de
"negocio propietario", administrador sin restricción de pertenencia) se comportó exactamente
como especifica el contrato. El detalle está en
[`verificacion.md`](./005-trazabilidad-pedido/verificacion.md).

E4 no crea ninguna tabla ni escribe en el historial: expone por consulta lo que E2 ya escribe
desde `OrderStatusEvent` (append-only, Principio XII). Con V-11 y V-12 verificados, esta épica
también cierra la validación funcional que HU-10 (E1) tenía pendiente de las métricas y reportes
de pedidos.

Sigue fuera de v1: la auditoría formal de accesibilidad, heredada de E1/E3/E2/E9, y las
transiciones que agreguen E5 (reparto) y E7 (cierre) — el mecanismo de esta épica ya queda
preparado para mostrarlas sin cambios (FR-012), pero su verificación funcional espera a que esas
épicas existan.

## E9 · Navegación y experiencia visual

Rama de trabajo: `004-navegacion-por-rol`. Transversal — no participa del orden E1→E8 (ver más
arriba).

| Artefacto | Para qué sirve |
| --- | --- |
| [`spec.md`](./004-navegacion-por-rol/spec.md) | Requisitos, escenarios y criterios de éxito de HU-15/HU-16 |
| [`plan.md`](./004-navegacion-por-rol/plan.md) | Decisiones técnicas (`.tema-voz`, despacho por rol en `/menu`) y fases de entrega |
| [`research.md`](./004-navegacion-por-rol/research.md) | Las cinco decisiones D-001 a D-005 con su fundamento |
| [`data-model.md`](./004-navegacion-por-rol/data-model.md) | Sin entidades nuevas; documenta el `AddressDto` reutilizado de E2 |
| [`contracts/`](./004-navegacion-por-rol/contracts/) | Sin endpoints nuevos; referencia los dos de E2 que reutiliza |
| [`quickstart.md`](./004-navegacion-por-rol/quickstart.md) | Puesta en marcha y los 26 pasos de validación funcional |
| [`tasks.md`](./004-navegacion-por-rol/tasks.md) | 35 tareas ordenadas por historia |
| [`verificacion.md`](./004-navegacion-por-rol/verificacion.md) | Resultado de la validación — sin defectos encontrados |
| [`design/`](./004-navegacion-por-rol/design/) | Capturas del mockup decidido antes de escribir la spec |
| [`checklists/`](./004-navegacion-por-rol/checklists/) | Calidad de requisitos |

Fases de entrega: **A** navegación de cliente (HU-15) → **B** navegación de negocio (HU-15) →
**C** categorías del menú y despacho en `/menu` (HU-15) → **D** identidad visual (HU-16), que
aplica `.tema-voz` sobre los archivos que A-C ya crearon → **E** validación funcional → **F**
landing de cliente/negocio sin duplicar el encabezado (FR-016) → **G** identidad visual del
administrador (FR-017) — las últimas dos, enmiendas agregadas al usar la aplicación ya
verificada.

**Por qué se da por terminada.** Las dos historias están construidas, las 188 pruebas de
`apps/web` pasan en verde (incluidas las 5 suites nuevas de esta épica), `tsc`/`eslint`/el build
de producción están limpios, y la **validación funcional se ejecutó el 2026-08-19**, los 26
pasos de `quickstart.md`. **No encontró ningún defecto en su primera pasada** — a diferencia de
E1, E3 y E2; las dos correcciones posteriores las señaló el usuario al seguir usando la
aplicación, no la validación en sí, y ambas se resolvieron con una enmienda chica a la spec antes
de tocar el código:

- **FR-016**: `/cliente` y `/negocio` ahora redirigen a su pantalla principal en vez de mostrar
  una landing que duplicaba el encabezado.
- **FR-017**: el encabezado de administrador pasó al mismo patrón visual que cliente y negocio
  (marca, íconos, estado activo, `.tema-voz`), reemplazando la exclusión que la spec original le
  daba. Sus dos destinos (Panel, Usuarios) no cambiaron. La prueba nueva de este cambio encontró
  un bug propio antes de llegar a la app: `/admin` es prefijo de todas sus rutas, así que "Panel"
  quedaba activo también en `/admin/usuarios` con un `startsWith` ingenuo.

Dos pasos (V-14/V-15, patrón mobile) se confirmaron por revisión de código en vez de observación
visual en vivo, por una limitación de la herramienta de automatización de esa sesión; queda
anotado en `verificacion.md` como pendiente de una confirmación visual futura. El detalle está en
[`verificacion.md`](./004-navegacion-por-rol/verificacion.md).

Esta épica no crea entidades ni endpoints: reutiliza `GET /addresses` y
`PUT /addresses/:id/default`, ya construidos y probados en E2. `admin` y las pantallas del rol
repartidor quedan sin cambios, por decisión declarada (FR-015).

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
