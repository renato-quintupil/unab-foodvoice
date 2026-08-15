# Plan de Implementación: E1 · Acceso y usuarios

**Rama**: `001-acceso-y-usuarios` | **Fecha**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la épica E1 (HU-08 Autenticación y sesión, HU-09 Gestión de usuarios y roles, HU-10 Panel y reportes del administrador) más las decisiones de stack acordadas en la sesión de planificación del 2026-08-15.

**Artefactos de diseño**: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

---

## Resumen

E1 entrega el cimiento de identidad de FoodVoice: un padrón de usuarios con rol gestionado por el administrador, un mecanismo de autenticación y sesión que reconoce ese rol en cada acción, y un panel de solo lectura para el administrador.

El enfoque técnico se apoya en cuatro decisiones que se derivan directamente de los requisitos, no de preferencias de moda:

1. **Sesión con estado en PostgreSQL, con identificador opaco en cookie `httpOnly`**. FR-024 exige invalidar sesiones _en el instante_ en que un usuario se desactiva; sin estado en servidor eso es imposible de garantizar, y con JWT solo es aproximable a costa de una lista de revocación —es decir, estado de todos modos, más complejidad (Principio I).
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

**Objetivos de rendimiento**: inicio de sesión y carga del panel por debajo de 5 segundos, cronometrados a mano sobre el entorno de contenedores del proyecto y el padrón de prueba (SC-001, SC-007, supuesto 22). Con el volumen de v1 (un solo local) no hay presión de rendimiento; la consulta de sesión por petición es despreciable. **No se instrumenta la aplicación ni se montan pruebas de carga**: sería alcance no pedido para un umbral que se comprueba observando la pantalla (Principio I, Principio III). La contrapartida asumida es que estos dos criterios quedan fuera de la cobertura automática.

**Restricciones**:

- Ninguna credencial ni secreto en el repositorio (Principio V, FR-007, FR-016, FR-028)
- Todo texto visible al usuario en español (Principio II)
- Sin entidad `Pedido` en esta épica (Principio III); solo la máquina de estados compartida (FR-023, D-012)
- La sesión debe poder revocarse de forma inmediata y transaccional (FR-024)

**Escala/Alcance**: v1 mono-local. 12 endpoints, 4 tablas y **10 pantallas**: inicio de sesión, tres páginas de inicio de rol no administrador, denegación por rol, panel, listado de usuarios, alta, edición y reporte de pedidos. La página de inicio del administrador **es** el panel (FR-031), de modo que no se cuenta dos veces.

---

## Validación del stack propuesto

Verificación explícita solicitada por el usuario: cada tecnología, contrastada con lo que esta épica necesita.

| Tecnología                  | Veredicto                                   | Fundamento                                                                                                                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Next.js 15 (App Router)** | Aplicable                                   | Su `middleware.ts` cubre la protección de rutas por rol (FR-003) y sus Route Handlers permiten el patrón BFF que mantiene la cookie same-origin (D-006). Los Server Components reducen el JavaScript enviado al navegador en las vistas de listado.                                                                 |
| **React 19**                | Aplicable                                   | Requisito de Next.js 15. Nada en esta épica lo cuestiona.                                                                                                                                                                                                                                                           |
| **TypeScript**              | **Necesario, no solo aplicable**            | Es lo que hace posible compartir contratos de dominio entre frontend y backend. Sin un lenguaje común, el requisito de `packages/shared` no tiene sentido.                                                                                                                                                          |
| **TailwindCSS 4**           | Aplicable                                   | Suficiente para 10 pantallas de formularios y tablas. Sin objeciones.                                                                                                                                                                                                                                                |
| **shadcn/ui**               | Aplicable, con una ventaja concreta         | Sus componentes `Dialog` y `AlertDialog` resuelven directamente las confirmaciones antes de acciones de impacto que exige FR-035 y el Principio IX. Al copiarse al repositorio en lugar de instalarse, los textos se escriben en español de origen (Principio II). Su base accesible (Radix) ayuda al Principio IV. |
| **NestJS 11**               | Aplicable, con una ventaja concreta         | Sus guards por decorador (`@Roles(...)`) hacen que la autorización por rol sea declarativa y que su **ausencia sea visible** en la revisión de código — importante cuando FR-003, FR-018 y SC-003/SC-008 exigen bloqueo del 100 %. Sus interceptores centralizan el formato de error en español.                    |
| **PostgreSQL 16**           | Aplicable, con una ventaja concreta         | La restricción `UNIQUE` sobre el correo hace cumplir FR-017/RN-005 en el motor, incluso ante peticiones concurrentes, en lugar de depender de una comprobación previa en el código. Las transacciones garantizan FR-024 y FR-030 (rechazo íntegro, sin cambios parciales).                                          |
| **Monorepo**                | Aplicable                                   | Es la condición para que `packages/shared` sea una dependencia real y no código duplicado.                                                                                                                                                                                                                          |
| **Docker**                  | Aplicable                                   | Además del despliegue, habilita los tests de integración contra una PostgreSQL real, que son los únicos que verifican de verdad FR-017, FR-024 y FR-030 (D-009).                                                                                                                                                    |
| **Tests unitarios**         | Aplicable, **e insuficientes por sí solos** | Ver la reserva de más abajo.                                                                                                                                                                                                                                                                                        |

