# Investigación técnica: E1 · Acceso y usuarios

**Fecha**: 2026-08-15 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Este documento registra las decisiones técnicas que resuelven los puntos abiertos del Contexto Técnico del plan. Cada decisión indica qué se eligió, por qué, y qué alternativas se descartaron.

---

## D-001 · Mecanismo de sesión

**Decisión**: sesión con estado en PostgreSQL (tabla `session`) referenciada por un identificador opaco (UUID v4) transportado en una cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción.

**Justificación**:

- **FR-024** exige que la desactivación de un usuario invalide sus sesiones activas *de inmediato*. Con estado en base de datos esto es un `UPDATE session SET revoked_at = now() WHERE user_id = ?` dentro de la misma transacción de la desactivación: no hay ventana de tiempo en la que la sesión siga siendo válida.
- **FR-005** exige expiración por 30 minutos de *inactividad*, es decir una ventana deslizante. Se resuelve con `last_activity_at`, refrescado en cada petición autenticada.
- **FR-007** prohíbe exponer credenciales o tokens. Una cookie `httpOnly` no es legible por JavaScript, lo que elimina el vector de robo por XSS que sí tiene un token guardado en `localStorage`.
- **Principio I (Simplicidad ante todo)**: un identificador opaco contra una tabla es más fácil de razonar, auditar y depurar que un esquema de dos tokens con rotación.

**Alternativas descartadas**:

| Alternativa | Por qué se descartó |
|---|---|
| JWT de acceso corto + refresh token en BD | La revocación inmediata de FR-024 solo sería exacta hasta el vencimiento del token de acceso, o exigiría una lista de revocación — es decir, estado en servidor de todos modos, más la complejidad de la rotación. |
| JWT puro sin estado | Incompatible con FR-024: sin estado en servidor no existe forma de invalidar una sesión ya emitida. |

**Consecuencias**:

- Cada petición autenticada realiza una consulta a `session`. Con el volumen previsto (v1, un solo local) es irrelevante; se indexa `session.id` (clave primaria) y `session.user_id`.
- La renovación de `last_activity_at` se hace en el mismo `UPDATE ... RETURNING` que la validación, evitando una segunda ida a la base de datos.

**Qué refresca `last_activity_at` (FR-005)**. La ventana deslizante solo tiene sentido si «actividad» significa *actividad de la persona*. La regla operativa es:

| Origen de la petición | ¿Refresca? |
|---|---|
| Cualquier petición autenticada originada por una acción del usuario —navegar, filtrar, paginar, enviar un formulario, `GET /auth/me` al montar una pantalla— | **Sí** |
| Consultas automáticas de la aplicación sin intervención del usuario: sondeo periódico, reintentos en segundo plano, refresco por temporizador | **No deben existir** |

La distinción no se implementa inspeccionando la petición —el servidor no puede saber si detrás hubo una persona—, sino **eliminando la categoría entera en el cliente**: `apps/web` tiene prohibido consultar la API por temporizador o en segundo plano. `GET /auth/me` se llama al montar una pantalla, es decir como consecuencia de una navegación, y nunca en un `setInterval`. Es una restricción de diseño del frontend, verificable en la revisión de código y por el escenario A9 de la guía (una pestaña abierta y quieta durante 30 minutos debe expirar igualmente, SC-024).

**Alternativa descartada**: una segunda marca de tiempo «actividad explícita» distinta de `last_activity_at`, alimentada solo por verbos de escritura. Complica el modelo y falla en el caso más común —un usuario que solo lee y navega está activo, y su sesión no debería expirar—.

---

## D-002 · Hash de contraseñas

**Decisión**: `bcrypt` con factor de coste 12, mediante la biblioteca `bcrypt` de Node.

**Justificación**: FR-007 y FR-016 prohíben el almacenamiento en texto plano. `bcrypt` es un algoritmo de hash lento y con sal automática, diseñado exactamente para credenciales, y es la opción más difundida y mejor documentada en el ecosistema Node/NestJS. El coste 12 equilibra resistencia a fuerza bruta con el objetivo **SC-001** (inicio de sesión en menos de 5 segundos).

**Alternativas descartadas**: `argon2` es criptográficamente preferible pero requiere compilación nativa que complica el `Dockerfile` sin un beneficio observable a esta escala (Principio I). Cualquier hash de propósito general (SHA-256 y similares) queda descartado por no ser lento ni salado por diseño.

**Límite superior de longitud (consecuencia declarada)**: bcrypt **trunca silenciosamente la entrada a 72 bytes**. Sin un límite explícito, dos contraseñas que compartan sus primeros 72 bytes serían indistinguibles para el sistema, y el usuario no tendría forma de saberlo. Por eso `PasswordSchema` declara un máximo de **72 caracteres**, con un mensaje de error en español, en lugar de dejar que el truncamiento ocurra sin aviso.

El límite se expresa en caracteres y el truncamiento ocurre en bytes, de modo que una contraseña de 72 caracteres con acentos o emoji supera los 72 bytes en UTF-8. Para que el límite sea exacto, la validación mide **bytes UTF-8**, no unidades de código: `new TextEncoder().encode(valor).length <= 72`. Es un detalle menor que, de omitirse, reintroduciría el mismo truncamiento silencioso que el límite pretende evitar.

