# Checklist de Calidad de Diseño — Operación y despliegue: E1 · Acceso y usuarios

**Propósito**: validar que los requisitos de contenedores, configuración, migraciones, semilla y estrategia de pruebas estén completos, sean inequívocos y verificables. Es una puerta formal: cada ítem debe resolverse en `plan.md`, `research.md` o `quickstart.md` (o justificarse explícitamente como decisión) antes de ejecutar `/speckit-tasks`.

**Creado**: 2026-08-15

**Funcionalidad**: [spec.md](../spec.md)

**Artefactos bajo prueba**: [research.md §D-009, §D-010, §D-013](../research.md), [quickstart.md](../quickstart.md), [plan.md](../plan.md)

**Alcance**: composición de contenedores, gestión de secretos, migraciones, semilla del administrador, estrategia de pruebas y criterios de aceptación operativos.

> **Cómo usar esta checklist**: cada ítem pregunta si el *requisito operativo está bien especificado*, no si el despliegue funciona. Marcar `[x]` solo cuando el artefacto responda la pregunta de forma inequívoca; si no, anotar el hallazgo y actualizar el plan.

## Configuración y gestión de secretos

- [x] CHK001 ¿Está justificada la existencia de `SESSION_COOKIE_SECRET` en la configuración, dado que el diseño de sesión usa un identificador opaco sin firma y ninguna decisión declara que la cookie se firme? [Conflicto, Guía §Configuración, Investigación §D-001] — **Resuelto 2026-08-15**: la variable se eliminó de `quickstart.md`. Se añadió una nota explicando por qué el identificador opaco no requiere firma, y se completaron `DATABASE_URL` y `API_INTERNAL_URL`, que sí eran necesarias y faltaban.
- [x] CHK002 ¿Está definida la lista completa de variables de entorno requeridas, con cuáles son obligatorias y cuáles admiten valor por defecto? [Completitud, Guía §Configuración] — **Resuelto 2026-08-15**: tabla completa de nueve variables en `quickstart.md` §1, indicando obligatoriedad, valor por defecto y propósito de cada una.
- [x] CHK003 ¿Se especifica el comportamiento de arranque cuando falta una variable obligatoria distinta de `ADMIN_SEED_PASSWORD` —falla explícita o arranque degradado? [Vacío, Investigación §D-010] — **Resuelto 2026-08-15**: falla explícita para **todas** las obligatorias, con un mensaje que nombra la variable y código de salida distinto de cero. No hay arranque degradado ni valores de reserva: un servicio en pie con configuración incompleta es más difícil de diagnosticar que uno que no arranca.
- [ ] CHK004 ¿Está definido cómo se gestionan los secretos en un entorno de producción real, más allá de un archivo `.env` local? [Vacío, Constitución §Principio V, Spec §FR-028]
- [x] CHK005 ¿Se especifica que ningún valor de configuración sensible aparece en los registros de la aplicación ni en mensajes de error? [Vacío, Spec §FR-007] — **Resuelto 2026-08-15**: declarado en `quickstart.md` §1. Los errores visibles son siempre los mensajes fijos en español de `packages/shared`; ninguna contraseña ni cadena de conexión llega a un registro.
- [x] CHK006 ¿Está definida la política de rotación de la contraseña del administrador semilla tras el primer arranque? [Vacío, Spec §FR-028] — **Resuelto 2026-08-15**: se recomienda cambiarla desde la aplicación; `ADMIN_SEED_PASSWORD` solo se consulta al crear o recuperar la cuenta, nunca para validar un inicio de sesión. Se descartó imponer un cambio obligatorio en el primer acceso: sería una pantalla y un estado más para un requisito que la spec no plantea (Principio III).

## Contenedores y composición

