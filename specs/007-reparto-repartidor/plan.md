# Plan de Implementación: E5 · Reparto (Asignación de pedido a repartidor)

**Rama**: `007-reparto-repartidor` | **Fecha**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/007-reparto-repartidor/spec.md`

## Resumen

E5 llena el único vacío real de la máquina de estados del pedido: hasta hoy no existe ningún
camino para que un pedido salga de `en_preparacion` hacia `asignado_repartidor`. El rol
`REPARTIDOR` existe desde E1 pero su pantalla es un placeholder sin acciones; `Order` no tiene
ninguna columna de repartidor.

El modelo es **autoservicio**: cualquier repartidor ve los pedidos `en_preparacion` sin
repartidor asignado y toma el que quiera, sin que el negocio intervenga. Un repartidor solo
puede tener un pedido a la vez, y puede devolverlo (soltar) si no puede completarlo — esta
última acción exigió **enmendar la constitución a v3.0.0** (Principio XII), porque es la primera
transición de retroceso de la máquina de estados.

Las cinco decisiones que gobiernan el diseño:

1. **Dos columnas nuevas en `Order`, sin tabla de asignación separada** (D-066): `deliveryUserId`
   y `assignedAt`, análogas a como `rejectionReason` ya vive en la misma fila desde E2.
2. **Un controlador nuevo, `DeliveryOrdersController` (`delivery/orders`), reutilizando
   `OrdersService`** (D-067): mismo criterio que separó `BusinessOrdersController` de
   `OrdersController` en E2 — cada rol tiene su propio controlador, ninguno bifurca lógica de
   acceso internamente.
3. **La concurrencia se resuelve con una escritura condicionada, respaldada por un índice único
   parcial** (D-068, D-069): mismo patrón que `transicionar()` de E2 (`updateMany` con `WHERE
   status = …`) para "tomar", y un `UNIQUE INDEX … WHERE status = 'asignado_repartidor'` sobre
   `delivery_user_id` — mismo mecanismo que ya usa `address_one_active_default_per_user_key` de
   E2 — para que "un repartidor, un pedido" sea una garantía de base de datos, no solo de la
   aplicación.
4. **El teléfono del cliente se expone en un DTO nuevo, no en `OrderSummaryDto`** (D-070):
   `DeliveryOrderDto` extiende `OrderSummaryDto` por composición, igual que `OrderDetailDto` lo
   hizo en E4, para no tocar los consumidores existentes de `OrderSummaryDto`.
5. **`registrarEvento` no necesita ningún cambio de código** (D-071): ya acepta `actorRole:
   Role` como parámetro genérico desde E2; E5 es simplemente su tercer y cuarto llamador
   (tomar, soltar). La generalización que E4 había anotado como pendiente resultó innecesaria al
   revisar el código real.

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios.

**Dependencias principales**: las ya presentes en el monorepo. **E5 no incorpora ninguna
dependencia nueva.**

**Almacenamiento**: PostgreSQL 16. **Una migración nueva**: dos columnas en `order`
(`delivery_user_id` nullable, `assigned_at` nullable) más una clave foránea hacia `user` y un
índice único parcial (ver `data-model.md`).

**Pruebas**: se hereda la disposición de E1–E4/E6. Unitarios con Vitest/Jest según paquete.
Integración con Jest en `services/api/test/`, contra PostgreSQL efímera en Docker — aquí es
donde se prueba la condición de carrera real (dos repartidores tomando el mismo pedido, un
repartidor intentando tomar un segundo pedido), que un test unitario con mocks no puede
demostrar.

**Plataforma objetivo**: navegador desde 360 px de ancho y contenedores Linux, igual que las
épicas anteriores.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` como BFF frente
a `services/api`. Sin cambios de arquitectura.

**Objetivos de rendimiento**: SC-001 (tomar un pedido en 1 clic) y SC-005 (un pedido soltado
vuelve a estar disponible en menos de 10 segundos) son los únicos objetivos temporales; ninguno
exige un SLO técnico nuevo — ambos son una escritura condicionada de una fila y una recarga
manual de la lista, sin sondeo en tiempo real (mismo criterio que el SC-004 de E2, que ya
estableció que "abrir o recargar la bandeja una vez" es suficiente sin notificaciones push,
explícitamente fuera de alcance también en esta épica).

**Restricciones**: mono-local (Principio VIII); sin geolocalización, notificaciones push, zonas
ni turnos; el nombre del cliente no se expone en esta épica (Principio X); las transiciones
`asignado_repartidor → entregado` y `entregado → cerrado` pertenecen a E7 y no se construyen
aquí.

