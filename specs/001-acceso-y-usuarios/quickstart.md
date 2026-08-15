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

Cada escenario corresponde a los Gherkin de la spec. Las secciones **A, B y C se verifican desde la aplicación, sin leer código ni logs**, y las ejecuta una persona no técnica —o alguien que actúe como tal, sin consultar el código—. La sección **D es la excepción**: es técnica por definición, la ejecuta quien revisa la implementación y no forma parte de lo que se pide a una persona no técnica (SC-010).

**Cuándo se ejecuta**: al cerrar cada fase, la sección que le corresponde —A al cerrar la Fase B, B al cerrar la C, C al cerrar la D—; y **A, B y C completas antes de dar la épica por terminada**, porque una fase posterior puede haber roto algo de una anterior.

### Preparación

1. Iniciar sesión con `ADMIN_SEED_EMAIL` y su contraseña.
2. Crear tres usuarios de prueba desde **Usuarios → Nuevo usuario**: uno con rol cliente, uno con rol negocio y uno con rol repartidor. **Anotar en un papel el correo y la contraseña de cada uno**: harán falta más adelante y el sistema no vuelve a mostrar las contraseñas.

**Sobre los pasos que piden dos sesiones a la vez** (A12, A13, B7, B8, B10). No hace falta un segundo computador ni conocimientos técnicos: basta abrir una **ventana de incógnito** —en Chrome y Edge, `Ctrl`+`Mayús`+`N`; en Firefox, `Ctrl`+`Mayús`+`P`— y usarla como si fuera el navegador de otra persona. La ventana normal queda con la sesión de administrador y la de incógnito con la del usuario de prueba, sin que una interfiera con la otra. Al cerrar la ventana de incógnito se pierde esa sesión, así que conviene dejarla abierta durante toda la sección.

Cuando un paso dice «en el otro navegador», se refiere siempre a esa ventana de incógnito.

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
| A16 | Comparar la pantalla tras **cerrar sesión** con la de A9, tras **expirar** | Ambas llevan al inicio de sesión, pero solo la expiración muestra un aviso explicativo; el cierre voluntario no muestra ningún error | FR-005, FR-006 |
| A17 | Como repartidor, escribir `/admin` (repetir A6) y observar dónde queda | Página propia de acceso denegado, con un enlace a su página de inicio. **No** se le cierra la sesión ni se le muestra el panel con un aviso encima | FR-003 |
| A18 | Revisar la página de inicio de cada rol no administrador | Contiene exactamente cuatro cosas: nombre, etiqueta del rol, «Cerrar sesión» y **ninguna otra acción** | FR-031 |
| A19 | Recorrer el inicio de sesión y la página de rol **solo con el teclado** | Se llega a todos los controles, el foco es visible en todo momento y cada campo tiene su etiqueta | FR-039, SC-038 |

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
| B27 | Tras cada acción de B1 a B11, mirar la pantalla | Cada una muestra una confirmación de éxito en español que nombra al usuario afectado; ninguna termina en silencio | FR-037, SC-037 |
| B28 | Hacer **doble clic** rápido sobre «Crear usuario» y sobre «Desactivar» | Un solo efecto: un usuario, una entrada de bitácora. El control queda inutilizable mientras la acción está en curso | FR-038, SC-039 |
| B29 | Abrir los cuatro diálogos de confirmación y leerlos | Los tres primeros indican que la acción se puede deshacer; el de restablecer contraseña advierte de que **no** es reversible | FR-035, Principio IX |
| B30 | Recorrer el listado y los formularios buscando los términos técnicos de la spec | En pantalla solo aparecen «Desactivar», «Reactivar», «Activo», «Desactivado» y las etiquetas de rol en singular. Nunca «baja lógica», «CLIENTE» en mayúsculas ni «eliminar» | § Vocabulario visible |
| B31 | Reducir la ventana del navegador a 360 px de ancho y recorrer el listado | Ningún contenido queda inalcanzable: la tabla se desplaza o se reorganiza, pero no se recorta | FR-040 |

### C · Panel y reportes (HU-10)

