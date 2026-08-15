# Plan de Implementación: E1 · Acceso y usuarios

**Rama**: `main` (sin rama dedicada) | **Fecha**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la épica E1 (HU-08 Autenticación y sesión, HU-09 Gestión de usuarios y roles, HU-10 Panel y reportes del administrador) más las decisiones de stack acordadas en la sesión de planificación del 2026-08-15.

**Artefactos de diseño**: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

---

## Resumen

E1 entrega el cimiento de identidad de FoodVoice: un padrón de usuarios con rol gestionado por el administrador, un mecanismo de autenticación y sesión que reconoce ese rol en cada acción, y un panel de solo lectura para el administrador.

El enfoque técnico se apoya en cuatro decisiones que se derivan directamente de los requisitos, no de preferencias de moda:

1. **Sesión con estado en PostgreSQL, con identificador opaco en cookie `httpOnly`**. FR-024 exige invalidar sesiones *en el instante* en que un usuario se desactiva; sin estado en servidor eso es imposible de garantizar, y con JWT solo es aproximable a costa de una lista de revocación —es decir, estado de todos modos, más complejidad (Principio I).
2. **`packages/shared` con Zod como fuente única de contratos**. Reglas como el mínimo de 8 caracteres (FR-032), el conjunto cerrado de roles (RN-001) y los mensajes fijos en español (FR-008, SC-018) se declaran una sola vez y se aplican en ambos lados. SC-018 exige literalmente que dos mensajes sean idénticos palabra por palabra: la única forma robusta de garantizarlo es que sean la misma constante.
3. **Next.js como BFF**. El navegador solo habla con Next.js, que reenvía a NestJS por la red interna de Docker. La cookie queda same-origin: sin CORS, sin token accesible desde JavaScript, sin NestJS expuesto a Internet.
4. **El rol se congela en la sesión**. FR-011 establece que un cambio de rol rige desde el próximo inicio de sesión. Leer el rol de la fila `session` implementa la regla por construcción, en lugar de simularla con comprobaciones repartidas.

El stack propuesto por el usuario (Next.js + React + TypeScript + TailwindCSS + shadcn/ui; NestJS + TypeScript; PostgreSQL; monorepo; Docker; tests unitarios) **es plenamente aplicable a esta épica**; la verificación consta en la sección "Validación del stack propuesto".

---

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5.x sobre Node.js 22 LTS, con `strict: true` en los tres paquetes

**Dependencias principales**:

- Frontend: Next.js 15 (App Router), React 19, TailwindCSS 4, shadcn/ui, react-hook-form + `@hookform/resolvers/zod`
- Backend: NestJS 11, Prisma 6, bcrypt, Zod
- Compartido: Zod 3 (única dependencia de producción del paquete)

**Almacenamiento**: PostgreSQL 16, accedido con Prisma. Migraciones versionadas con `prisma migrate`.

**Pruebas**: Jest + `@nestjs/testing` (unitarios de backend), Vitest + Testing Library (frontend y paquete compartido), Jest + Supertest contra PostgreSQL efímera en Docker (integración de API).

**Umbrales de cobertura** (hacen fallar `pnpm test` si no se cumplen): 90 % de líneas y ramas en `services/api/src/{auth,users,audit}`, 100 % de líneas en `packages/shared`, 80 % en el resto de `services/api`, 70 % en `apps/web`. La justificación de cada umbral y su verificación están en [quickstart.md](./quickstart.md).

**Plataforma objetivo**: navegador de escritorio y móvil (spec § Supuestos: plataforma web, sin app nativa en v1); servidor Linux en contenedores para el despliegue.

**Tipo de proyecto**: aplicación web en monorepo — frontend, backend y paquete de dominio compartido.

**Objetivos de rendimiento**: inicio de sesión y carga del panel por debajo de 5 segundos en condiciones normales de red (SC-001, SC-007). Con el volumen de v1 (un solo local) no hay presión de rendimiento; la consulta de sesión por petición es despreciable.

**Restricciones**:

- Ninguna credencial ni secreto en el repositorio (Principio V, FR-007, FR-016, FR-028)
- Todo texto visible al usuario en español (Principio II)
- Sin entidad `Pedido` en esta épica (Principio III); solo la máquina de estados compartida (FR-023, D-012)
- La sesión debe poder revocarse de forma inmediata y transaccional (FR-024)

**Escala/Alcance**: v1 mono-local. Aproximadamente 12 endpoints, 4 tablas, 8 pantallas (login, cuatro inicios por rol, listado de usuarios, formulario de usuario, panel).

---

## Validación del stack propuesto