- [x] CHK007 ¿Están definidos los `healthcheck` de los servicios `api` y `web`, o solo el de `postgres`? [Vacío, Investigación §D-013] — **Resuelto 2026-08-15**: tabla de salud y reinicio en D-013 para los tres servicios. `api` expone `GET /api/v1/health` sin autenticación, con cuerpo constante que no revela nada; documentado en el contrato.
- [x] CHK008 ¿Se especifica la política de reinicio de los contenedores y el comportamiento esperado ante un fallo de arranque? [Vacío, Investigación §D-013] — **Resuelto 2026-08-15**: `on-failure` para `api`, `unless-stopped` para `postgres` y `web`, en la misma tabla. Un fallo de migración deja el contenedor sin arrancar deliberadamente.
- [x] CHK009 ¿Está definido el mecanismo de persistencia de los datos de PostgreSQL entre reinicios (volumen nombrado, ubicación, respaldo)? [Vacío, Investigación §D-013] — **Resuelto 2026-08-15**: volumen nombrado `foodvoice_pgdata` en `/var/lib/postgresql/data`. El **respaldo se declara fuera de alcance de v1** con su justificación y su consecuencia asumida, que es un resultado válido de esta puerta.
- [x] CHK010 ¿Se especifica el usuario sin privilegios con que corre cada contenedor, más allá de declarar la intención? [Medibilidad, Investigación §D-013] — **Resuelto 2026-08-15**: `USER node` (uid 1000, provisto por `node:22-alpine`) en `api` y `web`; `postgres` con el usuario de su imagen oficial. Se reutiliza el usuario existente en lugar de crear uno propio.
- [x] CHK011 ¿Está definido cómo el servicio `web` alcanza a `api` —nombre de servicio, puerto y variable de entorno— de forma inequívoca? [Claridad, Investigación §D-006, §D-013] — **Resuelto 2026-08-15**: `API_INTERNAL_URL`, con `http://api:3001` en contenedores y `http://localhost:3001` en desarrollo local. No hay direcciones ni puertos escritos en el código.
- [x] CHK012 ¿Se especifica la coherencia de la versión de Node entre los `Dockerfile`, el campo `engines` de los paquetes y el entorno de desarrollo? [Consistencia, Investigación §Resumen de versiones] — **Resuelto 2026-08-15**: tres fuentes declaradas (`node:22-alpine`, `engines: ">=22 <23"`, `.nvmrc`), y `pnpm` falla la instalación si la versión local no cumple `engines`, convirtiendo la discrepancia en un error inmediato.
- [x] CHK013 ¿Están definidos los requisitos de cabeceras de seguridad HTTP y de la marca `Secure` de la cookie según el entorno? [Vacío, Investigación §D-001] — **Resuelto 2026-08-15**: `helmet` con configuración por defecto; `Secure` activa con `NODE_ENV=production` —en `http://localhost` una cookie `Secure` no se envía y la sesión no funcionaría—. El TLS del despliegue real se declara fuera de alcance de v1, no olvidado.

## Migraciones y datos

- [x] CHK014 ¿Está definido en qué momento se aplican las migraciones en un despliegue en contenedores —al arrancar el servicio, como paso previo, o manualmente? [Vacío, Investigación §D-013, Guía §Puesta en marcha] — **Resuelto 2026-08-15**: en el `entrypoint` de la imagen de `api`, con `prisma migrate deploy` antes de lanzar el servidor. Se descartó un servicio `migrate` de un solo uso: añade un cuarto servicio y un orden de arranque que mantener, para un beneficio que el `entrypoint` ya da.
- [x] CHK015 ¿Se especifica el comportamiento cuando dos instancias de `api` arrancan simultáneamente e intentan aplicar la misma migración? [Caso límite, Vacío] — **Resuelto 2026-08-15**: `prisma migrate deploy` toma un *advisory lock* en PostgreSQL; una instancia aplica y la otra encuentra el esquema al día. No hace falta coordinación adicional.
- [x] CHK016 ¿Está definida una estrategia de reversión ante una migración fallida a mitad de aplicación? [Vacío, Recuperación] — **Resuelto 2026-08-15**: cada migración corre dentro de una transacción, así que no deja el esquema a medias. La migración fallida queda marcada y **bloquea los arranques siguientes** hasta resolverla a mano con `prisma migrate resolve`. La reversión automática se descarta explícitamente en v1: con una sola base de datos y sin despliegue continuo, sería más riesgo que beneficio.
- [x] CHK017 ¿Se especifica que la semilla es idempotente de forma verificable, y qué se considera "ya existe" a esos efectos? [Medibilidad, Investigación §D-010] — **Resuelto 2026-08-15**: "ya existe" se evalúa por `ADMIN_SEED_EMAIL` normalizado, la clave única de la tabla. Si existe, el script no toca nada y sale con código 0. Verificable con un test de integración que ejecuta la semilla dos veces y compara el estado.
- [x] CHK018 ¿Está definido el orden obligatorio entre migración y semilla, y qué ocurre si se invierten? [Claridad, Guía §Puesta en marcha] — **Resuelto 2026-08-15**: garantizado por construcción al ir las migraciones en el `entrypoint`. Invertirlos falla con un error de tabla inexistente; no corrompe nada.

## Estrategia de pruebas

