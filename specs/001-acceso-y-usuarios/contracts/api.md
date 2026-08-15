# Contrato HTTP: servicio `services/api`

**Base**: `/api/v1` · **Formato**: JSON · **Autenticación**: cookie `fv_session` (`httpOnly`, `SameSite=Lax`, `Secure` en producción)

Todos los cuerpos de petición se validan con los esquemas Zod de `packages/shared` (ver [`shared.md`](./shared.md)).

---

## Convenciones de error

Formato único de respuesta de error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Debes ingresar un correo electrónico válido.",
    "fields": { "email": "Debes ingresar un correo electrónico válido." }
  }
}
```

- `code` es un identificador técnico estable en inglés, para el código que consume la API.
- `message` es el texto que se muestra al usuario, **siempre en español, sin detalles técnicos** (Principio II, FR-014).
- `fields` solo aparece en errores de validación por campo.

| Código HTTP | `code` | Significado |
|---|---|---|
| 400 | `VALIDATION_ERROR` | El cuerpo no cumple el esquema (FR-014, FR-032) |
| 401 | `UNAUTHENTICATED` | Sin sesión, o sesión expirada o revocada (FR-005, FR-024, FR-030) |
| 401 | `INVALID_CREDENTIALS` | Correo o contraseña incorrectos (FR-008) |
| 403 | `FORBIDDEN` | Autenticado, pero el rol no permite la acción (FR-003, FR-018) |
| 404 | `NOT_FOUND` | El recurso no existe |
| 409 | `EMAIL_ALREADY_EXISTS` | Correo ya usado por otro usuario, activo o desactivado (FR-017) |
| 409 | `SELF_PROTECTION` | Un administrador intenta desactivarse o cambiarse el rol (FR-027) |
| 423 | `ACCOUNT_LOCKED` | Bloqueo temporal por intentos fallidos (FR-033) |

**Formato de fechas**: toda fecha que la API devuelve (`createdAt`, `occurredAt`) es una cadena **ISO 8601 en UTC**, con sufijo `Z` y milisegundos — `"2026-08-15T14:32:07.451Z"`. La API no formatea fechas para leerlas ni aplica husos horarios: la conversión al huso local y el formato visible en español son responsabilidad de la interfaz. Así, dos clientes en husos distintos reciben exactamente el mismo dato y ninguna comparación depende de la configuración del contenedor.

**Mensajes fijos y no negociables** (definidos como constantes en `packages/shared`):

| Constante | Texto |
|---|---|
| `MSG_CREDENCIALES_INVALIDAS` | «Correo electrónico o contraseña incorrectos.» |
| `MSG_CUENTA_BLOQUEADA` | «Demasiados intentos fallidos. Vuelve a intentarlo en 15 minutos.» |
| `MSG_SIN_PERMISO` | «No tienes permiso para acceder a esta función.» |
| `MSG_SESION_EXPIRADA` | «Tu sesión expiró. Vuelve a iniciar sesión para continuar.» |

`MSG_CREDENCIALES_INVALIDAS` no distingue si falló el correo o la contraseña (FR-008). `MSG_CUENTA_BLOQUEADA` se devuelve **idéntico** para un correo registrado y para uno inexistente (SC-018): por eso es una constante única y no dos cadenas escritas por separado.

---

## Autenticación — HU-08

### `POST /api/v1/auth/login`

Inicia sesión (FR-001).

**Cuerpo**: `LoginSchema` → `{ email: string, password: string }`

**Respuesta 200** — establece la cookie `fv_session`:

```json
{
  "user": {
    "id": "uuid",
    "fullName": "María Pérez",
    "email": "maria.perez@ejemplo.cl",
    "role": "CLIENTE"
  },
  "redirectTo": "/cliente"
}
```

`redirectTo` implementa FR-031: `/cliente`, `/negocio`, `/repartidor` o `/admin` según el rol.

**Errores**: `400 VALIDATION_ERROR` · `401 INVALID_CREDENTIALS` · `423 ACCOUNT_LOCKED`

**Comportamiento obligatorio**

1. Normalizar el correo a minúsculas.
2. Consultar `login_attempt_control`. Si `locked_until > now()`, responder `423` **sin comprobar la contraseña**, exista o no la cuenta (FR-033, FR-008).
3. Buscar el usuario. Ejecutar la comparación bcrypt **siempre**, contra un hash señuelo si el usuario no existe, para igualar los tiempos de respuesta (D-002).
4. Usuario inexistente, contraseña incorrecta o `status = DESACTIVADO` → registrar el fallo y responder `401 INVALID_CREDENTIALS`. Los tres casos son indistinguibles desde fuera (FR-008, FR-012).
5. Éxito: eliminar la fila de `login_attempt_control`, crear la `session` con el rol vigente congelado (FR-011) y establecer la cookie.

### `POST /api/v1/auth/logout`

Cierra la sesión de inmediato (FR-006). Requiere sesión activa.

**Respuesta 204** — marca `revoked_at = now()` y borra la cookie. Es idempotente: una sesión ya inválida devuelve igualmente 204.

### `GET /api/v1/auth/me`

Devuelve el usuario de la sesión actual. Lo usa el frontend para renderizar la página de inicio por rol (FR-031).

**Respuesta 200**: `{ "id", "fullName", "email", "role" }` — el `role` proviene de la **sesión**, no del usuario (FR-011, D-007).

**Errores**: `401 UNAUTHENTICATED` si la sesión fue revocada (FR-024), expiró por inactividad (FR-005) o el usuario fue desactivado.

**Efecto lateral**: refresca `session.last_activity_at`, igual que cualquier otra petición autenticada (FR-004).

**Restricción de uso obligatoria**: `apps/web` llama a este endpoint **al montar una pantalla**, es decir como consecuencia de una navegación del usuario. Tiene **prohibido** llamarlo por temporizador, en un `setInterval` o en cualquier forma de sondeo en segundo plano. Un sondeo periódico refrescaría `last_activity_at` indefinidamente y una sesión abandonada no expiraría nunca, incumpliendo FR-005 y SC-013. El servidor no puede detectar la diferencia —una petición es una petición—, así que la garantía vive en el cliente y se verifica en la revisión de código y con el escenario A9 de la guía (SC-024).

---

## Gestión de usuarios — HU-09

Todos los endpoints de esta sección exigen rol `ADMINISTRADOR`; en caso contrario, `403 FORBIDDEN` con `MSG_SIN_PERMISO` (FR-003).

### `GET /api/v1/admin/users`

Lista el padrón con filtros, búsqueda y paginación (FR-015).

**Parámetros de consulta** (`ListUsersQuerySchema`):

| Parámetro | Tipo | Por defecto | Requisito |
|---|---|---|---|
| `search` | string (opcional) | — | Coincidencia parcial sobre nombre **y** correo, insensible a mayúsculas y acentos |
| `role` | `Role` (opcional) | — | Filtro por rol |
| `status` | `UserStatus` (opcional) | — | Filtro por estado |
| `page` | entero ≥ 1 | 1 | Paginación |

El tamaño de página es fijo: **20** (decisión de clarificación de la spec). No es un parámetro de la API: procede de la constante `PAGE_SIZE` de `packages/shared`, que es su única fuente. Ningún otro documento ni módulo repite el literal.

**Orden por defecto**: `created_at DESC, id DESC` (FR-015, D-016). No es configurable: la API no acepta parámetros de ordenamiento. El desempate por `id` es obligatorio, no opcional — sin él, dos altas con la misma marca de tiempo pueden intercambiarse entre consultas y hacer que un usuario aparezca en dos páginas o en ninguna (SC-023).

**`page` fuera de rango**: si `page` supera `totalPages`, la respuesta es **200 con `items: []`**, conservando los valores reales de `total`, `page` y `totalPages`. No es un error de validación: pedir la página 5 de un resultado que quedó en 3 es lo que ocurre naturalmente cuando un filtro se estrecha mientras el administrador navega, y responder 400 obligaría a la interfaz a distinguir ese caso de un error real. La interfaz muestra el mismo mensaje de "sin resultados" (FR-015, SC-020) y ofrece volver a la primera página.

**Término de búsqueda**: se normaliza con `normalizarBusqueda` de `packages/shared` —la misma función que alimenta `search_normalized`— y se **escapa** antes de construir el patrón `LIKE` (`\`, `%` y `_`). Buscar `100%` busca ese texto literal; sin el escape devolvería el padrón completo (D-011).

**Respuesta 200**:

```json
{
  "items": [ { "id", "fullName", "email", "phone", "role", "status", "createdAt" } ],
  "total": 47,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

`total` es el recuento de resultados que cumplen los criterios aplicados, no el del padrón completo (FR-015). Los tres criterios son combinables entre sí. Cuando no hay resultados, se devuelve `items: []` con `total: 0`; **el mensaje en español de "sin resultados" lo muestra la interfaz** (FR-015, FR-022, SC-020) — la API no devuelve un error, porque cero resultados no es un fallo.

### `POST /api/v1/admin/users`

Crea un usuario (FR-009).

**Cuerpo**: `CreateUserSchema` → `{ fullName, email, phone, password, role }`

**Respuesta 201**: el usuario creado, con `status: "ACTIVO"`. **Nunca** incluye la contraseña ni su hash.

**Errores**: `400 VALIDATION_ERROR` (campo obligatorio ausente, FR-014; contraseña fuera del rango de 8 a 72 caracteres, FR-032) · `409 EMAIL_ALREADY_EXISTS` (FR-017, RN-005 — aplica también si el correo pertenece a un usuario desactivado)

**Efecto**: registra `CREAR` en `admin_audit_log` en la misma transacción (FR-034). No requiere confirmación previa (FR-035).

**Sobre el rol `ADMINISTRADOR`**: **sí** puede asignarse al crear un usuario. No es una laxitud de `CreateUserSchema`, es lo que FR-009 enumera literalmente («un rol (cliente, negocio, repartidor, administrador)»), y es además el único camino para que exista un segundo administrador —sin él, el sistema quedaría atado para siempre al único administrador semilla, y retirarlo sería imposible sin dejar el sistema sin acceso (RN-006)—. RN-003 lo respalda: no hay permisos diferenciados dentro de un rol, de modo que todo administrador puede hacer lo mismo que cualquier otro, incluido crear administradores.

### `PATCH /api/v1/admin/users/:id`

Edita los datos de contacto y el correo (FR-010).

**Cuerpo**: `UpdateUserSchema` → `{ fullName?, email?, phone? }`. **No** admite `role`, `status` ni `password`: cada uno tiene su propio endpoint, porque son acciones de impacto que exigen confirmación (FR-035).

**Respuesta 200**: el usuario actualizado; conserva su rol y su estado previos.

**Errores**: `400` · `404` · `409 EMAIL_ALREADY_EXISTS`

**Nota**: un administrador **sí** puede editar sus propios datos de contacto (FR-027).

### `PUT /api/v1/admin/users/:id/role`

Cambia el rol (FR-011). Acción de impacto: la interfaz confirma antes de llamar (FR-035).

**Cuerpo**: `{ role: Role }` · **Respuesta 200**: el usuario actualizado.

**Errores**: `409 SELF_PROTECTION` si `:id` es el propio administrador (FR-027, RN-006)

**Efecto**, en una única transacción:

1. Actualizar `user.role`
2. **Revocar las sesiones vivas del usuario afectado** (FR-024, D-014)
3. Registrar `CAMBIAR_ROL`

El nuevo rol rige a partir del **próximo inicio de sesión** (FR-011): la revocación termina la sesión abierta, no muta su rol en caliente —eso último es lo que FR-011 y el caso límite de la spec prohíben expresamente—. Sin la revocación, un usuario degradado conservaría sus privilegios anteriores hasta 30 minutos, que es lo que SC-026 exige que no ocurra.

### `PUT /api/v1/admin/users/:id/status`

Desactiva o reactiva (FR-012, FR-013). Acción de impacto (FR-035).

**Cuerpo**: `{ status: "ACTIVO" | "DESACTIVADO" }` · **Respuesta 200**: el usuario actualizado.

**Errores**: `409 SELF_PROTECTION` al intentar desactivarse a sí mismo (FR-027, RN-006)

**Efecto de la desactivación**, en una única transacción (FR-024):

1. `user.status = DESACTIVADO`
2. Revocar todas sus sesiones vivas → su siguiente acción recibe `401`
3. Registrar `DESACTIVAR`

El historial asociado se conserva íntegro: no hay borrado (RN-002). La reactivación conserva las credenciales previas (FR-013), revoca sesiones por uniformidad de la regla —en la práctica no hay ninguna viva, D-014— y registra `REACTIVAR`.

### `POST /api/v1/admin/users/:id/password-reset`

Restablece la contraseña (FR-026). Acción de impacto (FR-035).

**Cuerpo**: `ResetPasswordSchema` → `{ password: string }` (entre 8 y 72 caracteres, FR-032)

**Respuesta 204**

**Efecto**, en una única transacción:

1. Reescribir `password_hash` — la contraseña anterior deja de ser válida de inmediato (SC-012)
2. **Revocar las sesiones vivas del usuario afectado** (FR-024, D-014): sin ello una sesión abierta seguiría operando con la credencial que acaba de invalidarse
3. **Eliminar la fila de `login_attempt_control`**: levanta cualquier bloqueo temporal vigente (FR-026, FR-033)
4. Registrar `RESTABLECER_PASSWORD` — **sin la contraseña**, ni en claro ni con hash (FR-034)

---

## Panel de administración — HU-10

Solo rol `ADMINISTRADOR` (FR-018). **Ningún endpoint de esta sección modifica datos**: solo se exponen verbos `GET` (FR-021, RN-004).

### `GET /api/v1/admin/dashboard/metrics`

Métricas generales del estado operativo (FR-019).

**Respuesta 200**:

```json
{
  "activeUsersByRole": {
    "CLIENTE": 128, "NEGOCIO": 4, "REPARTIDOR": 12, "ADMINISTRADOR": 2
  },
  "ordersByStatus": {
    "creado": 0, "en_preparacion": 0,
    "asignado_repartidor": 0, "entregado": 0, "cerrado": 0
  }
}
```

`activeUsersByRole` es plenamente funcional en E1. `ordersByStatus` devuelve todos los estados en cero hasta que E4/E2 aporten pedidos: la superficie existe y respeta la máquina de estados compartida (FR-023, D-012), pero no hay entidad `Pedido` en esta épica (Principio III). La interfaz muestra el mensaje de "sin datos" de FR-022 mientras el total sea cero.

### `GET /api/v1/admin/dashboard/orders`

Reporte de pedidos filtrable (FR-020).

**Parámetros**: `status` (`OrderStatus`, opcional), `from` (fecha, opcional), `to` (fecha, opcional), `page`. Los filtros son combinables.

**Respuesta 200**: misma forma paginada que el listado de usuarios. En E1 devuelve siempre `items: []` con `total: 0`, y la interfaz muestra el mensaje de "sin datos" en español (FR-022, SC-020).

**Validación**: si `from > to`, `400 VALIDATION_ERROR` con mensaje en español.

---

## Salud del servicio

### `GET /api/v1/health`

Único endpoint **sin autenticación** además del inicio de sesión. Lo consume el `healthcheck` de Docker (D-013), no la interfaz.

**Respuesta 200**: `{ "status": "ok" }` si el proceso está en pie y la conexión a PostgreSQL responde; `503` en caso contrario. No revela versiones, rutas, configuración ni ningún dato del padrón: su cuerpo es constante.

---

## Contrato del proxy en Next.js

Las rutas de `apps/web/src/app/api/**` reenvían al servicio NestJS (D-006) bajo tres reglas:

1. **Reenvío transparente**: mismo verbo, misma ruta bajo `/api/v1`, mismo cuerpo. No transforman la respuesta.
2. **Propagación de la cookie**: se reenvía `fv_session` en la petición y se propaga el `Set-Cookie` de la respuesta.
3. **Sin lógica de negocio**: el proxy no decide nada; toda regla vive en NestJS. Su única responsabilidad es que la cookie sea same-origin.

Adicionalmente, `apps/web/src/middleware.ts` redirige a `/login` cuando no hay cookie, y desde la raíz al segmento del rol. Es **exclusivamente experiencia de usuario**: la autorización real la ejercen los guards de NestJS (D-007).
