# Modelo de datos: E1 · Acceso y usuarios

**Fecha**: 2026-08-15 | **Spec**: [spec.md](./spec.md) | **Decisiones**: [research.md](./research.md)

Motor: PostgreSQL 16 · ORM: Prisma 6 (D-004). Los identificadores técnicos van en inglés (Principio II); los textos visibles al usuario van en español.

---

## Visión general

```text
┌──────────────────────┐         ┌──────────────────────┐
│         user         │ 1     N │       session        │
│  (Usuario)           ├────────►│  (Sesión)            │
└──────────┬───────────┘         └──────────────────────┘
           │ 1                    N
           │  actor / target      ┌──────────────────────┐
           └─────────────────────►│   admin_audit_log    │
                                  │  (Registro admin.)   │
                                  └──────────────────────┘

┌──────────────────────────────┐   (sin relación con user: es intencional)
│   login_attempt_control      │
│  (Control de intentos)       │   clave = correo normalizado
└──────────────────────────────┘
```

`login_attempt_control` **no** tiene clave foránea hacia `user`, y eso no es un descuido: FR-033 exige contar intentos sobre correos que no corresponden a ninguna cuenta, y FR-008 / SC-018 exigen que el comportamiento sea indistinguible en ambos casos.

---

## Entidad `user` — Usuario

Persona que accede a la plataforma (spec § Entidades Clave).

| Campo | Tipo | Restricciones | Origen |
|---|---|---|---|
| `id` | UUID | PK, generado | — |
| `full_name` | text | obligatorio, 2–120 caracteres | FR-009, FR-014 |
| `email` | text | **único**, obligatorio, formato de correo, almacenado normalizado a minúsculas y sin espacios al borde (D-015) | FR-009, FR-017, RN-005 |
| `phone` | text | obligatorio, 6–20 caracteres | FR-009, FR-014 |
| `password_hash` | text | obligatorio, bcrypt coste 12 | FR-007, FR-016, D-002 |
| `role` | enum `Role` | obligatorio: `CLIENTE` \| `NEGOCIO` \| `REPARTIDOR` \| `ADMINISTRADOR` | FR-002, FR-009, RN-001 |
| `status` | enum `UserStatus` | obligatorio: `ACTIVO` \| `DESACTIVADO`, por defecto `ACTIVO` | FR-012, FR-013 |
| `search_normalized` | text | derivado, indexado | FR-015, D-011 |
| `created_at` | timestamptz | por defecto `now()` | — |
| `updated_at` | timestamptz | actualizado en cada escritura | — |

**Índices**: único sobre `email`; índice sobre `search_normalized` para el `LIKE`; índice compuesto `(role, status)` para el filtrado del listado; índice `(created_at DESC, id DESC)` para el orden por defecto del listado (FR-015, D-016).

**Orden por defecto del listado**: `created_at DESC, id DESC` (D-016). El desempate por `id` es lo que hace el orden **total**: sin él, dos altas con la misma marca de tiempo podrían intercambiarse entre consultas y hacer que un usuario aparezca dos veces o ninguna al pasar de página.

**Reglas de validación**

- `email` se normaliza a minúsculas y sin espacios al borde **antes** de comparar o guardar, y la columna es `text` con `UNIQUE` — no `citext` (D-015). La unicidad alcanza también a los usuarios desactivados: no hay borrado físico, así que la restricción del motor lo garantiza por construcción (FR-017, RN-005).
- La contraseña en claro nunca se persiste ni se registra en logs. Se exige un mínimo de 8 caracteres (FR-032) y un **máximo de 72 bytes UTF-8** antes de calcular el hash: bcrypt trunca su entrada a esa longitud, así que aceptar más sería descartar caracteres en silencio (D-002).
- `search_normalized` se recalcula en cada alta y en cada edición que toque `full_name` o `email`, aplicando `normalizarBusqueda(full_name + ' ' + email)`. Esa función vive en `packages/shared` y su definición exacta —descomposición NFD, eliminación de marcas combinantes (`ñ → n`), minúsculas, colapso de espacios— está en D-011. La **misma** función normaliza el término que escribe el administrador: si ambas divergieran, un texto presente en la base dejaría de encontrarse.

**Longitudes máximas**, idénticas a las que declaran los esquemas Zod de `packages/shared` (D-005), para que la validación de forma y la restricción de almacenamiento no puedan discrepar:

| Campo | Mínimo | Máximo |
|---|---|---|
| `full_name` | 2 caracteres | 120 caracteres |
| `email` | — | 254 caracteres (límite de dirección de correo) |
| `phone` | 6 caracteres | 20 caracteres |
| contraseña (antes del hash) | 8 caracteres | 72 bytes UTF-8 (D-002) |

Las columnas son `text` sin longitud declarada en el motor: en PostgreSQL `varchar(n)` no aporta ninguna ventaja de almacenamiento sobre `text`, y fijar el límite en un solo lugar —el esquema Zod— evita que un cambio futuro deje ambos lados en desacuerdo.

**Reglas de negocio que dependen de consulta (viven en el servicio, no en el esquema)**

- Un administrador no puede desactivarse a sí mismo ni cambiar su propio rol; sí puede editar sus datos de contacto (FR-027, RN-006).
- **No existe ninguna comprobación del número de administradores activos**, y su ausencia es deliberada. RN-006 queda garantizado por la regla anterior: quien ejecuta una desactivación o un cambio de rol es siempre un administrador activo y no puede aplicarla sobre sí mismo, luego después de la acción queda al menos él. Un recuento adicional sería código que nunca podría dispararse (Principio III). La pérdida de acceso *efectivo* —credenciales olvidadas sin otro administrador que las restablezca— no es un estado detectable desde la aplicación y se recupera con el procedimiento operativo de FR-036 (D-010).
- El alta con un correo ya usado se rechaza con un mensaje en español, sin filtrar información adicional (FR-017).

**Baja lógica**: no existe borrado físico (spec § Fuera de Alcance). `status = DESACTIVADO` conserva el historial asociado (RN-002).

**Transiciones de estado**

```text
        crear (admin)
             │
             ▼
        ┌─────────┐   desactivar (FR-012)   ┌──────────────┐
        │ ACTIVO  ├────────────────────────►│ DESACTIVADO  │
        │         │◄────────────────────────┤              │
        └─────────┘   reactivar  (FR-013)   └──────────────┘
```

Efectos colaterales de la desactivación, en la **misma transacción** (FR-024):

1. `user.status = DESACTIVADO`
2. `UPDATE session SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL`
3. Se inserta una entrada en `admin_audit_log`

---

## Entidad `session` — Sesión

Vínculo temporal entre un usuario autenticado y su uso de la aplicación (spec § Entidades Clave, D-001).

| Campo | Tipo | Restricciones | Origen |
|---|---|---|---|
| `id` | UUID | PK, generado aleatoriamente; es el valor de la cookie | D-001 |
| `user_id` | UUID | FK → `user.id`, obligatorio | — |
| `role` | enum `Role` | obligatorio; **congelado** al iniciar sesión | FR-011, D-007 |
| `created_at` | timestamptz | por defecto `now()` | — |
| `last_activity_at` | timestamptz | por defecto `now()`, actualizado en cada petición autenticada originada por una acción del usuario | FR-004, FR-005 |
| `revoked_at` | timestamptz | nulo mientras la sesión está viva | FR-006, FR-024 |

**Índices**: PK sobre `id`; índice sobre `user_id` para la revocación masiva.

**Sin restricción de unicidad sobre `user_id`**: un mismo usuario puede tener varias filas vivas a la vez, es decir varias sesiones simultáneas en distintos navegadores o dispositivos (spec § Entidad Sesión). Cada una lleva su propio `last_activity_at` y expira por separado. De ahí que la revocación de FR-024 sea un `UPDATE` sobre **todas** las filas vivas del usuario y no sobre una sola, y que el cierre explícito de FR-006 afecte únicamente a la fila cuyo `id` viaja en la cookie.

**Una sesión es válida si y solo si** se cumplen las tres condiciones:

1. `revoked_at IS NULL` — no fue cerrada explícitamente (FR-006) ni revocada por desactivación (FR-024)
2. `now() - last_activity_at < 30 minutos` — no expiró por inactividad (FR-005)
3. El usuario referenciado sigue en estado `ACTIVO` (defensa en profundidad para FR-024)

**Por qué `role` se copia aquí**: FR-011 y el caso límite "cambio de rol con sesión activa" establecen que el nuevo rol rige recién en el próximo inicio de sesión. Leer el rol de la sesión, y no del usuario, implementa esa regla directamente en lugar de simularla con comprobaciones adicionales, y garantiza que ninguna sesión viva pueda ver mutados sus privilegios.

