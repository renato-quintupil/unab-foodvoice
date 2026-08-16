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

**Cómo llega al cliente una violación de la restricción única**. La comprobación previa del servicio cubre el caso normal, pero no es la garantía: entre leer y escribir cabe otra petición. Cuando la escritura falla con la violación de unicidad, el servicio la **traduce** a `409 EMAIL_ALREADY_EXISTS` con `MSG_CORREO_YA_EXISTE`, exactamente la misma respuesta que produce la comprobación previa. La traducción es obligatoria: sin ella, una condición de carrera llegaría al administrador como un `500`, es decir como un fallo del sistema en lugar de como la regla de negocio que es.

La respuesta **no incluye** el nombre de la restricción, el nombre de la columna, el valor del correo ni ningún fragmento del error del motor. Esto merece una precisión, porque parece rozar FR-008: aquí **sí** se revela que existe un usuario con ese correo, y es correcto que así sea. FR-008 protege la pantalla de inicio de sesión, a la que accede cualquiera; este endpoint solo lo alcanza un administrador autenticado, a quien FR-017 obliga precisamente a informarle de que el correo está tomado —de otro modo no podría corregir el alta—. Las dos reglas no chocan: se aplican a superficies distintas y a públicos distintos.

**Baja lógica**: no existe borrado físico (spec § Fuera de Alcance). `status = DESACTIVADO` conserva el historial asociado (RN-002).

**Qué conserva RN-002 en E1, si aún no existe el historial de pedidos**. La pregunta es pertinente: RN-002 habla de conservar el historial, y en esta épica no hay ninguna entidad de pedidos que conservar. Lo que E1 entrega no es el historial sino **las condiciones que lo harán posible**, y las tres son verificables ahora:

1. **La identidad del usuario es estable y permanente**: su `id` nunca se reutiliza ni desaparece, así que cualquier entidad futura que lo referencie seguirá encontrándolo.
2. **No hay borrado físico en ningún camino**, y `onDelete: Restrict` lo hace cumplir en el motor y no por disciplina.
3. **El correo queda reservado** aunque el usuario esté desactivado (FR-017, RN-005), de modo que su reactivación siempre es posible.

Dentro de E1 sí existe ya un historial que RN-002 protege, y conviene no pasarlo por alto: la **bitácora de acciones administrativas**, que sobrevive intacta a la desactivación tanto del usuario afectado como del administrador que actuó. Cuando E4/E2 añadan los pedidos, no habrá que cambiar nada de este modelo para cumplir RN-002: bastará con que referencien `user.id`.

### Metadatos operativos sin requisito funcional

Tres columnas de este modelo **no se remiten a ningún requisito**, y se declaran aquí en lugar de dejarlas pasar como parte inevitable del andamiaje (Principio III):

| Columna | Para qué está | Por qué se acepta |
|---|---|---|
| `user.updated_at` | Saber cuándo cambió por última vez una fila, al diagnosticar una incidencia | Una columna, mantenida por el ORM, que ninguna pantalla muestra y que `UserDto` **no expone** — no crea superficie funcional |
| `session.created_at` | Distinguir el inicio de una sesión de su última actividad al depurar la expiración | Ídem; sin ella, una sesión larga y una recién creada son indistinguibles en la tabla |
| `login_attempt_control.updated_at` | Ver cuándo se registró el último intento sobre un correo | Ídem |

Ninguna se lee desde el código de la aplicación ni participa en ninguna regla. Si en una revisión posterior se concluye que no se han usado nunca para diagnosticar nada, lo correcto es eliminarlas, no conservarlas por costumbre.

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

### Alcance exacto de la transacción de desactivación (FR-024, FR-030)

Todo lo que sigue ocurre **dentro de una única transacción**, incluidas las lecturas. Que las comprobaciones estén dentro y no antes no es un detalle: leer fuera y escribir dentro dejaría una ventana en la que el usuario puede cambiar entre la comprobación y la acción.