### Reserva declarada sobre el alcance de las pruebas

Los tests unitarios cubren bien la lógica de decisión: el conteo de intentos fallidos, la validación de los esquemas, los guards, el renderizado condicional. Pero cuatro requisitos de esta épica **no quedan verificados por un test unitario**, porque lo que garantiza su cumplimiento no es el código de la aplicación sino el motor de base de datos:

- **FR-017 / RN-005** (unicidad del correo, también entre desactivados): con un repositorio simulado se prueba el doble, no la restricción.
- **FR-024** (revocación inmediata de sesiones al desactivar): depende de que ambas escrituras ocurran en la misma transacción.
- **FR-030** (rechazo íntegro sin cambios parciales): es literalmente una propiedad transaccional.
- **FR-033** (bloqueo temporal): depende de la atomicidad del incremento del contador ante intentos concurrentes.

Por eso el plan incorpora una capa de integración de API contra PostgreSQL efímera en Docker, además de los unitarios pedidos. No sustituye a los unitarios: los complementa en los cuatro puntos donde son estructuralmente ciegos.

### Ajustes al enunciado original

| Enunciado        | Ajuste            | Motivo                                                                                                                                           |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package/shared` | `packages/shared` | Convención estándar del ecosistema (pnpm, Turborepo, npm workspaces). La carpeta está vacía; el cambio no tiene costo.                           |
| `services`       | `services/api`    | Un único backend NestJS monolítico con módulos internos. El plural de `services/` deja lugar futuro sin anticipar complejidad hoy (Principio I). |

---

## Constitution Check

_Puerta obligatoria antes de la Fase 0, reevaluada tras la Fase 1._

| Principio                                           | Evaluación                                                 | Cómo lo satisface el diseño                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I · Simplicidad ante todo**                       | ⚠️ Cumple, con complejidad añadida declarada               | Sesión con estado en lugar de JWT con rotación; un backend monolítico en vez de servicios por dominio; expiración pasiva sin procesos programados; normalización en la aplicación en lugar de extensiones del motor. **Pero cuatro decisiones aumentan la complejidad**, y el veredicto no se apoya solo en las que la reducen — ver la tabla siguiente.                                                                                                                                                                                                                                                                                                                                                                            |
| **II · Idioma: todo en español**                    | ✅ Cumple                                                  | Todos los textos visibles se declaran en español en `packages/shared` y en los esquemas Zod. Los identificadores técnicos siguen en inglés, como el propio principio autoriza. Los errores de la API llevan `code` técnico y `message` en español.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **III · Cero alcance fantasma**                     | ✅ Cumple                                                  | No se crea la entidad `Pedido`: solo el enum de estados que FR-023 obliga a consumir (D-012). No hay autorregistro (FR-025), ni recuperación por autoservicio, ni exportación, ni vista del registro administrativo. Cada endpoint del contrato se remite a un FR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **IV · Verificable por una persona no técnica**     | ⚠️ Cumple con excepción acotada                            | `quickstart.md` recorre A, B y C con la aplicación, sin leer código ni logs. La sección D recoge las dos excepciones que la propia spec declara en SC-010 — ver el detalle exacto bajo esta tabla y en Complexity Tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **V · Datos del usuario con respeto**               | ✅ Cumple                                                  | Solo los cuatro datos que FR-009 exige. Contraseñas con bcrypt coste 12; jamás en respuestas, logs ni bitácora. Secretos en `.env`, ignorado por git; la semilla falla en vez de recurrir a una credencial por defecto (D-010).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **VI · Voz primero, paridad manual**                | ➖ No aplica, por una razón de fondo                       | E1 no entrega **ninguna función de producto**: entrega acceso a las funciones que otras épicas construirán. La voz es la forma de pedir comida, y aquí no se pide nada. Además, el Principio X excluye expresamente la voz de la autenticación, de modo que aplicarlo aquí no solo sería innecesario sino contrario a otro principio. Aplicará en **E6**, sobre búsqueda y carrito.                                                                                                                                                                                                                                                                                                                                                 |
| **VII · Entender la intención**                     | ➖ No aplica, por la misma razón                           | No hay ninguna entrada en lenguaje natural en esta épica: los formularios de acceso y de gestión de usuarios son campos con formato fijo, donde interpretar la intención no significaría nada. Aplicará en **E6**, junto al Principio VI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **VIII · Catálogo y stock como única verdad**       | ➖ No aplica, y no por omisión                             | E1 no toca productos ni existencias, y **no puede tocarlos sin violar el Principio III**: el catálogo pertenece a E3. Su única intersección futura es que los roles que E1 define determinarán quién lo administra. Aplicará en **E3**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **IX · Confirmar antes de actuar y poder deshacer** | ✅ Cumple                                                  | FR-035 se implementa con `AlertDialog` de shadcn/ui en las cuatro acciones de impacto, indicando a quién afectan y qué efecto tienen. La cancelación no abre transacción alguna, así que tampoco deja rastro en la bitácora.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **X · Privacidad y datos mínimos**                  | ✅ Cumple                                                  | Sin micrófono, sin audio, sin datos biométricos. Sin direcciones en esta épica. Solo los datos operativos imprescindibles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **XI · Calidad guiada por especificación**          | ✅ Cumple                                                  | La spec ya trae los Gherkin de las tres historias. `quickstart.md` los traduce en pasos verificables y `contracts/` fija el comportamiento esperado **antes** de programar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **XII · Trazabilidad de punta a punta**             | ⚠️ Cumple **en lo que le corresponde**, no en su totalidad | El principio tiene dos mitades y E1 solo puede ejercer una. La máquina de estados única sí: se declara compartida en `packages/shared`, con los cinco estados del principio, sin añadir ni omitir ninguno y sin definir estados propios (FR-023, `data-model.md` §CHK029). El historial de cambios de estado del pedido **no**, porque en E1 no existe ningún pedido cuya trazabilidad se pueda ejercer; llegará con E4/E2. Lo que sí hace E1 es **aplicar el mismo criterio de historial no editable a lo que sí tiene**: `admin_audit_log` es de solo-agregar y su inmutabilidad la impone un disparador del motor, no una convención. Decir «cumple» a secas habría sido inexacto: E1 prepara la trazabilidad y no la demuestra. |

**Veredicto**: la puerta se aprueba, con **tres calificaciones matizadas** que conviene no leer como aprobados limpios: el Principio I cumple pero con complejidad añadida que se declara abajo; el IV, con dos excepciones acotadas; y el XII, solo en la mitad que esta épica puede ejercer.

### Decisiones que **aumentan** la complejidad (Principio I)

Una evaluación que solo encuentra cumplimiento merece revisarse antes que celebrarse. Estas cuatro decisiones hacen el sistema más complejo, no menos, y se declaran con lo que cada una compra:

| Decisión                                                 | Complejidad que añade                                                                               | Qué compra                                                                                                                                                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **BFF con Next.js** (D-006)                              | Un salto de red por petición, una capa de código que mantener y un modo de fallo propio (D-017)     | Que el identificador de sesión nunca sea accesible desde el JavaScript de la página, y que NestJS no quede expuesto a Internet. Sin ello harían falta CORS con credenciales y cookies cross-site, que es donde más agujeros se abren |
| **`packages/shared` como paquete aparte** (D-005, D-008) | Un espacio de trabajo más, un paso de compilación previo y un orquestador para garantizar su orden  | Que SC-018 —dos mensajes idénticos palabra por palabra— sea imposible de romper, en lugar de depender de que nadie edite uno solo de dos literales                                                                                   |
| **Capa de tests de integración** (D-009)                 | Un segundo runner, una PostgreSQL efímera y un ciclo de verificación notablemente más lento         | Cobertura automática de FR-017, FR-024, FR-030 y FR-033, que un doble de prueba **no puede** verificar: probaría el doble, no la regla                                                                                               |
| **`ClockService` inyectable** (D-009)                    | Ningún módulo puede llamar a `Date.now()`; el reloj aparece en la firma de cada servicio que lo usa | Que las reglas de 30 y 15 minutos se prueben sin esperarlas de verdad, y que el tiempo sea visible en el código en lugar de ser magia global                                                                                         |

Las cuatro se aceptan porque cada una cierra un hueco que la alternativa simple dejaba abierto, no por completitud. La primera y la tercera figuran además en Complexity Tracking como desviaciones formales.

### Qué queda dentro y qué fuera de la verificación no técnica (Principio IV)

La excepción de SC-010 es acotada, y la frontera exacta importa porque de otro modo «excepción declarada» se convierte en una puerta abierta:

| Ámbito                                                      | ¿Verificable por una persona no técnica?                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los **39 criterios de éxito**, salvo los dos casos de abajo | **Sí**, con la aplicación en la mano, siguiendo `quickstart.md` A, B y C                                                                                                                                   |
| **FR-034** · registro de acciones administrativas           | **No**: no tiene vista en v1 por decisión de alcance. Se comprueba en la sección D (D3–D6, D11, D12)                                                                                                       |
| **FR-007, FR-016, FR-028** · resguardo de credenciales      | **No**: el almacenamiento no es observable desde una pantalla, y exponerlo sería en sí mismo una debilidad. Se comprueba en la sección D (D1, D2, D9, D10), con los tres criterios objetivos de **SC-027** |
| **SC-001 y SC-007** · umbrales de 5 segundos                | **Sí**, con cronómetro (supuesto 22). No están exceptuados del Principio IV; lo que no tienen es cobertura **automática**                                                                                  |

La última fila deshace una confusión fácil: «no cubierto por las pruebas» y «no verificable por una persona no técnica» no son lo mismo, y solo lo segundo es una excepción al Principio IV.

### Reevaluación posterior a la Fase 1

Ejecutada el **2026-08-15**, tras completar `data-model.md`, `contracts/` y `quickstart.md`, y de nuevo tras cerrar las checklists de calidad. No es una afirmación de que nada cambió —cambiaron cosas—, sino el registro de qué se revisó y con qué resultado:

| Qué se revisó                                                              | Resultado                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Introdujo `data-model.md` alguna entidad, columna o índice sin requisito? | **Sí, cuatro elementos**, encontrados al recorrer la trazabilidad inversa (`data.md` §CHK032). Uno se retiró —un índice sin ninguna consulta que lo aprovechara—; los otros tres se conservan como metadatos operativos declarados |
| ¿Introdujeron los contratos superficie no especificada?                    | **Un endpoint**, `GET /health`, que se declara como infraestructura sin requisito funcional en lugar de asignarle uno forzado (`api.md` §CHK020)                                                                                   |
| ¿Excedió el diseño la spec en algún comportamiento observable?             | **Sí, en dos puntos**, ambos resueltos con enmienda aprobada: D-014 (revocación en las cuatro acciones) y D-002 (máximo de contraseña). Ninguno figura ya como desviación                                                          |
| ¿Aparecieron decisiones nuevas después del plan?                           | **Sí**: D-017 y D-018, más cuatro requisitos de interfaz (FR-037 a FR-040) y catorce criterios de éxito, todos surgidos de las checklists de calidad y todos incorporados a la spec antes de tocar código                          |
| ¿Cambió algún veredicto del Constitution Check?                            | **Sí, tres**: los Principios I, IV y XII pasan de «cumple» a «cumple con matiz», por el examen de las tres filas anteriores                                                                                                        |

Que la reevaluación **haya cambiado tres veredictos y retirado un índice** es lo que la distingue de un trámite. Se mantiene la aprobación de la puerta.

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
│       │   │   │   ├── usuarios/         #     padrón · HU-09
│       │   │   │   ├── pedidos/          #     reporte de pedidos · HU-10 (vacío en E1)
│       │   │   │   └── _components/      #     inventario de vistas (SC-015)
│       │   │   ├── sin-permiso/          #   denegación por rol · página propia (FR-003)
│       │   │   └── api/                  #   Route Handlers · proxy BFF (D-006)
│       │   ├── components/
│       │   │   ├── ui/                   #   shadcn/ui
│       │   │   └── *.tsx                 #   confirmación (FR-035), éxito (FR-037), acción en curso (FR-038)
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
│       │   ├── health/                   #   healthcheck de contenedores (D-013)
│       │   ├── config/                   #   validación de variables de entorno
│       │   ├── common/                   #   guards, pipes, filtros, reloj (D-009), logger
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
│       │   ├── enums/                    #   Role, UserStatus, AdminAction, OrderStatus
│       │   ├── schemas/                  #   Zod: validación + tipos
│       │   ├── messages/                 #   textos fijos y etiquetas visibles en español
│       │   ├── search/                   #   normalizarBusqueda, escaparLike (D-011)
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

Esta estructura es la misma que describen `contracts/shared.md` y `quickstart.md`; se cotejaron carpeta por carpeta el 2026-08-15 y la única discrepancia encontrada —`search/`, que el árbol de este plan omitía— quedó corregida arriba. Un segundo cotejo, esta vez **contra `tasks.md`**, encontró dos omisiones más: la página de denegación por rol (`sin-permiso/`, T072) y los tres componentes transversales de `components/` (T073, T100, T102). También quedan corregidas arriba. Que el primer cotejo no las viera tiene una causa que conviene nombrar: se hizo contra los otros documentos de diseño, y ninguno de ellos enumera rutas de la interfaz.

**Elementos de la estructura sin requisito funcional.** El recorrido inverso que exige el Principio III, aplicado a las carpetas y no solo a los datos:

| Elemento                          | Origen                                                                                                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/api/src/health/`        | **Ningún requisito funcional**: lo exige el `healthcheck` del despliegue (D-013). Se declara así, en lugar de asignarle un FR forzado, y su superficie está acotada a un cuerpo constante |
| `services/api/src/common/`        | Guards (FR-003, FR-018), pipes (FR-014), filtro de errores (Principio II), `ClockService` (D-009) y registro censurado (FR-007)                                                           |
| `services/api/src/config/`        | FR-028: el arranque falla si falta una variable, en lugar de recurrir a un valor por defecto                                                                                              |
| `docker-compose.test.yml`         | **Ningún requisito funcional**: sostiene la capa de integración (D-009), que sí figura como desviación declarada en Complexity Tracking                                                   |
| `apps/web/src/app/admin/pedidos/` | FR-020, FR-023. Superficie que responde vacía en E1 por diseño, no por falta de implementación (D-012)                                                                                    |
| El resto de carpetas              | Se remiten a un requisito según la trazabilidad de fases de abajo                                                                                                                         |