| # | Qué hacer | Qué debe ocurrir | Requisito |
|---|---|---|---|
| C1 | Entrar al panel como administrador | Métricas visibles en menos de 5 segundos | FR-019, SC-007 |
| C2 | Contrastar "usuarios activos por rol" con el listado filtrado | Las cifras coinciden | FR-019 |
| C3 | Intentar entrar al panel con otro rol | Impedido con mensaje en español | FR-018, SC-008 |
| C4 | Recorrer todas las vistas del panel | Ninguna ofrece acciones que modifiquen pedidos ni usuarios | FR-021, RN-004, SC-015 |
| C5 | Filtrar el reporte de pedidos por estado y por rango de fechas | Mensaje en español de "sin datos", no un error ni una pantalla vacía | FR-022, SC-020 |
| C5b | Filtrar el reporte con la **misma fecha** en inicio y fin | Se acepta y consulta ese día completo: mensaje de "sin datos", no un error de rango vacío | FR-020 |
| C5c | Escribir una fecha mal formada o un rango invertido | Mensaje en español indicando el problema; no un error técnico | FR-020, FR-022 |
| C5d | Observar cómo se escriben y se muestran las fechas del filtro | En `DD/MM/AAAA`; el formato interno no aparece en ninguna parte de la pantalla | § Fechas y horas visibles |
| C2b | Revisar el panel con un rol sin ningún usuario activo | Ese rol aparece con un **cero explícito**, no desaparece de la lista | FR-019, SC-034 |
| C4b | Comprobar que desde el panel se llega a la gestión de usuarios | El enlace existe y funciona; navegar no es modificar, así que no incumple la regla de solo lectura | FR-021, FR-031 |
| C6 | Revisar los estados ofrecidos en el filtro | Son exactamente los cinco de la máquina de estados, sin estados propios | FR-023 |
| C7 | Buscar una opción de exportar a PDF, Excel o CSV | No existe | FR-029 |

**Sobre C5**: en E1 el reporte de pedidos está vacío por diseño. La entidad Pedido pertenece a E4/E2 (D-012, y nota de entrega por fases de la spec). Lo que se valida aquí es que la superficie existe, respeta la máquina de estados compartida y se comporta correctamente sin datos.

### E · Mensajes, accesibilidad y presentación

Transversal a las tres historias, y también para una persona no técnica.

| # | Qué hacer | Qué debe ocurrir | Requisito |
|---|---|---|---|
| E1 | Recorrer los doce mensajes fijos provocándolos uno a uno —credenciales inválidas, cuenta bloqueada, sin permiso, sesión expirada, sin resultados de usuarios y de pedidos, correo duplicado, autoprotección, error inesperado, contraseña olvidada, rango de fechas inválido y sin datos— y leerlos en voz alta | Los doce cumplen las cuatro condiciones: en español correcto, sin ningún término técnico, dicen qué pasó **y qué puedes hacer**, y puedes repetirlos con tus palabras sin preguntar qué significan | SC-036, FR-003, FR-014, FR-022 |
| E2 | Recorrer la aplicación entera **sin tocar el ratón**, incluidos los diálogos de confirmación y el cierre de sesión | Se llega a todos los controles, el foco es visible en todo momento y al cerrar un diálogo el foco vuelve a un lugar razonable | SC-038, FR-039 |
| E3 | Repetir A1, B1 y C1 con la ventana reducida a 360 px y en un segundo navegador de la lista soportada | El comportamiento es el mismo; ningún contenido queda inalcanzable | FR-040 |

### D · Verificación técnica (excepciones a SC-010)

Catorce comprobaciones que no se hacen mirando la aplicación. **Diez de ellas son las dos excepciones acotadas a SC-010** que declara el supuesto 13 de la spec —el resguardo de credenciales (D1, D2, D9, D10) y la bitácora sin vista (D3–D6, D11, D12)—, y por eso no las ejecuta el perfil no técnico. **Las cuatro restantes no son excepciones al Principio IV**: D7, D8, D13 y D14 comprueban que el diseño interno no contradice un requisito cuyo efecto sí se observa en la sección A —que ningún sondeo mantenga viva una sesión, que la recuperación quede fuera de la aplicación, que un bloqueo vencido no estorbe y que las filas de `session` no se purguen—. La distinción importa: llamar «excepción» a las cuatro últimas ampliaría la excepción de SC-010 sin que ningún supuesto lo autorice.