| # | Operación | Por qué está dentro |
|---|---|---|
| 1 | Leer el usuario `:id` | Si no existe, la transacción termina sin escribir nada y la API responde `404` |
| 2 | Comprobar la autoprotección (`:id` ≠ administrador que actúa) | Si falla, se revierte y la API responde `409 SELF_PROTECTION` (FR-027) |
| 3 | Comprobar si el estado solicitado ya es el actual | Si coincide, la transacción termina **sin los pasos 4 a 6** y la API responde `200` sin cambios (`contracts/api.md` §PUT status) |
| 4 | `UPDATE user SET status = 'DESACTIVADO'` | La acción propiamente dicha (FR-012) |
| 5 | `UPDATE session SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL` | Alcanza a **todas** las sesiones vivas del afectado, nunca a las del administrador que actúa (FR-024) |
| 6 | `INSERT INTO admin_audit_log (...)` | La constancia de la acción (FR-034) |

**Si cualquiera de las seis falla, no queda nada aplicado.** No hay compensación ni reintento: la transacción se revierte entera, el usuario sigue activo, sus sesiones siguen vivas y la bitácora no registra nada. Es exactamente lo que exige FR-030 —rechazo íntegro, sin cambios parciales— y lo que hace que el escenario de cancelación de FR-035 sea trivial: si no hay confirmación, no se abre transacción alguna.

**La respuesta al cliente se emite después de la confirmación**, nunca antes. Un administrador que ve «usuario desactivado» en pantalla tiene la garantía de que las tres escrituras están en firme; no existe el estado intermedio en que la interfaz informe de un éxito que la base de datos aún podría rechazar.

Las otras tres acciones de impacto —cambio de rol, reactivación y restablecimiento de contraseña— siguen la misma estructura, cambiando el paso 4 por su escritura propia. El restablecimiento añade además el borrado de la fila de `login_attempt_control` (FR-026, FR-033) dentro de la misma transacción.

**Un administrador desactivado por otro** no recibe ningún trato especial, y el modelo lo hace evidente: el `WHERE` del paso 5 es por `user_id` del **afectado**, de modo que las sesiones del administrador que ejecuta la acción quedan intactas por construcción y no por una excepción escrita para ellas. Si ambos tenían sesión activa, solo termina la del afectado (RN-003: el acceso lo determina el rol, no la persona; SC-029). El sistema no puede quedarse sin administradores por esta vía, porque quien actúa sigue siendo uno (RN-006, supuesto 16).

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

La expiración por inactividad es **pasiva**: no se borra la fila, simplemente deja de considerarse válida. No hace falta ningún proceso programado (Principio I).

**Retención de las filas muertas**. Las sesiones revocadas y las expiradas **se conservan indefinidamente**: v1 no purga esta tabla, no fija plazo de retención y no tiene ninguna tarea programada de limpieza. Es una decisión de alcance, y su consecuencia se declara sin rodeos: **la tabla `session` crece de forma monótona y nunca se reduce**. Tres razones la hacen aceptable en v1 y una condición la haría insostenible más adelante:

- El volumen previsto es ínfimo —un solo local, unas pocas decenas de inicios de sesión al día—, de modo que la tabla suma del orden de miles de filas al año. La validez se resuelve siempre por clave primaria, así que el tamaño no degrada ninguna consulta.
- Las filas muertas **no contienen datos sensibles**: un identificador opaco, una referencia al usuario, un rol y tres marcas de tiempo. No hay credenciales que convenga borrar cuanto antes (Principio X).
- Una purga exigiría un proceso programado —lo único que el diseño de expiración pasiva evita deliberadamente— con su propia configuración y su propio modo de fallo, para resolver un problema que v1 no tiene (Principio I, Principio III).

Lo que cambiaría la conclusión es el volumen, no el tiempo: si el producto pasara a varios locales con uso continuo, un borrado periódico de las filas con `revoked_at` no nulo o con `last_activity_at` anterior a un plazo dado sería un `DELETE` de una línea. Se deja anotado aquí para que entonces sea una decisión informada y no un descubrimiento.

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

**Índices**: solo la clave primaria sobre `email`. **No hay índice sobre `locked_until`, y su ausencia es deliberada**: esta tabla se consulta siempre por el correo exacto —`WHERE email = ?`—, y `locked_until` nunca aparece en un criterio de búsqueda, solo se compara contra el reloj una vez recuperada la fila. Un índice sobre esa columna únicamente serviría para un barrido del tipo «encuentra todas las filas cuyo bloqueo venció», es decir para una tarea de limpieza que el diseño de vencimiento pasivo evita a propósito (D-003). Añadirlo sería pagar mantenimiento en cada escritura por una consulta que nadie hace.