Verificación explícita solicitada por el usuario: cada tecnología, contrastada con lo que esta épica necesita.

| Tecnología | Veredicto | Fundamento |
|---|---|---|
| **Next.js 15 (App Router)** | Aplicable | Su `middleware.ts` cubre la protección de rutas por rol (FR-003) y sus Route Handlers permiten el patrón BFF que mantiene la cookie same-origin (D-006). Los Server Components reducen el JavaScript enviado al navegador en las vistas de listado. |
| **React 19** | Aplicable | Requisito de Next.js 15. Nada en esta épica lo cuestiona. |
| **TypeScript** | **Necesario, no solo aplicable** | Es lo que hace posible compartir contratos de dominio entre frontend y backend. Sin un lenguaje común, el requisito de `packages/shared` no tiene sentido. |
| **TailwindCSS 4** | Aplicable | Suficiente para 8 pantallas de formularios y tablas. Sin objeciones. |
| **shadcn/ui** | Aplicable, con una ventaja concreta | Sus componentes `Dialog` y `AlertDialog` resuelven directamente las confirmaciones antes de acciones de impacto que exige FR-035 y el Principio IX. Al copiarse al repositorio en lugar de instalarse, los textos se escriben en español de origen (Principio II). Su base accesible (Radix) ayuda al Principio IV. |
| **NestJS 11** | Aplicable, con una ventaja concreta | Sus guards por decorador (`@Roles(...)`) hacen que la autorización por rol sea declarativa y que su **ausencia sea visible** en la revisión de código — importante cuando FR-003, FR-018 y SC-003/SC-008 exigen bloqueo del 100 %. Sus interceptores centralizan el formato de error en español. |
| **PostgreSQL 16** | Aplicable, con una ventaja concreta | La restricción `UNIQUE` sobre el correo hace cumplir FR-017/RN-005 en el motor, incluso ante peticiones concurrentes, en lugar de depender de una comprobación previa en el código. Las transacciones garantizan FR-024 y FR-030 (rechazo íntegro, sin cambios parciales). |
| **Monorepo** | Aplicable | Es la condición para que `packages/shared` sea una dependencia real y no código duplicado. |
| **Docker** | Aplicable | Además del despliegue, habilita los tests de integración contra una PostgreSQL real, que son los únicos que verifican de verdad FR-017, FR-024 y FR-030 (D-009). |
| **Tests unitarios** | Aplicable, **e insuficientes por sí solos** | Ver la reserva de más abajo. |

### Reserva declarada sobre el alcance de las pruebas

Los tests unitarios cubren bien la lógica de decisión: el conteo de intentos fallidos, la validación de los esquemas, los guards, el renderizado condicional. Pero cuatro requisitos de esta épica **no quedan verificados por un test unitario**, porque lo que garantiza su cumplimiento no es el código de la aplicación sino el motor de base de datos:

- **FR-017 / RN-005** (unicidad del correo, también entre desactivados): con un repositorio simulado se prueba el doble, no la restricción.
- **FR-024** (revocación inmediata de sesiones al desactivar): depende de que ambas escrituras ocurran en la misma transacción.
- **FR-030** (rechazo íntegro sin cambios parciales): es literalmente una propiedad transaccional.
- **FR-033** (bloqueo temporal): depende de la atomicidad del incremento del contador ante intentos concurrentes.

Por eso el plan incorpora una capa de integración de API contra PostgreSQL efímera en Docker, además de los unitarios pedidos. No sustituye a los unitarios: los complementa en los cuatro puntos donde son estructuralmente ciegos.

### Ajustes al enunciado original

| Enunciado | Ajuste | Motivo |
|---|---|---|
| `package/shared` | `packages/shared` | Convención estándar del ecosistema (pnpm, Turborepo, npm workspaces). La carpeta está vacía; el cambio no tiene costo. |
| `services` | `services/api` | Un único backend NestJS monolítico con módulos internos. El plural de `services/` deja lugar futuro sin anticipar complejidad hoy (Principio I). |

---

## Constitution Check

*Puerta obligatoria antes de la Fase 0, reevaluada tras la Fase 1.*