| # | Qué comprobar | Requisito |
|---|---|---|
| D1 | La tabla `user` no contiene ninguna contraseña legible; `password_hash` almacena hashes bcrypt | FR-007, FR-016 |
| D2 | No hay credenciales ni secretos en el repositorio; `.env` está ignorado por git | FR-007, FR-028 |
| D3 | Cada acción administrativa de B1–B11 dejó una fila en `admin_audit_log` con administrador, usuario afectado, acción y fecha | FR-034 |
| D4 | La cancelación de B16 **no** dejó ninguna fila en `admin_audit_log` | FR-034, FR-035 |
| D5 | `admin_audit_log` no contiene contraseñas en ninguna de sus columnas | FR-034 |
| D6 | Un `UPDATE` y un `DELETE` ejecutados **directamente** contra `admin_audit_log` fallan con la excepción del disparador `admin_audit_log_inmutable`: la inmutabilidad la impone el motor, no solo la ausencia de código que la vulnere | FR-034 |
| D7 | `apps/web` no contiene ningún `setInterval`, sondeo ni refresco en segundo plano contra la API | FR-005, SC-024 |
| D8 | El modo de recuperación de la semilla dejó una entrada con actor y afectado iguales, y no es alcanzable desde ningún endpoint | FR-036 |
| D9 | La respuesta del alta de un usuario no contiene la contraseña ni su hash, y la salida de diagnóstico del contenedor tampoco la contiene tras un inicio de sesión | FR-007, SC-027 |
| D10 | Dos usuarios creados con la **misma** contraseña tienen hashes distintos en `password_hash` — la sal se aplica por usuario | FR-007, SC-027 |
| D11 | `admin_audit_log` no contiene el nombre, el correo ni el teléfono del usuario afectado: solo referencias a su identificador | FR-034, Principio X |
| D12 | No existe ninguna entrada de bitácora para los inicios de sesión, los fallos ni los bloqueos: el registro cubre solo las seis acciones administrativas | FR-034, supuesto 27 |
| D13 | Tras cinco fallos y su vencimiento, la fila de `login_attempt_control` conserva un `locked_until` en el pasado sin que nada lo limpie, y eso no impide ningún inicio de sesión | FR-033, data CHK024 |
| D14 | La tabla `session` conserva las filas revocadas y expiradas: v1 no purga, y es una decisión de alcance declarada, no un olvido | data CHK005 |

**Quién ejecuta la sección D y cuándo**: la persona que revisa la implementación, en la revisión de código previa a dar la épica por terminada, con acceso al repositorio y a la base de datos de desarrollo (`docker compose exec postgres psql -U foodvoice -d foodvoice`). No forma parte de la validación funcional y no la ejecuta el perfil no técnico: es precisamente la excepción acotada que declara SC-010.

**Qué hacer si un paso falla**: cualquier paso de A, B, C, D o E que no se comporte como se describe invalida la épica; no hay pasos opcionales ni "aceptables con reservas". Se anota el paso, lo observado y lo esperado, se corrige y se **repite la sección completa** a la que pertenece —no solo el paso corregido—, porque un arreglo puede alterar el comportamiento de los pasos vecinos.

---

## Cobertura de los criterios de éxito

Los **39 criterios de la spec**, cada uno con el paso que lo comprueba. La tabla existe para responder una sola pregunta: si algún criterio se quedó sin forma de verificarse.

| Criterio | Paso | Criterio | Paso |
|---|---|---|---|
| SC-001 | A1 | SC-021 | B13, B24 |
| SC-002 | A2 | SC-022 | B23 |
| SC-003 | A6, A17 | SC-023 | B22 |
| SC-004 | B1 | SC-024 | A9 |
| SC-005 | B2 | SC-025 | B7, B10 |
| SC-006 | B8 | SC-026 | B7b |
| SC-007 | C1 | SC-027 | D1, D2, D9, D10 |
| SC-008 | C3 | SC-028 | A2, A4, A11 |
| SC-009 | C5, C5b | SC-029 | A13, B8 |
| SC-010 | *toda la guía* | SC-030 | A8, A16 |
| SC-011 | B4, B5 | SC-031 | A7 |
| SC-012 | B10 | SC-032 | B6 |
| SC-013 | A9 | SC-033 | B9 |
| SC-014 | B18 | SC-034 | B12, B14, C2b |
| SC-015 | C4 | SC-035 | A10 |
| SC-016 | B3, B10b | SC-036 | E1 |
| SC-017 | A3, A5 | SC-037 | B27 |
| SC-018 | A4 | SC-038 | A19, E2 |
| SC-019 | B16, B17 | SC-039 | B28 |
| SC-020 | B15, B26, C5 | | |

**Ningún criterio queda sin paso.** SC-010 es el único sin uno concreto, y es correcto: no es un criterio sobre una función sino sobre la guía entera —que todo esto pueda hacerlo una persona no técnica—, y se cumple o se incumple al ejecutarla.

**Cuatro criterios se verifican únicamente aquí, sin ninguna cobertura automática**: SC-001 y SC-007 (los umbrales de 5 segundos, supuesto 22), SC-036 (los mensajes) y SC-038 (el teclado y el foco). Si esta guía no se ejecuta, esos cuatro no los comprueba nadie.

---

## Criterio de aceptación de la épica

E1 se considera terminada cuando:

1. Las cinco órdenes de comprobación automática terminan sin error, ejecutadas **en un entorno limpio o con la caché deshabilitada**.
2. Todos los pasos de A, B, C y E se comportan como se describe.
3. Los catorce puntos de D se verifican en la revisión de la implementación.
4. Los treinta y nueve criterios de éxito tienen su paso ejecutado, según la tabla de cobertura.
5. Los únicos criterios pendientes son los que dependen de pedidos reales (parte de FR-019, más FR-020 y FR-023), declarados como entrega por fases en la spec y verificables al completarse E4/E2.