**Ausencia deliberada de clave foránea**: si esta tabla apuntara a `user`, sería imposible contar intentos sobre correos no registrados, y el sistema respondería distinto para una cuenta existente que para una inexistente — filtrando exactamente lo que FR-008 prohíbe filtrar.

**Verificación contra los escenarios de no revelación**. La ausencia de clave foránea no basta con declararla: se comprueba recorriendo los cuatro casos en que un correo puede llegar a la pantalla de inicio de sesión y confirmando que la tabla se comporta igual en todos.

| Caso | Comportamiento de la tabla | ¿Distinguible desde fuera? |
|---|---|---|
| Correo que no corresponde a ninguna cuenta | Se crea la fila y se cuenta el fallo | No |
| Correo de un usuario activo, contraseña incorrecta | Ídem | No |
| Correo de un usuario desactivado, credenciales correctas | Ídem: el rechazo de FR-012 se cuenta como fallo | No |
| Correo que existió y fue editado a otro valor | La fila sigue asociada al correo escrito, no al usuario | No |

La cuarta fila es la que solo aparece al pensar el modelo como *control de correos ingresados* y no como *control de usuarios*: si la tabla tuviera clave foránea, editar un correo arrastraría o rompería su contador, y el comportamiento pasaría a depender de si detrás hay una cuenta. Sin ella, la tabla ni siquiera sabe que existen usuarios, que es exactamente la propiedad que FR-008 necesita.

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

### Atomicidad del contador ante intentos concurrentes (FR-033)

**No se exige ningún nivel de aislamiento especial**: el `READ COMMITTED` por defecto de PostgreSQL basta, porque el incremento **no se implementa leyendo y luego escribiendo**. La carrera que preocupa —cinco peticiones simultáneas que leen `failed_count = 4` y todas concluyen que aún no toca bloquear— solo existe si la decisión se toma en la aplicación. Aquí se toma dentro de la propia escritura:

```sql
INSERT INTO login_attempt_control (email, failed_count, locked_until, updated_at)
VALUES ($1, 1, NULL, now())
ON CONFLICT (email) DO UPDATE SET
  failed_count = CASE WHEN login_attempt_control.failed_count >= 4 THEN 0
                      ELSE login_attempt_control.failed_count + 1 END,
  locked_until = CASE WHEN login_attempt_control.failed_count >= 4 THEN now() + interval '15 minutes'
                      ELSE login_attempt_control.locked_until END,
  updated_at   = now();
```

PostgreSQL toma un bloqueo de fila sobre el conflicto, de modo que las peticiones concurrentes sobre el mismo correo se serializan entre sí y cada una ve el valor que dejó la anterior. El quinto fallo bloquea exactamente una vez, sea cual sea el orden de llegada, y sin que dos peticiones puedan «gastar» el mismo intento.

Se descartó `SERIALIZABLE`: encarece cada transacción de la aplicación y obliga a manejar reintentos por fallo de serialización, para conseguir lo mismo que ya garantiza un `UPSERT` sobre una única fila. Y se descartó un bloqueo explícito con `SELECT ... FOR UPDATE`: son dos idas a la base de datos donde basta una, y deja abierta la duda de qué ocurre si la fila aún no existe —el caso más frecuente, un correo que falla por primera vez—, que el `INSERT ... ON CONFLICT` resuelve sin ramas.

**Lo que sí es imprescindible** es que la condición del quinto fallo se evalúe **dentro del SQL**, como arriba, y no leyendo el contador en el servicio para decidir después. Ese es el único punto donde la regla puede romperse en silencio, y su test de integración debe lanzar los cinco intentos en paralelo, no en secuencia.

### El inicio de sesión exitoso: una sola transacción

El borrado de la fila y la creación de la sesión **van en la misma transacción**. Si se hicieran por separado, cualquiera de los dos fallos posibles dejaría un estado que contradice a FR-033: una sesión creada con el contador intacto —el usuario entra, pero arrastra fallos que podrían bloquearlo en su próximo intento— o un contador reiniciado sin sesión —un fallo que además regala intentos—. Ninguno es catastrófico por separado, y precisamente por eso conviene fijarlo: son las incoherencias que nadie declara y que luego cuesta explicar. El coste de agruparlas es nulo, porque ambas escrituras ocurren en el mismo instante y sobre la misma conexión.