| Principio | Evaluación | Cómo lo satisface el diseño |
|---|---|---|
| **I · Simplicidad ante todo** | ✅ Cumple | Sesión con estado en lugar de JWT con rotación; un backend monolítico en vez de servicios por dominio; expiración pasiva sin procesos programados; normalización de búsqueda en la aplicación en lugar de extensiones del motor. Cada elección es la más simple que satisface el requisito. |
| **II · Idioma: todo en español** | ✅ Cumple | Todos los textos visibles se declaran en español en `packages/shared` y en los esquemas Zod. Los identificadores técnicos siguen en inglés, como el propio principio autoriza. Los errores de la API llevan `code` técnico y `message` en español. |
| **III · Cero alcance fantasma** | ✅ Cumple | No se crea la entidad `Pedido`: solo el enum de estados que FR-023 obliga a consumir (D-012). No hay autorregistro (FR-025), ni recuperación por autoservicio, ni exportación, ni vista del registro administrativo. Cada endpoint del contrato se remite a un FR. |
| **IV · Verificable por una persona no técnica** | ⚠️ Cumple con excepción declarada | `quickstart.md` recorre A, B y C con la aplicación, sin leer código ni logs. La sección D recoge las dos excepciones acotadas que la propia spec declara en SC-010 (registro administrativo sin vista, FR-034; resguardo de credenciales, FR-007/FR-016/FR-028) — ver Complexity Tracking. |
| **V · Datos del usuario con respeto** | ✅ Cumple | Solo los cuatro datos que FR-009 exige. Contraseñas con bcrypt coste 12; jamás en respuestas, logs ni bitácora. Secretos en `.env`, ignorado por git; la semilla falla en vez de recurrir a una credencial por defecto (D-010). |
| **VI · Voz primero, paridad manual** | ➖ No aplica | Esta épica no tiene interacción por voz. El Principio X refuerza que la voz nunca forma parte de la autenticación (spec § Fuera de Alcance). Aplicará en E6. |
| **VII · Entender la intención** | ➖ No aplica | Sin lenguaje natural en E1. |
| **VIII · Catálogo y stock como única verdad** | ➖ No aplica | Sin catálogo en E1. |
| **IX · Confirmar antes de actuar y poder deshacer** | ✅ Cumple | FR-035 se implementa con `AlertDialog` de shadcn/ui en las cuatro acciones de impacto, indicando a quién afectan y qué efecto tienen. La cancelación no abre transacción alguna, así que tampoco deja rastro en la bitácora. |
| **X · Privacidad y datos mínimos** | ✅ Cumple | Sin micrófono, sin audio, sin datos biométricos. Sin direcciones en esta épica. Solo los datos operativos imprescindibles. |
| **XI · Calidad guiada por especificación** | ✅ Cumple | La spec ya trae los Gherkin de las tres historias. `quickstart.md` los traduce en pasos verificables y `contracts/` fija el comportamiento esperado **antes** de programar. |
| **XII · Trazabilidad de punta a punta** | ✅ Cumple | La máquina de estados se declara única y compartida en `packages/shared`, sin estados propios (FR-023). El `admin_audit_log` es de solo-agregar, aplicando el mismo criterio de historial no editable del principio a las acciones administrativas. |

**Veredicto**: la puerta se aprueba. La única desviación —la excepción al Principio IV— ya venía declarada y justificada en la propia spec (supuesto 13, SC-010) y se documenta en Complexity Tracking.

**Reevaluación posterior a la Fase 1**: el diseño de `data-model.md` y `contracts/` no introduce ninguna desviación adicional. Se mantiene el veredicto.

---

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/001-acceso-y-usuarios/
├── spec.md              # Especificación (ya existente)
├── plan.md              # Este archivo
├── research.md          # Fase 0 · 13 decisiones técnicas
├── data-model.md        # Fase 1 · entidades, transiciones, esquema Prisma
├── quickstart.md        # Fase 1 · puesta en marcha y validación funcional
├── contracts/
│   ├── README.md        #   principios comunes
│   ├── api.md           #   endpoints HTTP de services/api
│   └── shared.md        #   contratos de dominio de packages/shared
├── checklists/          # Calidad de requisitos (ya existente)
└── tasks.md             # Fase 2 · lo genera /speckit-tasks
```

### Código fuente (raíz del repositorio)

```text
├── apps/
│   └── web/                              # Next.js 15 · App Router
│       ├── src/
│       │   ├── app/
│       │   │   ├── login/                #   inicio de sesión (FR-001)
│       │   │   ├── cliente/              #   inicio mínimo por rol (FR-031)
│       │   │   ├── negocio/
│       │   │   ├── repartidor/
│       │   │   ├── admin/
│       │   │   │   ├── page.tsx          #     panel · HU-10
│       │   │   │   └── usuarios/         #     padrón · HU-09
│       │   │   └── api/                  #   Route Handlers · proxy BFF (D-006)
│       │   ├── components/
│       │   │   └── ui/                   #   shadcn/ui
│       │   ├── lib/
│       │   └── middleware.ts             #   protección de rutas por rol
│       ├── tests/                        # Vitest + Testing Library
│       └── Dockerfile
│
├── services/
│   └── api/                              # NestJS 11
│       ├── src/
│       │   ├── auth/                     #   HU-08 · login, logout, me
│       │   ├── users/                    #   HU-09 · CRUD, roles, estado
│       │   ├── dashboard/                #   HU-10 · métricas y reportes
│       │   ├── audit/                    #   FR-034 · bitácora solo-agregar
│       │   ├── common/                   #   guards, pipes, filtros de error
│       │   └── prisma/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts                   #   FR-028 · admin semilla
│       ├── test/                         # Jest + Supertest · integración
│       └── Dockerfile
│
├── packages/
│   └── shared/                           # Contratos de dominio (D-005)
│       ├── src/
│       │   ├── enums/
│       │   ├── schemas/                  #   Zod: validación + tipos
│       │   ├── messages/                 #   textos fijos en español
│       │   ├── order-state/              #   máquina de estados (D-012)
│       │   └── types/
│       └── tests/                        # Vitest
│
├── docker-compose.yml                    # postgres + api + web
├── docker-compose.test.yml               # postgres efímera para integración
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