Los dos elementos sin requisito funcional son infraestructura de despliegue y de pruebas. Ninguno añade superficie que el usuario pueda alcanzar, y ambos se declaran para que su ausencia de FR sea una constatación y no un hueco.

---

## Fases de entrega

Alineadas con las prioridades de la spec. **Qué significa aquí «independiente»**, porque decirlo sin precisar sería falso: las fases son **acumulativas y no independientes entre sí** —la Fase B necesita el administrador semilla y el esquema de datos que entrega la Fase A, y no podría existir sin ellos—. Lo que sí es independiente es la **verificación de cada historia de usuario** una vez están los cimientos: HU-08 se demuestra entera sin que HU-09 ni HU-10 existan, HU-09 sin HU-10, y HU-10 funciona sobre el administrador semilla sin necesidad de que HU-09 esté construida. La Fase A no es una historia sino el habilitante común, y por eso no se «verifica de forma independiente» en el mismo sentido: se verifica comprobando que el sistema arranca.

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

| Desviación                                                                                                                                                                               | Por qué es necesaria                                                                                                                                                                                                                                                                                                          | Alternativa más simple, y por qué se rechazó                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Excepción al Principio IV**: FR-034 (registro administrativo) y FR-007/FR-016/FR-028 (resguardo de credenciales) no son verificables por una persona no técnica desde la aplicación    | Ya declarada y justificada en la propia spec (supuesto 13, SC-010). El registro no tiene vista en v1 por decisión de alcance, y el almacenamiento de credenciales no es observable por naturaleza                                                                                                                             | Construir una vista de la bitácora: sería alcance no especificado (Principio III). Mostrar indicios del almacenamiento de credenciales en pantalla: sería en sí mismo una debilidad de seguridad                                                                                                                                                                                                                                                                                                          |
| **Capa de tests de integración** además de los unitarios solicitados                                                                                                                     | FR-017, FR-024, FR-030 y FR-033 dependen de garantías del motor (restricción única, transacciones, atomicidad) que un doble de prueba no puede verificar                                                                                                                                                                      | Solo unitarios con la base de datos simulada: dejaría sin cobertura automática precisamente las reglas de seguridad más delicadas de la épica                                                                                                                                                                                                                                                                                                                                                             |
| **Enum de estados del pedido en `packages/shared`** sin entidad `Pedido`                                                                                                                 | FR-023 obliga a HU-10 a usar la máquina de estados de HU-03 sin definir estados propios, y necesita nombrarlos para sus filtros. Vive en el paquete compartido, y no en el backend, porque la interfaz también los nombra —en los filtros y en las etiquetas visibles— y una segunda lista sería una lista que puede divergir | No incluir nada: HU-10 no podría ofrecer sus filtros. Declararlos solo en el backend: la interfaz necesitaría su propia copia. Implementar la entidad completa: sería construir E4/E2 dentro de E1, contra el Principio III. El riesgo inverso —declarar de más y que E4/E2 tengan que desmontarlo— se acota limitando el alcance a un enum y una función pura, sin tabla ni migración (`data.md` §CHK028)                                                                                                |
| **Patrón BFF con Next.js** (D-006): un salto de red por petición y una capa de código intermedia                                                                                         | El navegador no debe poder leer el identificador de sesión (FR-007, D-001) ni NestJS quedar expuesto a Internet. Con el proxy, la cookie es same-origin y `httpOnly`                                                                                                                                                          | Llamadas directas del navegador a NestJS: exigirían CORS con credenciales y cookies cross-site —las dos configuraciones donde más fácilmente se abren agujeros— o mover el token a una cabecera, lo que obliga a guardarlo en un lugar legible por JavaScript. La alternativa simple **reintroduce exactamente el riesgo** que D-001 evita. Costo asumido y acotado: un salto despreciable dentro de la red de contenedores, y un modo de fallo propio que D-017 especifica en lugar de dejar sin definir |
| ~~**Revocación de sesiones en las cuatro acciones de impacto** (D-014)~~ — **ya no es una desviación**: la spec la exige desde la enmienda a FR-024 aprobada el 2026-08-15 (supuesto 20) | —                                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ~~**Límite máximo de 72 bytes en la contraseña** (D-002)~~ — **ya no es una desviación**: la spec lo exige desde la enmienda a FR-032 aprobada el 2026-08-15 (supuesto 21)               | —                                                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Corrección del 2026-08-15**: una versión anterior de esta sección afirmaba que «ninguna de las tres es una desviación introducida por decisión técnica de este plan». Contrastada ítem por ítem, **la afirmación era falsa para dos de ellas**, y se rectifica en lugar de matizarse:

