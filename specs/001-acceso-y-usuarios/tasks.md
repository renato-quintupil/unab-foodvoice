# Tasks: E1 · Acceso y usuarios

**Input**: Documentos de diseño de `/specs/001-acceso-y-usuarios/`

**Prerequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **incluidos y obligatorios**. El Principio XI de la constitución exige criterios de aceptación escritos antes de programar, y D-009 define dos niveles de prueba con umbrales de cobertura que hacen fallar `pnpm test`. No son opcionales en esta épica.

**Organización**: las tareas se agrupan por historia de usuario, de modo que cada una pueda implementarse, probarse y demostrarse por separado.

## Formato: `[ID] [P?] [Story] Descripción`

- **[P]**: puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1 = HU-08, US2 = HU-09, US3 = HU-10)
- Cada tarea indica su ruta de archivo exacta

## Convención de rutas

Monorepo pnpm con tres espacios de trabajo (plan.md § Estructura):

- `apps/web/` — Next.js 15, App Router
- `services/api/` — NestJS 11
- `packages/shared/` — contratos de dominio, sin dependencias de red ni de base de datos

---

## Phase 1: Setup (infraestructura compartida)

**Propósito**: dejar el monorepo instalable y con las herramientas comunes en pie.

- [ ] T001 Crear `pnpm-workspace.yaml` en la raíz declarando `apps/*`, `services/*` y `packages/*` (D-008)
- [ ] T002 Crear `package.json` de la raíz con los scripts `dev`, `build`, `test`, `test:integration`, `lint` y `typecheck` delegados a Turborepo, y `engines` fijando `"node": ">=22 <23"` (D-013)
- [ ] T003 Crear `turbo.json` declarando el grafo de tareas y que `packages/shared` se compile antes que sus consumidores (D-008)
- [ ] T004 [P] Crear `tsconfig.base.json` en la raíz con `strict: true`, heredado por los tres paquetes (plan § Contexto Técnico)
- [ ] T005 [P] Configurar ESLint y Prettier en la raíz con `eslint.config.mjs` y `.prettierrc`
- [ ] T006 [P] Crear `.nvmrc` con `22` y verificar que coincide con `engines` y con los `Dockerfile` (ops CHK012)
- [ ] T007 [P] Crear `.env.example` con las nueve variables de `quickstart.md` §1, sin valores reales, y confirmar que `.env` está en `.gitignore` (Principio V, FR-028)

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Propósito**: contratos compartidos, esquema de datos e infraestructura de la API y de la web. Corresponde a la **Fase A** del plan.

**⚠️ CRÍTICO**: ninguna historia de usuario puede comenzar hasta completar esta fase.

### `packages/shared` — contratos de dominio (D-005)

