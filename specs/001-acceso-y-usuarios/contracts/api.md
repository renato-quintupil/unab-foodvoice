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

**Catálogo cerrado de códigos**. La API no produce ningún `code` fuera de esta tabla, y ningún `code` de la tabla queda sin productor —la columna «Quién lo produce» existe para que un código huérfano sea visible de un vistazo—:

| Código HTTP | `code` | Significado | Quién lo produce |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | El cuerpo o los parámetros no cumplen el esquema (FR-014, FR-032) | El `ZodValidationPipe`, en cualquier endpoint con cuerpo o parámetros de consulta |
| 401 | `UNAUTHENTICATED` | Sin sesión, o sesión expirada, revocada o inexistente (FR-005, FR-024, FR-030) | El `SessionGuard`, en **todos** los endpoints salvo `POST /auth/login` y `GET /health` |
| 401 | `INVALID_CREDENTIALS` | Correo o contraseña incorrectos (FR-008) | **Exclusivamente** `POST /auth/login` |
| 403 | `FORBIDDEN` | Autenticado, pero el rol no permite la acción (FR-003, FR-018) | El `RolesGuard`, en los endpoints bajo `/admin` |
| 404 | `NOT_FOUND` | El recurso no existe | Los endpoints con `:id` |
| 409 | `EMAIL_ALREADY_EXISTS` | Correo ya usado por otro usuario, activo o desactivado (FR-017) | `POST /admin/users` y `PATCH /admin/users/:id` |
| 409 | `SELF_PROTECTION` | Un administrador intenta desactivarse o cambiarse el rol (FR-027) | `PUT /admin/users/:id/role` y `PUT /admin/users/:id/status` |
| 413 | `PAYLOAD_TOO_LARGE` | El cuerpo excede el límite de tamaño | El servidor, antes de leer el cuerpo, en cualquier endpoint con cuerpo |
| 423 | `ACCOUNT_LOCKED` | Bloqueo temporal por intentos fallidos (FR-033) | **Exclusivamente** `POST /auth/login` |
| 500 | `INTERNAL_ERROR` | Fallo no previsto | El filtro global de excepciones; su `message` es fijo y no revela nada del fallo |
| 502 | `UPSTREAM_UNAVAILABLE` | El servicio NestJS no respondió | **Exclusivamente** el proxy de Next.js, nunca NestJS |

**Cómo distingue el cliente los dos `401`**: por el endpoint, no por el contenido. `INVALID_CREDENTIALS` solo puede provenir de `POST /auth/login` y significa «estas credenciales no sirven»; `UNAUTHENTICATED` solo puede provenir de cualquier otro endpoint y significa «no hay sesión válida». Son mutuamente excluyentes por construcción, de modo que el código que consume la API nunca necesita decidir cuál de los dos recibió: en el formulario de inicio de sesión muestra el error junto al formulario, y en cualquier otra pantalla lleva a `/login` con `MSG_SESION_EXPIRADA`. Esta separación estricta es también lo que impide que una sesión caducada se confunda con una contraseña equivocada y mande a la persona a cambiar algo que está bien.

**Contenido de `fields`**: sus claves son **siempre nombres de campo declarados en el esquema del endpoint**, nunca nombres tomados de la petición. Si el cliente envía un campo que el esquema no conoce, ese campo se descarta en silencio y no aparece en `fields`. La razón es doble: evita devolver al navegador un texto que el propio cliente inyectó, y garantiza que la interfaz pueda asociar cada mensaje a un control real del formulario en lugar de tener que mostrar errores sobre campos que no existen en pantalla.

**Límite de tamaño del cuerpo**: **10 KB** para todos los endpoints. Ninguno recibe archivos ni texto largo —el campo más extenso es un nombre de 120 caracteres—, de modo que el límite está dos órdenes de magnitud por encima de cualquier petición legítima y aun así impide que una petición desmedida consuma memoria antes de ser validada. Al excederse, la respuesta es `413 PAYLOAD_TOO_LARGE` y el cuerpo **no llega a analizarse**.

