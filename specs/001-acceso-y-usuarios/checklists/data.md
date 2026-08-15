# Checklist de Calidad de Diseño — Modelo de datos y trazabilidad: E1 · Acceso y usuarios

**Propósito**: validar que el modelo de datos esté completo, sea inequívoco, consistente con la spec y que sus reglas transaccionales y de trazabilidad sean verificables. Es una puerta formal: cada ítem debe resolverse en `data-model.md` (o justificarse explícitamente como decisión) antes de ejecutar `/speckit-tasks`.

**Creado**: 2026-08-15

**Funcionalidad**: [spec.md](../spec.md)

**Artefacto bajo prueba**: [data-model.md](../data-model.md)

**Alcance**: las cuatro entidades persistidas (`user`, `session`, `login_attempt_control`, `admin_audit_log`), sus restricciones, transiciones y garantías transaccionales, más los tipos compartidos sin persistencia.

> **Cómo usar esta checklist**: cada ítem pregunta si el *modelo está bien especificado*, no si la base de datos funciona. Marcar `[x]` solo cuando el artefacto responda la pregunta de forma inequívoca; si no, anotar el hallazgo y actualizar el modelo.

## Completitud del modelo

- [x] CHK001 ¿Está resuelto el tipo de la columna `email`, que el modelo declara como "citext / text" sin decidir entre ambos, y las consecuencias de esa elección sobre la comparación de unicidad? [Ambigüedad, Modelo §Entidad user] — **Resuelto 2026-08-15**: `text` con `UNIQUE` y normalización en la aplicación (D-015). Se descarta `citext` por ser una extensión, coherente con el rechazo de `unaccent` en D-011. Consecuencia declarada: la unicidad insensible a mayúsculas depende de que la normalización de Zod se aplique sin excepción, cubierta por un test de integración que varía las mayúsculas.
- [x] CHK002 ¿Se especifica la longitud máxima de la contraseña admitida antes de calcular el hash, dado que bcrypt trunca silenciosamente a 72 bytes? [Vacío, Modelo §user.password_hash, Investigación §D-002] — **Resuelto 2026-08-15**: máximo de 72 **bytes UTF-8** declarado en `PasswordSchema`, con mensaje en español y validación por bytes y no por caracteres, porque el truncamiento de bcrypt ocurre en bytes. Documentado en D-002. **Enmienda a FR-032 aprobada el 2026-08-15**: el requisito declara ahora el rango de 8 a 72 caracteres (supuesto 21, SC-016 y un caso límite), de modo que el límite deja de ser una desviación del plan y sale del Complexity Tracking.
- [x] CHK003 ¿Está definido cómo se pobla `search_normalized` para los registros existentes al aplicar una migración que la introduzca o modifique? [Vacío, Modelo §D-011] — **Resuelto 2026-08-15**: procedimiento en tres pasos (nullable → `UPDATE` normalizador → `NOT NULL`) documentado en D-011, con la obligación explícita de repoblar la columna entera si la definición de `normalizarBusqueda` cambia alguna vez.
- [ ] CHK004 ¿Se especifica si `login_attempt_control` requiere un índice sobre `locked_until`, o se declara explícitamente innecesario? [Vacío, Modelo §login_attempt_control]
- [ ] CHK005 ¿Está definida la política de retención de filas de `session` ya revocadas o expiradas, aunque sea para declararla fuera de alcance con su justificación? [Vacío, Modelo §Ciclo de vida]
- [x] CHK006 ¿Se especifica el comportamiento de la semilla cuando ya existe un usuario con el correo indicado pero con un rol distinto de `ADMINISTRADOR`? [Vacío, Investigación §D-010, Spec §FR-028] — **Resuelto 2026-08-15**: en su modo normal el script **falla de forma explícita** y no modifica nada; promover en silencio una cuenta preexistente sería una escalada de privilegios provocada por una variable de entorno. La resolución pasa por el modo de recuperación (FR-036).
- [x] CHK007 ¿Están definidos los requisitos de longitud máxima de `full_name`, `email` y `phone` de forma consistente entre el modelo y los esquemas Zod? [Consistencia, Modelo §user, Contrato §shared.md] — **Resuelto 2026-08-15**: tabla de longitudes en `data-model.md` §user, idéntica a los esquemas Zod. Las columnas son `text` sin longitud en el motor: el límite se fija en un único lugar para que ambos lados no puedan discrepar.

## Integridad y garantías del motor

