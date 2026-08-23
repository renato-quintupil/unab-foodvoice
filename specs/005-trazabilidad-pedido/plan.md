# Plan de Implementación: E4 · Trazabilidad del pedido

**Rama**: `005-trazabilidad-pedido` | **Fecha**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/005-trazabilidad-pedido/spec.md`

## Resumen

E4 no crea ningún dato nuevo: **expone por consulta lo que E2 ya escribe**. `OrderStatusEvent`
es append-only desde E2 (creación + las dos transiciones alcanzables hoy) y no tiene endpoint,
DTO ni pantalla. Esta épica agrega exactamente eso — sin migración de base de datos — para las
tres historias de usuario: cliente (P1), negocio (P2) y administrador (P3, extendiendo HU-10).

Las cuatro decisiones que gobiernan el diseño:

1. **Un tipo de detalle, tres endpoints.** `OrderDetailDto` (`OrderSummaryDto` + `history`) es el
   mismo para las tres historias; lo que cambia es la autorización de cada endpoint, no la forma
   de la respuesta (D-051).
2. **Reutiliza los prefijos de ruta que E2 ya definió** (`/orders`, `/business/orders`) en vez de
   crear un cuarto endpoint compartido: `GET /orders/:id` (cliente) y `GET /business/orders/:id`
   (negocio) viven en los controladores que ya existen. El admin gana `GET
   /admin/dashboard/orders/:id` dentro de `DashboardController`, que ya expone `GET
   .../orders` (D-052).
3. **v1 es mono-local (Principio VIII): no hay restricción de "negocio propio".** Cualquier
   cuenta `NEGOCIO` gestiona el único local, así que su endpoint solo verifica el rol — no un
   identificador de negocio que no existe en el esquema. Esto corrigió una premisa incorrecta
   que tenía la spec original (ver `checklists/requirements.md`).
4. **El "quién actuó" del historial es el nombre del usuario, no un identificador técnico.** El
   rol ya tiene etiqueta compartida (`ETIQUETA_ROL`, de E1); el nombre reutiliza `User.fullName`,
   un dato que el sistema ya guarda y ya muestra en el panel de administración — no es una
   recolección nueva (Principio V).

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios.

**Dependencias principales**: las ya presentes en el monorepo. **E4 no incorpora ninguna
dependencia nueva.**

**Almacenamiento**: PostgreSQL 16. **Sin migración**: `order_status_event` y su índice
(`order_id, occurred_at, id`) ya existen desde E2 y ya están pensados para esta consulta (el
comentario del propio esquema lo dice: "Deja preparado el orden estable de consulta de E4, sin
exponerla en E2"). E4 solo lee.

**Pruebas**: se hereda la disposición de E1/E2/E3. Unitarios con Vitest/Jest según paquete.
Integración con Jest en `services/api/test/`, contra PostgreSQL efímera en Docker — aquí es
donde se prueba el control de acceso (cliente ajeno, pedido inexistente) y el orden cronológico
de la secuencia devuelta, que es lo único con lógica real de esta épica.

**Plataforma objetivo**: navegador desde 360 px de ancho y contenedores Linux, igual que las
épicas anteriores.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` como BFF frente
a `services/api`. Sin cambios de arquitectura.

**Objetivos de rendimiento**: SC-001 (ver el historial en menos de 10 segundos) y SC-004 (llegar
al detalle desde el reporte de admin en no más de dos acciones) son los únicos objetivos
temporales vigentes; ninguno exige un SLO técnico nuevo — la consulta es un `SELECT` indexado
sobre una tabla que en v1 tiene como máximo dos filas por pedido.

**Restricciones**: mono-local (Principio VIII); sin geolocalización ni seguimiento en tiempo
real; sin notificaciones; el historial es de solo lectura — ningún endpoint de esta épica
escribe en `order_status_event`; las transiciones que agreguen E5/E7 deben poder aparecer en la
misma consulta sin cambiarla (FR-012).

