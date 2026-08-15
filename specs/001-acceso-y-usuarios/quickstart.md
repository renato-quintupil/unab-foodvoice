# Guía de puesta en marcha y validación: E1 · Acceso y usuarios

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contratos**: [contracts/](./contracts/)

Esta guía sirve para dos cosas: levantar el entorno y **verificar que la épica está terminada**. La sección de validación funcional está escrita para que la ejecute una persona no técnica usando solo la aplicación (Principio IV).

---

## Requisitos previos

| Herramienta | Versión |
|---|---|
| Node.js | 22 LTS |
| pnpm | 9 (`corepack enable`) |
| Docker Desktop | con Compose v2 |

---

## Puesta en marcha

### 1. Configuración

```bash
cp .env.example .env
```

Editar `.env`. Esta es la lista **completa** de variables; no hay ninguna otra:

| Variable | ¿Obligatoria? | Valor por defecto | Para qué sirve |
|---|---|---|---|
| `POSTGRES_PASSWORD` | **Sí** | — | Contraseña del usuario `foodvoice` en PostgreSQL |
| `DATABASE_URL` | **Sí** | — | Cadena de conexión que usa Prisma. `postgresql://foodvoice:<POSTGRES_PASSWORD>@postgres:5432/foodvoice` |
| `API_INTERNAL_URL` | **Sí** | — | Cómo alcanza `web` a `api`. `http://api:3001` en contenedores; `http://localhost:3001` en desarrollo local |
| `ADMIN_SEED_EMAIL` | **Sí** | — | Correo del administrador semilla (FR-028) |
| `ADMIN_SEED_PASSWORD` | **Sí** | — | Su contraseña, de 8 a 72 caracteres. **Nunca** tiene valor por defecto (D-010) |
| `NODE_ENV` | No | `development` | Con `production`, la cookie `fv_session` se marca `Secure` |
| `PORT_API` | No | `3001` | Puerto interno de `api` |
| `PORT_WEB` | No | `3000` | Puerto de `web`, el único publicado hacia el anfitrión |
| `ADMIN_SEED_RECOVER` | No | `false` | Modo de recuperación de acceso administrativo (FR-036). Ver más abajo |

**Si falta una variable obligatoria, el arranque falla de forma explícita** con un mensaje que la nombra, y el proceso termina con código distinto de cero. No existe arranque degradado ni valor de reserva: un servicio en pie con una configuración incompleta es más difícil de diagnosticar que uno que no arranca.

No hay ninguna variable de secreto de cookie: el identificador de sesión es un UUID v4 opaco que no se firma ni se cifra, porque no transporta información — su validez la determina la fila correspondiente en la tabla `session` (D-001). Un secreto de firma no aportaría nada y sería una pieza de configuración sin uso.

`.env` está en `.gitignore` y **nunca** se versiona (Principio V, FR-028). Ningún valor de configuración —ni la contraseña de la base de datos, ni la del administrador semilla, ni la cadena de conexión completa— aparece jamás en los registros de la aplicación ni en un mensaje de error mostrado al usuario: los errores visibles son siempre los mensajes fijos en español de `packages/shared` (FR-007, Principio II).

### 2. Levantar el entorno

```bash
pnpm install
docker compose up -d postgres      # espera a que el healthcheck pase
pnpm --filter api db:migrate       # aplica las migraciones de Prisma
pnpm --filter api db:seed          # crea el administrador semilla (idempotente)
pnpm dev                           # api en :3001, web en :3000
```

Alternativa íntegramente en contenedores:

```bash
docker compose up --build          # postgres + api + web
```

Solo `web` publica un puerto hacia el exterior; `api` y `postgres` quedan en la red interna (D-006, D-013).

**Las migraciones no se ejecutan a mano en este modo**: el `entrypoint` de la imagen de `api` ejecuta `prisma migrate deploy` antes de arrancar el servidor, y solo lanza NestJS si termina bien (D-013). De ahí se siguen tres cosas:

- El **orden migración → semilla** está garantizado por construcción, no por recordar la secuencia.
- **Dos instancias arrancando a la vez** no compiten: `prisma migrate deploy` toma un *advisory lock* en PostgreSQL; una aplica y la otra encuentra el esquema al día.
- Una **migración fallida deja el contenedor sin arrancar** y bloquea los arranques siguientes hasta resolverla con `prisma migrate resolve`. Es intencional: atender peticiones contra un esquema que no corresponde al código es peor que no atender ninguna.