**Versionado**: `v1` es la única versión que existe y no está previsto que convivan dos. Un cambio es incompatible si quita un campo de una respuesta, añade un campo obligatorio a una petición, cambia el tipo o el significado de un campo existente, o retira un endpoint o un valor de enum; un cambio que solo añade campos opcionales o endpoints nuevos es compatible. Un cambio incompatible exigiría publicar `/api/v2` y mantener ambas rutas mientras hubiera clientes en la anterior. En v1 esa situación **no puede darse**: el único cliente de esta API es `apps/web`, que vive en el mismo repositorio, se compila del mismo commit y se despliega en el mismo `docker compose`. El prefijo se declara desde ahora no porque haga falta hoy, sino porque añadirlo más tarde sí sería un cambio incompatible.

**Formato de fechas**: toda fecha que la API devuelve (`createdAt`, `occurredAt`) es una cadena **ISO 8601 en UTC**, con sufijo `Z` y milisegundos — `"2026-08-15T14:32:07.451Z"`. La API no formatea fechas para leerlas ni aplica husos horarios: la conversión al huso local y el formato visible en español son responsabilidad de la interfaz. Así, dos clientes en husos distintos reciben exactamente el mismo dato y ninguna comparación depende de la configuración del contenedor.

**Mensajes fijos y no negociables**. Los textos viven **exclusivamente** en `packages/shared` (ver [`shared.md` § Mensajes fijos](./shared.md#mensajes-fijos-en-español)), que es su única fuente. Este documento los referencia **por nombre de constante y nunca reproduce su texto**: una copia aquí sería una segunda fuente que podría divergir de la primera sin que ninguna prueba lo notara, y es exactamente el riesgo que la existencia de las constantes pretende eliminar (SC-018).

| Situación | Constante | Requisito |
|---|---|---|
| `401 INVALID_CREDENTIALS` | `MSG_CREDENCIALES_INVALIDAS` | FR-008 |
| `423 ACCOUNT_LOCKED` | `MSG_CUENTA_BLOQUEADA` | FR-033, SC-018 |
| `403 FORBIDDEN` | `MSG_SIN_PERMISO` | FR-003, FR-018 |
| `401 UNAUTHENTICATED` | `MSG_SESION_EXPIRADA` | FR-005, FR-030 |
| `409 EMAIL_ALREADY_EXISTS` | `MSG_CORREO_YA_EXISTE` | FR-017 |
| `409 SELF_PROTECTION` | `MSG_AUTOPROTECCION` | FR-027 |
| `500 INTERNAL_ERROR`, `502 UPSTREAM_UNAVAILABLE` | `MSG_ERROR_INESPERADO` | Principio II |
| Listado de usuarios vacío (lo muestra la interfaz) | `MSG_SIN_RESULTADOS_USUARIOS` | FR-015, SC-020 |
| Reporte de pedidos vacío (lo muestra la interfaz) | `MSG_SIN_RESULTADOS_PEDIDOS` | FR-022, SC-020 |

`MSG_CREDENCIALES_INVALIDAS` cubre los cuatro casos que FR-008 exige no distinguir: correo inexistente, contraseña incorrecta, cuenta desactivada y cualquier otra causa de fallo del inicio de sesión.

**El `423` no revela cuánto falta**. La respuesta de bloqueo contiene el `code`, el `message` fijo y **ningún campo con el tiempo restante**: ni en el cuerpo, ni en una cabecera `Retry-After`. El mensaje habla de 15 minutos porque ese es el plazo del bloqueo completo (FR-033), no el que queda. Se decide así por dos razones: SC-018 exige que el mensaje sea idéntico *palabra por palabra* entre dos intentos, y un tiempo restante lo haría distinto en cada uno; y un contador regresivo en pantalla sería una funcionalidad que ningún requisito pide, con su propio estado y su propio refresco (Principio I, Principio III). La contrapartida asumida es que la persona bloqueada no sabe si le faltan dos minutos o catorce, y su único recurso es esperar o pedir un restablecimiento al administrador (FR-026).

---

## Autenticación — HU-08

**Resolución de la cookie de sesión** (aplica a todos los endpoints autenticados). El `SessionGuard` acepta la petición **solo** si la cookie `fv_session` contiene un identificador que corresponde a una fila de `session` que cumple las tres condiciones de validez del modelo de datos. Cualquier otro caso —cookie ausente, valor sin forma de UUID, UUID bien formado que no existe en la tabla, sesión revocada, sesión expirada por inactividad o sesión de un usuario ya desactivado— produce **exactamente la misma respuesta**: `401 UNAUTHENTICATED` con `MSG_SESION_EXPIRADA` y una instrucción de borrado de la cookie, para que el navegador no siga enviando un valor inservible en cada petición.

Que los seis casos sean indistinguibles es deliberado. Distinguir «esta sesión no existe» de «esta sesión expiró» le diría a quien pruebe identificadores al azar cuándo ha acertado uno, y no le sirve de nada al cliente legítimo: en los seis casos lo único que puede hacer es volver a iniciar sesión.

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

**Por qué `PATCH` en uno y `PUT` en dos.** No es una inconsistencia de estilo, sino la distinción entre las dos formas de escritura que existen aquí:

- `PATCH /admin/users/:id` recibe un **subconjunto elegido por quien llama** de tres campos opcionales y modifica solo los presentes. Un cuerpo con `{ phone }` deja intactos el nombre y el correo. Eso es exactamente una modificación parcial, y `PUT` sería engañoso: prometería reemplazar el recurso entero y luego no lo haría.
- `PUT /admin/users/:id/role` y `PUT /admin/users/:id/status` reciben **el valor completo de un único atributo**, sin nada opcional. Enviar el mismo cuerpo dos veces deja el mismo estado que enviarlo una vez, que es la propiedad que `PUT` promete. Cada uno es un endpoint propio, y no un campo más de `PATCH`, porque son acciones de impacto que exigen confirmación previa (FR-035) y desencadenan la revocación de sesiones (FR-024); mezclarlas con la edición de contacto obligaría a mirar el cuerpo para saber si la petición necesitaba confirmación.

**Modificación concurrente de un mismo usuario.** No hay control de concurrencia optimista: ni `ETag`, ni número de versión, ni comprobación de que el dato leído siga siendo el vigente. Si dos administradores editan al mismo usuario a la vez, **prevalece el último en guardar** y el primero no recibe aviso. Es una consecuencia asumida y declarada, no un descuido: con un padrón de un solo local y unos pocos administradores el conflicto es improbable, y una comprobación de versión añadiría un campo al contrato, un código de error más y una pantalla de resolución para un caso que la spec no plantea (Principio I, Principio III). Lo que sí está cubierto es el caso en que el usuario ya no existe o cambió de estado: la acción se ejecuta dentro de una transacción y, si `:id` no corresponde a ninguna fila, la respuesta es `404 NOT_FOUND`. El **borrado físico no existe** en v1 (spec § Fuera de Alcance), así que un usuario nunca desaparece bajo los pies de otro administrador: a lo sumo aparece desactivado.

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

**Dos altas simultáneas con el mismo correo**: la garantía de unicidad la da la **restricción única del motor**, no la comprobación previa del servicio. Esa comprobación existe para poder responder un `409` con mensaje claro en el caso normal, pero entre leer y escribir hay una ventana en la que otra petición puede insertar la misma fila. Cuando eso ocurre, la escritura falla con la violación de unicidad y el servicio la traduce al **mismo `409 EMAIL_ALREADY_EXISTS` con `MSG_CORREO_YA_EXISTE`**: desde fuera, la carrera es indistinguible del caso normal, y exactamente una de las dos peticiones crea el usuario. Traducir esa violación en lugar de dejarla escapar como `500` es obligatorio; es lo que impide que una condición de carrera se presente al administrador como un fallo del sistema. El test de integración de FR-017 cubre este camino, no solo el de la comprobación previa.

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

**Estado solicitado igual al actual**: la respuesta es `200` con el usuario sin cambios, y **no ocurre nada más**: no se revocan sesiones y **no se registra ninguna entrada en la bitácora**. Desactivar a quien ya está desactivado no es un error —el estado que el administrador pedía es el que hay—, pero tampoco es una acción: FR-034 registra las acciones administrativas que se aplicaron sobre un usuario, y aquí no se aplicó ninguna. Anotarla llenaría la bitácora de entradas que no corresponden a ningún cambio y volvería inútil su lectura; revocar sesiones sería peor todavía, porque expulsaría a un usuario activo por una petición que no modificó nada. Con esta regla el endpoint es idempotente en el sentido pleno: repetirlo *n* veces deja el mismo estado y la misma bitácora que ejecutarlo una vez.

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

**Parámetros** (`OrdersQuerySchema`): `status` (`OrderStatus`, opcional), `from` (fecha, opcional), `to` (fecha, opcional), `page` (entero ≥ 1, por defecto 1). Los filtros son combinables.

**Formato de `from` y `to`**: cadena `AAAA-MM-DD`, **solo fecha, sin hora ni huso**. No se acepta una marca de tiempo completa: el administrador filtra por días, no por instantes, y admitir las dos formas obligaría a decidir qué hacer con un huso horario escrito por el cliente. Un valor con otra forma —`15-08-2026`, `2026-8-5`, una fecha inexistente como `2026-02-30`— produce `400 VALIDATION_ERROR` con mensaje en español.

Ambos extremos son **inclusivos**, y se interpretan en **UTC**, el mismo huso en que la API devuelve toda fecha: `from` abarca desde las `00:00:00.000Z` de ese día y `to` hasta las `23:59:59.999Z` del suyo. Así, `from=to=2026-08-15` devuelve los pedidos de ese día completo, que es lo que una persona espera al escribir la misma fecha dos veces; con extremos exclusivos devolvería cero y parecería un defecto. Los dos parámetros son independientes: solo `from` significa «desde esa fecha en adelante», solo `to` significa «hasta esa fecha», y ninguno de los dos significa «todo el historial».

**Validación de rango**: si `from > to`, `400 VALIDATION_ERROR` con mensaje en español. **No se limita la amplitud del rango** ni por arriba ni por abajo: un rango de cincuenta años es válido y no representa ningún riesgo, porque la respuesta está paginada y devuelve como mucho una página de resultados. Rechazar rangos amplios exigiría fijar un máximo arbitrario que el administrador no puede prever y que ningún requisito respalda (Principio III). Tampoco se restringen las fechas futuras: un rango enteramente futuro es válido y devuelve el conjunto vacío, que es la respuesta correcta y no un error.

**Respuesta 200**: `Paginated<OrderDto>`, **la misma forma exacta** que el listado de usuarios —`items`, `total`, `page`, `pageSize`, `totalPages`— porque ambas provienen del tipo `Paginated<T>` de `packages/shared` y del mismo `PAGE_SIZE`. No hay ningún campo que una tenga y la otra no. Que las dos superficies paginadas del producto se comporten igual, incluida la regla de `page` fuera de rango, evita que la interfaz necesite dos componentes de paginación distintos.

En E1 devuelve siempre `items: []` con `total: 0`, y la interfaz muestra el mensaje de "sin datos" en español (FR-022, SC-020).

---

## Salud del servicio

### `GET /api/v1/health`

Único endpoint **sin autenticación** además del inicio de sesión. Lo consume el `healthcheck` de Docker (D-013), no la interfaz.

**Respuesta 200**: `{ "status": "ok" }` si el proceso está en pie y la conexión a PostgreSQL responde; `503` en caso contrario. No revela versiones, rutas, configuración ni ningún dato del padrón: su cuerpo es constante.

---

## Contrato del proxy en Next.js

Las rutas de `apps/web/src/app/api/**` reenvían al servicio NestJS (D-006) bajo tres reglas:

1. **Reenvío transparente**: mismo verbo, misma ruta bajo `/api/v1`, mismo cuerpo y mismo código de estado. No transforman la respuesta.
2. **Propagación de la cookie**: se reenvía `fv_session` en la petición y se propaga el `Set-Cookie` de la respuesta.
3. **Sin lógica de negocio**: el proxy no decide nada; toda regla vive en NestJS. Su única responsabilidad es que la cookie sea same-origin.

**Qué significa «transparente», campo por campo.** «No transformar» es una intención hasta que se enumera qué cruza y qué no, así que se enumera. La lista es cerrada en ambos sentidos: lo que no aparece, no se propaga.

| Sentido | Se propaga | No se propaga |
|---|---|---|
| Navegador → NestJS | Verbo, ruta bajo `/api/v1`, cadena de consulta, cuerpo sin modificar, `content-type`, `accept`, `cookie` | `host`, `origin`, `referer`, `user-agent`, `authorization`, cualquier `x-forwarded-*` y cualquier otra cabecera |
| NestJS → Navegador | Código de estado, cuerpo sin modificar, `content-type`, `set-cookie` | Cualquier otra cabecera de respuesta |

La lista blanca es deliberadamente corta. `authorization` no se propaga porque esta API no lo usa —la sesión viaja en la cookie (D-001)— y reenviarlo abriría un segundo camino de autenticación que nadie ha especificado. Las cabeceras de identidad del cliente no se propagan porque NestJS no toma ninguna decisión con ellas: FR-033 cuenta intentos por correo y nunca por origen. Y el cuerpo se reenvía **sin analizar ni reserializar**, de modo que lo que valida el esquema de NestJS es exactamente lo que el navegador envió.

**Cuando NestJS no responde.** El proxy espera como mucho **10 segundos**. Si se agota ese plazo, la conexión falla o el servicio devuelve algo que no es una respuesta HTTP válida, el proxy responde `502 UPSTREAM_UNAVAILABLE` con `MSG_ERROR_INESPERADO` y el mismo formato de error que cualquier otro fallo, para que la interfaz no necesite un camino aparte. Tres reglas lo acotan:

- **No reintenta.** Una petición que puede haber modificado datos no se repite a ciegas: el proxy no sabe si NestJS llegó a aplicarla antes de dejar de responder, y reintentar una desactivación o un alta podría duplicarla. Reintentar quedaría en manos de la persona, que sí sabe qué pidió.
- **No inventa contenido.** Nunca devuelve un cuerpo vacío disfrazado de éxito ni una lista vacía cuando no pudo consultar: una respuesta `200` con `items: []` significa «no hay datos», y confundir eso con «no pude preguntar» le mostraría al administrador un padrón vacío como si fuera real.
- **No filtra el detalle técnico.** El mensaje que llega al navegador está en español y no menciona direcciones internas, puertos, nombres de servicio ni trazas (Principio II). El detalle queda en la salida de diagnóstico del contenedor.

El plazo de 10 segundos se elige por encima del objetivo de 5 segundos de SC-001 y muy por debajo del tiempo que una persona tolera mirando una pantalla quieta; sin él, una petición colgada dejaría el navegador esperando indefinidamente sin ningún mensaje.

Adicionalmente, `apps/web/src/middleware.ts` redirige a `/login` cuando no hay cookie, y desde la raíz al segmento del rol. Es **exclusivamente experiencia de usuario**: la autorización real la ejercen los guards de NestJS (D-007).

---

## Trazabilidad

### Cada endpoint contra su requisito

Los doce endpoints y el requisito que los justifica. **Ninguno existe sin requisito** (Principio III): la única fila sin `FR` es el `healthcheck`, y se declara como tal en lugar de inventarle uno.

| # | Endpoint | Requisitos |
|---|---|---|
| 1 | `POST /auth/login` | FR-001, FR-002, FR-008, FR-031, FR-033 |
| 2 | `POST /auth/logout` | FR-006 |
| 3 | `GET /auth/me` | FR-004, FR-005, FR-031 |
| 4 | `GET /admin/users` | FR-015, FR-018 |
| 5 | `POST /admin/users` | FR-009, FR-014, FR-017, FR-032, FR-034 |
| 6 | `PATCH /admin/users/:id` | FR-010, FR-014, FR-017, FR-027, FR-034 |
| 7 | `PUT /admin/users/:id/role` | FR-011, FR-024, FR-027, FR-034 |
| 8 | `PUT /admin/users/:id/status` | FR-012, FR-013, FR-024, FR-027, FR-034 |
| 9 | `POST /admin/users/:id/password-reset` | FR-024, FR-026, FR-032, FR-033, FR-034 |
| 10 | `GET /admin/dashboard/metrics` | FR-018, FR-019 |
| 11 | `GET /admin/dashboard/orders` | FR-018, FR-020, FR-023 |
| 12 | `GET /health` | **Ninguno.** Es infraestructura, exigida por el `healthcheck` del despliegue (D-013), no por la spec. Se declara así de forma explícita: su cuerpo es constante, no toca el padrón y no expone superficie funcional |

### Requisitos que no son un endpoint

La cobertura no se demuestra solo con la tabla anterior: hay requisitos de HU-08, HU-09 y HU-10 que no se materializan en una ruta HTTP. Ninguno queda sin lugar donde vivir.

| Requisito | Dónde vive |
|---|---|
| FR-002, FR-003, FR-018 | `SessionGuard` y `RolesGuard`, aplicados a todos los endpoints de `/admin` (D-007) |
| FR-005, FR-030 | `SessionGuard`: umbral de inactividad y rechazo previo a aplicar nada |
| FR-007, FR-016 | Hash de la contraseña al escribirla y ausencia estructural del campo en `UserDto` (D-002, `shared.md`) |
| FR-021, FR-022 | Ausencia deliberada de verbos de escritura en `/admin/dashboard/**` y mensajes de "sin datos" en la interfaz |
| FR-025 | Ausencia deliberada de un endpoint de registro público. Es un requisito que se cumple por lo que **no** existe |
| FR-028, FR-036 | Script de semilla y su modo de recuperación, fuera de la API (D-010) |
| FR-029 | Ausencia deliberada de endpoints de exportación y de cualquier mecanismo de refresco automático |
| FR-031 | Campo `redirectTo` de la respuesta de inicio de sesión, más las páginas por rol de `apps/web` |
| FR-035 | Diálogo de confirmación en `apps/web`, previo a llamar a los cuatro endpoints de impacto. La API no lo comprueba: cuando la petición llega, la confirmación ya ocurrió |
| RN-001 … RN-007 | Reglas transversales, cada una realizada por los endpoints y guards de las filas anteriores |

### Superficie deliberadamente vacía en E1

Dos partes del contrato existen y responden, pero devuelven datos vacíos por construcción, no por falta de datos:

| Superficie | Qué devuelve en E1 | Cuándo dejará de estar vacía |
|---|---|---|
| `GET /admin/dashboard/orders` | Siempre `items: []`, `total: 0` | Cuando E4/E2 entreguen la entidad `Pedido` y su persistencia |
| Campo `ordersByStatus` de `GET /admin/dashboard/metrics` | Los cinco estados en cero | La misma condición |

Se construyen ahora porque FR-019, FR-020 y FR-023 los especifican por completo y la nota de entrega por fases de la spec condiciona **su verificación**, no su existencia. Lo que **no** se construye es la entidad `Pedido` (D-012, Principio III). La distinción importa al revisar: una lista vacía aquí es el comportamiento correcto y esperado, no un defecto pendiente. El resto de la API no tiene ninguna superficie vacía: todo lo demás es plenamente funcional dentro de E1.