- [x] CHK019 ¿Está definido el umbral concreto de cobertura que la guía de puesta en marcha remite al plan, dado que el plan no llega a fijarlo? [Conflicto, Guía §Comprobaciones automáticas, Plan §Contexto Técnico] — **Resuelto 2026-08-15**: umbrales por ámbito definidos en ambos artefactos (90 % en los módulos de seguridad, 100 % en `packages/shared`, 80 % en el resto de la API, 70 % en la web), con incumplimiento que hace fallar `pnpm test`.
- [ ] CHK020 ¿Se especifica qué requisitos concretos debe cubrir cada nivel de prueba, de modo que ningún requisito quede sin nivel asignado? [Cobertura, Investigación §D-009]
- [ ] CHK021 ¿Está definido el estado inicial de datos de los tests de integración y cómo se aísla cada caso de los demás? [Vacío, Investigación §D-009]
- [x] CHK022 ¿Se especifica cómo se prueban los requisitos que dependen del paso del tiempo —30 minutos de inactividad y 15 minutos de bloqueo— sin esperar ese tiempo real? [Vacío, Spec §FR-005, §FR-033] — **Resuelto 2026-08-15**: `ClockService` inyectable (ningún módulo llama a `Date.now()` directamente), sustituido por un doble en los unitarios; en los de integración se envejece la fila directamente. Que las reglas temporales sean pasivas es lo que lo hace viable: no hay proceso programado cuyo disparo simular. Se descartaron los temporizadores simulados de Jest porque no alcanzan al `now()` de PostgreSQL, justo la capa donde estas reglas necesitan verificarse (D-009).
- [ ] CHK023 ¿Está definido si los tests de integración deben ejecutarse antes de dar una fase por completada, o son opcionales? [Claridad, Plan §Fases de entrega]
- [ ] CHK024 ¿Se especifica la convivencia de dos ejecutores de pruebas (Jest y Vitest) en cuanto a configuración compartida y ejecución desde la raíz del monorepo? [Vacío, Investigación §D-009]
- [ ] CHK025 ¿Está justificada la ausencia de pruebas de extremo a extremo frente a la exigencia del Principio IV, y declarado quién ejecuta entonces la validación funcional y con qué periodicidad? [Justificación, Investigación §D-009, Constitución §Principio IV]

## Verificabilidad de la guía de validación

- [ ] CHK026 ¿Son los pasos de la guía ejecutables por una persona no técnica sin conocimiento previo del sistema, incluidos los que requieren dos navegadores simultáneos? [Medibilidad, Guía §Validación funcional, Constitución §Principio IV]
- [x] CHK027 ¿Está definido cómo se ejecutan de forma práctica los pasos que exigen esperar 15 o 30 minutos reales, o se declara una alternativa? [Vacío, Guía §A5, §A9] — **Resuelto 2026-08-15**: la espera real se hace al menos una vez, con A5 y A9 corriendo en paralelo mientras se avanza con la sección B. Para las repeticiones se documenta un atajo con `psql` que envejece la fila, declarado explícitamente como **no equivalente**: comprueba que el sistema reacciona al umbral, no que el umbral sea de 15 o 30 minutos.
- [x] CHK028 ¿Se especifica quién ejecuta la sección de verificación técnica, con qué herramientas y en qué momento del flujo de trabajo? [Vacío, Guía §Sección D, Spec §SC-010] — **Resuelto 2026-08-15**: la persona que revisa la implementación, en la revisión de código previa al cierre de la épica, con acceso al repositorio y a `psql`. Es exactamente la excepción acotada que declara SC-010.
- [ ] CHK029 ¿Cubre la guía todos los criterios de éxito de la spec, o existe alguno sin paso de validación correspondiente? [Cobertura, Guía, Spec §Criterios de Éxito]
- [x] CHK030 ¿Está definido qué constituye un fallo de validación y qué hacer cuando un paso no se comporta como se describe? [Vacío, Recuperación, Guía] — **Resuelto 2026-08-15**: cualquier paso que no se comporte como se describe invalida la épica; no hay pasos opcionales. Se anota lo observado y lo esperado, se corrige y se **repite la sección completa**, no solo el paso corregido, porque un arreglo puede alterar el comportamiento de los pasos vecinos.

## Operación continua

- [ ] CHK031 ¿Están definidos los requisitos de registro de la aplicación —qué se registra, con qué nivel y qué nunca debe aparecer? [Vacío, Spec §FR-007]
- [x] CHK032 ¿Se especifica alguna estrategia de respaldo y restauración de la base de datos, aunque sea para declararla fuera de alcance en v1? [Vacío] — **Resuelto 2026-08-15**: **declarada fuera de alcance de v1** en D-013, con su justificación (proyecto académico, un solo local, sin entorno productivo real) y su consecuencia asumida (una pérdida del volumen obliga a recrear el padrón). Declararlo es el resultado válido que las notas de esta checklist contemplan.
- [ ] CHK033 ¿Está definido el comportamiento de la aplicación cuando PostgreSQL deja de estar disponible durante la operación, y el mensaje en español que se muestra al usuario? [Vacío, Excepción, Constitución §Principio II]

## Notas

- CHK001 y CHK019 son conflictos documentales concretos, no preguntas abiertas: el primero introduce un secreto que el diseño de sesión no usa; el segundo remite a un umbral que ningún documento define.
- CHK022 y CHK027 apuntan al mismo problema desde los dos lados: los requisitos temporales de FR-005 y FR-033 son difíciles de probar automáticamente y tediosos de validar a mano, y ningún artefacto resuelve todavía cómo se hará.
- CHK031, CHK032 y CHK033 cubren aspectos operativos que la spec no aborda por estar centrada en el comportamiento observable. Declararlos fuera de alcance con su justificación es un resultado válido de esta puerta.