**Estado respecto a la spec**: **incorporado. Aprobado el 2026-08-15**. Cuando se redactó esta decisión, ningún requisito fijaba un máximo —FR-032 solo establecía el mínimo de 8—, así que el límite quedó registrado aquí en espera de una enmienda, conforme al procedimiento del Principio III. **FR-032 declara ahora el rango de 8 a 72 caracteres**, y la spec recoge además el cambio en SC-016, en un caso límite y en el supuesto 21. Este límite no es una regla de negocio nueva sino la exposición honesta de una restricción del algoritmo elegido: la alternativa —aceptar la contraseña y truncarla en silencio— sería un comportamiento oculto que contradice el Principio IV.

**Nota de seguridad**: la comparación de contraseñas se ejecuta **siempre**, incluso cuando el correo no corresponde a ningún usuario, contra un hash señuelo constante. Esto iguala el tiempo de respuesta entre "cuenta inexistente" y "contraseña incorrecta", cerrando el canal lateral de temporización que dejaría abierto FR-008.

---

## D-003 · Control de intentos fallidos (FR-033)

**Decisión**: tabla independiente `login_attempt_control`, con clave por **correo electrónico normalizado** (minúsculas, sin espacios al borde), no por `user_id`.

**Justificación**: la spec es explícita (Entidades Clave, FR-008, FR-033, SC-018): el conteo debe existir aunque la cuenta no exista, y el mensaje de bloqueo debe ser idéntico en ambos casos. Ligar el contador al `Usuario` haría imposible contar intentos sobre correos no registrados y filtraría, por diferencia de comportamiento, qué correos están dados de alta.

**Diseño**:

- `failed_count` (entero) y `locked_until` (timestamp nulo).
- Al fallar: `failed_count += 1`; si alcanza 5, `locked_until = now() + 15 min` y `failed_count = 0`.
- Al acertar: la fila se elimina (reinicio del contador, FR-033).
- El restablecimiento de contraseña por el administrador (FR-026) elimina la fila, levantando el bloqueo.
- El vencimiento es pasivo: si `locked_until <= now()`, se ignora y se permite el intento. No hace falta ningún proceso programado de limpieza (Principio I).

**Alternativas descartadas**: contador en memoria (se pierde al reiniciar el contenedor y no funciona con más de una instancia); limitación por dirección IP (no es lo que pide FR-033 y castiga a usuarios legítimos tras una NAT compartida).

---

## D-004 · Acceso a datos: Prisma

**Decisión**: Prisma ORM con `prisma migrate` para las migraciones versionadas. El `schema.prisma` vive en `services/api/prisma/`.

**Justificación**: un único esquema declarativo genera a la vez las migraciones y el cliente TypeScript tipado, lo que reduce la superficie de error entre el modelo y el código. Sus migraciones versionadas dan una historia reproducible de la base de datos, necesaria para levantar entornos limpios en Docker y para los tests de integración.

**Alternativas descartadas**: TypeORM (integración histórica con NestJS, pero migraciones menos ergonómicas y tipado más débil); Drizzle (excelente, pero con menos convenciones asentadas dentro de NestJS).

**Punto de atención**: el cliente Prisma se genera dentro de `services/api` y **no** se expone en `packages/shared`. El paquete compartido no debe arrastrar dependencias de base de datos hacia el navegador.

---

## D-005 · Contratos compartidos: Zod como fuente única

**Decisión**: `packages/shared` define los esquemas Zod de todas las entradas de la API; los tipos TypeScript se **infieren** de ellos (`z.infer`). NestJS los aplica mediante un `ZodValidationPipe` propio; Next.js los usa en los formularios vía `react-hook-form` + `@hookform/resolvers/zod`.

**Justificación**: reglas como "la contraseña tiene al menos 8 caracteres" (**FR-032**) o "el rol pertenece al conjunto fijo de cuatro valores" (**RN-001**) deben ser idénticas en ambos lados. Definirlas dos veces garantiza que tarde o temprano se desincronicen y que el mensaje en español que ve el usuario difiera del que aplica el servidor. Con una definición única, el mensaje de error en español (**Principio II**) también se declara una sola vez, dentro del esquema.

**Alternativa descartada**: `class-validator` en el backend (opción por defecto de NestJS) más un esquema separado en el frontend. Es lo convencional en NestJS, pero duplica cada regla de negocio en dos lugares, contra el objetivo explícito del usuario de compartir contratos de dominio.

**Frontera de responsabilidad**: Zod valida **forma y formato** (campos presentes, longitud, correo bien formado, rol válido). Las reglas que necesitan consultar la base de datos —unicidad del correo (**FR-017**), autoprotección del administrador (**FR-027**)— viven en los servicios de NestJS, nunca en el esquema.

---

## D-006 · Comunicación frontend ↔ backend (BFF)

**Decisión**: el navegador habla exclusivamente con Next.js. Los Route Handlers de Next (`apps/web/src/app/api/**`) reenvían las peticiones al servicio NestJS por la red interna de Docker, propagando la cookie de sesión.

**Justificación**:

- La cookie de sesión queda **same-origin**: no hace falta CORS ni `SameSite=None`, que son las dos configuraciones donde más fácilmente se abren agujeros.
- El servicio NestJS no necesita quedar expuesto a Internet: en el `docker-compose` solo `web` publica un puerto hacia el exterior.
- El identificador de sesión nunca es accesible desde el JavaScript de la página.