| Desviación                           | ¿La exige la spec o la constitución? | Qué la respalda                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Excepción al Principio IV            | **Sí, la spec**                      | Supuesto 13 y SC-010, escritos antes que este plan. El plan la hereda, no la crea                                                                                                                                                                                                           |
| Enum de estados sin entidad `Pedido` | **Sí, la spec y la constitución**    | FR-023 obliga a nombrar los estados; el Principio XII los define; el Principio III prohíbe construir la entidad aquí                                                                                                                                                                        |
| **Capa de tests de integración**     | **No: es una decisión de este plan** | El enunciado pedía «tests unitarios». Que FR-017, FR-024, FR-030 y FR-033 dependan de garantías del motor es un hecho sobre esos requisitos, pero **la decisión de añadir un segundo nivel de pruebas la tomó este plan**, y presentarla como derivada de la spec era una atribución cómoda |
| **Patrón BFF**                       | **No: es una decisión de este plan** | El enunciado pedía Next.js y NestJS, no un proxy entre ambos. La motiva FR-007 y D-001, pero la forma concreta —Route Handlers que reenvían— la eligió este plan                                                                                                                            |

Las dos desviaciones propias están justificadas y sus alternativas evaluadas arriba; lo que no era defendible es atribuirlas a la spec. La distinción importa porque una desviación heredada no admite discusión y una propia sí: quien revise este plan puede rechazar el BFF o la capa de integración, y debe saber que puede hacerlo.