**Congelar el rol no basta por sí solo**: si la sesión sobreviviera al cambio de rol, un usuario degradado conservaría sus privilegios anteriores hasta 30 minutos. Por eso el cambio de rol **revoca** las sesiones del usuario afectado (D-014): la sesión termina y el nuevo rol rige en el siguiente inicio de sesión, sin mutación en caliente y sin ventana de privilegio.

**Ciclo de vida**

```text
   login exitoso
        │
        ▼
   ┌─────────┐  cada petición: last_activity_at = now()
   │  VIVA   │◄─────────────────────────────────────────┐
   └────┬────┘                                          │
        │                                               │
        ├── logout explícito ──────► revoked_at = now()  (FR-006)
        ├── acción de impacto ─────► revoked_at = now()  (FR-024, D-014)
        │     del administrador          desactivación, cambio de rol,
        │     sobre este usuario         reactivación, restablecimiento
        └── 30 min sin actividad ──► inválida por tiempo (FR-005)
```

La expiración por inactividad es **pasiva**: no se borra la fila, simplemente deja de considerarse válida. No hace falta ningún proceso programado (Principio I). Una tarea de limpieza de filas antiguas queda fuera del alcance de v1.

**Qué cuenta como actividad** (FR-005, D-001): toda petición autenticada originada por una acción de la persona —navegar, filtrar, paginar, enviar un formulario, incluido el `GET /auth/me` que se dispara al montar una pantalla—. Lo que **no** puede existir es una consulta automática: `apps/web` tiene prohibido llamar a la API por temporizador o en segundo plano, porque un sondeo periódico mantendría `last_activity_at` fresco para siempre y vaciaría de sentido a FR-005 y SC-013. La restricción es de diseño del frontend, no una comprobación del servidor: este no puede saber si detrás de una petición hubo una persona.

**Quién aplica el umbral y con qué reloj**: lo aplica el `SessionGuard` de NestJS al validar cada petición, comparando `last_activity_at` contra el `ClockService` (D-009). El reloj es siempre el del proceso de la API —nunca el del navegador, que el usuario controla, ni el de PostgreSQL, para que la regla se pruebe con un doble de reloj sin depender del motor—. Todas las marcas de tiempo se almacenan en `timestamptz`, es decir en UTC, de modo que el huso horario del contenedor no altera ningún cálculo: solo afecta a cómo se muestran las fechas, y eso ocurre en la interfaz.

---

## Entidad `login_attempt_control` — Control de intentos de acceso

Contador de intentos fallidos y bloqueo temporal, **asociado al correo ingresado**, exista o no una cuenta con él (spec § Entidades Clave, FR-033, D-003).

| Campo | Tipo | Restricciones | Origen |
|---|---|---|---|
| `email` | text | **PK**, normalizado a minúsculas | FR-033 |
| `failed_count` | integer | por defecto 0 | FR-033 |
| `locked_until` | timestamptz | nulo cuando no hay bloqueo vigente | FR-033 |
| `updated_at` | timestamptz | actualizado en cada escritura | — |

**Ausencia deliberada de clave foránea**: si esta tabla apuntara a `user`, sería imposible contar intentos sobre correos no registrados, y el sistema respondería distinto para una cuenta existente que para una inexistente — filtrando exactamente lo que FR-008 prohíbe filtrar.

**Reglas de transición**

| Evento | Efecto |
|---|---|
| Intento fallido, `failed_count < 4` | `failed_count += 1` |
| Intento fallido, `failed_count = 4` (quinto fallo) | `locked_until = now() + 15 min`, `failed_count = 0` |
| Intento con `locked_until > now()` | Rechazado **aunque la contraseña sea correcta**; el contador no avanza |
| Intento con `locked_until <= now()` | El bloqueo se ignora; el intento procede normalmente (FR-033: se levanta solo) |
| Inicio de sesión exitoso | Se elimina la fila |
| El administrador restablece la contraseña (FR-026) | Se elimina la fila: el bloqueo se levanta de inmediato |

**Mensaje asociado**: idéntico palabra por palabra para correo registrado y no registrado (SC-018). Se define una sola vez en `packages/shared` como constante, de modo que sea imposible que las dos rutas de código diverjan.

---

## Entidad `admin_audit_log` — Registro de acciones administrativas