**Alternativa descartada**: llamadas directas del navegador a NestJS, que exigirían CORS con credenciales y cookies cross-site, o mover el token a un header `Authorization` — lo que obliga a guardarlo en un lugar legible por JavaScript, contradiciendo D-001.

**Costo asumido**: un salto de red adicional por petición, despreciable dentro de la misma red de contenedores frente al objetivo de 5 segundos de **SC-001**.

---

## D-007 · Autorización por rol

**Decisión**: un `SessionGuard` de NestJS resuelve la sesión y adjunta el usuario a la petición; un `RolesGuard` con decorador `@Roles(Rol.ADMINISTRADOR)` verifica el rol. En el frontend, el `middleware.ts` de Next.js protege las rutas por segmento.

**Justificación**: **FR-003** y **FR-018** exigen bloquear el acceso fuera del rol. La verificación del frontend es de experiencia de usuario (evita mostrar una pantalla que fallará); **la verificación autoritativa es siempre la del backend**. Un guard aplicado por decorador hace que la omisión sea visible en la revisión de código, en lugar de depender de que cada controlador recuerde comprobar el rol.

**Rol vigente**: el rol se lee de la fila `session`, congelado en el momento del inicio de sesión, no de la fila `user`. Esto implementa literalmente **FR-011** y el caso límite "cambio de rol con sesión activa": el nuevo rol rige recién en el próximo inicio de sesión.

---

## D-008 · Monorepo: pnpm workspaces + Turborepo

**Decisión**: `pnpm-workspace.yaml` declara `apps/*`, `services/*` y `packages/*`. Turborepo orquesta `build`, `test`, `lint` y `typecheck` con caché y respeto del grafo de dependencias.

**Justificación**: pnpm instala con enlaces duros (rápido y eficiente en disco) y, sobre todo, es **estricto**: un paquete solo puede importar lo que declaró en su `package.json`, lo que impide que `apps/web` acabe dependiendo por accidente de algo de `services/api`. Turborepo garantiza que `packages/shared` se compile antes que sus consumidores.

**Alternativa descartada**: npm workspaces sin orquestador. Es más simple, pero el hoisting permisivo de npm hace fácil crear dependencias implícitas entre paquetes, justo lo que la separación de carpetas busca evitar.

**Renombrado**: la carpeta `package/shared` (singular) pasa a `packages/shared`, convención estándar del ecosistema. La carpeta está vacía, así que el cambio no tiene costo.

---

## D-009 · Estrategia de pruebas

**Decisión**: dos niveles.

| Nivel | Herramienta | Ámbito |
|---|---|---|
| Unitario backend | Jest + `@nestjs/testing` | Servicios, guards, pipes, con repositorios sustituidos por dobles |
| Unitario frontend | Vitest + Testing Library | Componentes, hooks, Route Handlers |
| Unitario shared | Vitest | Esquemas Zod, máquina de estados |
| Integración API | Jest + Supertest + PostgreSQL efímera en Docker | Endpoints completos contra una base de datos real |

**Justificación**: Jest es el runner que NestJS trae cableado de fábrica; Vitest es notablemente más rápido y es el estándar actual del frontend. La capa de integración no es opcional: **FR-017** (unicidad del correo, garantizada por una restricción del motor), **FR-024** (revocación transaccional), **FR-030** (rechazo íntegro sin cambios parciales) y **FR-033** (bloqueo temporal) **no quedan realmente verificados contra una base de datos simulada** — la simulación probaría el doble, no la regla.

**Alternativa descartada**: solo unitarios con dobles. Dejaría sin cobertura automática justo las reglas de seguridad más delicadas de la épica.

**No incluido**: pruebas E2E con navegador. Quedan fuera de esta épica para no inflar el alcance (Principio I); la verificación de los escenarios Gherkin la realiza una persona siguiendo `quickstart.md` (Principio IV).

**Requisitos que dependen del paso del tiempo (FR-005, FR-033)**. Dos reglas centrales de la épica se expresan en minutos: 30 de inactividad y 15 de bloqueo. Esperarlos de verdad haría que la batería de pruebas tardara casi una hora, así que ninguna prueba lo hace.

*Decisión*: ningún módulo llama a `new Date()` ni a `Date.now()` directamente. El tiempo se obtiene de un `ClockService` inyectable con un único método `ahora(): Date`. En producción devuelve la hora real; en las pruebas se sustituye por un doble que devuelve un instante fijado.

| Nivel | Cómo se adelanta el tiempo |
|---|---|
| Unitario | Se inyecta un `ClockService` falso; el test fija el instante antes de cada aserción |
| Integración | Se escribe directamente en la fila —`last_activity_at` 31 minutos atrás, `locked_until` en el pasado— y se comprueba el comportamiento del endpoint contra una base de datos real |

Que las reglas temporales sean pasivas (D-001, D-003) es lo que hace viable este enfoque: no hay ningún proceso programado cuyo disparo haya que simular, solo una comparación contra el reloj en el momento de la lectura.

*Alternativa descartada*: falsear el reloj global del proceso con los temporizadores simulados de Jest. Funciona en el código de la aplicación, pero no en PostgreSQL, cuyo `now()` seguiría siendo el real — justo en la capa donde estas reglas necesitan verificarse. Un `ClockService` explícito es además visible en la firma de cada servicio, en lugar de ser magia global.