**Complejidad declarada fuera de esta tabla**: `packages/shared` como paquete aparte y el `ClockService` inyectable también aumentan la complejidad, y figuran en el Constitution Check bajo el Principio I. No se registran aquí como desviaciones porque ninguno añade comportamiento observable ni superficie: son formas de organizar el mismo alcance.

Las dos que **sí eran decisiones de este plan** más allá de la letra de la spec quedaron resueltas el **2026-08-15**, ambas mediante enmienda aprobada por la persona responsable del producto, conforme al procedimiento del Principio III:

- **D-014** modificaba un comportamiento observable —tras un cambio de rol o un restablecimiento, la sesión del usuario afectado termina—. **FR-024 cubre ahora las cuatro acciones de impacto** (supuesto 20, más FR-011, FR-026, RN-001, dos casos límite y SC-025/SC-026).
- **D-002** imponía un máximo de contraseña que ningún requisito reflejaba. **FR-032 declara ahora el rango de 8 a 72 caracteres** (supuesto 21, más SC-016 y un caso límite).

**Este plan ya no excede la spec en ningún comportamiento observable**: todo lo que el sistema hace de cara al usuario está respaldado por un requisito.

---

## Riesgos y mitigaciones

Cada fila declara **cómo se comprueba que la mitigación funciona**. Sin esa columna, una mitigación es una intención: la afirmación «se usa una constante compartida» no dice nada sobre si alguien podría dejar de usarla mañana.