Bitácora de solo-agregar de las acciones de HU-09 (FR-034).

| Campo | Tipo | Restricciones | Origen |
|---|---|---|---|
| `id` | UUID | PK, generado | — |
| `actor_user_id` | UUID | FK → `user.id`; el administrador que ejecutó la acción | FR-034 |
| `target_user_id` | UUID | FK → `user.id`; el usuario afectado | FR-034 |
| `action` | enum `AdminAction` | `CREAR` \| `EDITAR` \| `CAMBIAR_ROL` \| `DESACTIVAR` \| `REACTIVAR` \| `RESTABLECER_PASSWORD` | FR-034 |
| `occurred_at` | timestamptz | por defecto `now()` | FR-034 |

**Correspondencia con FR-034**. El requisito enumera seis acciones registrables; el enum declara seis valores, sin sobrantes ni faltantes:

| Acción de FR-034 | Valor de `AdminAction` | Endpoint que la produce |
|---|---|---|
| Alta | `CREAR` | `POST /admin/users` |
| Edición | `EDITAR` | `PATCH /admin/users/:id` |
| Cambio de rol | `CAMBIAR_ROL` | `PUT /admin/users/:id/role` |
| Desactivación | `DESACTIVAR` | `PUT /admin/users/:id/status` → `DESACTIVADO` |
| Reactivación | `REACTIVAR` | `PUT /admin/users/:id/status` → `ACTIVO` |
| Restablecimiento de contraseña | `RESTABLECER_PASSWORD` | `POST /admin/users/:id/password-reset` |

La única entrada que no procede de un endpoint es la que deja el modo de recuperación de la semilla (FR-036, D-010): usa `RESTABLECER_PASSWORD` con `actor_user_id = target_user_id`, igualdad imposible desde la aplicación porque FR-027 prohíbe actuar sobre uno mismo. Esa igualdad es, por tanto, la marca inequívoca de una recuperación operativa.

**Restricciones de uso**

- **Solo inserción**: el código no expone ninguna operación de actualización ni de borrado sobre esta tabla (FR-034).
- **Nunca contiene contraseñas**, ni en claro ni con hash, ni valores anteriores de campos sensibles (FR-034).
- La entrada se escribe **dentro de la misma transacción** que la acción que registra. Si la acción se revierte, la entrada tampoco queda: es lo que exige el escenario "Confirmación antes de una acción de impacto" cuando el administrador cancela (FR-035).
- **Sin vista de consulta en v1** (spec § Fuera de Alcance). Se verifica en la revisión de la implementación, excepción acotada declarada en SC-010.
- **Los usuarios se registran por referencia, nunca por copia**: las dos columnas de usuario son claves foráneas y no hay ninguna columna con nombre, correo, teléfono ni valores anteriores o posteriores del campo modificado (FR-034, Principio X). La consecuencia asumida es que la bitácora dice que hubo una edición, pero no qué cambió.
- **Retención indefinida**: v1 no purga ni archiva esta tabla, y no fija plazo. Con unas pocas acciones administrativas al día, una política de purga sería alcance sin requisito (Principio I, Principio III). Las entradas sobreviven a la desactivación tanto del actor como del afectado, porque no hay borrado físico de usuarios (RN-002).
- **No registra eventos de autenticación**: los inicios de sesión, los fallos, los bloqueos, los cierres y las expiraciones **no** dejan entrada aquí (spec § FR-034, supuesto 27). El enum `AdminAction` tiene exactamente seis valores y ninguno los cubre, lo que hace la exclusión estructural y no una omisión del código.

---

## Tipos compartidos sin persistencia

Definidos en `packages/shared`, sin tabla asociada en esta épica.

### `OrderStatus` — Máquina de estados del pedido (D-012)

Enum de los cinco estados del Principio XII, más la función pura de transiciones válidas:

```text
creado ──► en_preparacion ──► asignado_repartidor ──► entregado ──► cerrado
```

`transicionesValidas(estado)` devuelve el conjunto de estados alcanzables desde uno dado. **No se crea la entidad `Pedido`**: pertenece a E4/E2 y construirla aquí violaría el Principio III. HU-10 la consume únicamente para nombrar los estados de sus filtros (FR-023).

### Panel de métricas (FR-019)

Vista agregada de solo lectura, **sin entidad propia** (spec § Entidades Clave):

