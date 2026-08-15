# Tasks: E1 · Acceso y usuarios

**Input**: Documentos de diseño de `/specs/001-acceso-y-usuarios/`

**Prerequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **incluidos y obligatorios**. El Principio XI de la constitución exige criterios de aceptación escritos antes de programar, y D-009 define dos niveles de prueba con umbrales de cobertura que hacen fallar `pnpm test`. No son opcionales en esta épica.

**Organización**: las tareas se agrupan por historia de usuario, de modo que cada una pueda implementarse, probarse y demostrarse por separado.

**Revisión del 2026-08-15**: este plan de tareas se regeneró tras cerrar cuatro checklists de calidad —`security.md`, `api.md`, `data.md` y `ux.md`—, cuyas resoluciones añadieron comportamiento que la versión anterior no contemplaba. De `security.md` y `api.md`: `OrdersQuerySchema`, constantes de mensaje nuevas, el límite de tamaño del cuerpo, el manejo de fallo del proxy, la traducción de la violación de unicidad, la idempotencia de `PUT status` y la resolución uniforme de la cookie. De `data.md`: el disparador de inmutabilidad de la bitácora, el `UPSERT` atómico del contador de intentos y la retirada de un índice sin lector. De `ux.md`: las convenciones de interfaz, las etiquetas visibles, la confirmación de éxito, el estado de carga con prevención de doble envío, la accesibilidad y el huso horario de referencia. Cada tarea afectada cita la checklist y el ítem que la originó.

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

- [X] T001 Crear `pnpm-workspace.yaml` en la raíz declarando `apps/*`, `services/*` y `packages/*` (D-008)
- [X] T002 Crear `package.json` de la raíz con los scripts `dev`, `build`, `test`, `test:integration`, `lint` y `typecheck` delegados a Turborepo, y `engines` fijando `"node": ">=22 <23"` (D-013)
- [X] T003 Crear `turbo.json` declarando el grafo de tareas y que `packages/shared` se compile antes que sus consumidores —sin ese orden, `pnpm -r build` falla de forma intermitente—, con **`cache: false` para `test:integration`**: dependen de una base de datos externa cuyo estado Turborepo no observa, y cachearlos podría dejar en verde una batería que no volvió a ejecutarse (D-008, architecture CHK005, architecture CHK006)
- [X] T004 [P] Crear `tsconfig.base.json` en la raíz con `strict: true`, heredado por los tres paquetes (plan § Contexto Técnico)
- [X] T005 [P] Configurar ESLint y Prettier en la raíz con `eslint.config.mjs` y `.prettierrc`
- [X] T006 [P] Crear `.nvmrc` con `22` y verificar que coincide con `engines` y con los `Dockerfile` (ops CHK012)
- [X] T007 [P] Crear `.env.example` con las variables de `quickstart.md` §1, sin valores reales, y confirmar que `.env` está en `.gitignore` (Principio V, FR-028)

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Propósito**: contratos compartidos, esquema de datos e infraestructura de la API y de la web. Corresponde a la **Fase A** del plan.

**⚠️ CRÍTICO**: ninguna historia de usuario puede comenzar hasta completar esta fase.

### `packages/shared` — contratos de dominio (D-005)