*Validación manual*: los pasos A5 y A9 de `quickstart.md` describen la espera real, que es lo que verifica el requisito de verdad, y ofrecen una alternativa abreviada para quien no pueda esperar.

---

## D-010 · Semilla del administrador inicial (FR-028)

**Decisión**: script `services/api/prisma/seed.ts`, ejecutable con `pnpm --filter api db:seed`. Lee `ADMIN_SEED_EMAIL` y `ADMIN_SEED_PASSWORD` de variables de entorno y es **idempotente**: si ya existe un usuario con ese correo, no hace nada.

**Justificación**: **FR-028** y el **Principio V** exigen que la contraseña provenga de configuración externa al repositorio. El script falla de forma explícita si `ADMIN_SEED_PASSWORD` no está definida o tiene menos de 8 caracteres (FR-032) — nunca recurre a un valor por defecto, que sería una credencial de fábrica publicada en el código.

**Operativa**: `.env.example` documenta las variables sin valores reales; `.env` está en `.gitignore`.

**Qué significa «ya existe»**: la idempotencia se evalúa por `ADMIN_SEED_EMAIL` normalizado, que es la clave única de la tabla. Si existe una fila con ese correo, el script no la toca —ni la contraseña, ni el rol, ni el estado— y termina con un mensaje informativo y código de salida 0. Ejecutar la semilla diez veces seguidas deja el mismo estado que ejecutarla una vez, y eso es exactamente lo que verifica su test de integración.

**Si el correo existe pero con otro rol o desactivado**: el script tampoco lo modifica en su modo normal. Es deliberado: promover en silencio a administrador una cuenta preexistente sería una escalada de privilegios provocada por una variable de entorno, y el arranque es el peor momento para eso. En su lugar el script **falla de forma explícita**, indicando que el correo está ocupado por un usuario que no es un administrador activo y que debe resolverse con el modo de recuperación.

**Modo de recuperación (FR-036)**: `pnpm --filter api db:seed --recuperar` —o `ADMIN_SEED_RECOVER=true`— fuerza la cuenta de `ADMIN_SEED_EMAIL` al estado de administrador activo con la contraseña de `ADMIN_SEED_PASSWORD`, exista ya o no, y revoca sus sesiones vivas. Es el único camino de vuelta cuando ningún administrador conserva acceso, dado que no hay autoservicio de contraseña (FR-026).

Tres resguardos lo mantienen honesto:

- **Solo se ejecuta desde fuera de la aplicación**, con acceso al despliegue y a su configuración. No hay ningún endpoint, pantalla ni parámetro HTTP que lo alcance: quien puede ejecutarlo ya podría escribir directamente en la base de datos.
- **Nunca es el modo por defecto.** El arranque del contenedor invoca siempre el modo normal e idempotente; el de recuperación exige la intervención deliberada de una persona.
- **Deja rastro**: escribe una entrada en `admin_audit_log` con `action = RESTABLECER_PASSWORD` y `actor_user_id = target_user_id` (la propia cuenta recuperada), porque la bitácora exige un actor y en esta operación no hay ninguno dentro del sistema. La igualdad de ambas columnas es la marca que distingue una recuperación operativa de un restablecimiento hecho por un administrador desde la aplicación, donde actor y afectado son siempre distintos (FR-027).

**Rotación de la contraseña semilla**: tras el primer arranque, lo recomendable es que el administrador cambie su contraseña desde la aplicación y que `ADMIN_SEED_PASSWORD` deje de reflejar la contraseña vigente —la variable solo se consulta al crear la cuenta o al recuperarla, nunca para validar un inicio de sesión—. No se impone un cambio obligatorio en el primer acceso: sería una pantalla y un estado más para un requisito que la spec no plantea (Principio III).

---

## D-011 · Búsqueda insensible a mayúsculas y acentos (FR-015)

**Decisión**: columna generada `search_normalized` en la tabla `user`, mantenida por la aplicación, que almacena `nombre_completo || ' ' || correo` normalizado (minúsculas, sin diacríticos vía `String.normalize('NFD')` y eliminación de marcas combinantes). La búsqueda es un `LIKE '%texto%'` sobre esa columna, con el término de búsqueda normalizado de la misma manera.

**Justificación**: FR-015 exige coincidencia parcial sobre nombre y correo a la vez, sin distinguir mayúsculas ni acentos ("MARÍA" debe encontrar a "María Pérez", **SC-021**). Normalizar en escritura evita aplicar funciones sobre la columna en cada consulta y mantiene el comportamiento idéntico sea cual sea la configuración regional del motor.

**Alternativa descartada**: la extensión `unaccent` de PostgreSQL. Es más elegante, pero exige instalar una extensión en el contenedor y hace la lógica dependiente del motor; normalizar en la aplicación mantiene la regla visible en el código y probable con un test unitario.

**Definición exacta de la función**. La normalización se declara una sola vez en `packages/shared` como `normalizarBusqueda(texto: string): string`, y se aplica **idénticamente** al construir `search_normalized` y al preparar el término que escribe el administrador. Que sean la misma función no es un detalle de estilo: si divergen, un texto que existe en la base deja de encontrarse.

Pasos, en este orden:

1. `.normalize('NFD')` — descompone cada carácter acentuado en su letra base más una marca combinante.
2. `.replace(/\p{Mn}/gu, '')` — elimina las marcas combinantes. `á → a`, `ü → u`, **`ñ → n`**.
3. `.toLowerCase()`.
4. `.replace(/\s+/g, ' ')` — colapsa cualquier secuencia de espacios, tabulaciones o saltos de línea en un único espacio.
5. `.trim()`.