- [ ] T008 Crear el esqueleto de `packages/shared`: `package.json` con `zod` como única dependencia de producción, `tsconfig.json` y configuración de Vitest
- [ ] T009 [P] Definir `Role` y `UserStatus` como objetos constantes con sus tipos inferidos en `packages/shared/src/enums/role.ts` (FR-002, RN-001, RN-003)
- [ ] T010 [P] Definir `AdminAction` con sus seis valores en `packages/shared/src/enums/admin-action.ts`, uno por cada acción de FR-034
- [ ] T011 [P] Declarar los mensajes fijos en español en `packages/shared/src/messages/es.ts` — credenciales inválidas, cuenta bloqueada, sin permiso, sesión expirada, sin resultados de usuarios y de pedidos, correo ya existe, autoprotección (FR-008, SC-018)
- [ ] T012 [P] Implementar `normalizarBusqueda` y `escaparLike` en `packages/shared/src/search/normalizar.ts` siguiendo los cinco pasos de D-011: NFD, eliminación de marcas combinantes, minúsculas, colapso de espacios y recorte
- [ ] T013 Implementar `PasswordSchema` en `packages/shared/src/schemas/password.ts` exigiendo mínimo 8 caracteres y máximo 72 **bytes UTF-8**, con mensajes en español (FR-032, D-002)
- [ ] T014 [P] Implementar `LoginSchema` en `packages/shared/src/schemas/auth.ts`, con normalización del correo y **sin** validación de longitud de contraseña (FR-008)
- [ ] T015 [P] Implementar `CreateUserSchema`, `UpdateUserSchema`, `ChangeRoleSchema`, `ChangeStatusSchema` y `ResetPasswordSchema` en `packages/shared/src/schemas/user.ts` con las longitudes de `data-model.md` §user (FR-009, FR-010, FR-014)
- [ ] T016 [P] Implementar `ListUsersQuerySchema` y la constante `PAGE_SIZE = 20` en `packages/shared/src/schemas/query.ts`, sin exponer `pageSize` ni parámetros de ordenamiento (FR-015, D-016)
- [ ] T017 [P] Declarar `UserDto`, `SessionUser` y `Paginated<T>` en `packages/shared/src/types/api.ts`, ninguno con contraseña ni hash (FR-007, FR-016)
- [ ] T018 Exponer la superficie pública del paquete en `packages/shared/src/index.ts`
- [ ] T019 [P] Escribir los tests de los esquemas en `packages/shared/tests/schemas.test.ts`: cada uno acepta lo válido y rechaza lo inválido **con el mensaje en español exacto**; ningún campo obligatorio puede faltar (FR-014, SC-005); `PasswordSchema` rechaza 7 y acepta 8, rechaza 73 y acepta 72, y rechaza una contraseña de menos de 72 caracteres acentuados que supere los 72 bytes (SC-016)
- [ ] T020 [P] Escribir los tests de normalización en `packages/shared/tests/normalizar.test.ts`: «MARÍA» encuentra «María», «Nunez» encuentra «Nuñez», los espacios múltiples se colapsan, y `escaparLike` neutraliza `%`, `_` y `\` (SC-021)
- [ ] T021 [P] Escribir el test de los mensajes fijos en `packages/shared/tests/messages.test.ts`, comprobando que existen y no están vacíos — impide que una constante se borre y rompa la igualdad de SC-018

### `services/api` — esqueleto, datos e infraestructura

- [ ] T022 Crear el esqueleto de NestJS 11 en `services/api` con `package.json`, `tsconfig.json`, `main.ts` y prefijo global `/api/v1`
- [ ] T023 Definir los cuatro modelos, los tres enums y los índices en `services/api/prisma/schema.prisma` según `data-model.md`, con `email` como `text` único (D-015), el índice `(createdAt desc, id desc)` (D-016) y `onDelete: Restrict` en las tres claves foráneas, que es lo que hace cumplir la conservación del historial **en el motor** (RN-002)
- [ ] T024 Generar la migración inicial con `prisma migrate dev` en `services/api/prisma/migrations/`, poblando `search_normalized` en tres pasos —nullable, `UPDATE`, `NOT NULL`— según D-011
- [ ] T025 Implementar `PrismaService` y su módulo en `services/api/src/prisma/`, con conexión y desconexión ligadas al ciclo de vida de Nest
- [ ] T026 Implementar `ClockService` con el método `ahora(): Date` en `services/api/src/common/clock.service.ts`, única fuente de tiempo de la aplicación (D-009)
- [ ] T027 [P] Implementar el `ZodValidationPipe` en `services/api/src/common/pipes/zod-validation.pipe.ts`, traduciendo los errores de Zod al formato `{ error: { code, message, fields } }` (contrato § Convenciones de error)
- [ ] T028 [P] Implementar el filtro global de excepciones en `services/api/src/common/filters/http-exception.filter.ts` con los ocho códigos de error del contrato, garantizando que ningún mensaje filtre detalles técnicos (FR-007, Principio II)
- [ ] T029 [P] Implementar el serializador de fechas a ISO 8601 en UTC en `services/api/src/common/interceptors/date.interceptor.ts` (api CHK002)
- [ ] T030 Implementar `GET /api/v1/health` sin autenticación en `services/api/src/health/`, devolviendo `{ status: "ok" }` y comprobando la conexión a PostgreSQL (D-013)
- [ ] T031 Implementar la validación de arranque de las variables de entorno obligatorias en `services/api/src/config/env.validation.ts`, que **falla nombrando la variable ausente** y termina con código distinto de cero (ops CHK003)
- [ ] T032 Implementar el script de semilla en `services/api/prisma/seed.ts`: idempotente por `ADMIN_SEED_EMAIL` normalizado, sin contraseña por defecto, y que **falla explícitamente** si el correo existe con otro rol o desactivado (FR-028, D-010)
- [ ] T033 Añadir el modo de recuperación `--recuperar` al script de semilla, que fuerza la cuenta a administrador activo, revoca sus sesiones y registra la acción con actor igual al afectado (FR-036, D-010)
- [ ] T034 [P] Escribir el test de integración de la semilla en `services/api/test/seed.integration-spec.ts`: dos ejecuciones seguidas dejan el mismo estado, y la segunda no altera la contraseña (ops CHK017)

### `apps/web` — esqueleto y proxy

- [ ] T035 Crear el esqueleto de Next.js 15 con App Router en `apps/web`, con `output: 'standalone'` en `next.config.ts`
- [ ] T036 [P] Configurar TailwindCSS 4 y shadcn/ui en `apps/web`, copiando los componentes al repositorio en `apps/web/src/components/ui/`
- [ ] T037 [P] Configurar Vitest y Testing Library en `apps/web/vitest.config.ts`
- [ ] T038 Implementar el Route Handler de proxy en `apps/web/src/app/api/[...path]/route.ts`, con reenvío transparente, propagación de la cookie `fv_session` y del `Set-Cookie`, y sin lógica de negocio (D-006, contrato § Proxy)

### Contenedores

- [ ] T039 [P] Crear `services/api/Dockerfile` multi-etapa sobre `node:22-alpine`, con `USER node` y un `entrypoint` que ejecuta `prisma migrate deploy` antes de arrancar el servidor (D-013)
- [ ] T040 [P] Crear `apps/web/Dockerfile` multi-etapa sobre `node:22-alpine`, con `USER node` y salida standalone
- [ ] T041 Crear `docker-compose.yml` con los tres servicios, sus `healthcheck` y políticas de reinicio, el volumen nombrado `foodvoice_pgdata`, y publicando **solo** el puerto de `web` (D-006, D-013)
- [ ] T042 [P] Crear `docker-compose.test.yml` con una PostgreSQL efímera en otro puerto para los tests de integración (D-009)
- [ ] T043 Crear el arranque compartido de los tests de integración en `services/api/test/setup.ts`, que aplica migraciones y **aísla cada caso** truncando las tablas entre pruebas (ops CHK021)

**Checkpoint**: `docker compose up` levanta los tres servicios, la migración se aplica, la semilla crea el administrador y `pnpm test` pasa. Fin de la Fase A del plan.

---

## Phase 3: User Story 1 — Autenticación y sesión con control por rol (HU-08, P1) 🎯 MVP

**Objetivo**: que un usuario inicie sesión con correo y contraseña, llegue a la página de su rol, y que el sistema mantenga, expire y cierre su sesión aplicando el rol en el servidor.

**Prueba independiente**: ejecutar la sección A completa de `quickstart.md` usando solo el administrador semilla. No requiere HU-09 ni HU-10.

### Tests de la historia 1 ⚠️

> Escribir estos tests **antes** de la implementación y comprobar que fallan (Principio XI).

- [ ] T044 [P] [US1] Test unitario del hash de contraseñas en `services/api/src/auth/hashing.service.spec.ts`: bcrypt coste 12, y la comparación se ejecuta **siempre**, contra un hash señuelo si el usuario no existe (D-002)
- [ ] T045 [P] [US1] Test unitario del control de intentos en `services/api/src/auth/login-attempt.service.spec.ts` con `ClockService` sustituido: el quinto fallo bloquea 15 minutos, el bloqueo vencido se ignora, y el acierto elimina la fila (FR-033)
- [ ] T046 [P] [US1] Test unitario de `SessionGuard` en `services/api/src/common/guards/session.guard.spec.ts`: las tres condiciones de validez de sesión, con el umbral de 30 minutos medido contra el reloj inyectado (FR-005)
- [ ] T047 [P] [US1] Test unitario de `RolesGuard` en `services/api/src/common/guards/roles.guard.spec.ts`: el rol se lee de la sesión, no del usuario (FR-002, FR-011, D-007)
- [ ] T048 [P] [US1] Test de integración del inicio de sesión en `services/api/test/auth-login.integration-spec.ts`: credenciales correctas crean sesión; contraseña incorrecta, usuario inexistente y usuario desactivado devuelven **el mismo** `401` (FR-008, FR-012, SC-002)
- [ ] T049 [P] [US1] Test de integración del bloqueo temporal en `services/api/test/auth-lockout.integration-spec.ts`: cinco fallos bloquean, el mensaje es **idéntico** para correo registrado e inexistente, y el bloqueo rechaza incluso la contraseña correcta (FR-033, SC-017, SC-018)
- [ ] T050 [P] [US1] Test de integración del ciclo de vida de la sesión en `services/api/test/auth-session.integration-spec.ts`: expiración por inactividad envejeciendo `last_activity_at`, cierre explícito, rechazo íntegro sin cambios parciales, y que una sucesión de peticiones mantiene viva la sesión sin reautenticar (FR-004, FR-005, FR-006, FR-030, SC-013)
- [ ] T051 [P] [US1] Test de integración de la denegación por rol en `services/api/test/auth-roles.integration-spec.ts`: un usuario de cada rol no administrador recibe `403` con `MSG_SIN_PERMISO` al pedir una ruta reservada, verificando que el bloqueo ocurre **en el procesamiento** y no solo ocultando opciones en pantalla (FR-002, FR-003, SC-003)

### Implementación de la historia 1

- [ ] T052 [P] [US1] Implementar `HashingService` en `services/api/src/auth/hashing.service.ts` con bcrypt coste 12 y el hash señuelo constante para igualar tiempos de respuesta (D-002)
- [ ] T053 [P] [US1] Implementar `LoginAttemptService` en `services/api/src/auth/login-attempt.service.ts` sobre `login_attempt_control`, con clave por correo normalizado y sin clave foránea a `user` (FR-033, D-003)
- [ ] T054 [US1] Implementar `SessionService` en `services/api/src/auth/session.service.ts`: creación con rol congelado, validación y refresco de `last_activity_at` en un único `UPDATE ... RETURNING` con `JOIN` a `user`, lo que mantiene la sesión viva mientras el usuario interactúa (FR-004, D-001, data CHK017)
- [ ] T055 [US1] Implementar `AuthService` en `services/api/src/auth/auth.service.ts` con los cinco pasos obligatorios del contrato para el inicio de sesión, en ese orden (contrato § POST /auth/login)
- [ ] T056 [US1] Implementar `SessionGuard` en `services/api/src/common/guards/session.guard.ts`, aplicando el umbral de 30 minutos contra `ClockService` (FR-005)
- [ ] T057 [US1] Implementar `RolesGuard` y el decorador `@Roles()` en `services/api/src/common/guards/`, leyendo el rol de la sesión para determinar qué funciones están disponibles (FR-002, FR-003, FR-018, D-007)
- [ ] T058 [US1] Implementar `POST /api/v1/auth/login` en `services/api/src/auth/auth.controller.ts`, estableciendo la cookie `fv_session` (`httpOnly`, `SameSite=Lax`, `Secure` en producción) y devolviendo `redirectTo` según el rol (FR-001, FR-031)
- [ ] T059 [US1] Implementar `POST /api/v1/auth/logout` en el mismo controlador, idempotente y devolviendo 204 (FR-006)
- [ ] T060 [US1] Implementar `GET /api/v1/auth/me` en el mismo controlador, con el rol tomado de la sesión (FR-011, FR-031)
- [ ] T061 [P] [US1] Implementar la pantalla de inicio de sesión en `apps/web/src/app/login/page.tsx` con `react-hook-form` y `LoginSchema`, mostrando los mensajes en español del paquete compartido (FR-001, Principio II)
- [ ] T062 [US1] Implementar `apps/web/src/middleware.ts`, que redirige a `/login` sin cookie y desde la raíz al segmento del rol, **sin** ejercer autorización real (D-007)
- [ ] T063 [P] [US1] Implementar las páginas de inicio de cliente, negocio y repartidor en `apps/web/src/app/{cliente,negocio,repartidor}/page.tsx`, cada una con nombre, rol y «Cerrar sesión» (FR-031)
- [ ] T064 [P] [US1] Implementar el manejo de sesión expirada en `apps/web/src/lib/api-client.ts`: ante un `401`, mostrar `MSG_SESION_EXPIRADA` y llevar a `/login` (FR-030)
- [ ] T065 [US1] Verificar que `apps/web` **no contiene** ningún `setInterval`, sondeo ni refresco en segundo plano contra la API, y dejarlo cubierto por una regla de ESLint en `eslint.config.mjs` (FR-005, SC-024, quickstart D7)
- [ ] T066 [P] [US1] Escribir los tests de componente de la pantalla de inicio de sesión en `apps/web/tests/login.test.tsx`: campos obligatorios, mensajes en español y estado de carga

**Checkpoint**: la sección A de `quickstart.md` pasa íntegra. HU-08 es demostrable por sí sola. **Este es el MVP.**

---

## Phase 4: User Story 2 — Gestión de usuarios y roles (HU-09, P2)

**Objetivo**: que el administrador dé de alta, edite, busque, filtre, cambie de rol, desactive, reactive y restablezca contraseñas, con confirmación previa y bitácora de cada acción.

**Prueba independiente**: ejecutar la sección B completa de `quickstart.md`. Depende de US1 solo para autenticarse, no para su lógica.

### Tests de la historia 2 ⚠️

- [ ] T067 [P] [US2] Test unitario de `AuditService` en `services/api/src/audit/audit.service.spec.ts`: solo inserción, nunca contraseñas, y la entrada va en la transacción de la acción (FR-034)
- [ ] T068 [P] [US2] Test unitario de la autoprotección en `services/api/src/users/users.service.spec.ts`: un administrador no puede desactivarse ni cambiarse el rol, pero sí editar sus datos de contacto (FR-027, SC-014)
- [ ] T069 [P] [US2] Test de integración de la unicidad del correo en `services/api/test/users-email.integration-spec.ts`, incluido el alta **variando las mayúsculas** y con el correo de un usuario desactivado (FR-017, RN-005, SC-011, D-015)
- [ ] T070 [P] [US2] Test de integración de la revocación transaccional en `services/api/test/users-impact.integration-spec.ts`: las cuatro acciones de impacto revocan las sesiones del afectado y **nunca** las del administrador que actúa; tras un cambio de rol no queda ninguna ventana en que el usuario conserve privilegios del rol anterior (FR-024, SC-006, SC-025, SC-026)
- [ ] T071 [P] [US2] Test de integración del listado en `services/api/test/users-list.integration-spec.ts`: orden estable entre páginas, búsqueda insensible a mayúsculas y acentos, término con `%` escapado, resultados que cumplen **todos** los criterios aplicados, y `page` fuera de rango devuelve 200 con lista vacía (FR-015, SC-009, SC-021, SC-023)
- [ ] T072 [P] [US2] Test de integración del restablecimiento en `services/api/test/users-password.integration-spec.ts`: la contraseña anterior deja de servir, el bloqueo temporal se levanta y la bitácora no guarda la contraseña (FR-026, FR-033, SC-012)
- [ ] T073 [P] [US2] Test de integración del mínimo de administradores en `services/api/test/users-last-admin.integration-spec.ts`: ejecutar una secuencia de desactivaciones y cambios de rol entre varios administradores y afirmar que **el conteo de administradores activos nunca llega a cero**, incluido el intento del último de retirarse a sí mismo (FR-027, RN-006, SC-022)
- [ ] T074 [P] [US2] Test de integración del alta operativa en `services/api/test/users-create-login.integration-spec.ts`: crear un usuario con cada rol y comprobar **en la misma prueba** que puede iniciar sesión de inmediato con el rol asignado (FR-009, SC-004)

### Implementación de la historia 2

- [ ] T075 [US2] Implementar `AuditService` y su módulo en `services/api/src/audit/`, expuesto **solo** con la operación de inserción (FR-034)
- [ ] T076 [US2] Implementar `UsersService` en `services/api/src/users/users.service.ts` con las reglas que exigen consulta: unicidad del correo y autoprotección del administrador (FR-017, FR-027, RN-006, D-005)
- [ ] T077 [US2] Implementar `GET /api/v1/admin/users` en `services/api/src/users/users.controller.ts` con búsqueda normalizada y escapada, filtros combinables, paginación de 20 y orden `created_at DESC, id DESC` (FR-015, SC-009, D-016)
- [ ] T078 [US2] Implementar `POST /api/v1/admin/users`, admitiendo el rol `ADMINISTRADOR` y registrando `CREAR` en la misma transacción (FR-009, FR-034, SC-004)
- [ ] T079 [US2] Implementar `PATCH /api/v1/admin/users/:id` para datos de contacto y correo, recalculando `search_normalized` y registrando `EDITAR` (FR-010)
- [ ] T080 [US2] Implementar `PUT /api/v1/admin/users/:id/role` con la transacción de tres pasos: actualizar rol, revocar sesiones del afectado y registrar `CAMBIAR_ROL` (FR-011, FR-024, SC-026)
- [ ] T081 [US2] Implementar `PUT /api/v1/admin/users/:id/status` para desactivar y reactivar, con revocación de sesiones y registro de `DESACTIVAR` o `REACTIVAR`, conservando íntegro el historial del usuario (FR-012, FR-013, FR-024, RN-002, SC-006)
- [ ] T082 [US2] Implementar `POST /api/v1/admin/users/:id/password-reset` con los cuatro efectos de la transacción: rehash, revocación de sesiones, borrado del bloqueo y registro **sin** la contraseña (FR-026, FR-033, FR-034)
- [ ] T083 [P] [US2] Implementar el listado de usuarios en `apps/web/src/app/admin/usuarios/page.tsx` con búsqueda, filtros por rol y estado, paginación y total de resultados (FR-015)
- [ ] T084 [P] [US2] Implementar el estado vacío del listado en `apps/web/src/app/admin/usuarios/_components/sin-resultados.tsx`, con el mensaje en español y la vuelta a la primera página (FR-015, SC-020)
- [ ] T085 [P] [US2] Implementar el formulario de alta en `apps/web/src/app/admin/usuarios/nuevo/page.tsx` con `CreateUserSchema` y los cinco campos obligatorios (FR-009, FR-014, SC-005)
- [ ] T086 [P] [US2] Implementar el formulario de edición en `apps/web/src/app/admin/usuarios/[id]/editar/page.tsx` con `UpdateUserSchema` (FR-010)
- [ ] T087 [US2] Implementar el diálogo de confirmación reutilizable en `apps/web/src/components/confirmar-accion.tsx` con `AlertDialog` de shadcn/ui, indicando a quién afecta y qué efecto tiene (FR-035, Principio IX)
- [ ] T088 [US2] Conectar el diálogo a las cuatro acciones de impacto desde `apps/web/src/app/admin/usuarios/_components/acciones-usuario.tsx`, garantizando que cancelar no dispara ninguna llamada (FR-035, SC-019)
- [ ] T089 [P] [US2] Escribir los tests de componente del listado y los formularios en `apps/web/tests/usuarios.test.tsx`: mensajes en español, estado vacío y cancelación de la confirmación

**Checkpoint**: la sección B de `quickstart.md` pasa íntegra. HU-08 y HU-09 funcionan de forma independiente.

---

## Phase 5: User Story 3 — Panel y reportes del administrador (HU-10, P3)

**Objetivo**: un panel de solo lectura con las métricas de usuarios activos por rol y la superficie de reportes de pedidos, que en E1 permanece vacía por diseño.

**Prueba independiente**: ejecutar la sección C completa de `quickstart.md`, con la salvedad de que las métricas de pedidos siguen en cero hasta E4/E2.

### Tests de la historia 3 ⚠️

- [ ] T090 [P] [US3] Test unitario de la máquina de estados en `packages/shared/tests/order-state.test.ts`: las transiciones son estrictamente lineales y `cerrado` es terminal (Principio XII, FR-023)
- [ ] T091 [P] [US3] Test de integración de las métricas en `services/api/test/dashboard-metrics.integration-spec.ts`: el conteo por rol coincide con el padrón y los roles sin usuarios activos devuelven cero explícito (FR-019, data CHK030)
- [ ] T092 [P] [US3] Test de integración del reporte en `services/api/test/dashboard-orders.integration-spec.ts`: devuelve lista vacía, los filtros combinados no arrastran datos ajenos, y `from > to` produce `400` con mensaje en español (FR-020, SC-009)
- [ ] T093 [P] [US3] Test de integración del control de acceso en `services/api/test/dashboard-access.integration-spec.ts`: los tres roles no administradores reciben `403` en todos los endpoints del panel (FR-018, SC-008)

### Implementación de la historia 3

- [ ] T094 [P] [US3] Definir `OrderStatus` con sus cinco estados en `packages/shared/src/enums/order-status.ts` (Principio XII, D-012)
- [ ] T095 [US3] Implementar `transicionesValidas` y `esTransicionValida` en `packages/shared/src/order-state/machine.ts`, **sin** crear la entidad `Pedido` (D-012, Principio III)
- [ ] T096 [US3] Implementar `DashboardService` y su módulo en `services/api/src/dashboard/`, exponiendo **solo** verbos `GET` (FR-021, RN-004)
- [ ] T097 [US3] Implementar `GET /api/v1/admin/dashboard/metrics` con el conteo de usuarios activos por rol y los pedidos por estado en cero (FR-019, D-012)
- [ ] T098 [US3] Implementar `GET /api/v1/admin/dashboard/orders` con filtros combinables por estado y rango de fechas, y validación de `from > to` (FR-020, SC-009)
- [ ] T099 [P] [US3] Implementar el panel en `apps/web/src/app/admin/page.tsx` como página de inicio del administrador, con acceso a la gestión de usuarios (FR-031, ux CHK022)
- [ ] T100 [P] [US3] Implementar el reporte de pedidos en `apps/web/src/app/admin/pedidos/page.tsx` con los filtros y el mensaje de «sin datos» en español (FR-020, FR-022, SC-020)
- [ ] T101 [US3] Inventariar las vistas del panel en `apps/web/src/app/admin/_components/vistas-panel.ts` y verificar que ninguna ofrece acciones que modifiquen datos, de modo que SC-015 sea comprobable contra una lista explícita (FR-021, RN-004)
- [ ] T102 [P] [US3] Escribir los tests de componente del panel en `apps/web/tests/panel.test.tsx`: métricas visibles, mensaje de sin datos y ausencia de controles de escritura

**Checkpoint**: las tres historias funcionan de forma independiente. Fin de la Fase D del plan.

---

## Phase 6: Polish y aspectos transversales

**Propósito**: cerrar la épica con las garantías que atraviesan las tres historias.

- [ ] T103 Configurar los umbrales de cobertura por ámbito en la configuración de cada paquete, de modo que su incumplimiento **haga fallar** `pnpm test`: 90 % en `services/api/src/{auth,users,audit}`, 100 % en `packages/shared`, 80 % en el resto de la API y 70 % en `apps/web` (quickstart § Comprobaciones automáticas)
- [ ] T104 [P] Configurar `helmet` en `services/api/src/main.ts` y confirmar que la marca `Secure` de la cookie depende de `NODE_ENV=production` (ops CHK013)
- [ ] T105 [P] Configurar el registro de la aplicación en `services/api/src/common/logger.ts` con una lista de campos censurados —contraseña, hash, cadena de conexión, cookie de sesión— y comprobar que ninguno aparece en la salida (FR-007, ops CHK005, ops CHK031)
- [ ] T106 [P] Escribir el `README.md` de la raíz remitiendo a `quickstart.md` para la puesta en marcha, sin duplicar sus instrucciones
- [ ] T107 Ejecutar las cinco comprobaciones automáticas —`test`, `test:integration`, `lint`, `typecheck`, `build`— y dejarlas todas en verde
- [ ] T108 Ejecutar la validación funcional completa de `quickstart.md` secciones A, B y C, incluidas las esperas reales de A5 y A9, y cronometrar el inicio de sesión y la carga del panel para confirmar que ambos bajan de 5 segundos (SC-001, SC-007, supuesto 22)
- [ ] T109 Ejecutar la verificación técnica de `quickstart.md` sección D (D1 a D8) en la revisión de la implementación (SC-010)

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Setup (Phase 1)**: sin dependencias, puede empezar de inmediato
- **Foundational (Phase 2)**: depende del Setup — **bloquea todas las historias**
- **Historias (Phases 3-5)**: todas dependen de Foundational
  - Pueden ir en paralelo con equipo suficiente, o en orden de prioridad P1 → P2 → P3
- **Polish (Phase 6)**: depende de las historias que se quieran entregar

### Dependencias entre historias

- **US1 (P1)**: puede empezar en cuanto termine Foundational. Sin dependencias de otras historias.
- **US2 (P2)**: puede empezar en cuanto termine Foundational. Usa la autenticación de US1 para **acceder**, pero su lógica es independiente y sus tests de integración crean su propia sesión. T074 es la única tarea que cruza deliberadamente a US1, porque SC-004 mide precisamente esa costura.
- **US3 (P3)**: puede empezar en cuanto termine Foundational. Consume el padrón de usuarios que US2 gestiona, pero sus métricas funcionan sobre el administrador semilla sin necesidad de HU-09.

### Dentro de cada historia

- Los tests se escriben **antes** y deben fallar (Principio XI)
- Modelos antes que servicios; servicios antes que endpoints; API antes que interfaz
- Una historia se termina antes de pasar a la siguiente prioridad

### Oportunidades de paralelismo

- Todo el bloque T009–T021 de `packages/shared` es paralelizable salvo T013 y T018, que dependen del resto
- Los tests de una misma historia marcados `[P]` corren en paralelo: ocho en US1 (T044–T051), ocho en US2 (T067–T074), cuatro en US3 (T090–T093)
- Backend y frontend de una misma historia pueden avanzar a la vez una vez fijado el contrato
- Con equipo, las tres historias avanzan simultáneamente tras el checkpoint de Foundational

---

## Ejemplo de paralelismo: historia 1

```bash
# Los cuatro tests unitarios, a la vez:
Task: "Test del hash de contraseñas en services/api/src/auth/hashing.service.spec.ts"
Task: "Test del control de intentos en services/api/src/auth/login-attempt.service.spec.ts"
Task: "Test de SessionGuard en services/api/src/common/guards/session.guard.spec.ts"
Task: "Test de RolesGuard en services/api/src/common/guards/roles.guard.spec.ts"