**Decisión de estructura**: monorepo pnpm con tres espacios de trabajo, respetando la definición de carpetas del usuario con los dos ajustes ya justificados (`packages/` en plural, backend en `services/api`).

La separación no es decorativa. `packages/shared` **no puede depender** de `apps/web` ni de `services/api`, y el aislamiento estricto de pnpm lo hace cumplir en tiempo de instalación en lugar de por disciplina. Esa restricción es lo que garantiza que el paquete compartido siga siendo ejecutable tanto en el navegador como en Node — condición sin la cual el contrato compartido deja de servir.

---

## Fases de entrega

Alineadas con las prioridades de la spec: cada historia es verificable de forma independiente.

### Fase A · Cimientos (habilitante)

Monorepo pnpm + Turborepo, TypeScript estricto, `packages/shared` con enums, esquemas, mensajes y máquina de estados; esqueletos de Next.js y NestJS; `schema.prisma` y primera migración; `docker-compose.yml`; semilla del administrador (FR-028); pipeline de tests en los tres paquetes.

**Verificable cuando**: `docker compose up` levanta los tres servicios, la migración se aplica, la semilla crea el administrador y `pnpm test` pasa.

### Fase B · HU-08 · Autenticación y sesión (P1)

Módulo `auth`, tabla `session`, `SessionGuard` y `RolesGuard`, control de intentos fallidos, las tres rutas de autenticación, pantalla de inicio de sesión, `middleware.ts` y las cuatro páginas de inicio por rol (FR-031).

**Verificable cuando**: pasan todos los pasos de la sección A de `quickstart.md`, usando solo el administrador semilla.

### Fase C · HU-09 · Gestión de usuarios y roles (P2)

Módulo `users` con los seis endpoints, módulo `audit` (FR-034), listado con búsqueda, filtros y paginación, formularios de alta y edición, y los diálogos de confirmación de FR-035.

**Verificable cuando**: pasan todos los pasos de la sección B de `quickstart.md`.

### Fase D · HU-10 · Panel y reportes (P3)

Módulo `dashboard`, métricas de usuarios activos por rol, superficie de reportes de pedidos con filtros y mensaje de "sin datos", panel estrictamente de solo lectura.

**Verificable cuando**: pasan todos los pasos de la sección C de `quickstart.md`, con la salvedad ya declarada de que las métricas de pedidos permanecen vacías hasta E4/E2.

---

## Complexity Tracking

| Desviación | Por qué es necesaria | Alternativa más simple, y por qué se rechazó |
|---|---|---|
| **Excepción al Principio IV**: FR-034 (registro administrativo) y FR-007/FR-016/FR-028 (resguardo de credenciales) no son verificables por una persona no técnica desde la aplicación | Ya declarada y justificada en la propia spec (supuesto 13, SC-010). El registro no tiene vista en v1 por decisión de alcance, y el almacenamiento de credenciales no es observable por naturaleza | Construir una vista de la bitácora: sería alcance no especificado (Principio III). Mostrar indicios del almacenamiento de credenciales en pantalla: sería en sí mismo una debilidad de seguridad |
| **Capa de tests de integración** además de los unitarios solicitados | FR-017, FR-024, FR-030 y FR-033 dependen de garantías del motor (restricción única, transacciones, atomicidad) que un doble de prueba no puede verificar | Solo unitarios con la base de datos simulada: dejaría sin cobertura automática precisamente las reglas de seguridad más delicadas de la épica |
| **Enum de estados del pedido en `packages/shared`** sin entidad `Pedido` | FR-023 obliga a HU-10 a usar la máquina de estados de HU-03 sin definir estados propios, y necesita nombrarlos para sus filtros | No incluir nada: HU-10 no podría ofrecer sus filtros. Implementar la entidad completa: sería construir E4/E2 dentro de E1, contra el Principio III |
| ~~**Revocación de sesiones en las cuatro acciones de impacto** (D-014)~~ — **ya no es una desviación**: la spec la exige desde la enmienda a FR-024 aprobada el 2026-08-15 (supuesto 20) | — | — |
| ~~**Límite máximo de 72 bytes en la contraseña** (D-002)~~ — **ya no es una desviación**: la spec lo exige desde la enmienda a FR-032 aprobada el 2026-08-15 (supuesto 21) | — | — |