Los datos de PostgreSQL viven en el volumen nombrado `foodvoice_pgdata` y sobreviven a `docker compose down`. Se pierden solo con `docker compose down -v`. **No hay estrategia de respaldo en v1** (D-013): declarado fuera de alcance, no olvidado.

### 2b. Recuperar el acceso administrativo (FR-036)

Si ningún administrador conserva acceso —el caso típico es que el último olvide su contraseña y no exista otro que se la restablezca—, la aplicación no puede resolverlo: no hay autoservicio de contraseña (FR-026) y la cuenta sigue activa y válida a ojos del sistema. La salida es operativa:

```bash
# Ajustar antes ADMIN_SEED_PASSWORD en .env
pnpm --filter api db:seed --recuperar
```

Fuerza la cuenta de `ADMIN_SEED_EMAIL` a administrador activo con esa contraseña y revoca sus sesiones vivas. Solo puede ejecutarlo quien tiene acceso al despliegue y a su configuración —no existe ningún endpoint ni pantalla que lo alcance—, y deja una entrada en `admin_audit_log` con el mismo usuario como actor y como afectado, combinación imposible desde la aplicación (D-010).

**Rotación**: tras el primer arranque, lo recomendable es que el administrador cambie su contraseña desde la aplicación. `ADMIN_SEED_PASSWORD` solo se consulta al crear la cuenta o al recuperarla, nunca para validar un inicio de sesión, así que a partir de ese momento deja de reflejar la contraseña vigente.

### 3. Comprobación de humo

Abrir <http://localhost:3000>. Debe redirigir a `/login` y mostrar el formulario en español.

---

## Comprobaciones automáticas

```bash
pnpm test              # unitarios de los tres paquetes
pnpm test:integration  # integración de la API contra PostgreSQL efímera
pnpm lint
pnpm typecheck
pnpm build
```

Los tests de integración levantan su propia base de datos con `docker-compose.test.yml`, en un puerto distinto, y no tocan los datos de desarrollo (D-009).

**Se considera aprobado** cuando las cinco órdenes terminan sin error y se cumplen los umbrales de cobertura:

| Ámbito | Umbral | Motivo |
|---|---|---|
| `services/api/src/auth/`, `users/`, `audit/` | **90 %** de líneas y ramas | Concentran las reglas de seguridad de la épica |
| `packages/shared` | **100 %** de líneas | Es lógica pura y pequeña; no hay excusa para menos |
| `services/api` (resto) | 80 % de líneas | Módulos de infraestructura |
| `apps/web` | 70 % de líneas | La validación de interfaz la cubre la sección funcional de esta guía |

Los umbrales se declaran en la configuración de cada paquete y su incumplimiento hace fallar la orden `pnpm test`. La cobertura es un piso, no un objetivo: cumplirla no sustituye a la validación funcional.

---

## Validación funcional

Cada escenario corresponde a los Gherkin de la spec. Todos se verifican **desde la aplicación**, sin leer código ni logs.

### Preparación

Iniciar sesión con `ADMIN_SEED_EMAIL` y su contraseña, y crear tres usuarios de prueba desde **Usuarios → Nuevo usuario**: uno con rol cliente, uno con rol negocio y uno con rol repartidor.

### A · Autenticación y sesión (HU-08)