**Escala/Alcance**: tres endpoints nuevos (`GET /orders/:id`, `GET /business/orders/:id`, `GET
/admin/dashboard/orders/:id`) y tres pantallas nuevas de detalle (`/cliente/pedidos/[id]`,
`/negocio/pedidos/[id]`, `/admin/pedidos/[id]`), más los enlaces que las conectan desde las
pantallas ya existentes.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Sin dependencias ni tablas nuevas. Un solo tipo de DTO de detalle reutilizado por los tres roles; sin servicio de historial separado, sin paginación (máximo 2 entradas hoy). |
| **II · Idioma: todo en español** | `ETIQUETA_ROL` y `ETIQUETA_ESTADO_PEDIDO` ya existen y se reutilizan sin duplicar; ninguna pantalla nueva introduce texto suelto fuera de `packages/shared/src/messages`. |
| **III · Cero alcance fantasma** | No se dispara ninguna transición nueva (asignado_repartidor, entregado, cerrado quedan para E5/E7). No se agrega geolocalización, notificaciones ni auditoría de accesos a la trazabilidad — las tres exclusiones que la spec declara explícitamente. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre las cuatro SC desde la UI: abrir un pedido y ver su línea de tiempo, ver el motivo de un rechazo, comprobar que un pedido ajeno da 404, y llegar al detalle desde el reporte de admin en dos clics. |
| **V · Datos del usuario con respeto** | No se pide ni almacena ningún dato nuevo: `actorName` reutiliza `User.fullName`, ya guardado desde E1. Sin variables de entorno nuevas. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E4 no interpreta voz. Las tres pantallas son manuales por diseño (E6 no existe todavía); no hay una vía "solo por voz" que dejar sin equivalente. |
| **VII · Entender la intención** | No aplica: sin lenguaje natural en esta épica. |
| **VIII · El catálogo y el stock son la única verdad, por local** | E4 confirma en el diseño mismo que v1 es mono-local: el endpoint de negocio no filtra por negocio porque no hay más de uno (decisión 3 de este plan). No toca catálogo ni stock. |
| **IX · Confirmar antes de actuar** | No aplica: E4 es de solo lectura, no hay acción que confirmar. |
| **X · Privacidad y datos mínimos** | Sin geolocalización, sin audio, sin dato nuevo recolectado (ver Principio V). |
| **XI · Calidad guiada por especificación (test-first)** | Los criterios de aceptación de las tres historias preceden al diseño; se trazan a pruebas de integración (control de acceso, orden cronológico) y a los pasos de `quickstart.md`. |
| **XII · Trazabilidad del pedido de punta a punta** | E4 es la contraparte de lectura del historial append-only que el Principio XII exige: no lo modifica, no le agrega escritura, y su contrato de lectura queda preparado para las transiciones que E5/E7 agregarán sin requerir cambios (FR-012). **PASS.** |

### Estado de la enmienda constitucional

`.specify/memory/constitution.md` sigue en versión **2.0.0** (2026-08-17); E4 no requiere
ninguna enmienda porque no cambia la máquina de estados ni el contrato de historial, solo lo
consulta.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, contratos y `quickstart.md`.
**PASS: sin violaciones constitucionales.** Se comprobó expresamente:

- Ningún artefacto de Fase 1 introduce escritura sobre `order_status_event`.
- El endpoint de negocio (D-052) no incorpora ningún campo ni tabla de "negocio propietario":
  la ausencia es deliberada, no un olvido pendiente de otra épica.
- `OrderDetailDto` es una extensión aditiva de `OrderSummaryDto` (agrega `history`), así que
  ningún consumidor existente de `OrderSummaryDto` (E2, E9) se ve afectado.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/005-trazabilidad-pedido/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D-051 a D-054
├── data-model.md         # Fase 1: DTOs nuevos, sin cambio de esquema
├── quickstart.md         # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── api.md            # Tres endpoints nuevos de services/api
│   └── shared.md         # Tipos nuevos de packages/shared
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos y grupos que E4 crea o modifica. Ningún archivo de E1/E2/E3/E9 se
elimina ni cambia de forma más allá de lo indicado.

```text
packages/shared/src/
├── types/
│   └── api.ts                        # MODIFICADO · agrega OrderStatusEventDto, OrderDetailDto
└── index.ts                          # MODIFICADO · superficie pública

services/api/
└── src/
    ├── orders/
    │   ├── orders.controller.ts          # MODIFICADO · GET /orders/:id
    │   ├── business-orders.controller.ts # MODIFICADO · GET /business/orders/:id
    │   └── orders.service.ts             # MODIFICADO · detalle + historial, reusa registrarEvento
    └── dashboard/
        ├── dashboard.controller.ts       # MODIFICADO · GET /admin/dashboard/orders/:id
        └── dashboard.service.ts          # MODIFICADO · detalle sin restricción de pertenencia

apps/web/src/app/
├── cliente/pedidos/
│   ├── page.tsx                          # MODIFICADO · enlaza a /cliente/pedidos/[id]
│   └── [id]/page.tsx                     # NUEVO · línea de tiempo del pedido
├── negocio/pedidos/
│   ├── page.tsx                          # MODIFICADO · enlaza a /negocio/pedidos/[id]
│   ├── rechazados/page.tsx               # MODIFICADO · enlaza a /negocio/pedidos/[id]
│   └── [id]/page.tsx                     # NUEVO · misma línea de tiempo, vista de negocio
└── admin/pedidos/
    ├── page.tsx                          # MODIFICADO · enlaza a /admin/pedidos/[id]
    └── [id]/page.tsx                     # NUEVO · detalle sin restricción de pertenencia

services/api/test/
└── orders-history-*.integration-spec.ts  # NUEVO · control de acceso, 404 indistinguible, orden
```