Las tres desviaciones vigentes se derivan de exigencias de la spec o de la constitución, no de decisiones técnicas de este plan.

Las dos que **sí eran decisiones de este plan** más allá de la letra de la spec quedaron resueltas el **2026-08-15**, ambas mediante enmienda aprobada por la persona responsable del producto, conforme al procedimiento del Principio III:

- **D-014** modificaba un comportamiento observable —tras un cambio de rol o un restablecimiento, la sesión del usuario afectado termina—. **FR-024 cubre ahora las cuatro acciones de impacto** (supuesto 20, más FR-011, FR-026, RN-001, dos casos límite y SC-025/SC-026).
- **D-002** imponía un máximo de contraseña que ningún requisito reflejaba. **FR-032 declara ahora el rango de 8 a 72 caracteres** (supuesto 21, más SC-016 y un caso límite).

**Este plan ya no excede la spec en ningún comportamiento observable**: todo lo que el sistema hace de cara al usuario está respaldado por un requisito.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Canal lateral de temporización que revele si una cuenta existe, debilitando FR-008 | La comparación bcrypt se ejecuta siempre, contra un hash señuelo cuando el usuario no existe (D-002) |
| Que los dos mensajes de bloqueo diverjan tras una edición, rompiendo SC-018 | Ambas rutas usan la misma constante de `packages/shared`; un test verifica que existe y no está vacía (D-003) |
| Alta concurrente con el mismo correo, evadiendo la comprobación previa de FR-017 | La restricción `UNIQUE` del motor es la autoridad; el código traduce la violación a `409 EMAIL_ALREADY_EXISTS` |
| Desactivación que actualice el usuario pero no revoque sus sesiones, rompiendo FR-024 | Ambas escrituras van en una única transacción de Prisma, cubierta por un test de integración |
| Que la validación se duplique y front y back diverjan | Zod compartido como fuente única; el backend valida con los mismos esquemas que el formulario (D-005) |
| Que el panel adquiera acciones de escritura, rompiendo RN-004 | El módulo `dashboard` solo expone verbos `GET`; SC-015 se verifica en C4 |
| Que un sondeo en segundo plano del frontend mantenga viva una sesión abandonada, anulando FR-005 | `apps/web` tiene prohibido consultar la API por temporizador; se verifica en D7 y con el escenario A9, que exige la pestaña abierta y quieta (SC-024) |
| Paginación no determinista que muestre a un usuario dos veces o ninguna | Orden total `created_at DESC, id DESC` con índice de apoyo (D-016); se verifica en B22 (SC-023) |
| Que `normalizarBusqueda` diverja entre la escritura de `search_normalized` y la consulta, y un usuario deje de encontrarse sin error visible | Una única función en `packages/shared` usada por ambos caminos, con test unitario sobre los casos de SC-021 y verificación en B24 |
| Que un correo se inserte sin normalizar y rompa la unicidad insensible a mayúsculas de FR-017 | Los esquemas Zod son la única puerta de entrada de datos (D-005); el test de integración de FR-017 intenta el alta variando las mayúsculas (D-015) |
| Que nadie conserve acceso administrativo y el sistema quede inoperable | Procedimiento de recuperación fuera de la aplicación (FR-036, D-010), verificado en D8 |

---

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| FR-028 (semilla), FR-036 (recuperación operativa), infraestructura, `packages/shared` | A |
| FR-001 a FR-008, FR-024, FR-025, FR-030, FR-031, FR-033 | B |
| FR-009 a FR-017, FR-026, FR-027, FR-032, FR-034, FR-035 | C |
| FR-018 a FR-023, FR-029 | D |

Los requisitos FR-019 (parte de pedidos), FR-020 y FR-023 quedan entregados como superficie preparada; su verificación funcional se completa cuando E4/E2 aporten pedidos, tal como declara la nota de entrega por fases de la spec.