**Escala/Alcance**: un controlador nuevo con cuatro endpoints (`GET .../available`, `GET
.../current`, `PUT .../:id/take`, `PUT .../:id/release`), dos columnas nuevas en `Order`, un DTO
nuevo en `packages/shared`, y una pantalla nueva reemplazando el placeholder de `/repartidor`.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Dos columnas en la tabla que ya existe, no una tabla de asignación nueva. Reutiliza `OrdersService`, `registrarEvento` y el patrón de escritura condicionada de E2 en vez de introducir un mecanismo de concurrencia propio. |
| **II · Idioma: todo en español** | Cuatro mensajes nuevos en `packages/shared/src/messages`; ninguna pantalla introduce texto suelto fuera de esa fuente. |
| **III · Cero alcance fantasma** | Sin zonas, turnos, geolocalización ni notificaciones — las cuatro exclusiones que la spec declara. La única transición nueva es la que HU-04 pide (`en_preparacion → asignado_repartidor`) más la de retroceso ya enmendada; `asignado_repartidor → entregado` queda intacta para E7. |
| **IV · Verificable por una persona no técnica** | `quickstart.md` recorre las seis SC desde la UI: tomar un pedido, ver que desaparece de la lista de otro repartidor, ver el teléfono solo en el pedido propio, soltarlo y verlo reaparecer. |
| **V · Datos del usuario con respeto** | El teléfono ya existe desde E1 (`User.phone`); esta épica no pide ni almacena ningún dato nuevo del cliente, solo lo expone a un rol que antes no lo veía. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E5 no interpreta voz; toda acción (tomar, soltar) es un botón. No hay vía "solo por voz" que dejar sin equivalente. |
| **VII · Entender la intención** | No aplica: sin lenguaje natural en esta épica. |
| **VIII · El catálogo y el stock son la única verdad, por local** | Sin cambios: E5 no toca catálogo ni stock. Mono-local: todos los repartidores ven la misma lista del único local. |
| **IX · Confirmar antes de actuar** | Tomar y soltar son acciones explícitas de un clic (FR-002, FR-008); no hay interpretación de lenguaje natural que confirmar. |
| **X · Privacidad y datos mínimos** | El teléfono del cliente se expone únicamente al repartidor con el pedido en curso, nunca en la lista de disponibles ni junto al nombre del cliente (Historia de Usuario 2, FR-007). |
| **XI · Calidad guiada por especificación (test-first)** | Los criterios de aceptación de las tres historias preceden al diseño; la condición de carrera (SC-002, SC-003) se traza a pruebas de integración específicas, no solo unitarias. |
| **XII · Trazabilidad del pedido de punta a punta** | **Requiere la enmienda 3.0.0** (ya ratificada, 2026-08-27): agrega `asignado_repartidor → en_preparacion` como única transición de retroceso, restringida al repartidor dueño del pedido. Sin esta enmienda, la Historia 3 (soltar pedido) violaría el principio. Cada transición nueva agrega su entrada de historial en la misma transacción, igual que E2. **PASS tras la enmienda.** |

### Estado de la enmienda constitucional

`.specify/memory/constitution.md` pasó de **2.0.0 a 3.0.0** el 2026-08-27, como parte de la
planificación de esta épica (no antes: la ambigüedad solo se hizo visible al diseñar la
Historia 3 contra la máquina de estados real). El Sync Impact Report del propio archivo
documenta el motivo y el alcance de la enmienda.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `research.md`, `data-model.md`, contratos y `quickstart.md`.
**PASS: sin violaciones constitucionales.** Se comprobó expresamente:

- `packages/shared/src/order-state/machine.ts` se actualiza para reflejar exactamente las seis
  transiciones vigentes de la constitución v3.0.0 — ni una más.
- El índice único parcial (D-069) impide, a nivel de base de datos, que un repartidor tenga dos
  pedidos en `asignado_repartidor` a la vez, incluso si un error de la aplicación lo permitiera.
- `DeliveryOrderDto` es una extensión aditiva de `OrderSummaryDto` (D-070); ningún consumidor
  existente de `OrderSummaryDto` (E2, E4, E9) se ve afectado.

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/007-reparto-repartidor/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D-066 a D-072
├── data-model.md         # Fase 1: columnas nuevas, migración, DTOs
├── quickstart.md         # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── api.md            # Cuatro endpoints nuevos de services/api
│   └── shared.md         # Tipos y mensajes nuevos de packages/shared
└── tasks.md              # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos y grupos que E5 crea o modifica.

```text
packages/shared/src/
├── order-state/
│   └── machine.ts                    # MODIFICADO · agrega la transición de retroceso (v3.0.0)
├── messages/
│   └── etiquetas.ts                  # MODIFICADO · cuatro mensajes nuevos (D-072)
├── types/
│   └── api.ts                        # MODIFICADO · agrega DeliveryOrderDto
└── index.ts                          # MODIFICADO · superficie pública

services/api/prisma/
├── schema.prisma                     # MODIFICADO · delivery_user_id, assigned_at, índice único parcial
└── migrations/
    └── <timestamp>_reparto/          # NUEVO

services/api/src/orders/
├── orders.service.ts                 # MODIFICADO · agrega tomar/soltar/listas (registrarEvento no cambia, D-071)
└── delivery-orders.controller.ts     # NUEVO · GET .../available, GET .../current, PUT .../take, .../release

apps/web/src/app/repartidor/
├── page.tsx                          # MODIFICADO · reemplaza el placeholder por la pantalla real
└── _components/
    ├── pedidos-disponibles.tsx       # NUEVO
    └── pedido-en-curso.tsx           # NUEVO

services/api/test/
└── delivery-orders-*.integration-spec.ts  # NUEVO · concurrencia, un-pedido-a-la-vez, soltar
```