### `locked_until` en el pasado con `failed_count` mayor que cero

Es un estado **normal y esperado**, no una inconsistencia, y se describe aquí para que nadie escriba código que intente «arreglarlo». Se alcanza así: cinco fallos bloquean la cuenta y dejan `failed_count = 0` con `locked_until` a quince minutos vista; pasado ese lapso el bloqueo se ignora; y dos fallos posteriores dejan `failed_count = 2` junto a un `locked_until` que sigue apuntando al pasado.

**El valor vencido no se limpia ni se anula**: simplemente deja de mirarse, porque la única comprobación que se hace sobre él es `locked_until > now()`. Cuando la cuenta vuelva a acumular cinco fallos, el `UPSERT` lo sobrescribe. Anularlo exigiría una escritura adicional en cada intento para no cambiar ningún comportamiento observable.

### Edición de un correo hacia un valor con bloqueo vigente

Cuando el administrador cambia el correo de un usuario a uno que ya figura en esta tabla con `locked_until` en el futuro, **la fila de bloqueo no se toca**, y el usuario editado queda sujeto a ese bloqueo aunque él nunca haya fallado un intento.

Es la consecuencia correcta de que la tabla controle *correos ingresados en la pantalla de inicio de sesión* y no *usuarios*: alguien estuvo intentando entrar con ese correo, y el bloqueo debe seguir aplicándose exista o no una cuenta detrás (FR-008, FR-033). Levantarlo automáticamente al asignar el correo a un usuario abriría un camino para eludir el bloqueo —bastaría con que un administrador reasignara el correo—, y hacerlo depender de si hay cuenta detrás reintroduciría justo la diferencia de comportamiento que la ausencia de clave foránea elimina.

La contrapartida asumida es que un usuario recién editado puede encontrarse bloqueado sin culpa. Tiene dos salidas, ninguna de las cuales exige código nuevo: esperar los quince minutos, o pedir al administrador un restablecimiento de contraseña, que borra la fila y levanta el bloqueo de inmediato (FR-026). El caso inverso es simétrico y también deliberado: editar el correo **desde** un valor bloqueado no libera esa fila, que sigue protegiendo al correo antiguo de quien estuviera probándolo.

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

**Qué instante registra `occurred_at`**. El del **inicio de la transacción**, no el de su confirmación: `now()` en PostgreSQL devuelve la marca de tiempo de comienzo de la transacción actual, y `@default(now())` de Prisma se traduce a eso. La elección no es libre —es lo que hace el motor— pero sí hay que declararla, porque tiene una consecuencia:

**dos acciones cuyas transacciones se solapen pueden quedar registradas en un orden de `occurred_at` distinto del orden en que realmente se confirmaron.** Si la acción A empieza antes que B pero confirma después, la bitácora dirá que A ocurrió primero. Para v1 es irrelevante y se acepta: las acciones administrativas son esporádicas, las ejecuta un puñado de personas, sus transacciones duran milisegundos y **no existe ninguna vista que muestre la bitácora ordenada** (spec § Fuera de Alcance), de modo que el orden no sostiene ninguna decisión. Se declara para que quien construya esa vista más adelante sepa que `occurred_at` responde a «cuándo empezó» y no a «en qué orden quedó firme», y decida entonces si necesita algo más fuerte.

Lo que sí queda garantizado es lo que importa: `occurred_at` está siempre **dentro** del intervalo de la transacción que registra, de modo que ninguna entrada puede llevar una fecha anterior a la acción que la produjo ni posterior a su confirmación.

**Restricciones de uso**