| Riesgo                                                                                                                                       | Mitigación                                                                                                                                                                                                                                                    | Cómo se comprueba                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canal lateral de temporización que revele si una cuenta existe, debilitando FR-008                                                           | La comparación bcrypt se ejecuta siempre, contra un hash señuelo **generado al arrancar con el coste configurado** (D-002)                                                                                                                                    | Test unitario que afirma que la comparación ocurre también sin usuario, y que el coste del señuelo coincide con el configurado (T050)                                                                                                                                                           |
| Que los dos mensajes de bloqueo diverjan tras una edición, rompiendo SC-018                                                                  | Ambas rutas usan la misma constante de `packages/shared` (D-003)                                                                                                                                                                                              | Test que verifica que las doce constantes existen y no están vacías (T024), más la comparación de pantallas en A4                                                                                                                                                                               |
| Alta concurrente con el mismo correo, evadiendo la comprobación previa de FR-017                                                             | La restricción `UNIQUE` del motor es la autoridad; el código traduce la violación a `409 EMAIL_ALREADY_EXISTS` (D-018)                                                                                                                                        | Test de integración con **dos altas simultáneas** del mismo correo: exactamente un usuario y un `409`, nunca un `500` (T079)                                                                                                                                                                    |
| Desactivación que actualice el usuario pero no revoque sus sesiones, rompiendo FR-024                                                        | Las seis operaciones van en una única transacción (`data-model.md` § Alcance exacto)                                                                                                                                                                          | Test de integración de las cuatro acciones de impacto sobre sesiones en varios navegadores (T080)                                                                                                                                                                                               |
| Que la validación se duplique y front y back diverjan                                                                                        | Zod compartido como fuente única, con `UpdateUserSchema` reutilizando las definiciones de `CreateUserSchema` (D-005)                                                                                                                                          | Test que aplica las mismas entradas inválidas a ambos esquemas y exige el mismo resultado (T021)                                                                                                                                                                                                |
| Que el panel adquiera acciones de escritura, rompiendo RN-004                                                                                | El módulo `dashboard` solo expone verbos `GET`; las vistas se declaran en un inventario explícito                                                                                                                                                             | C4 contra el inventario de T115, no recorriendo la aplicación a ojo (SC-015)                                                                                                                                                                                                                    |
| Que un sondeo en segundo plano del frontend mantenga viva una sesión abandonada, anulando FR-005                                             | `apps/web` tiene prohibido consultar la API por temporizador, con una regla de ESLint que lo impide (T075)                                                                                                                                                    | D7 sobre el código, y el escenario A9 con la pestaña abierta y quieta media hora (SC-024)                                                                                                                                                                                                       |
| Paginación no determinista que muestre a un usuario dos veces o ninguna                                                                      | Orden total `created_at DESC, id DESC` con índice de apoyo (D-016)                                                                                                                                                                                            | B22: recorrer 1 → 2 → 1 → 2 y exigir las mismas personas en las mismas páginas (SC-023)                                                                                                                                                                                                         |
| Que `normalizarBusqueda` diverja entre la escritura de `search_normalized` y la consulta, y un usuario deje de encontrarse sin error visible | Una única función en `packages/shared` usada por ambos caminos (D-011)                                                                                                                                                                                        | Test unitario sobre los casos de SC-021 y verificación en B13 y B24                                                                                                                                                                                                                             |
| Que un correo se inserte sin normalizar y rompa la unicidad insensible a mayúsculas de FR-017                                                | Los esquemas Zod son la única puerta de entrada de datos (D-005, D-015)                                                                                                                                                                                       | Test de integración que intenta el alta **variando las mayúsculas** (T079)                                                                                                                                                                                                                      |
| Que nadie conserve acceso administrativo y el sistema quede inoperable                                                                       | Procedimiento de recuperación fuera de la aplicación (FR-036, D-010)                                                                                                                                                                                          | D8: la entrada de bitácora con actor igual al afectado, y la comprobación de que ningún endpoint lo alcanza                                                                                                                                                                                     |
| **Que una migración sobre `session` deje sesiones vivas con un significado distinto del que tenían**                                         | Toda migración que altere `session` de forma incompatible —cambiar el significado de `role`, retirar una columna que la validación usa— **debe revocar todas las sesiones vivas en la misma migración**. Añadir una columna con valor por defecto no lo exige | Revisión de la migración: si toca `session` y no revoca, hay que justificar por qué es compatible. En E1 no se da, porque la tabla nace con la primera migración                                                                                                                                |
| **Que `middleware.ts` y los guards diverjan sobre qué rol accede a qué ruta**                                                                | El middleware no reimplementa reglas: solo comprueba la cookie y el segmento, con la correspondencia rol → segmento en una constante compartida. La autorización real es siempre la del servidor (D-007)                                                      | A6 y A17: invocar la ruta restringida **sin pasar por la interfaz** y exigir el rechazo. Por diseño, el peor caso de una divergencia es una molestia visible, nunca un acceso indebido                                                                                                          |
| **Que `packages/shared` se desincronice entre frontend y backend**                                                                           | No hay versionado independiente: `workspace:*`, sin publicar, compilado antes que sus consumidores y desplegado del mismo commit (`contracts/shared.md` § Compatibilidad)                                                                                     | La compilación falla en el acto ante un cambio incompatible. El riesgo residual **no es de versiones sino de datos**: cambiar `normalizarBusqueda` deja la columna persistida calculada con la versión anterior, y por eso toda modificación de esa función exige una migración que la repueble |