| # | Qué hacer | Qué debe ocurrir | Requisito |
|---|---|---|---|
| A1 | Iniciar sesión con el cliente de prueba | Llega a su página de inicio con su nombre, su rol y "Cerrar sesión", en menos de 5 segundos | FR-001, FR-031, SC-001 |
| A2 | Iniciar sesión con una contraseña incorrecta | Mensaje en español que **no** indica si falló el correo o la contraseña | FR-008, SC-002 |
| A3 | Fallar 5 veces seguidas y luego usar la contraseña correcta | Se rechaza con el mensaje de bloqueo temporal | FR-033, SC-017 |
| A4 | Repetir A3 con un correo **inexistente** y comparar ambas pantallas | El mensaje es idéntico palabra por palabra | FR-008, SC-018 |
| A5 | Esperar 15 minutos tras A3 y reintentar | Entra con normalidad, sin intervención del administrador | FR-033, SC-017 |
| A6 | Como repartidor, escribir `/admin` en la barra de direcciones | Acceso impedido con mensaje en español | FR-003, SC-003 |
| A7 | Navegar entre pantallas durante varios minutos | No se vuelve a pedir autenticación | FR-004, SC-031 |
| A8 | Pulsar "Cerrar sesión" y luego el botón "atrás" del navegador | La sesión terminó; pide autenticarse de nuevo | FR-006, SC-030 |
| A9 | Dejar la sesión inactiva 30 minutos, **con la pestaña abierta y sin tocarla**, e intentar una acción | Pide volver a iniciar sesión. Que la aplicación haya estado abierta todo ese rato no mantiene viva la sesión | FR-005, SC-013, SC-024 |
| A10 | Con la sesión expirada, enviar un formulario a medio completar | La acción se rechaza **por completo**; ningún cambio queda aplicado, comprobable releyendo el dato | FR-030, SC-035 |
| A11 | Desactivar al cliente de prueba y hacerle iniciar sesión con su contraseña **correcta**. Comparar la pantalla con la de A2 | Mensaje idéntico al de una contraseña incorrecta: nada indica que la cuenta exista ni que esté desactivada | FR-008, FR-012, SC-028 |
| A12 | Iniciar sesión con el mismo usuario en dos navegadores distintos y usar ambos | Las dos sesiones funcionan a la vez. Cerrar sesión en uno **no** cierra el otro | § Entidad Sesión |
| A13 | Desactivar al usuario de A12 desde el panel de administración, con sus dos sesiones abiertas | **Ambas** quedan rechazadas en su siguiente acción, no solo la última | FR-024, SC-029 |
| A14 | Mirar la pantalla de inicio de sesión sin escribir nada | Indica en español que el administrador restablece las contraseñas. **No** hay enlace de "olvidé mi contraseña" que prometa un correo o un formulario | FR-026 |
| A15 | Iniciar sesión escribiendo el correo en MAYÚSCULAS y con un espacio al final | Entra con normalidad: el correo no distingue mayúsculas ni espacios de los extremos | FR-001 |

**Sobre las esperas de A5 y A9**. Son 15 y 30 minutos reales, y esa espera es exactamente lo que el requisito afirma: conviene hacerla al menos una vez, dejando los dos pasos corriendo en paralelo mientras se avanza con la sección B. La espera de A9 debe hacerse **sin tocar la pestaña**: es la única forma de comprobar SC-024, es decir que la aplicación no se mantiene viva sola.

Si hay que repetir la validación y no se dispone de ese tiempo, quien tenga acceso técnico al despliegue puede adelantar el reloj sobre la fila correspondiente, sin tocar el código:

```bash
# A9 · envejecer la sesión abierta 31 minutos
docker compose exec postgres psql -U foodvoice -d foodvoice \
  -c "UPDATE session SET last_activity_at = now() - interval '31 minutes' WHERE revoked_at IS NULL;"

# A5 · vencer el bloqueo temporal
docker compose exec postgres psql -U foodvoice -d foodvoice \
  -c "UPDATE login_attempt_control SET locked_until = now() - interval '1 minute';"
```

Es un atajo de conveniencia, no una validación equivalente: comprueba que el sistema reacciona al umbral, no que el umbral sea de 15 o 30 minutos. La cobertura automática de estas dos reglas la dan los tests de integración, que usan el mismo mecanismo con un reloj sustituido (D-009).

### B · Gestión de usuarios y roles (HU-09)

Con dos navegadores: uno como administrador, otro como el usuario afectado.