**Decisión de estructura**: no se crea ningún módulo NestJS nuevo — `DeliveryOrdersController` se
agrega a `OrdersModule`, que ya declara `OrdersService`, igual que `BusinessOrdersController` lo
hizo en E2. La pantalla del repartidor sigue el mismo patrón de `negocio/pedidos/page.tsx`
(lista + acción por fila), sin un layout nuevo (E9 ya dejó `admin`/`repartidor` sin header propio
por decisión declarada, FR-015 de `004-navegacion-por-rol`).

## Fases de entrega

### Fase A · Cimientos (habilitante)

Enmienda constitucional (ya ratificada), migración de `Order` (dos columnas + índice único
parcial), actualización de `machine.ts`, y el DTO/mensajes nuevos en `packages/shared`. Sin
esta fase no hay dónde escribir la asignación.

### Fase B · Historia 1 — Repartidor toma un pedido disponible (P1, MVP)

`GET /delivery/orders/available`, `PUT /delivery/orders/:id/take`, generalización de
`registrarEvento`. Cubre FR-001 a FR-006, FR-010 a FR-013 (parcial).

### Fase C · Historia 2 — Repartidor consulta su pedido en curso (P2)

`GET /delivery/orders/current`, incluido el teléfono del cliente. Cubre FR-007.

### Fase D · Historia 3 — Repartidor suelta un pedido (P3)

`PUT /delivery/orders/:id/release`. Cubre FR-008, FR-009.

### Fase E · Pantalla del repartidor

Reemplaza `apps/web/src/app/repartidor/page.tsx`. Integra las tres fases anteriores en una sola
vista: lista de disponibles + pedido en curso con su acción de soltar. Cubre FR-013.

### Fase F · Validación funcional

Ejecutar `quickstart.md` completo (SC-001 a SC-007) con al menos dos repartidores reales,
incluida la condición de carrera de la Historia 1 y la verificación de que la trazabilidad de
E4 muestra las transiciones nuevas sin cambios de contrato (SC-006).

## Complexity Tracking

> Sin violaciones sin justificar — la enmienda constitucional ya se resolvió como Sync Impact
> Report en `.specify/memory/constitution.md`, no como una excepción de este plan.

| Violación | Por qué hace falta | Alternativa más simple descartada |
|-----------|---------------------|-------------------------------------|
| Transición de retroceso `asignado_repartidor → en_preparacion` (única excepción a "sin retrocesos" del Principio XII) | La Historia 3 (soltar un pedido) la necesita; sin ella, un imprevisto del repartidor bloquea el pedido hasta que exista E7 | Quitar la Historia 3 del alcance: descartada por el usuario al resolver la clarificación — un pedido bloqueado indefinidamente por un repartidor que no puede salir es peor que una única transición de retroceso, acotada y documentada |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Dos repartidores toman el mismo pedido en una carrera real (dos escrituras casi simultáneas) | Alto: dos repartidores creyendo tener el mismo pedido | `updateMany` condicionado (`WHERE status = 'en_preparacion' AND delivery_user_id IS NULL`) como en `transicionar()` de E2; solo una escritura afecta una fila, la otra recibe `count: 0` y un mensaje claro |
| Un repartidor toma dos pedidos casi al mismo tiempo desde dos pestañas | Medio: viola FR-004 | Índice único parcial (`delivery_user_id` único mientras `status = 'asignado_repartidor'`) como respaldo de base de datos, no solo una comprobación previa de la aplicación que podría perder la misma carrera |
| Confundir "pedido no existe" con "ya no está disponible" o "no es tuyo" en los mensajes de error | Bajo: mensajes confusos, no fuga de datos (los pedidos ya son visibles para todo repartidor, a diferencia del historial de E4) | Tres códigos de error distintos y explícitos (`DELIVERY_ORDER_ALREADY_ASSIGNED`, `DELIVERY_ALREADY_HAS_ORDER`, `DELIVERY_ORDER_NOT_YOURS`), cada uno con su mensaje propio — no hace falta ocultar existencia aquí como sí hace E4 |
| Olvidar actualizar `machine.ts` al implementar, dejando la transición de retroceso solo declarada en la constitución pero no en el código | Alto: `esTransicionValida` seguiría rechazando la transición que la constitución ya permite | Tarea explícita en Fase A; prueba unitaria de `machine.ts` que verifica las seis transiciones exactas de la v3.0.0 |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| Migración, `machine.ts`, DTO y mensajes nuevos | A |
| FR-001 a FR-006, FR-010, FR-011, FR-012 | B |
| FR-007 | C |
| FR-008, FR-009 | D |
| FR-013 | E |
| SC-001 a SC-007 | F |

Los siete criterios de éxito se trazan uno a uno en `quickstart.md`.