**Decisión de estructura**: no se crea ningún módulo nuevo. El historial se resuelve dentro de
`OrdersService` (cliente/negocio) y `DashboardService` (admin), reutilizando el helper privado
`registrarEvento`/las tablas ya mapeadas — E4 solo agrega los métodos de lectura simétricos.
Cada pantalla de detalle es una ruta dinámica `[id]` nueva, siguiendo el mismo patrón que
`cliente/direcciones/[id]/editar` (E2) y `admin/usuarios/[id]/editar` (E1).

## Fases de entrega

### Fase A · Contrato compartido (habilitante)

Agregar `OrderStatusEventDto` y `OrderDetailDto` a `packages/shared/src/types/api.ts`. Sin
cambios de esquema Prisma ni de enums — no hay Fase de "cimientos" con migración, a diferencia
de E2/E3.

### Fase B · HU-03 (cliente) — Historia 1, P1

`GET /orders/:id` en `OrdersController` y el método de servicio correspondiente. Pantalla
`/cliente/pedidos/[id]`. Enlace desde `/cliente/pedidos`. Cubre FR-001 a FR-003, FR-005,
FR-007, FR-010, FR-011.

### Fase C · HU-03 (negocio) — Historia 2, P2

`GET /business/orders/:id` en `BusinessOrdersController`. Pantalla `/negocio/pedidos/[id]`.
Enlaces desde `/negocio/pedidos` y `/negocio/pedidos/rechazados`. Cubre FR-004, FR-008.

### Fase D · HU-03 (admin) — Historia 3, P3

`GET /admin/dashboard/orders/:id` en `DashboardController`. Pantalla `/admin/pedidos/[id]`.
Enlace desde cada fila de `/admin/pedidos`. Cubre FR-006, FR-009.

### Fase E · Validación funcional

Ejecutar `quickstart.md` completo (SC-001 a SC-004) con un cliente, un negocio y un
administrador reales, sobre pedidos en `creado`, `en_preparacion` y `rechazado`. Esta fase
también cierra la verificación funcional pendiente de HU-10 (FR-019, FR-020, SC-006 de
`specs/001-acceso-y-usuarios/spec.md`), que esperaba a que existieran pedidos con historial
real.

## Complexity Tracking

La puerta constitucional pasa sin violaciones que justificar. No hay tabla de excepciones.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir "no existe" con "no autorizado" en el endpoint de cliente y filtrar información por el código de error | Medio: fuga de información sobre pedidos ajenos | Un único `noEncontrado()` (ya existe en `common/errors`) para ambos casos, igual que el resto de la API; prueba de integración específica |
| Que el endpoint de negocio quede filtrando por un campo de "negocio propietario" que no existe, rompiendo en producción | Alto: 404 para todo pedido en mono-local | Sin filtro de pertenencia en el servicio — solo el guard de rol; prueba de integración que un negocio ve un pedido creado por cualquier cliente |
| Duplicar la traducción de `OrderStatus`/`Role` de Prisma a compartido en el nuevo método de historial | Bajo: inconsistencia si `A_COMPARTIDO` cambia en un solo lugar | Reutilizar los mapas `A_COMPARTIDO`/`A_PRISMA` ya definidos en `orders.service.ts`, no duplicarlos |
| Que `OrderDetailDto` rompa algún consumidor existente de `OrderSummaryDto` | Bajo | `OrderDetailDto` extiende por composición (`OrderSummaryDto & { history }`), no modifica el tipo existente |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Tipos compartidos `OrderStatusEventDto`, `OrderDetailDto` | A |
| FR-001, FR-002, FR-003, FR-005, FR-007, FR-010, FR-011 | B |
| FR-004, FR-008 | C |
| FR-006, FR-009 | D |
| FR-012 (verificado por diseño, no por transición disparada); SC-001 a SC-004 | E |

Los cuatro criterios de éxito se trazan uno a uno en `quickstart.md`.