| # | Qué hacer | Qué debe ocurrir | Requisito |
|---|---|---|---|
| B1 | Crear un usuario con rol repartidor | Queda activo y puede iniciar sesión con ese rol, en menos de un minuto | FR-009, SC-004 |
| B2 | Crear un usuario omitiendo el teléfono o el rol | Mensaje en español; el usuario no se crea | FR-014, SC-005 |
| B3 | Crear un usuario con una contraseña de 7 caracteres | Mensaje en español indicando el mínimo; no se crea | FR-032, SC-016 |
| B4 | Crear un usuario con el correo de otro ya existente | Se rechaza con mensaje claro | FR-017, SC-011 |
| B5 | Desactivar un usuario y luego intentar crear otro con su mismo correo | También se rechaza: el correo queda reservado | RN-005, SC-011 |
| B6 | Editar los datos de contacto de un usuario | Se reflejan de inmediato; conserva rol y estado | FR-010, SC-032 |
| B6b | Cambiarle el correo a un usuario **con sesión abierta** | Su sesión continúa sin interrupción. Al cerrarla y volver a entrar, debe usar el correo nuevo; el anterior ya no sirve | FR-010 |
| B7 | Cambiar el rol de un usuario **con sesión abierta** | Su sesión termina: la siguiente acción le pide autenticarse. Al volver a entrar, rige el nuevo rol — nunca se aplica en caliente sobre la sesión abierta | FR-011, FR-024, RN-001, SC-025 |
| B7b | Tras B7, comprobar que durante la sesión anterior no conservó privilegios | No hay ventana en que mantenga el rol previo | RN-003, SC-026 |
| B8 | Desactivar a un usuario **con sesión abierta** en el otro navegador | Su siguiente acción es rechazada y no puede volver a autenticarse. Tu propia sesión de administrador sigue viva | FR-012, FR-024, SC-006, SC-029 |
| B8b | Volver a desactivar a ese mismo usuario, ya desactivado | Se acepta sin error y sin cambio alguno; no se registra ninguna acción nueva en la bitácora | FR-034, `contracts/api.md` §PUT status |
| B9 | Reactivarlo | Vuelve a entrar con sus credenciales previas, sin que haya que restablecérselas | FR-013, SC-033 |
| B10 | Restablecer su contraseña y probar la anterior | La anterior es rechazada; la nueva funciona. Si tenía sesión abierta, esta termina | FR-026, FR-024, SC-012, SC-025 |
| B10b | Asignar una contraseña de más de 72 caracteres | Mensaje en español indicando el máximo; no se aplica ni se recorta | FR-032, SC-016 |
| B11 | Bloquear una cuenta con 5 fallos y restablecerle la contraseña | El bloqueo se levanta de inmediato | FR-026, FR-033 |
| B12 | Filtrar por rol "negocio" y estado "activo" | Solo esos usuarios, de a 20 por página, con el total indicado | FR-015, SC-034 |
| B13 | Buscar "perez", luego "MARÍA", luego "maria.perez" | Las tres búsquedas encuentran a María Pérez | FR-015, SC-021 |
| B14 | Combinar la búsqueda con ambos filtros | Solo los usuarios que cumplen los tres criterios | FR-015, SC-034 |
| B15 | Aplicar filtros sin resultados | Mensaje explicativo en español, no una pantalla vacía | FR-015, SC-020 |
| B16 | Iniciar una desactivación y **cancelar** la confirmación | El usuario sigue activo; no se aplicó ningún cambio | FR-035, SC-019 |
| B17 | Verificar que cambio de rol, desactivación, reactivación y restablecimiento **piden confirmación** | Los cuatro la piden, indicando a quién afectan | FR-035, SC-019 |
| B18 | Como administrador, intentar desactivarte a ti mismo o cambiarte el rol | Ambos impedidos con mensaje en español | FR-027, RN-006, SC-014 |
| B19 | Como administrador, editar tus propios datos de contacto | Permitido | FR-027 |
| B20 | Buscar cualquier formulario de registro público | No existe: no hay autorregistro | FR-025, RN-007 |
| B21 | Crear un usuario con rol **administrador** y entrar con él | Se crea y accede a la gestión de usuarios y al panel, igual que cualquier otro administrador | FR-009, RN-003 |
| B22 | Con más de 20 usuarios, recorrer las páginas 1 → 2 → 1 → 2 | Las mismas personas en las mismas páginas, de la más reciente a la más antigua; nadie aparece dos veces ni desaparece | FR-015, SC-023 |
| B23 | Desde B21, desactivar al otro administrador y luego intentar desactivarte tú | Lo primero se aplica; lo segundo se impide. Siempre queda al menos un administrador activo | FR-027, RN-006, SC-022 |
| B24 | Buscar `Nunez` y luego `Nuñez` sobre un usuario apellidado «Nuñez» | Ambas búsquedas lo encuentran | FR-015, SC-021 |
| B25 | Buscar un texto que contenga `%` | Devuelve solo quienes tengan ese carácter, no el padrón completo | FR-015 |
| B26 | Aplicar un filtro estrecho y pedir una página que ya no existe | Muestra el mensaje de "sin resultados" y permite volver a la primera página; no un error | FR-015, SC-020 |

### C · Panel y reportes (HU-10)