- [ ] CHK008 ¿Está especificado qué mecanismo impide efectivamente `UPDATE` y `DELETE` sobre `admin_audit_log`, dado que el modelo lo declara "solo inserción" pero lo confía a una convención de código y no a una restricción del motor? [Vacío, Modelo §admin_audit_log, Spec §FR-034]
- [x] CHK009 ¿Se define el comportamiento de `ON DELETE` de las claves foráneas hacia `user`, siendo que el diseño declara que no existe borrado físico? [Vacío, Modelo §Esquema Prisma] — **Resuelto 2026-08-15**: `onDelete: Restrict` en las tres claves foráneas, no `Cascade`. Si alguien intentara borrar un usuario, la operación falla en el motor en lugar de llevarse por delante la bitácora que FR-034 exige conservar.
- [ ] CHK010 ¿Está especificado el nivel de aislamiento de transacción requerido para el incremento del contador de intentos fallidos ante peticiones concurrentes? [Vacío, Modelo §login_attempt_control, Spec §FR-033]
- [ ] CHK011 ¿Es inequívoco el alcance exacto de la transacción de desactivación —qué escrituras la componen y qué ocurre si una falla? [Claridad, Modelo §Transiciones de estado, Spec §FR-024]
- [ ] CHK012 ¿Se especifica cómo se traduce una violación de la restricción única del correo a la respuesta de la API, y que esa traducción no filtre información adicional? [Trazabilidad, Modelo §user, Spec §FR-017, §FR-008]
- [ ] CHK013 ¿Está definido si `login_attempt_control` participa en la misma transacción que la creación de sesión en un inicio exitoso? [Vacío, Modelo §Reglas de transición]

## Claridad y medibilidad

- [x] CHK014 ¿Es objetivamente verificable la afirmación de que la expiración por inactividad es "pasiva", incluyendo qué componente aplica el umbral de 30 minutos y con qué reloj? [Medibilidad, Modelo §session, Spec §FR-005] — **Resuelto 2026-08-15**: lo aplica el `SessionGuard` de NestJS al validar cada petición, comparando contra el `ClockService` (D-009) —nunca el reloj del navegador ni el de PostgreSQL—. Todas las marcas son `timestamptz` en UTC, de modo que el huso del contenedor no altera ningún cálculo.
- [x] CHK015 ¿Está definida de forma precisa la función de normalización de `search_normalized` —qué caracteres se eliminan, qué ocurre con la eñe y con los espacios múltiples? [Claridad, Modelo §D-011, Spec §FR-015] — **Resuelto 2026-08-15**: `normalizarBusqueda` definida paso a paso en D-011 y expuesta en `packages/shared`. La eñe se pliega a `n` deliberadamente («Nuñez» y «Nunez» se encuentran mutuamente); los espacios consecutivos se colapsan en uno. La misma función se usa al escribir y al consultar, y se añadió `escaparLike` para los caracteres con significado en el patrón.
- [ ] CHK016 ¿Es inequívoco qué momento registra `occurred_at` —el inicio de la transacción o su confirmación— y si eso afecta al orden de la bitácora? [Ambigüedad, Modelo §admin_audit_log]
- [x] CHK017 ¿Se define de forma medible qué significa "el usuario referenciado sigue en estado ACTIVO" como tercera condición de validez de sesión, y si implica una consulta adicional por petición? [Medibilidad, Modelo §session] — **Resuelto 2026-08-15**: no implica consulta adicional. La validación de sesión hace un único `UPDATE ... RETURNING` con `JOIN` a `user` (D-001), de modo que las tres condiciones se evalúan en una sola ida a la base de datos.

## Consistencia con la especificación

- [x] CHK018 ¿Es consistente la decisión de congelar el rol en `session` con todos los escenarios de la spec, incluido el caso en que un usuario sea degradado y su sesión conserve privilegios superiores durante hasta 30 minutos? [Consistencia, Modelo §session.role, Spec §FR-011, §RN-001] — **Resuelto 2026-08-15**: el rol sigue congelado (impide la mutación en caliente que prohíbe el caso límite de la spec), y además el cambio de rol **revoca** las sesiones del usuario afectado (D-014). La ventana de privilegio desaparece.
- [x] CHK019 ¿Está justificado el riesgo del ítem anterior, o requiere una excepción explícita para el rol `ADMINISTRADOR`? [Conflicto, Spec §RN-003, §FR-011] — **Resuelto 2026-08-15**: no hace falta una excepción por rol. D-014 aplica la misma regla a los cuatro roles, lo que es más simple que un caso especial para `ADMINISTRADOR` (Principio I) y coherente con RN-003, que establece que el acceso lo determina el rol y no la persona.
- [x] CHK020 ¿Concuerda el conjunto de valores de `AdminAction` con las seis acciones que la spec exige registrar, sin sobrantes ni faltantes? [Consistencia, Modelo §admin_audit_log, Spec §FR-034] — **Resuelto 2026-08-15**: verificado uno a uno. Seis acciones en FR-034, seis valores en el enum, correspondencia exacta, ahora en tabla explícita en `data-model.md` que además indica qué endpoint produce cada valor. La única entrada sin endpoint es la del modo de recuperación (FR-036), que se distingue por tener actor y afectado iguales.
- [ ] CHK021 ¿Es consistente la ausencia deliberada de clave foránea en `login_attempt_control` con todos los escenarios de no revelación de cuentas? [Consistencia, Modelo §login_attempt_control, Spec §FR-008, §SC-018]
- [ ] CHK022 ¿Cubre el modelo la conservación del historial de un usuario desactivado que exige RN-002, dado que en E1 aún no existe ninguna entidad de historial de pedidos? [Cobertura, Modelo, Spec §RN-002]