- **Solo inserción, y lo hace cumplir el motor**: además de que el código no expone ninguna operación de actualización ni de borrado, la migración inicial crea un **disparador que rechaza `UPDATE` y `DELETE`** sobre esta tabla lanzando una excepción. La convención de código no bastaba: FR-034 exige que el registro «nunca se edita ni se borra», y una regla que solo vive en la disciplina de quien programa se rompe con un `prisma.adminAuditLog.deleteMany()` escrito de buena fe en un test o en un script de mantenimiento. Con el disparador, esa llamada falla. Prisma no expresa disparadores en su esquema, así que se declara en SQL a mano dentro de la migración:

  ```sql
  CREATE FUNCTION admin_audit_log_solo_insercion() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'admin_audit_log es de solo inserción (FR-034)';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER admin_audit_log_inmutable
    BEFORE UPDATE OR DELETE ON "AdminAuditLog"
    FOR EACH ROW EXECUTE FUNCTION admin_audit_log_solo_insercion();
  ```

  **Consecuencias asumidas**, ambas deseables: una migración futura que necesite reescribir esta tabla tendrá que desactivar el disparador de forma deliberada y visible en el propio archivo de migración —no podrá hacerlo por descuido—; y el aislamiento entre tests de integración no puede truncar esta tabla con un `DELETE`, así que el arranque compartido debe usar `TRUNCATE ... CASCADE`, que no dispara disparadores de fila. Ese detalle, que de otro modo aparecería como un fallo desconcertante en la primera prueba, queda anotado aquí y en la tarea correspondiente.
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

**Fidelidad al Principio XII, sin añadir ni omitir**. El principio enuncia la máquina como «creado → en preparación → asignado a repartidor → entregado → cerrado». E1 declara **esos cinco estados, en ese orden, y ninguno más**. En concreto, y porque son las tres tentaciones habituales:

- **No hay estado de cancelación ni de rechazo.** El principio no lo contempla, y E1 no puede inventarlo: FR-023 prohíbe expresamente definir estados propios. Si el producto llega a necesitarlo, corresponde enmendar la constitución y HU-03, no ampliarlo aquí.
- **No hay transiciones de retroceso.** `entregado` no vuelve a `en_preparacion`. La linealidad estricta es lo que hace que el historial de trazabilidad sea legible como una secuencia y no como un grafo.
- **`cerrado` es terminal**: `transicionesValidas('cerrado')` devuelve el conjunto vacío, coherente con que el principio sitúe el cierre al final y lo condicione a la entrega.

**Por qué esto no crea un contrato que E4/E2 deban romper**. Es una preocupación razonable —declarar un tipo sin su entidad puede fijar decisiones prematuras—, y aquí no ocurre, porque lo que E1 declara es exactamente lo que HU-03 ya había fijado y nada más. Cuando E4/E2 construyan `Pedido`, lo que harán es **añadir**: una tabla con una columna `status` de este mismo enum y un historial de cambios de estado. Ninguna de esas adiciones obliga a modificar lo que E1 escribió, porque E1 no ha decidido nada sobre la persistencia —ni el nombre de la tabla, ni las columnas del pedido, ni cómo se guarda el historial—. Lo único que E4/E2 no podrán hacer sin romper compatibilidad es cambiar los nombres o el orden de los cinco estados, y eso no es una restricción que imponga E1: la impone el Principio XII, y regiría igual si este enum no existiera.

El riesgo real de la operación es el contrario y conviene nombrarlo: que E1 hubiera declarado *de más* —una entidad `Pedido` a medias, un campo `total`, un estado extra «por si acaso»— y E4/E2 tuvieran que desmontarlo. Por eso el alcance se limita a un enum y una función pura, sin tabla, sin migración y sin ningún dato persistido (D-012).

### Panel de métricas (FR-019)

Vista agregada de solo lectura, **sin entidad propia** (spec § Entidades Clave):

- Usuarios activos por rol: `SELECT role, count(*) FROM "user" WHERE status = 'ACTIVO' GROUP BY role` — plenamente funcional en E1.
- Pedidos por estado: superficie preparada que devuelve el conjunto vacío hasta que E4/E2 aporten pedidos; la interfaz muestra el mensaje de "sin datos" de FR-022 (D-012).

**Los roles sin usuarios activos devuelven cero explícito, nunca una clave ausente.** El `GROUP BY` de arriba **omite** las filas de un rol que no tenga ningún usuario activo, así que el servicio DEBE completar el resultado con los cuatro roles antes de responder. La misma regla rige para los cinco estados de `ordersByStatus`, que en E1 están todos en cero por definición.