Para `search_normalized` la entrada es `full_name + ' ' + email`; para el término de búsqueda, el texto tal cual lo escribió el administrador.

**Sobre la eñe**: el paso 2 convierte `ñ` en `n`, de modo que «Nuñez» y «Nunez» se encuentran mutuamente. Es intencional y coherente con el objetivo de FR-015 —que el administrador encuentre a la persona sin acertar la ortografía exacta—, y evita tratar el español como un caso especial dentro de una regla que ya es general para todos los diacríticos. La consecuencia asumida es que `ñ` y `n` son indistinguibles **a efectos de búsqueda**; el nombre almacenado y mostrado conserva siempre su forma original, porque `search_normalized` es una columna derivada y nunca se muestra.

**Caracteres con significado en `LIKE`**: el término normalizado se escapa antes de construir el patrón (`\` → `\\`, `%` → `\%`, `_` → `\_`), de modo que buscar `100%` busque literalmente ese texto y no cualquier cadena. Sin este paso, un `%` escrito por el administrador devolvería el padrón completo.

**Población en la migración**: la migración que introduce la columna la crea como `NOT NULL` en dos pasos —añadir como nullable, poblar con un `UPDATE` que aplique la misma normalización, y recién entonces imponer `NOT NULL`—. En E1 la tabla nace vacía y el `UPDATE` no afecta ninguna fila, pero el procedimiento queda declarado para cuando una migración posterior cambie la definición sobre datos existentes. Si la definición de `normalizarBusqueda` cambiara alguna vez, la migración correspondiente **debe** repoblar la columna entera: dejarla con valores calculados por la versión anterior de la función haría que unos usuarios se encontraran y otros no, sin patrón visible.

---

## D-012 · Máquina de estados del pedido en `packages/shared`

**Decisión**: `packages/shared` declara el enum de los cinco estados del **Principio XII** (`creado`, `en_preparacion`, `asignado_repartidor`, `entregado`, `cerrado`) y una función pura `transicionesValidas(estado)`. **No** se crea entidad `Pedido`, ni tabla, ni persistencia en esta épica.

**Justificación**: es la pieza mínima que satisface a la vez tres exigencias. **FR-023** obliga a que HU-10 use la máquina de estados de HU-03 sin definir estados propios — necesita nombrarlos para sus filtros. La instrucción de que la máquina de estados sea compartida entre frontend y backend se cumple ubicándola en el paquete común. Y el **Principio III (cero alcance fantasma)** prohíbe construir aquí la entidad Pedido, que pertenece a E4/E2 — coherente con la nota de entrega por fases de la propia spec.

**Consecuencia declarada**: las métricas de pedidos de FR-019, FR-020 y FR-023 se entregan en E1 como **superficie preparada y vacía**: el panel muestra el mensaje de "sin datos" de FR-022 hasta que E4/E2 aporten pedidos reales. Las métricas de usuarios activos por rol sí son plenamente funcionales y verificables dentro de E1.

---

## D-013 · Empaquetado en contenedores

**Decisión**: `docker-compose.yml` en la raíz levanta tres servicios (`postgres`, `api`, `web`); cada aplicación tiene su `Dockerfile` multi-etapa para producción.

**Detalles**:

- Solo `web` publica un puerto hacia el anfitrión (`3000`). `api` y `postgres` quedan en la red interna, en coherencia con D-006.
- `postgres` declara un `healthcheck`; `api` espera con `depends_on: condition: service_healthy` antes de arrancar.
- Los `Dockerfile` usan `node:22-alpine`, instalan con `pnpm --frozen-lockfile`, compilan en una etapa y copian a una imagen final que corre como usuario sin privilegios.
- Next.js se construye con `output: 'standalone'` para que la imagen final no arrastre el árbol completo de `node_modules`.
- Los tests de integración usan un `docker-compose.test.yml` con una PostgreSQL efímera en otro puerto, para no interferir con la base de datos de desarrollo.

**Persistencia de PostgreSQL**: volumen nombrado `foodvoice_pgdata` montado en `/var/lib/postgresql/data`. Los datos sobreviven a `docker compose down`; se pierden solo con `docker compose down -v`, que es explícito. El respaldo de la base de datos queda **fuera del alcance de v1** (Principio III): el proyecto es académico y de un solo local, y una estrategia de respaldo sin un entorno productivo real sería alcance sin requisito. La consecuencia asumida —una pérdida del volumen obliga a recrear el padrón— se acepta y se declara aquí en lugar de dejarse implícita.

**Momento de aplicación de las migraciones**. Las migraciones se aplican **al arrancar el servicio `api`**, antes de que el proceso de NestJS empiece a atender peticiones: el `entrypoint` de la imagen ejecuta `prisma migrate deploy` y solo si termina bien lanza el servidor. Si falla, el contenedor termina con error y `restart: on-failure` lo reintenta, en lugar de quedar atendiendo peticiones contra un esquema que no corresponde al código.

*Alternativa descartada*: un servicio `migrate` de un solo uso en el compose, con `api` esperando a que termine. Es más explícito, pero añade un cuarto servicio y un orden de arranque que hay que mantener, para un beneficio que el `entrypoint` ya da (Principio I).

*Arranques concurrentes*: `prisma migrate deploy` toma un **advisory lock** en PostgreSQL antes de aplicar nada. Si dos instancias de `api` arrancan a la vez, una aplica las migraciones y la otra espera y encuentra el esquema ya al día. No hace falta coordinación adicional.

*Migración fallida a mitad de aplicación*: cada migración de Prisma se ejecuta dentro de una transacción, de modo que una que falle no deja el esquema a medias —salvo las sentencias que PostgreSQL no puede ejecutar transaccionalmente, que esta épica no usa—. La migración queda marcada como fallida en `_prisma_migrations` y **bloquea los arranques siguientes** hasta que alguien la resuelva: es el comportamiento deseado, porque arrancar sobre un esquema inconsistente es peor que no arrancar. La recuperación es manual (`prisma migrate resolve`), y en v1 no se automatiza: con una sola base de datos y sin despliegue continuo, automatizar una reversión sería más riesgo que beneficio.

**Orden obligatorio migración → semilla**: la semilla escribe en la tabla `user`, así que exige el esquema ya aplicado. Al ir las migraciones en el `entrypoint`, el orden está garantizado por construcción y no depende de que alguien recuerde la secuencia. Ejecutar la semilla contra una base sin migrar falla con un error de tabla inexistente; no corrompe nada.

**Salud y reinicio de los servicios**:

| Servicio | `healthcheck` | `restart` |
|---|---|---|
| `postgres` | `pg_isready -U foodvoice` | `unless-stopped` |
| `api` | `GET /api/v1/health` → 200 | `on-failure` |
| `web` | `GET /` → 200 | `unless-stopped` |

`api` expone un `GET /api/v1/health` **sin autenticación**, que responde 200 si el proceso está en pie y la conexión a la base de datos responde. Es el único endpoint no autenticado además del inicio de sesión, y no revela ningún dato: su cuerpo es `{ "status": "ok" }`. `web` depende de `api` con `condition: service_healthy`, y `api` de `postgres` con la misma condición.

**Usuario sin privilegios**: los `Dockerfile` finalizan con `USER node` (uid 1000, provisto por la imagen `node:22-alpine`). No se crea un usuario propio: reutilizar el que la imagen ya trae es menos configuración con el mismo resultado. `postgres` corre con el usuario de su imagen oficial, sin modificar.

**Cómo `web` alcanza a `api`**: por el nombre del servicio en la red interna de Compose, `http://api:3001`, provisto en la variable `API_INTERNAL_URL`. `web` no conoce ninguna otra forma de llegar: no hay `localhost` ni direcciones IP en el código. En desarrollo fuera de contenedores, la misma variable apunta a `http://localhost:3001`.

**Cabeceras de seguridad y la marca `Secure`**: `api` monta `helmet` con su configuración por defecto. La cookie `fv_session` es siempre `httpOnly` y `SameSite=Lax`; la marca `Secure` se activa cuando `NODE_ENV=production`, porque en desarrollo local sobre `http://localhost` una cookie `Secure` no se envía y la sesión no funcionaría. El transporte cifrado del despliegue real (TLS) es responsabilidad del proxy que quede delante de `web` y queda fuera del alcance de v1, declarado aquí para que no se confunda con un olvido.

**Versión de Node**: `22` en los `Dockerfile` (`node:22-alpine`), en el campo `engines` de cada `package.json` (`"node": ">=22 <23"`) y en el `.nvmrc` de la raíz. Las tres fuentes deben coincidir; `pnpm` falla la instalación si la versión local no cumple `engines`, lo que convierte la discrepancia en un error inmediato en lugar de una diferencia silenciosa entre entornos.

---

## D-014 · Toda acción de impacto revoca las sesiones del usuario afectado

**Decisión**: las cuatro acciones de impacto de FR-035 —cambio de rol, desactivación, reactivación y restablecimiento de contraseña— revocan, en su misma transacción, todas las sesiones activas del usuario afectado. Nunca las del administrador que ejecuta la acción.

**Problema que resuelve**. El diseño inicial revocaba sesiones solo en la desactivación (FR-024, exigido por la spec) y en el restablecimiento de contraseña (añadido por criterio propio). Eso dejaba dos incoherencias:

1. **Ventana de privilegio tras un cambio de rol.** FR-011 y el caso límite correspondiente establecen que el nuevo rol rige desde el próximo inicio de sesión. Con el rol congelado en la sesión (D-007), un administrador degradado a cliente **conservaba privilegios de administrador durante hasta 30 minutos**. Es coherente con la letra de FR-011, pero difícilmente con RN-003 («el acceso lo determina el rol, no la persona») ni con la intención de RN-006: si el motivo de la degradación es retirarle el acceso, media hora de margen lo frustra.
2. **Una excepción sin regla.** La revocación en el restablecimiento de contraseña era una decisión aislada, no exigida por ningún requisito, aplicada a una sola de las cuatro acciones. Una excepción suelta es más difícil de recordar y de auditar que una regla uniforme.

**Compatibilidad con FR-011**. Revocar la sesión **no aplica el rol en caliente**, que es exactamente lo que el caso límite de la spec prohíbe. La sesión termina y el usuario debe autenticarse de nuevo; en ese nuevo inicio de sesión rige el nuevo rol. Se respeta la letra («el nuevo rol aplica en el próximo inicio de sesión») y se elimina la ventana de privilegio. El rol sigue congelado en `session`: esa parte del diseño no cambia, y sigue siendo lo que impide una mutación de privilegios sobre una sesión viva.

**Por qué la reactivación también revoca**: por uniformidad de la regla. En la práctica un usuario reactivado no tiene sesiones vivas —la desactivación las revocó—, así que la operación no encuentra nada que revocar. Incluirla evita una excepción que habría que justificar y recordar.

**Alternativas descartadas**:

| Alternativa | Por qué se descartó |
|---|---|
| Revocar solo en desactivación (letra estricta de la spec) | Deja abierta la ventana de privilegio del cambio de rol, y mantiene válida la contraseña anterior en sesiones vivas tras un restablecimiento — vaciando de sentido a FR-026 |
| Aplicar el nuevo rol en caliente sobre la sesión abierta | Contradice explícitamente el caso límite «cambio de rol con sesión activa» de la spec |
| Mantener la revocación en el restablecimiento como excepción única | Resuelve un problema y deja el otro; una excepción sin regla es peor de mantener que una regla uniforme (Principio I) |

**Estado respecto a la spec**: **incorporada. Aprobada el 2026-08-15** por la persona responsable del producto tras revisar esta decisión.

Cuando se redactó, esta decisión excedía lo que la spec exigía en tres de las cuatro acciones. No era alcance funcional nuevo —no añade pantallas, endpoints ni datos, y ningún escenario Gherkin cambió de resultado—, pero sí modificaba un comportamiento observable: tras un cambio de rol o un restablecimiento de contraseña, el usuario afectado ve terminada su sesión. Por eso quedó registrada aquí en espera de una enmienda, conforme al procedimiento del Principio III.

La enmienda ya existe. **FR-024 cubre ahora las cuatro acciones de impacto**, y la spec recoge además el cambio en FR-011, FR-026, RN-001, la entidad Sesión, dos casos límite y los criterios SC-025 y SC-026 (supuesto 20). Esta decisión deja por tanto de ser una desviación: es la implementación directa de un requisito.

---

## D-015 · Tipo de la columna `email`: `text` con normalización en la aplicación

**Decisión**: `email` es una columna `text` con restricción `UNIQUE`, y el valor se normaliza a minúsculas y sin espacios al borde **antes** de cualquier escritura o comparación. No se usa el tipo `citext`.

**Justificación**: la unicidad insensible a mayúsculas que exigen FR-017 y RN-005 puede lograrse de dos maneras, y ambas funcionan. Se elige normalizar en la aplicación por coherencia con una decisión que este diseño ya tomó:

- `citext` es una **extensión** de PostgreSQL (`CREATE EXTENSION citext`), no un tipo del núcleo. Exige un paso adicional en la migración inicial y privilegios que no todo entorno gestionado concede.
- D-011 ya descartó la extensión `unaccent` por el mismo motivo para la búsqueda. Aceptar `citext` aquí y rechazar `unaccent` allí sería una incoherencia difícil de justificar.
- El esquema Zod compartido **ya** aplica `.trim().toLowerCase()` a todo correo que entra al sistema (D-005). Con eso, lo que llega a la base de datos está normalizado por construcción, y un `UNIQUE` sobre `text` es exactamente tan estricto como uno sobre `citext`.
- Prisma modela `citext` con `@db.Citext`, pero la comparación insensible sigue ocurriendo en el motor y no en el tipo TypeScript, de modo que el código de la aplicación no gana claridad alguna.

**Consecuencia declarada**: la garantía de unicidad insensible a mayúsculas **depende de que la normalización se aplique sin excepción**. Un camino de escritura que se saltara el esquema Zod podría insertar `Maria@Ejemplo.cl` junto a `maria@ejemplo.cl`. Dos cosas lo contienen: los esquemas Zod son la única puerta de entrada de datos a la API (D-005), y el test de integración de FR-017 intenta explícitamente crear un usuario con el correo de otro **variando las mayúsculas**, que es el caso que se rompería si la normalización se omitiera.

**Alternativa descartada**: un índice único funcional sobre `lower(email)`. Da la garantía en el motor sin extensiones, pero Prisma no lo declara de forma nativa —exige SQL a mano en la migración— y volvería el esquema menos legible que la restricción única directa, para cubrir un camino de escritura que el diseño ya cierra.

---

## D-016 · Orden por defecto del listado de usuarios (FR-015)

**Decisión**: el listado se ordena por `created_at DESC, id DESC`. No es configurable en v1.

**Justificación**: la paginación de 20 por página que exige FR-015 solo es correcta si el orden es **total y estable**. Sin orden declarado, PostgreSQL no garantiza ninguno entre dos consultas, y un mismo usuario puede aparecer en la página 1 y otra vez en la página 2, o no aparecer en ninguna. No es un defecto hipotético: se manifiesta en cuanto el padrón supera una página.

El desempate por `id` no es adorno. `created_at DESC` a secas deja de ser un orden total en cuanto dos usuarios comparten marca de tiempo —lo que ocurre con altas hechas en el mismo instante, y sistemáticamente en los datos de prueba creados en un bucle—. Añadir `id` como segundo criterio hace el orden determinista sin depender de la resolución del reloj.

**Por qué cronológico inverso y no alfabético**: el uso previsto del listado es revisar las altas recientes y llegar a una persona concreta. Para lo segundo está la búsqueda (FR-015, SC-021), que hace innecesario recorrer páginas; para lo primero, el orden cronológico inverso pone delante lo que el administrador acaba de hacer. El orden alfabético resolvería un problema que la búsqueda ya resuelve mejor.

**Alcance**: no se ofrece ordenamiento por columna elegido por el usuario. Sería un parámetro más en la API, un estado más en la interfaz y un índice más por cada criterio, para un padrón de un solo local que cabe en pocas páginas (Principio I, Principio III).

**Índice de apoyo**: `(created_at DESC, id DESC)` sobre `user`. Los filtros por rol y estado se apoyan en el índice compuesto `(role, status)` ya previsto.

---

## D-017 · Comportamiento del proxy BFF ante un fallo del servicio NestJS

**Decisión**: el proxy de Next.js espera como mucho 10 segundos; si el servicio no responde, la conexión falla o la respuesta no es HTTP válida, devuelve `502 UPSTREAM_UNAVAILABLE` con `MSG_ERROR_INESPERADO`, **sin reintentar** y sin fabricar contenido.

**Justificación**: D-006 puso a Next.js en el camino de toda petición, lo que introduce un modo de fallo que no existiría con llamadas directas: el salto intermedio puede fallar por su cuenta. Sin una regla declarada, ese fallo se manifestaría como un error sin mensaje o, peor, como una respuesta vacía indistinguible de «no hay datos».

**Por qué no reintenta**: el proxy no sabe si NestJS llegó a aplicar la petición antes de dejar de responder. Reintentar un `POST /admin/users` podría crear dos usuarios; reintentar una desactivación es inocuo, pero distinguir unos verbos de otros sería una regla de negocio dentro de una pieza cuya definición es no tener ninguna. La decisión de reintentar queda en la persona, que sí sabe qué pidió.

**Por qué nunca fabrica contenido**: una lista vacía significa «no hay datos» en toda la API. Si el proxy devolviera `200` con `items: []` al no poder consultar, el administrador vería un padrón vacío como si fuera real —el peor resultado posible, porque no hay nada en pantalla que delate el fallo—.

**Por qué 10 segundos**: por encima del objetivo de 5 segundos de SC-001, para no cortar una petición legítima lenta, y muy por debajo del tiempo que una persona tolera ante una pantalla quieta. Sin plazo, una petición colgada dejaría el navegador esperando indefinidamente y sin mensaje.

**Alternativa descartada**: propagar el error crudo del salto de red. Habría expuesto nombres de servicio y puertos internos en una pantalla de usuario, contra el Principio II y contra el propósito de D-006 de no publicar la topología interna.

---

## D-018 · Límites de la superficie HTTP: tamaño, versionado y concurrencia

**Decisión**: tres límites declarados de una vez, porque los tres responden a la misma pregunta —qué NO hace esta API— y separarlos los volvería fáciles de olvidar.

**1. Tamaño del cuerpo: 10 KB en todos los endpoints.** Ninguno recibe archivos ni texto largo; el campo más extenso es un nombre de 120 caracteres. El límite queda dos órdenes de magnitud por encima de cualquier petición legítima y aun así impide que una petición desmedida consuma memoria antes de ser validada. Al excederse, `413 PAYLOAD_TOO_LARGE` **sin analizar el cuerpo**. Se descartó dejar el valor por defecto del framework: es un número que nadie eligió y que puede cambiar con una actualización.

**2. Versionado: `/api/v1` sin política de convivencia.** Un cambio incompatible —quitar un campo de una respuesta, añadir uno obligatorio a una petición, cambiar el tipo o el significado de un campo, retirar un endpoint o un valor de enum— exigiría publicar `/api/v2`. En v1 la situación no puede darse: el único cliente es `apps/web`, que vive en el mismo repositorio, se compila del mismo commit y se despliega en el mismo `docker compose` (ver `shared.md` § Compatibilidad). El prefijo se declara desde ahora porque añadirlo más tarde sería, él mismo, un cambio incompatible.

**3. Sin control de concurrencia optimista.** No hay `ETag`, ni número de versión, ni comprobación de que el dato leído siga vigente. Dos administradores editando al mismo usuario producen un «gana el último en guardar», sin aviso al primero. Se descartó el control de versión porque añadiría un campo al contrato, un código de error más y una pantalla de resolución de conflictos, para un caso que con un padrón de un solo local y unos pocos administradores es improbable (Principio I, Principio III). **La consecuencia asumida —una edición puede pisar a otra— se declara en la spec como caso límite**, para que no se descubra como un defecto.

Lo que sí queda cubierto por el motor y no por una comprobación previa es la **unicidad del correo** (FR-017): dos altas simultáneas del mismo correo se resuelven con la restricción única, y la violación se traduce al mismo `409 EMAIL_ALREADY_EXISTS` que devolvería el caso normal. Traducirla es obligatorio: sin esa traducción, una condición de carrera llegaría al administrador como un `500`.

---

## Resumen de versiones

| Componente | Versión objetivo |
|---|---|
| Node.js | 22 LTS |
| TypeScript | 5.x, `strict: true` en todos los paquetes |
| Next.js | 15 (App Router) |
| React | 19 |
| TailwindCSS | 4 |
| shadcn/ui | última (se copian los componentes al repositorio, no es dependencia) |
| NestJS | 11 |
| Prisma | 6 |
| PostgreSQL | 16 |
| Zod | 3 |
| pnpm | 9 |