# Los cuatro tests de integración, a la vez:
Task: "Integración del inicio de sesión en services/api/test/auth-login.integration-spec.ts"
Task: "Integración del bloqueo temporal en services/api/test/auth-lockout.integration-spec.ts"
Task: "Integración del ciclo de vida de la sesión en services/api/test/auth-session.integration-spec.ts"
Task: "Integración de la denegación por rol en services/api/test/auth-roles.integration-spec.ts"
```

---

## Estrategia de implementación

### MVP primero (solo historia 1)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational — **crítico, bloquea todo lo demás**
3. Completar Phase 3: historia 1
4. **PARAR Y VALIDAR**: ejecutar la sección A de `quickstart.md` entera
5. Demostrable: un usuario inicia sesión, llega a la página de su rol, la sesión expira y se cierra

### Entrega incremental

1. Setup + Foundational (T001–T043) → cimientos listos (Fase A del plan)
2. + Historia 1 (T044–T066) → validar sección A → **MVP** (Fase B)
3. + Historia 2 (T067–T089) → validar sección B (Fase C)
4. + Historia 3 (T090–T102) → validar sección C (Fase D)
5. + Polish (T103–T109) → épica cerrada

Cada incremento añade valor sin romper el anterior.

---

## Notas

- Las tareas `[P]` tocan archivos distintos y no dependen entre sí
- La etiqueta `[Story]` permite trazar cada tarea hasta su historia
- Verificar que los tests fallan antes de implementar (Principio XI)
- Conviene commitear por tarea o por grupo lógico
- **FR-025, FR-029 y RN-007 son requisitos negativos** —no hay autorregistro, ni exportación de reportes, ni actualización en tiempo real— y por tanto no tienen tarea de construcción: se cumplen por ausencia y los confirma la validación funcional en los pasos B20 y C7 de `quickstart.md` (T108)
- **SC-001 y SC-007 no tienen cobertura automática**: se cronometran a mano en T108, conforme al supuesto 22. Si el rendimiento se degradara, lo detectaría una persona validando, no la batería de pruebas
- **Las métricas de pedidos de FR-019, FR-020 y FR-023 se entregan vacías por diseño**: la entidad `Pedido` pertenece a E4/E2 y construirla aquí violaría el Principio III (D-012)
- Los mensajes visibles al usuario van **siempre** en español y **siempre** desde `packages/shared`, nunca como literales dispersos (Principio II, SC-018)