## Cobertura de casos límite del modelo

- [ ] CHK023 ¿Está definido el comportamiento cuando un administrador es desactivado por otro y ambos tienen sesión activa simultáneamente? [Cobertura, Vacío]
- [ ] CHK024 ¿Se especifica qué ocurre si `locked_until` queda en el pasado pero la fila persiste con `failed_count` mayor que cero? [Caso límite, Modelo §Reglas de transición]
- [ ] CHK025 ¿Está definido el comportamiento cuando el correo de un usuario se edita hacia un valor que existe en `login_attempt_control` con un bloqueo vigente? [Caso límite, Vacío]
- [x] CHK026 ¿Se especifica el límite inferior de administradores activos que el sistema debe conservar, más allá de la autoprotección individual que impide autodesactivarse? [Vacío, Spec §RN-006, §Casos Límite] — **Resuelto 2026-08-15**: se examinó si hacía falta una comprobación del recuento y se concluyó que **no**. FR-027 ya lo garantiza: quien ejecuta la acción es siempre un administrador activo y no puede aplicarla sobre sí mismo, luego después de la acción queda al menos él. El recuento sería código imposible de disparar (Principio III). El razonamiento quedó escrito en RN-006, en un caso límite y en el supuesto 16, y se verifica en B23 (SC-022).
- [x] CHK027 ¿Está cubierto el escenario en que el último administrador activo es desactivado por otro administrador que luego pierde su propio acceso? [Cobertura, Vacío, Spec §RN-006] — **Resuelto 2026-08-15**: este era el hueco real, y no se resuelve dentro de la aplicación: perder las credenciales no es un estado que el sistema pueda detectar, porque la cuenta sigue activa y válida. Se añadió **FR-036**, un procedimiento de recuperación ejecutable fuera de la aplicación (modo `--recuperar` de la semilla, D-010), con sus resguardos y su rastro en la bitácora. Documentado en `quickstart.md` §2b y verificado en D8.

## Tipos compartidos sin persistencia

- [ ] CHK028 ¿Está justificado que la máquina de estados del pedido carezca de persistencia en E1 sin que ello genere un contrato que deba romperse al construir E4/E2? [Supuesto, Modelo §OrderStatus, Investigación §D-012]
- [ ] CHK029 ¿Se especifica que las transiciones son estrictamente lineales, y está eso alineado con el Principio XII sin añadir ni omitir transiciones? [Consistencia, Modelo §OrderStatus, Constitución §Principio XII]
- [ ] CHK030 ¿Está definido qué ocurre con las métricas del panel cuando la agregación de usuarios por rol devuelve roles sin ningún usuario activo —cero explícito u omisión de la clave? [Claridad, Modelo §Panel de métricas, Contrato §metrics]

## Trazabilidad

- [ ] CHK031 ¿La tabla de trazabilidad requisito → modelo cubre todos los requisitos funcionales de la spec, sin filas ausentes? [Trazabilidad, Modelo §Trazabilidad]
- [ ] CHK032 ¿Existe algún elemento del modelo (columna, índice, entidad) que no se remita a ningún requisito, es decir, alcance no especificado? [Constitución §Principio III, Modelo]

## Notas

- CHK002, CHK008 y CHK019 son los hallazgos de mayor impacto: el primero es una restricción del algoritmo elegido que ningún requisito refleja; el segundo confía una garantía de inmutabilidad exigida por FR-034 a una convención en lugar de al motor; el tercero es una tensión real entre la letra de FR-011 y la intención de RN-003.
- CHK026 y CHK027 apuntan al mismo vacío desde dos ángulos: la spec exige que el sistema nunca quede sin administrador, pero la autoprotección individual no basta para garantizarlo.