| # | Qué hacer | Qué debe ocurrir | Requisito |
|---|---|---|---|
| C1 | Entrar al panel como administrador | Métricas visibles en menos de 5 segundos | FR-019, SC-007 |
| C2 | Contrastar "usuarios activos por rol" con el listado filtrado | Las cifras coinciden | FR-019 |
| C3 | Intentar entrar al panel con otro rol | Impedido con mensaje en español | FR-018, SC-008 |
| C4 | Recorrer todas las vistas del panel | Ninguna ofrece acciones que modifiquen pedidos ni usuarios | FR-021, RN-004, SC-015 |
| C5 | Filtrar el reporte de pedidos por estado y por rango de fechas | Mensaje en español de "sin datos", no un error ni una pantalla vacía | FR-022, SC-020 |
| C5b | Filtrar el reporte con la **misma fecha** en inicio y fin | Se acepta y consulta ese día completo: mensaje de "sin datos", no un error de rango vacío | FR-020 |
| C5c | Escribir una fecha mal formada (`15-08-2026`) o un rango invertido | Mensaje en español indicando el problema; no un error técnico | FR-020, FR-022 |
| C6 | Revisar los estados ofrecidos en el filtro | Son exactamente los cinco de la máquina de estados, sin estados propios | FR-023 |
| C7 | Buscar una opción de exportar a PDF, Excel o CSV | No existe | FR-029 |

**Sobre C5**: en E1 el reporte de pedidos está vacío por diseño. La entidad Pedido pertenece a E4/E2 (D-012, y nota de entrega por fases de la spec). Lo que se valida aquí es que la superficie existe, respeta la máquina de estados compartida y se comporta correctamente sin datos.

### D · Verificación técnica (excepciones a SC-010)

Estos dos aspectos no son observables desde la interfaz. Se comprueban en la revisión de la implementación, tal como declaran los supuestos 12 y 13 de la spec.

| # | Qué comprobar | Requisito |
|---|---|---|
| D1 | La tabla `user` no contiene ninguna contraseña legible; `password_hash` almacena hashes bcrypt | FR-007, FR-016 |
| D2 | No hay credenciales ni secretos en el repositorio; `.env` está ignorado por git | FR-007, FR-028 |
| D3 | Cada acción administrativa de B1–B11 dejó una fila en `admin_audit_log` con administrador, usuario afectado, acción y fecha | FR-034 |
| D4 | La cancelación de B16 **no** dejó ninguna fila en `admin_audit_log` | FR-034, FR-035 |
| D5 | `admin_audit_log` no contiene contraseñas en ninguna de sus columnas | FR-034 |
| D6 | El código no expone ninguna operación de actualización ni de borrado sobre `admin_audit_log` | FR-034 |
| D7 | `apps/web` no contiene ningún `setInterval`, sondeo ni refresco en segundo plano contra la API | FR-005, SC-024 |
| D8 | El modo de recuperación de la semilla dejó una entrada con actor y afectado iguales, y no es alcanzable desde ningún endpoint | FR-036 |
| D9 | La respuesta del alta de un usuario no contiene la contraseña ni su hash, y la salida de diagnóstico del contenedor tampoco la contiene tras un inicio de sesión | FR-007, SC-027 |
| D10 | Dos usuarios creados con la **misma** contraseña tienen hashes distintos en `password_hash` — la sal se aplica por usuario | FR-007, SC-027 |
| D11 | `admin_audit_log` no contiene el nombre, el correo ni el teléfono del usuario afectado: solo referencias a su identificador | FR-034, Principio X |
| D12 | No existe ninguna entrada de bitácora para los inicios de sesión, los fallos ni los bloqueos: el registro cubre solo las seis acciones administrativas | FR-034, supuesto 27 |

**Quién ejecuta la sección D y cuándo**: la persona que revisa la implementación, en la revisión de código previa a dar la épica por terminada, con acceso al repositorio y a la base de datos de desarrollo (`docker compose exec postgres psql -U foodvoice -d foodvoice`). No forma parte de la validación funcional y no la ejecuta el perfil no técnico: es precisamente la excepción acotada que declara SC-010.

**Qué hacer si un paso falla**: cualquier paso de A, B, C o D que no se comporte como se describe invalida la épica; no hay pasos opcionales ni "aceptables con reservas". Se anota el paso, lo observado y lo esperado, se corrige y se **repite la sección completa** a la que pertenece —no solo el paso corregido—, porque un arreglo puede alterar el comportamiento de los pasos vecinos.

---

## Criterio de aceptación de la épica

E1 se considera terminada cuando:

1. Las cinco órdenes de comprobación automática terminan sin error.
2. Todos los pasos de A, B y C se comportan como se describe.
3. Los seis puntos de D se verifican en la revisión de la implementación.
4. Los únicos criterios de éxito pendientes son los que dependen de pedidos reales (parte de FR-019, más FR-020 y FR-023), declarados como entrega por fases en la spec y verificables al completarse E4/E2.