- Usuarios activos por rol: `SELECT role, count(*) FROM "user" WHERE status = 'ACTIVO' GROUP BY role` — plenamente funcional en E1.
- Pedidos por estado: superficie preparada que devuelve el conjunto vacío hasta que E4/E2 aporten pedidos; la interfaz muestra el mensaje de "sin datos" de FR-022 (D-012).

---

## Esquema Prisma (referencia)

```prisma
enum Role         { CLIENTE NEGOCIO REPARTIDOR ADMINISTRADOR }
enum UserStatus   { ACTIVO DESACTIVADO }
enum AdminAction  { CREAR EDITAR CAMBIAR_ROL DESACTIVAR REACTIVAR RESTABLECER_PASSWORD }

model User {
  id               String     @id @default(uuid())
  fullName         String
  email            String     @unique
  phone            String
  passwordHash     String
  role             Role
  status           UserStatus @default(ACTIVO)
  searchNormalized String
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  sessions         Session[]
  auditActed       AdminAuditLog[] @relation("actor")
  auditTargeted    AdminAuditLog[] @relation("target")

  @@index([searchNormalized])
  @@index([role, status])
  @@index([createdAt(sort: Desc), id(sort: Desc)])   // orden por defecto del listado (D-016)
}

model Session {
  id             String    @id @default(uuid())
  userId         String
  role           Role
  createdAt      DateTime  @default(now())
  lastActivityAt DateTime  @default(now())
  revokedAt      DateTime?

  user           User      @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([userId])
}

model LoginAttemptControl {
  email       String    @id
  failedCount Int       @default(0)
  lockedUntil DateTime?
  updatedAt   DateTime  @updatedAt
}

model AdminAuditLog {
  id           String      @id @default(uuid())
  actorUserId  String
  targetUserId String
  action       AdminAction
  occurredAt   DateTime    @default(now())

  actor        User        @relation("actor",  fields: [actorUserId],  references: [id], onDelete: Restrict)
  target       User        @relation("target", fields: [targetUserId], references: [id], onDelete: Restrict)

  @@index([targetUserId])
}
```

**Sobre `onDelete: Restrict`**: el diseño no contempla borrado físico de usuarios (RN-002), así que la política de borrado en cascada nunca debería ejercerse. Se declara `Restrict` —y no el `Cascade` que sería habitual— precisamente por eso: si alguna vez alguien intentara eliminar una fila de `user`, la operación debe **fallar** en el motor, no llevarse por delante la bitácora que FR-034 exige conservar. Es la diferencia entre una regla escrita en un documento y una regla que la base de datos hace cumplir.

---

## Trazabilidad requisito → modelo

| Requisito | Dónde se satisface |
|---|---|
| FR-001, FR-002 | `user.email`, `user.password_hash`, `user.role` |
| FR-003, FR-018 | `session.role` + guards (D-007) |
| FR-004, FR-005 | `session.last_activity_at` |
| FR-006 | `session.revoked_at` |
| FR-007, FR-016 | `user.password_hash` (bcrypt, D-002) |
| FR-008, SC-018 | `login_attempt_control` sin FK + mensaje único compartido |
| FR-009, FR-014 | Campos obligatorios de `user` + esquema Zod |
| FR-010 | Actualización de `full_name`, `email`, `phone` |
| FR-011 | `session.role` congelado |
| FR-012, FR-013 | `user.status` + revocación de sesiones |
| FR-015 | `user.search_normalized`, índice `(role, status)`, paginación |
| FR-017, RN-005 | Restricción única sobre `user.email`, sin borrado físico |
| FR-024 | `session.revoked_at` en la transacción de desactivación |
| FR-026 | Reescritura de `password_hash` + borrado de `login_attempt_control` |
| FR-027, RN-006 | Regla de servicio sobre `actor_user_id = target_user_id` |
| FR-028 | Script de semilla (D-010) |
| FR-036 | Modo de recuperación del script de semilla (D-010); entrada de bitácora con actor = afectado |
| FR-030 | Transacciones de la API; sesión inválida rechaza antes de escribir |
| FR-032 | Esquema Zod compartido (D-005) |
| FR-033 | `login_attempt_control.failed_count`, `locked_until` |
| FR-034 | `admin_audit_log`, solo inserción |
| FR-035 | Confirmación en la interfaz; sin confirmación no hay transacción ni bitácora |
| FR-019, FR-020, FR-023 | Agregación de `user`; superficie de pedidos preparada (D-012) |