- [X] T008 Crear el esqueleto de `packages/shared`: `package.json` con `zod` como única dependencia de producción y declarado por sus consumidores como `workspace:*` —nunca publicado en un registro, lo que hace imposible una divergencia de versiones entre frontend y backend (`shared.md` § Compatibilidad, api CHK030)—, más `tsconfig.json` y configuración de Vitest
- [X] T009 [P] Definir `Role` y `UserStatus` como objetos constantes con sus tipos inferidos en `packages/shared/src/enums/role.ts` (FR-002, RN-001, RN-003)
- [X] T010 [P] Definir `AdminAction` con sus seis valores en `packages/shared/src/enums/admin-action.ts`, uno por cada acción de FR-034 y **ninguno más**: la ausencia de valores para los eventos de autenticación es lo que hace estructural su exclusión del registro, en lugar de depender de que el código recuerde no escribirlos (FR-034, supuesto 27, security CHK032)
- [X] T011 [P] Definir `OrderStatus` con sus cinco estados en `packages/shared/src/enums/order-status.ts` (Principio XII, D-012). Va en esta fase, y no en la historia 3, porque `OrdersQuerySchema` (T018) lo necesita; la máquina de transiciones sí pertenece a US3
- [X] T012 [P] Declarar los **doce** mensajes fijos en español en `packages/shared/src/messages/es.ts`: credenciales inválidas, cuenta bloqueada, sin permiso, sesión expirada, sin resultados de usuarios y de pedidos, correo ya existe, autoprotección, error inesperado, contraseña olvidada, rango de fechas inválido y sin datos de pedidos. Este archivo es su **única fuente**: ningún otro módulo ni documento reproduce su texto (FR-008, SC-018, api CHK015)
- [X] T013 [P] Declarar en `packages/shared/src/messages/etiquetas.ts` las etiquetas visibles `ETIQUETA_ROL`, `ETIQUETA_ESTADO` y `ETIQUETA_ESTADO_PEDIDO`, más `MSG_EXITO` indexado por `AdminAction`, y la constante `HUSO_REFERENCIA = 'America/Santiago'`. Las etiquetas son la razón por la que los identificadores internos en mayúsculas nunca llegan a la pantalla, y el tipado de `MSG_EXITO` impide añadir una acción registrable sin su mensaje de éxito (FR-037, spec § Vocabulario visible, ux CHK006, ux CHK007, ux CHK026)
- [X] T014 [P] Implementar `normalizarBusqueda` y `escaparLike` en `packages/shared/src/search/normalizar.ts` siguiendo los cinco pasos de D-011: NFD, eliminación de marcas combinantes, minúsculas, colapso de espacios y recorte. Dejar escrito en el propio archivo que alimenta una columna **persistida**, de modo que todo cambio futuro exige una migración que la repueble (api CHK030)
- [X] T015 Implementar `PasswordSchema` en `packages/shared/src/schemas/password.ts` exigiendo mínimo 8 caracteres y máximo 72 **bytes UTF-8**, con mensajes en español (FR-032, D-002)
- [X] T016 [P] Implementar `LoginSchema` en `packages/shared/src/schemas/auth.ts`, con normalización del correo y **sin** validación de longitud de contraseña: validarla revelaría por diferencia de mensaje una característica de la credencial almacenada, que es la cuarta prohibición de FR-008 (security CHK017)
- [X] T017 [P] Implementar `CreateUserSchema`, `UpdateUserSchema`, `ChangeRoleSchema`, `ChangeStatusSchema` y `ResetPasswordSchema` en `packages/shared/src/schemas/user.ts` con los formatos y límites de la tabla de FR-014 —nombre 2–120, correo válido de hasta 254, teléfono 6–20 sin validación de estructura—. `UpdateUserSchema` DEBE **reutilizar** las definiciones de `CreateUserSchema`, no repetirlas, para que ninguna edición deje un usuario en un estado que su alta habría rechazado (FR-009, FR-010, FR-014, security CHK003)
- [X] T018 [P] Implementar `ListUsersQuerySchema` con `PAGE_SIZE = 20`, y `OrdersQuerySchema` con su `FechaSchema` en `packages/shared/src/schemas/query.ts`. Las fechas son `AAAA-MM-DD`, se valida que el día exista y que `from <= to` comparando las cadenas, y ninguno de los dos esquemas expone `pageSize` ni parámetros de ordenamiento (FR-015, FR-020, D-016, api CHK004)
- [X] T019 [P] Declarar `UserDto`, `SessionUser` y `Paginated<T>` en `packages/shared/src/types/api.ts`, ninguno con contraseña ni hash. `Paginated<T>` es la **única** forma paginada del producto: el listado de usuarios y el reporte de pedidos la comparten sin campos propios (FR-007, FR-016, api CHK018)
- [X] T020 Exponer la superficie pública del paquete en `packages/shared/src/index.ts`
- [X] T021 [P] Escribir los tests de los esquemas de usuario en `packages/shared/tests/schemas.test.ts`: cada uno acepta lo válido y rechaza lo inválido **con el mensaje en español exacto**; ningún campo obligatorio puede faltar (SC-005); `PasswordSchema` rechaza 7 y acepta 8, rechaza 73 y acepta 72, y rechaza una contraseña de menos de 72 caracteres acentuados que supere los 72 bytes (SC-016); y `UpdateUserSchema` produce **el mismo resultado que `CreateUserSchema`** sobre las mismas entradas inválidas, además de rechazar un cuerpo sin ningún campo (FR-010, FR-014)
- [X] T022 [P] Escribir los tests de los esquemas de consulta en `packages/shared/tests/query.test.ts`: `OrdersQuerySchema` acepta `AAAA-MM-DD`, rechaza `15-08-2026`, rechaza el día inexistente `2026-02-30`, acepta `from = to`, rechaza `from > to` y acepta cada extremo por separado (FR-020, api CHK004)
- [X] T023 [P] Escribir los tests de normalización en `packages/shared/tests/normalizar.test.ts`: «MARÍA» encuentra «María», «Nunez» encuentra «Nuñez», los espacios múltiples se colapsan, y `escaparLike` neutraliza `%`, `_` y `\` (SC-021)
- [X] T024 [P] Escribir el test de los mensajes fijos en `packages/shared/tests/messages.test.ts`, comprobando que los doce existen y no están vacíos — impide que una constante se borre y rompa la igualdad de SC-018

### `services/api` — esqueleto, datos e infraestructura

- [X] T025 Crear el esqueleto de NestJS 11 en `services/api` con `package.json`, `tsconfig.json`, `main.ts` y prefijo global `/api/v1`
- [X] T026 Definir los cuatro modelos, los tres enums y los índices en `services/api/prisma/schema.prisma` según `data-model.md`, con `email` como `text` único (D-015), el índice `(createdAt desc, id desc)` (D-016), **sin restricción de unicidad sobre `session.user_id`** —lo que permite sesiones simultáneas (§ Entidad Sesión, security CHK004)—, **sin índice sobre `admin_audit_log.target_user_id`** —ninguna consulta lo aprovecha en v1 (data CHK032)— y `onDelete: Restrict` en las tres claves foráneas, que es lo que hace cumplir la conservación del historial **en el motor** (RN-002)
- [X] T027 Generar la migración inicial con `prisma migrate dev` en `services/api/prisma/migrations/`, poblando `search_normalized` en tres pasos —nullable, `UPDATE`, `NOT NULL`— según D-011, y añadiendo **en SQL a mano** el disparador `admin_audit_log_inmutable` que **rechaza `UPDATE` y `DELETE`** sobre `admin_audit_log` lanzando una excepción. Prisma no expresa disparadores en su esquema, así que la migración es el único lugar donde puede vivir la garantía de inmutabilidad que FR-034 exige y que una convención de código no da (data CHK008)
- [X] T028 Implementar `PrismaService` y su módulo en `services/api/src/prisma/`, con conexión y desconexión ligadas al ciclo de vida de Nest
- [X] T029 Implementar `ClockService` con el método `ahora(): Date` en `services/api/src/common/clock.service.ts`, única fuente de tiempo de la aplicación (D-009)
- [X] T030 [P] Implementar el `ZodValidationPipe` en `services/api/src/common/pipes/zod-validation.pipe.ts`, traduciendo los errores de Zod al formato `{ error: { code, message, fields } }`. Las claves de `fields` DEBEN provenir **siempre del esquema y nunca de la petición**: un campo desconocido se descarta en silencio, de modo que la respuesta jamás devuelva un nombre que el propio cliente inyectó (api CHK014)
- [X] T031 [P] Implementar el filtro global de excepciones en `services/api/src/common/filters/http-exception.filter.ts` con los **once** códigos del catálogo cerrado del contrato —incluidos `413`, `500` y `502`, que la versión anterior de este plan no contemplaba—, garantizando que ningún mensaje filtre detalles técnicos y que `500` use `MSG_ERROR_INESPERADO` (Principio II, api CHK016)
- [X] T032 [P] Implementar el serializador de fechas a ISO 8601 en UTC en `services/api/src/common/interceptors/date.interceptor.ts` (api CHK002)
- [X] T033 [P] Configurar el límite de **10 KB** para el cuerpo de las peticiones en `services/api/src/main.ts`, respondiendo `413 PAYLOAD_TOO_LARGE` **sin analizar el cuerpo**. Fijarlo explícitamente y no heredar el valor por defecto del framework, que puede cambiar con una actualización (D-018, api CHK008)
- [X] T034 Implementar `GET /api/v1/health` sin autenticación en `services/api/src/health/`, devolviendo `{ status: "ok" }` y comprobando la conexión a PostgreSQL. Es el único endpoint de la API que **no se remite a ningún requisito funcional**, y se declara así deliberadamente (D-013, api CHK020)
- [X] T035 Implementar la validación de arranque de las variables de entorno obligatorias en `services/api/src/config/env.validation.ts`, que **falla nombrando la variable ausente** y termina con código distinto de cero (ops CHK003)
- [X] T036 Implementar el script de semilla en `services/api/prisma/seed.ts`: idempotente por `ADMIN_SEED_EMAIL` normalizado, sin contraseña por defecto, y que **falla explícitamente** si el correo existe con otro rol o desactivado (FR-028, D-010)
- [X] T037 Añadir el modo de recuperación `--recuperar` al script de semilla, que fuerza la cuenta a administrador activo, revoca sus sesiones y registra la acción con actor igual al afectado (FR-036, D-010)
- [X] T038 Escribir el test de integración de la semilla en `services/api/test/seed.integration-spec.ts`: dos ejecuciones seguidas dejan el mismo estado, y la segunda no altera la contraseña (ops CHK017). **Depende de T049**, que es donde nace el arranque de la capa de integración —migraciones aplicadas, base sin filas y aislamiento por `TRUNCATE`—: sin él este test no tiene dónde correr. Por eso no lleva `[P]` pese a tocar un archivo propio

### `apps/web` — esqueleto y proxy

- [X] T039 Crear el esqueleto de Next.js 15 con App Router en `apps/web`, con `output: 'standalone'` en `next.config.ts`
- [X] T040 [P] Configurar TailwindCSS 4 y shadcn/ui en `apps/web`, copiando los componentes al repositorio en `apps/web/src/components/ui/`
- [X] T041 [P] Configurar Vitest y Testing Library en `apps/web/vitest.config.ts`
- [X] T042 Implementar el Route Handler de proxy en `apps/web/src/app/api/[...path]/route.ts` con la **lista blanca cerrada** de cabeceras del contrato —`content-type`, `accept` y `cookie` hacia NestJS; código de estado, `content-type` y `set-cookie` de vuelta—, reenviando el cuerpo **sin analizar ni reserializar** y sin lógica de negocio (D-006, api CHK013)
- [X] T043 Añadir al proxy el plazo de **10 segundos** y la respuesta `502 UPSTREAM_UNAVAILABLE` con `MSG_ERROR_INESPERADO` cuando NestJS no responde, **sin reintentar** y **sin fabricar contenido** —jamás una lista vacía, que se confundiría con «no hay datos»— en `apps/web/src/app/api/[...path]/route.ts` (D-017, api CHK005)
- [X] T044 [P] Escribir los tests del proxy en `apps/web/tests/proxy.test.ts`: propaga solo las cabeceras de la lista, no propaga `authorization` ni `x-forwarded-*`, y ante un servicio caído devuelve `502` en lugar de un `200` con lista vacía (D-017)

### Contenedores

- [X] T045 [P] Crear `services/api/Dockerfile` multi-etapa sobre `node:22-alpine`, con `USER node` y un `entrypoint` que ejecuta `prisma migrate deploy` antes de arrancar el servidor (D-013)
- [X] T046 [P] Crear `apps/web/Dockerfile` multi-etapa sobre `node:22-alpine`, con `USER node` y salida standalone
- [X] T047 Crear `docker-compose.yml` con los tres servicios, sus `healthcheck` y políticas de reinicio, el volumen nombrado `foodvoice_pgdata`, y publicando **solo** el puerto de `web` (D-006, D-013)
- [X] T048 [P] Crear `docker-compose.test.yml` con una PostgreSQL efímera en otro puerto para los tests de integración (D-009)
- [X] T049 Crear el arranque compartido de los tests de integración en `services/api/test/setup.ts`: aplica migraciones, deja la base **sin ninguna fila** —ni siquiera el administrador semilla, que crea cada caso que lo necesite— y **aísla cada caso** con `TRUNCATE ... RESTART IDENTITY CASCADE`, y **no** con `DELETE`, que el disparador de inmutabilidad de `admin_audit_log` rechazaría (T027). Los casos se ejecutan **en serie** sobre una única base y ninguno depende del orden, comprobable ejecutando la batería en orden aleatorio (ops CHK021, data CHK008)

**Checkpoint**: `docker compose up` levanta los tres servicios, la migración se aplica, la semilla crea el administrador y `pnpm test` pasa. Fin de la Fase A del plan.

---

## Phase 3: User Story 1 — Autenticación y sesión con control por rol (HU-08, P1) 🎯 MVP

**Objetivo**: que un usuario inicie sesión con correo y contraseña, llegue a la página de su rol, y que el sistema mantenga, expire y cierre su sesión aplicando el rol en el servidor.

**Prueba independiente**: ejecutar la sección A completa de `quickstart.md` (A1–A15) usando solo el administrador semilla y un usuario de prueba. No requiere HU-09 ni HU-10.

### Tests de la historia 1 ⚠️

> Escribir estos tests **antes** de la implementación y comprobar que fallan (Principio XI).

- [X] T050 [P] [US1] Test unitario del hash de contraseñas en `services/api/src/auth/hashing.service.spec.ts`: bcrypt coste 12, la comparación se ejecuta **siempre** contra un hash señuelo si el usuario no existe, **dos usuarios con la misma contraseña producen hashes distintos** —lo que delata la ausencia de sal— y **el coste incrustado en el señuelo coincide con el configurado**, de modo que cambiar la configuración sin regenerarlo haga fallar la batería en lugar de degradar la seguridad sin aviso (D-002, SC-027, architecture CHK004)
- [X] T051 [P] [US1] Test unitario del control de intentos en `services/api/src/auth/login-attempt.service.spec.ts` con `ClockService` sustituido: el quinto fallo bloquea 15 minutos, el bloqueo vencido se ignora, el contador queda **en cero** tras el vencimiento —de modo que un único fallo posterior no vuelve a bloquear—, una fila con `locked_until` vencido y `failed_count > 0` se trata como estado normal y no se limpia, y el acierto elimina la fila (FR-033, security CHK016, data CHK024)
- [X] T052 [P] [US1] Test unitario de `SessionGuard` en `services/api/src/common/guards/session.guard.spec.ts`: las tres condiciones de validez de sesión, con el umbral de 30 minutos medido contra el reloj inyectado, y **ninguna duración máxima absoluta** —una sesión con actividad continuada nunca caduca por antigüedad— (FR-005, security CHK005)
- [X] T053 [P] [US1] Test unitario de `RolesGuard` en `services/api/src/common/guards/roles.guard.spec.ts`: el rol se lee de la sesión, no del usuario (FR-002, FR-011, D-007)
- [X] T054 [P] [US1] Test de integración del inicio de sesión en `services/api/test/auth-login.integration-spec.ts`: credenciales correctas crean sesión; contraseña incorrecta, usuario inexistente y **usuario desactivado con credenciales correctas** devuelven el mismo `401` con el mismo mensaje, y los tres cuentan como fallo (FR-008, FR-012, SC-002, SC-028). Incluir el inicio de sesión con el correo en mayúsculas y con espacios al borde, que debe funcionar, y con la contraseña en otra caja, que no (FR-001, security CHK001)
- [X] T055 [P] [US1] Test de integración del bloqueo temporal en `services/api/test/auth-lockout.integration-spec.ts`: cinco fallos bloquean, el mensaje es **idéntico** para correo registrado e inexistente, el bloqueo rechaza incluso la contraseña correcta, y la respuesta **no contiene el tiempo restante** ni en el cuerpo ni en una cabecera `Retry-After`. Incluir el caso concurrente —**cinco intentos lanzados en paralelo, no en secuencia**—, que es el único que delata si la decisión del quinto fallo se tomó leyendo el contador en el servicio en lugar de dentro del `UPSERT` (FR-033, SC-017, SC-018, api CHK010, data CHK010)
- [X] T056 [P] [US1] Test de integración del ciclo de vida de la sesión en `services/api/test/auth-session.integration-spec.ts`: expiración por inactividad envejeciendo `last_activity_at`, cierre explícito, rechazo íntegro sin cambios parciales comprobando que el dato conserva su valor previo, y que una sucesión de peticiones mantiene viva la sesión sin reautenticar. Tras el cierre explícito, **reutilizar la misma cookie en una petición posterior debe rechazarse**: es lo que en el navegador se percibe como pulsar «atrás» y volver a una vista que parecía cargada, y sin esta aserción SC-030 quedaría solo en la comprobación manual de A8 (FR-004, FR-005, FR-006, FR-030, SC-013, SC-030, SC-031, SC-035)
- [X] T057 [P] [US1] Test de integración de la resolución de la cookie en `services/api/test/auth-cookie.integration-spec.ts`: los **seis** casos —cookie ausente, valor sin forma de UUID, UUID válido inexistente, sesión revocada, sesión expirada y sesión de un usuario desactivado— producen la misma respuesta `401` con `MSG_SESION_EXPIRADA` y la instrucción de borrado de la cookie, sin que ninguno sea distinguible de otro (api CHK027)
- [X] T058 [P] [US1] Test de integración de sesiones simultáneas en `services/api/test/auth-multi-session.integration-spec.ts`: dos sesiones del mismo usuario conviven y expiran por separado; cerrar una **no** cierra la otra; y una acción administrativa de impacto termina **ambas** (FR-006, FR-024, SC-029, security CHK004)
- [X] T059 [P] [US1] Test de integración de la denegación por rol en `services/api/test/auth-roles.integration-spec.ts`: un usuario de cada rol no administrador recibe `403` con `MSG_SIN_PERMISO` al invocar **directamente** una ruta reservada, sin pasar por la interfaz, verificando que el bloqueo ocurre en el procesamiento y no ocultando opciones en pantalla (FR-002, FR-003, SC-003)

### Implementación de la historia 1

- [X] T060 [P] [US1] Implementar `HashingService` en `services/api/src/auth/hashing.service.ts` con bcrypt coste 12 y un hash señuelo **generado al arrancar con el mismo coste configurado**, nunca escrito como literal: un señuelo de coste distinto al configurado tarda menos en compararse y reabre en silencio la diferencia de temporización que existe para cerrar (D-002, FR-008, architecture CHK004)
- [X] T061 [P] [US1] Implementar `LoginAttemptService` en `services/api/src/auth/login-attempt.service.ts` sobre `login_attempt_control`, con clave por correo normalizado, **sin clave foránea a `user` y sin ninguna noción del origen de la petición**: el conteo es por correo y solo por correo. El incremento y la decisión del quinto fallo van **dentro de un único `INSERT ... ON CONFLICT DO UPDATE` con `CASE`**, nunca leyendo el contador para decidir después: es el único punto donde la regla puede romperse en silencio ante peticiones concurrentes, y resuelto así basta el aislamiento por defecto (FR-033, D-003, security CHK015, data CHK010)
- [X] T062 [US1] Implementar `SessionService` en `services/api/src/auth/session.service.ts`: creación con rol congelado, validación y refresco de `last_activity_at` en un único `UPDATE ... RETURNING` con `JOIN` a `user`, y revocación por usuario que alcanza **todas** sus sesiones vivas (FR-004, FR-024, D-001, data CHK017)
- [X] T063 [US1] Implementar `AuthService` en `services/api/src/auth/auth.service.ts` con los cinco pasos obligatorios del contrato para el inicio de sesión, en ese orden, agrupando en **una sola transacción** el borrado de la fila de `login_attempt_control` y la creación de la sesión: separarlos permitiría entrar arrastrando fallos previos, o reiniciar el contador sin haber entrado (contrato § POST /auth/login, data CHK013)
- [X] T064 [US1] Implementar `SessionGuard` en `services/api/src/common/guards/session.guard.ts`, aplicando el umbral de 30 minutos contra `ClockService` y devolviendo la **misma** respuesta para los seis casos de cookie inválida, con borrado de la cookie (FR-005, api CHK027)
- [X] T065 [US1] Implementar `RolesGuard` y el decorador `@Roles()` en `services/api/src/common/guards/`, leyendo el rol de la sesión para determinar qué funciones están disponibles (FR-002, FR-003, FR-018, D-007)
- [X] T066 [US1] Implementar `POST /api/v1/auth/login` en `services/api/src/auth/auth.controller.ts`, estableciendo la cookie `fv_session` (`httpOnly`, `SameSite=Lax`, `Secure` en producción) y devolviendo `redirectTo` según el rol (FR-001, FR-031)
- [X] T067 [US1] Implementar `POST /api/v1/auth/logout` en el mismo controlador: idempotente, devuelve 204 y revoca **solo la sesión desde la que se cierra**, dejando intactas las demás del mismo usuario (FR-006, § Entidad Sesión)
- [X] T068 [US1] Implementar `GET /api/v1/auth/me` en el mismo controlador, con el rol tomado de la sesión (FR-011, FR-031)
- [X] T069 [P] [US1] Implementar la pantalla de inicio de sesión en `apps/web/src/app/login/page.tsx` con `react-hook-form` y `LoginSchema`, mostrando los mensajes en español del paquete compartido y el aviso permanente `MSG_CONTRASENA_OLVIDADA` **antes de cualquier intento fallido**, sin ningún enlace de recuperación que prometa un flujo inexistente (FR-001, FR-026, Principio II, security CHK009)
- [X] T070 [US1] Implementar `apps/web/src/middleware.ts`, que redirige a `/login` sin cookie y desde la raíz al segmento del rol, **sin** ejercer autorización real (D-007)
- [X] T071 [P] [US1] Implementar las páginas de inicio de cliente, negocio y repartidor en `apps/web/src/app/{cliente,negocio,repartidor}/page.tsx`, cada una con **exactamente cuatro cosas**: el nombre completo, la etiqueta visible del rol, «Cerrar sesión» y **ninguna otra acción** —una función del rol antes de que su épica la especifique es alcance fantasma— (FR-031, ux CHK010)
- [X] T072 [P] [US1] Implementar la página de acceso denegado en `apps/web/src/app/sin-permiso/page.tsx` con `MSG_SIN_PERMISO` y un enlace a la página de inicio del rol de quien llega. Es **página propia y no un aviso** sobre la vista restringida, que para entonces ya le habría mostrado su contenido; y **no cierra la sesión**, porque equivocarse de dirección no es un problema de identidad (FR-003, ux CHK004)
- [X] T073 [P] [US1] Implementar el componente de acción en curso en `apps/web/src/components/accion-en-curso.tsx`, que muestra el progreso e **inutiliza el control que disparó la acción** hasta que llega la respuesta. Un solo componente cubre las dos exigencias de FR-038 —que las operaciones sujetas al umbral de 5 segundos no parezcan congeladas y que un doble clic no produzca dos efectos— y lo usan todos los formularios y acciones de US2 y US3 (FR-038, SC-039, ux CHK014, ux CHK029)
- [X] T074 [P] [US1] Implementar el manejo de errores de la API en `apps/web/src/lib/api-client.ts` según la tabla § Dónde se presenta cada mensaje: los errores por campo van junto al campo; los `409` y los fallos del sistema, como aviso sobre la vista y **conservando lo que la persona escribió**; el `403`, a la página de acceso denegado; y el `401`, a `/login` con `MSG_SESION_EXPIRADA` —salvo tras un cierre voluntario, que lleva a `/login` **sin ningún mensaje**— (FR-003, FR-006, FR-030, D-017, ux CHK002, ux CHK008, ux CHK024)
- [X] T075 [US1] Verificar que `apps/web` **no contiene** ningún `setInterval`, sondeo ni refresco en segundo plano contra la API, y dejarlo cubierto por una regla de ESLint en `eslint.config.mjs` (FR-005, SC-024, quickstart D7)
- [X] T076 [P] [US1] Escribir los tests de componente de la pantalla de inicio de sesión en `apps/web/tests/login.test.tsx`: campos obligatorios, mensajes en español, aviso de contraseña olvidada visible y estado de carga

**Checkpoint**: la sección A de `quickstart.md` pasa íntegra. HU-08 es demostrable por sí sola. **Este es el MVP.**

---

## Phase 4: User Story 2 — Gestión de usuarios y roles (HU-09, P2)

**Objetivo**: que el administrador dé de alta, edite, busque, filtre, cambie de rol, desactive, reactive y restablezca contraseñas, con confirmación previa y bitácora de cada acción.

**Prueba independiente**: ejecutar la sección B completa de `quickstart.md`. Depende de US1 solo para autenticarse, no para su lógica.

### Tests de la historia 2 ⚠️

- [X] T077 [P] [US2] Test unitario de `AuditService` en `services/api/src/audit/audit.service.spec.ts`: solo inserción, nunca contraseñas, y la entrada va en la transacción de la acción (FR-034)
- [X] T078 [P] [US2] Test unitario de la autoprotección en `services/api/src/users/users.service.spec.ts`: un administrador no puede desactivarse ni cambiarse el rol, pero sí editar sus datos de contacto (FR-027, SC-014)
- [X] T079 [P] [US2] Test de integración de la unicidad del correo en `services/api/test/users-email.integration-spec.ts`, incluido el alta **variando las mayúsculas**, con el correo de un usuario desactivado, y **dos altas concurrentes del mismo correo**, que deben producir exactamente un usuario y un `409 EMAIL_ALREADY_EXISTS` —nunca un `500`— (FR-017, RN-005, SC-011, D-015, api CHK028)
- [X] T080 [P] [US2] Test de integración de la revocación transaccional en `services/api/test/users-impact.integration-spec.ts`: las cuatro acciones de impacto revocan **todas** las sesiones del afectado, incluidas las de otros navegadores, y **nunca** las del administrador que actúa; tras un cambio de rol no queda ninguna ventana en que el usuario conserve privilegios del rol anterior (FR-024, SC-006, SC-025, SC-026, SC-029)
- [X] T081 [P] [US2] Test de integración de la idempotencia del cambio de estado en `services/api/test/users-status-idempotent.integration-spec.ts`: pedir el estado que el usuario ya tiene devuelve `200` sin cambios, **sin revocar sesiones y sin escribir en la bitácora**; repetir la petición _n_ veces deja el mismo estado y el mismo número de entradas que ejecutarla una vez (FR-034, api CHK007)
- [X] T082 [P] [US2] Test de integración del contenido y la inmutabilidad de la bitácora en `services/api/test/audit-content.integration-spec.ts`: cada acción deja exactamente una entrada con actor, afectado, acción e instante; **ninguna columna contiene nombre, correo, teléfono ni contraseña**; los inicios de sesión, fallos y bloqueos **no dejan ninguna entrada**; y un `UPDATE` y un `DELETE` ejecutados directamente contra la tabla **fallan por el disparador**, que es la prueba de que la inmutabilidad la impone el motor y no la disciplina (FR-034, Principio X, security CHK032, security CHK034, data CHK008)
- [X] T083 [P] [US2] Test de integración del listado en `services/api/test/users-list.integration-spec.ts`: orden estable entre páginas, búsqueda insensible a mayúsculas y acentos, término con `%` escapado, resultados que cumplen **todos** los criterios aplicados, y `page` fuera de rango devuelve 200 con lista vacía (FR-015, SC-021, SC-023, SC-034)
- [X] T084 [P] [US2] Test de integración de la edición en `services/api/test/users-update.integration-spec.ts`: los cambios se reflejan conservando rol y estado; el **cambio de correo no revoca la sesión abierta** del usuario, y su siguiente inicio de sesión exige el correo nuevo mientras el anterior deja de servir. Incluir el caso en que el correo nuevo tiene un bloqueo vigente en `login_attempt_control`: la edición se aplica, **la fila de bloqueo no se toca** y el usuario queda sujeto a él hasta que venza o se le restablezca la contraseña (FR-010, SC-032, security CHK008, data CHK025)
- [X] T085 [P] [US2] Test de integración del restablecimiento en `services/api/test/users-password.integration-spec.ts`: la contraseña anterior deja de servir, el bloqueo temporal se levanta y la bitácora no guarda la contraseña (FR-026, FR-033, SC-012)
- [X] T086 [P] [US2] Test de integración del mínimo de administradores en `services/api/test/users-last-admin.integration-spec.ts`: ejecutar una secuencia de desactivaciones y cambios de rol entre varios administradores y afirmar que **el conteo de administradores activos nunca llega a cero**, incluido el intento del último de retirarse a sí mismo (FR-027, RN-006, SC-022)
- [X] T087 [P] [US2] Test de integración del alta y la reactivación en `services/api/test/users-create-login.integration-spec.ts`: crear un usuario con cada rol y comprobar **en la misma prueba** que puede iniciar sesión de inmediato con el rol asignado; y que un usuario reactivado vuelve a entrar con sus credenciales previas sin restablecimiento (FR-009, FR-013, SC-004, SC-033)

### Implementación de la historia 2

- [X] T088 [US2] Implementar `AuditService` y su módulo en `services/api/src/audit/`, expuesto **solo** con la operación de inserción y registrando los usuarios **por referencia, nunca copiando sus datos personales** (FR-034, Principio X)
- [X] T089 [US2] Implementar `UsersService` en `services/api/src/users/users.service.ts` con las reglas que exigen consulta —unicidad del correo, autoprotección del administrador, existencia del recurso—, que son exactamente las que la frontera de `shared.md` sitúa fuera de Zod (FR-017, FR-027, RN-006, D-005, api CHK031)
- [X] T090 [US2] Implementar `GET /api/v1/admin/users` en `services/api/src/users/users.controller.ts` con búsqueda normalizada y escapada, filtros combinables, paginación de 20 y orden `created_at DESC, id DESC` (FR-015, SC-034, D-016)
- [X] T091 [US2] Implementar `POST /api/v1/admin/users`, admitiendo el rol `ADMINISTRADOR`, registrando `CREAR` en la misma transacción y **traduciendo la violación de unicidad del motor a `409 EMAIL_ALREADY_EXISTS`**, de modo que una carrera sea indistinguible del caso normal y nunca aflore como `500` (FR-009, FR-017, FR-034, SC-004, api CHK028)
- [X] T092 [US2] Implementar `PATCH /api/v1/admin/users/:id` para datos de contacto y correo, recalculando `search_normalized`, registrando `EDITAR`, **sin revocar sesiones** y **sin tocar `login_attempt_control`** ni para el correo antiguo ni para el nuevo: esa tabla controla correos ingresados, no usuarios (FR-010, security CHK008, data CHK025)
- [X] T093 [US2] Implementar `PUT /api/v1/admin/users/:id/role` con la transacción de tres pasos: actualizar rol, revocar todas las sesiones del afectado y registrar `CAMBIAR_ROL` (FR-011, FR-024, SC-026)
- [X] T094 [US2] Implementar `PUT /api/v1/admin/users/:id/status` para desactivar y reactivar, con revocación de sesiones y registro de `DESACTIVAR` o `REACTIVAR`, conservando íntegro el historial. Cuando el estado solicitado **coincide con el actual**, devolver `200` sin cambios, sin revocar y sin registrar (FR-012, FR-013, FR-024, RN-002, SC-006, api CHK007)
- [X] T095 [US2] Implementar `POST /api/v1/admin/users/:id/password-reset` con los cuatro efectos de la transacción: rehash, revocación de sesiones, borrado del bloqueo y registro **sin** la contraseña (FR-026, FR-033, FR-034)
- [X] T096 [P] [US2] Implementar el listado de usuarios en `apps/web/src/app/admin/usuarios/page.tsx` con búsqueda, filtros por rol y estado, paginación y total de resultados (FR-015)
- [X] T097 [P] [US2] Implementar el estado vacío del listado en `apps/web/src/app/admin/usuarios/_components/sin-resultados.tsx`, con el mensaje en español y la vuelta a la primera página (FR-015, SC-020)
- [X] T098 [P] [US2] Implementar el formulario de alta en `apps/web/src/app/admin/usuarios/nuevo/page.tsx` con `CreateUserSchema` y los cinco campos obligatorios, mostrando la contraseña **solo mientras el administrador la escribe**: ninguna pantalla posterior la recupera (FR-009, FR-014, SC-005, supuesto 23)
- [X] T099 [P] [US2] Implementar el formulario de edición en `apps/web/src/app/admin/usuarios/[id]/editar/page.tsx` con `UpdateUserSchema`, capaz de mostrar sobre el formulario un `409` que el navegador no podía anticipar —correo duplicado o autoprotección— porque son reglas que exigen consultar el estado (FR-010, api CHK031)
- [X] T100 [US2] Implementar el diálogo de confirmación reutilizable en `apps/web/src/components/confirmar-accion.tsx` con `AlertDialog` de shadcn/ui, indicando a quién afecta y qué efecto tiene (FR-035, Principio IX)
- [X] T101 [US2] Conectar el diálogo a las cuatro acciones de impacto desde `apps/web/src/app/admin/usuarios/_components/acciones-usuario.tsx`, garantizando que cancelar no dispara ninguna llamada, y **declarando en cada diálogo si la acción se puede deshacer**: las tres primeras son reversibles y el restablecimiento de contraseña **no lo es**, distinción que el Principio IX exige y que evita tratar con la misma ligereza una desactivación y un restablecimiento (FR-035, SC-019, ux CHK020)
- [X] T102 [US2] Implementar la confirmación de éxito tras cada acción administrativa en `apps/web/src/components/aviso-exito.tsx`, tomando el texto de `MSG_EXITO` indexado por la acción y nombrando al usuario afectado. Aparece solo cuando el cambio quedó firme, y nunca junto a un mensaje de error: pedir confirmación antes (FR-035) y no decir nada después deja al administrador sin poder distinguir el éxito de un fallo silencioso (FR-037, SC-037, ux CHK003)
- [X] T103 [US2] Implementar la navegación del administrador en `apps/web/src/app/admin/_components/navegacion.tsx` con los dos destinos **Panel** y **Usuarios** más «Cerrar sesión», visible desde cualquier vista administrativa. Los otros tres roles no llevan navegación en v1 (spec § Navegación disponible por rol, ux CHK012)
- [X] T104 [P] [US2] Escribir los tests de componente del listado y los formularios en `apps/web/tests/usuarios.test.tsx`: mensajes en español, estado vacío, cancelación de la confirmación, aviso de éxito con el nombre del afectado, presentación de un `409` del servidor y **el control inutilizado mientras la acción está en curso** (SC-037, SC-039)

**Checkpoint**: la sección B de `quickstart.md` pasa íntegra. HU-08 y HU-09 funcionan de forma independiente.

---

## Phase 5: User Story 3 — Panel y reportes del administrador (HU-10, P3)

**Objetivo**: un panel de solo lectura con las métricas de usuarios activos por rol y la superficie de reportes de pedidos, que en E1 permanece vacía por diseño.

**Prueba independiente**: ejecutar la sección C completa de `quickstart.md`, con la salvedad de que las métricas de pedidos siguen en cero hasta E4/E2.

### Tests de la historia 3 ⚠️

- [X] T105 [P] [US3] Test unitario de la máquina de estados en `packages/shared/tests/order-state.test.ts`: las transiciones son estrictamente lineales y `cerrado` es terminal (Principio XII, FR-023)
- [X] T106 [P] [US3] Test de integración de las métricas en `services/api/test/dashboard-metrics.integration-spec.ts`: el conteo por rol coincide con el padrón, y un padrón **sin ningún usuario de un rol** devuelve ese rol con valor cero y no con la clave ausente —lo que ocurriría si se devolviera el `GROUP BY` tal cual—; los cinco estados de pedido aparecen siempre, todos en cero (FR-019, data CHK030)
- [X] T107 [P] [US3] Test de integración del reporte en `services/api/test/dashboard-orders.integration-spec.ts`: devuelve lista vacía con la **misma forma paginada** que el listado de usuarios; los filtros combinados no arrastran datos ajenos; `from = to` consulta el día completo; una fecha mal formada y `from > to` producen `400` con mensaje en español; y un rango de amplitud extrema o enteramente futuro se acepta y devuelve el conjunto vacío (FR-020, SC-009, api CHK018, api CHK026)
- [X] T108 [P] [US3] Test de integración del control de acceso en `services/api/test/dashboard-access.integration-spec.ts`: los tres roles no administradores reciben `403` en todos los endpoints del panel (FR-018, SC-008)

### Implementación de la historia 3

- [X] T109 [US3] Implementar `transicionesValidas` y `esTransicionValida` en `packages/shared/src/order-state/machine.ts`, **sin** crear la entidad `Pedido` (D-012, Principio III)
- [X] T110 [US3] Implementar `DashboardService` y su módulo en `services/api/src/dashboard/`, exponiendo **solo** verbos `GET` (FR-021, RN-004)
- [X] T111 [US3] Implementar `GET /api/v1/admin/dashboard/metrics` con el conteo de usuarios activos por rol y los pedidos por estado en cero, **completando el resultado del `GROUP BY` con los cuatro roles y los cinco estados**: el motor omite las filas sin coincidencias, y una clave ausente obligaría a la interfaz a distinguir «cero» de «no informado». Los cinco estados son **los de la máquina compartida, sin definir ninguno propio** (FR-019, FR-023, D-012, data CHK030)
- [X] T112 [US3] Implementar `GET /api/v1/admin/dashboard/orders` con filtros combinables por estado y rango de fechas, convirtiendo `from` y `to` en un intervalo **inclusivo en ambos extremos, tomando cada uno como un día del calendario en `HUSO_REFERENCIA`** y no en UTC —un pedido de las 22:00 en Chile debe figurar en su día, no en el siguiente—, y devolviendo `Paginated<T>` con el mismo `PAGE_SIZE` que el listado de usuarios (FR-020, api CHK004, api CHK018, ux CHK026)
- [X] T113 [P] [US3] Implementar el panel en `apps/web/src/app/admin/page.tsx` como página de inicio del administrador, con acceso a la gestión de usuarios —**navegar no es modificar**, así que el enlace no incumple FR-021— y mostrando siempre los cuatro roles y los cinco estados de pedido aunque valgan cero, con el mensaje de «sin datos» donde no hay pedidos y **sin ninguna alusión a épicas futuras**: el calendario del proyecto no es información del administrador. Las etiquetas de los cinco estados salen de `ETIQUETA_ESTADO_PEDIDO` (T013), de modo que el panel **nombre los estados de la máquina compartida y ninguno propio** (FR-019, FR-021, FR-023, FR-031, ux CHK022, ux CHK028)
- [X] T114 [P] [US3] Implementar el reporte de pedidos en `apps/web/src/app/admin/pedidos/page.tsx`, mostrando las fechas al usuario en **`DD/MM/AAAA`** —el formato interno nunca aparece en pantalla— y el mensaje de «sin datos» en español, con la misma paginación de 20 e indicación de total que el listado de usuarios (FR-020, FR-022, SC-020, ux CHK021, ux CHK026)
- [X] T115 [US3] Inventariar las vistas del panel en `apps/web/src/app/admin/_components/vistas-panel.ts` y verificar que ninguna ofrece acciones que modifiquen datos, de modo que SC-015 sea comprobable **contra una lista cerrada** y no recorriendo la aplicación a ojo: sin inventario, «el 100 % de las vistas» no es verificable porque nadie puede afirmar que las visitó todas. Los enlaces de navegación no cuentan como modificación (FR-021, RN-004, SC-015, ux CHK034)
- [X] T116 [P] [US3] Escribir los tests de componente del panel en `apps/web/tests/panel.test.tsx`: métricas visibles, mensaje de sin datos y ausencia de controles de escritura

**Checkpoint**: las tres historias funcionan de forma independiente. Fin de la Fase D del plan.

---

## Phase 6: Polish y aspectos transversales

**Propósito**: cerrar la épica con las garantías que atraviesan las tres historias.

- [X] T117 Configurar los umbrales de cobertura por ámbito en la configuración de cada paquete, de modo que su incumplimiento **haga fallar** `pnpm test`: 90 % en `services/api/src/{auth,users,audit}`, 100 % en `packages/shared`, 80 % en el resto de la API y 70 % en `apps/web` (quickstart § Comprobaciones automáticas)
- [X] T118 [P] Configurar `helmet` en `services/api/src/main.ts` y confirmar que la marca `Secure` de la cookie depende de `NODE_ENV=production`. Dejar anotado que **el cifrado del canal queda fuera del alcance de v1** y corresponde al proxy que se sitúe delante de `web` (ops CHK013, supuesto 24)
- [X] T119 [P] Configurar el registro de la aplicación en `services/api/src/common/logger.ts` según la tabla de D-019: arranque, migraciones y semilla en nivel informativo; una línea por petición con verbo, ruta, estado y duración; errores controlados en advertencia; y errores no previstos en error, con su traza y un **identificador de correlación que también viaja al cliente**, para que `MSG_ERROR_INESPERADO` pueda relacionarse con la traza sin filtrar nada al usuario. La prohibición de registrar contraseñas, hashes, la cookie, la cadena de conexión y los cuerpos de `/auth/login` y `password-reset` se implementa como **lista de campos censurados**, no como cuidado al escribir cada llamada (FR-007, SC-027, D-019, ops CHK005, ops CHK031)
- [X] T120 [P] Implementar el manejo de la caída de PostgreSQL según D-019: `GET /health` responde `503`; cualquier endpoint autenticado devuelve `500` con `MSG_ERROR_INESPERADO`; y la interfaz lo presenta como aviso sobre la vista actual **conservando lo escrito y sin llevar a `/login`**. Este último punto es el que hay que decidir por adelantado: tratar una consulta de sesión fallida como sesión inválida expulsaría al usuario por un problema ajeno, y un fallo de infraestructura no es un `401` (D-019, Principio II, ops CHK033)
- [X] T121 [P] Escribir el `README.md` de la raíz remitiendo a `quickstart.md` para la puesta en marcha, sin duplicar sus instrucciones
- [ ] T122 [P] Revisar la accesibilidad de todas las pantallas contra las cuatro condiciones de FR-039 —recorrido completo por teclado incluidos los diálogos, foco siempre visible, cada campo con etiqueta asociada y su error asociado al campo, contraste suficiente— y dejar el resultado anotado. La base accesible de shadcn/ui cubre buena parte, pero no exime de comprobarlo: los diálogos de confirmación y el foco tras cerrarlos son donde más fácil se rompe (FR-039, SC-038, ux CHK030)
- [ ] T123 [P] Comprobar la aplicación desde **360 píxeles de ancho** hasta escritorio, verificando que ningún contenido queda inalcanzable —el listado de usuarios se desplaza o se reorganiza, pero no se recorta— y sobre las dos últimas versiones estables de Chrome, Firefox, Edge y Safari (FR-040, ux CHK031, ux CHK032)
- [ ] T124 Recorrer el inventario completo de mensajes visibles —los doce fijos de `packages/shared` más los de validación de cada campo— y comprobar que los doce cumplen las cuatro condiciones de «mensaje claro y sin detalles técnicos», incluidos expresamente el de bloqueo temporal y los dos de «sin resultados». Lo hace una persona no técnica: la cuarta condición es que pueda repetir cada mensaje con sus palabras (SC-036, SC-010, ux CHK001, ux CHK035)
- [ ] T125 Ejecutar desde la raíz las cinco comprobaciones automáticas que declara `package.json` —`test`, `test:integration`, `lint`, `typecheck`, `build`— y dejarlas todas en verde, **en un entorno limpio o con la caché de Turborepo deshabilitada**: un resultado en verde recuperado de la caché es una afirmación sobre una ejecución pasada, no sobre el código de ahora (quickstart § Comprobaciones automáticas, architecture CHK006)
- [ ] T126 Ejecutar la validación funcional completa de `quickstart.md` secciones **A, B, C y E**, incluidas las esperas reales de A5 y A9, y cronometrar el inicio de sesión y la carga del panel para confirmar que ambos bajan de 5 segundos. La ejecuta **una persona no técnica**, o alguien que actúe como tal sin consultar el código (SC-001, SC-007, supuesto 22, ops CHK025, ops CHK026)
- [ ] T127 Ejecutar la verificación técnica de `quickstart.md` sección D (D1 a D14) en la revisión de la implementación, incluidas las tres comprobaciones objetivas de SC-027, la ausencia de entradas de autenticación en la bitácora y el rechazo de `UPDATE`/`DELETE` por el disparador (SC-010, SC-027)
- [ ] T128 Recorrer las dos tablas de cobertura y confirmar que no queda nada sin verificar: los **33 escenarios** `HU<nn>-E<nn>` de `spec.md` § Trazabilidad de escenarios, cada uno con su paso ejecutado y su criterio satisfecho; y los **39 criterios de éxito** de `quickstart.md` § Cobertura, cada uno con su paso. Prestar atención a los cuatro que **solo** se verifican a mano —SC-001, SC-007, SC-036 y SC-038—, porque si la guía no se ejecuta nadie los comprueba (Principio XI, security CHK035, ops CHK029)

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
- **US2 (P2)**: puede empezar en cuanto termine Foundational. Usa la autenticación de US1 para **acceder**, pero su lógica es independiente y sus tests de integración crean su propia sesión. T087 es la única tarea que cruza deliberadamente a US1, porque SC-004 mide precisamente esa costura.
- **US3 (P3)**: puede empezar en cuanto termine Foundational. Consume el padrón de usuarios que US2 gestiona, pero sus métricas funcionan sobre el administrador semilla sin necesidad de HU-09.

### Dentro de cada historia

- Los tests se escriben **antes** y deben fallar (Principio XI)
- Modelos antes que servicios; servicios antes que endpoints; API antes que interfaz
- Una historia se termina antes de pasar a la siguiente prioridad

### Oportunidades de paralelismo

- El bloque T009–T024 de `packages/shared` es paralelizable salvo por tres dependencias internas: **T015 precede a T017**, porque `CreateUserSchema` valida la contraseña con `PasswordSchema` (FR-014 remite a FR-032); **T018 depende de T011**, porque `OrdersQuerySchema` usa `OrderStatus`; y **T020 depende de todo el bloque**, porque exporta la superficie pública. Una versión anterior de esta nota decía que T015 «depende del resto», que es la relación al revés: es una dependencia de T017, no un consumidor suyo
- **T038 depende de T049**: aunque está escrito antes en la lista, no puede ejecutarse hasta que exista el arranque de la capa de integración. Todos los tests `*.integration-spec.ts` de las tres historias comparten esa dependencia
- T043 depende de T042 (mismo archivo); T044 depende de ambas
- Los tests de una misma historia marcados `[P]` corren en paralelo: diez en US1 (T050–T059), once en US2 (T077–T087), cuatro en US3 (T105–T108)
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

# Los seis tests de integración, a la vez:
Task: "Integración del inicio de sesión en services/api/test/auth-login.integration-spec.ts"
Task: "Integración del bloqueo temporal en services/api/test/auth-lockout.integration-spec.ts"
Task: "Integración del ciclo de vida de la sesión en services/api/test/auth-session.integration-spec.ts"
Task: "Integración de la resolución de la cookie en services/api/test/auth-cookie.integration-spec.ts"
Task: "Integración de sesiones simultáneas en services/api/test/auth-multi-session.integration-spec.ts"
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

1. Setup + Foundational (T001–T049) → cimientos listos (Fase A del plan)
2. - Historia 1 (T050–T076) → validar sección A → **MVP** (Fase B)
3. - Historia 2 (T077–T104) → validar sección B (Fase C)
4. - Historia 3 (T105–T116) → validar sección C (Fase D)
5. - Polish (T117–T128) → épica cerrada

Cada incremento añade valor sin romper el anterior.

---

## Notas

- Las tareas `[P]` tocan archivos distintos y no dependen entre sí
- La etiqueta `[Story]` permite trazar cada tarea hasta su historia
- Verificar que los tests fallan antes de implementar (Principio XI)
- Conviene commitear por tarea o por grupo lógico
- **FR-025, FR-029 y RN-007 son requisitos negativos** —no hay autorregistro, ni exportación de reportes, ni actualización en tiempo real— y por tanto no tienen tarea de construcción: se cumplen por ausencia y los confirma la validación funcional en los pasos B20 y C7 de `quickstart.md` (T126). La tabla «Requisitos que no son un endpoint» de `contracts/api.md` los enumera junto a FR-021, para que una revisión que solo mire lo construido no los pase por alto
- **No hay tarea de cambio de contraseña por el propio usuario**, ni de recuperación por autoservicio: no existen en v1, y el único camino por el que una contraseña cambia después del alta es T095 (FR-026, api CHK017)
- **SC-001 y SC-007 no tienen cobertura automática**: se cronometran a mano en T126, conforme al supuesto 22. Si el rendimiento se degradara, lo detectaría una persona validando, no la batería de pruebas
- **Las métricas de pedidos de FR-019, FR-020 y FR-023 se entregan vacías por diseño**: la entidad `Pedido` pertenece a E4/E2 y construirla aquí violaría el Principio III (D-012). La tabla «Superficie deliberadamente vacía en E1» de `contracts/api.md` acota cuáles son las dos superficies afectadas y bajo qué condición dejarán de estarlo
- **No hay tarea de control de concurrencia optimista**: prevalece el último cambio guardado y v1 no detecta la edición concurrente, consecuencia asumida y declarada en D-018 y en los casos límite de la spec
- Los mensajes visibles al usuario van **siempre** en español y **siempre** desde `packages/shared`, nunca como literales dispersos (Principio II, SC-018)