---

## Trazabilidad requisito → fase

| Requisitos                                                                            | Fase                      |
| ------------------------------------------------------------------------------------- | ------------------------- |
| FR-028 (semilla), FR-036 (recuperación operativa), infraestructura, `packages/shared` | A                         |
| FR-001 a FR-008, FR-025, FR-030, FR-033, FR-038                              | B                         |
| FR-009 a FR-017, FR-026, FR-027, FR-032, FR-034, FR-035, FR-037                       | C                         |
| FR-018 a FR-023, FR-029                                                               | D                         |
| FR-024, FR-031, FR-039, FR-040                                                                        | **Repartidos**: ver abajo |

**Cuatro requisitos no caben en una sola fase, y forzarlos a una haría la tabla mentirosa:**

- **FR-024** (invalidación de sesiones). El **mecanismo** —revocar y tratar como inválida una sesión revocada— pertenece a la Fase B, porque es parte del ciclo de vida de la sesión. Pero **los cuatro disparadores son acciones de HU-09** y llegan en la Fase C, de modo que en la Fase B el mecanismo existe y no lo ejerce nadie. Su verificación funcional (pasos B8 y B10) ocurre por tanto en la Fase C. Esto **no es una dependencia hacia atrás**: la Fase C usa algo que la B ya entregó, que es el orden correcto.
- **FR-031** (página de inicio por rol). Para cliente, negocio y repartidor se satisface entero en la Fase B. Para el administrador **no**, porque su página de inicio _es_ el panel, que llega en la Fase D. Durante las fases B y C el administrador aterriza en la gestión de usuarios; al completarse la D, en el panel. Es un cambio deliberado y declarado, no un ajuste de última hora.
- **FR-039** (accesibilidad) y **FR-040** (tamaños de pantalla y navegadores). No son funciones que se construyan en una fase, sino condiciones que **toda pantalla debe cumplir desde el momento en que existe**: rigen sobre la Fase B en cuanto hay inicio de sesión, sobre la C en cuanto hay formularios y diálogos, y sobre la D en cuanto hay panel. Su **verificación** sí es única y ocurre al cierre (T122 y T123), porque recorrer las pantallas de a una a medida que aparecen obligaría a repetir el recorrido entero en cada fase. Asignarlos a la Fase B —como hacía una versión anterior de esta tabla— insinuaba que los diálogos de la Fase C quedaban fuera, que es justamente donde la accesibilidad se rompe con más facilidad.

**Ninguna fase depende de algo que se entregue después.** Se comprobó recorriendo las cuatro: A no depende de nada; B usa de A el esquema, la semilla y `packages/shared`; C usa de B la sesión y los guards; D usa de B los guards y de A el enum de estados. La fila repartida es la única que podía insinuar lo contrario, y por eso se explica en lugar de resolverse asignando sus cuatro requisitos a una fase cualquiera.

Los requisitos FR-019 (parte de pedidos), FR-020 y FR-023 quedan entregados como superficie preparada; su verificación funcional se completa cuando E4/E2 aporten pedidos, tal como declara la nota de entrega por fases de la spec.