No es una preferencia de formato. Una clave ausente obliga a la interfaz a distinguir «cero usuarios con este rol» de «este rol no vino en la respuesta», dos situaciones que ningún requisito diferencia y que en la práctica se resolverían mostrando un hueco en el panel donde debería haber un cero. Con la forma completa garantizada, el panel siempre presenta las mismas nueve cifras y su lectura no depende del estado del padrón. Es además lo que hace comprobable el paso C2 de la guía, que contrasta las cifras del panel con el listado filtrado: no se puede contrastar una cifra que no aparece.

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
}
```

**Sobre el índice que esta tabla no tiene**. Una versión anterior de este modelo declaraba `@@index([targetUserId])`. Se retira: **en v1 nadie lee esta tabla**. No hay vista de consulta (spec § Fuera de Alcance), ningún endpoint la expone y ninguna regla de negocio la interroga; sus únicas lecturas son las de la verificación técnica D3–D5 y D11, hechas a mano sobre un puñado de filas. Un índice sin ninguna consulta que lo aproveche es alcance no especificado con coste real: se mantiene en cada inserción, es decir en cada acción administrativa, a cambio de nada (Principio III).

Tampoco lo exigen las claves foráneas: PostgreSQL solo necesitaría recorrer estas columnas al borrar un usuario, y el borrado físico no existe en este diseño —de hecho `onDelete: Restrict` está ahí para que falle si alguien lo intenta—. El índice vuelve el día que se especifique una vista de la bitácora, junto con la consulta concreta que lo justifique.

**Disparador de inmutabilidad**. La migración inicial añade además, en SQL a mano, el disparador `admin_audit_log_inmutable` que rechaza `UPDATE` y `DELETE` sobre esta tabla (ver § Restricciones de uso). Prisma no lo expresa en el esquema, así que vive únicamente en el archivo de migración; que no aparezca aquí arriba no significa que sea opcional.

**Sobre `onDelete: Restrict`**: el diseño no contempla borrado físico de usuarios (RN-002), así que la política de borrado en cascada nunca debería ejercerse. Se declara `Restrict` —y no el `Cascade` que sería habitual— precisamente por eso: si alguna vez alguien intentara eliminar una fila de `user`, la operación debe **fallar** en el motor, no llevarse por delante la bitácora que FR-034 exige conservar. Es la diferencia entre una regla escrita en un documento y una regla que la base de datos hace cumplir.

---

## Trazabilidad requisito → modelo

La tabla recorre **los treinta y seis requisitos funcionales** de la spec, sin omitir ninguno. Los que no tienen elemento de modelo aparecen igual, declarando dónde viven: dejarlos fuera haría imposible distinguir un requisito que no necesita datos de uno que se olvidó.

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
| FR-021 | **Sin elemento de modelo**: el panel no expone verbos de escritura. Se cumple por lo que no existe (RN-004) |
| FR-022 | **Sin elemento de modelo**: el mensaje de "sin datos" lo muestra la interfaz; la API devuelve un conjunto vacío, que no es un error |
| FR-025 | **Sin elemento de modelo**: no hay ninguna ruta de alta que no pase por el administrador. Se cumple por ausencia (RN-007) |
| FR-029 | **Sin elemento de modelo**: no hay exportación ni refresco automático. Se cumple por ausencia |
| FR-031 | `session.role`, que determina el destino tras el inicio de sesión; las páginas por rol viven en `apps/web` |

**Requisitos sin elemento de modelo**: FR-021, FR-022, FR-025 y FR-029. Los cuatro son negativos o de interfaz, y ninguno necesita datos. Se listan para que su ausencia en el esquema sea una constatación y no un hueco.

## Elementos del modelo sin requisito

El recorrido inverso, exigido por el Principio III: qué hay en el modelo que ningún requisito pida.

| Elemento | Veredicto |
|---|---|
| `user.updated_at`, `session.created_at`, `login_attempt_control.updated_at` | **Metadatos operativos declarados**, sin superficie funcional ni exposición en `UserDto` (ver § Metadatos operativos sin requisito funcional) |
| `@@index([targetUserId])` en `admin_audit_log` | **Retirado**: no había ninguna consulta que lo aprovechara en v1 |
| Todo lo demás —columnas, índices, restricciones y enums— | Se remite a un requisito, según la tabla anterior |

Las tres columnas de metadatos son el único alcance del modelo que no responde a un requisito, y se conservan con una justificación escrita y una condición de revisión, no por inercia.
