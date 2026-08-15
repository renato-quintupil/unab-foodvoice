# Checklist de Calidad de Requisitos — Seguridad y Autenticación: E1 · Acceso y usuarios

**Propósito**: validar que los requisitos de autenticación, sesión, credenciales y control de acceso estén completos, claros, consistentes y medibles. Es una puerta formal: cada ítem debe resolverse en la spec (o justificarse explícitamente como decisión) antes de ejecutar `/speckit-plan`.
**Creado**: 2026-08-15
**Funcionalidad**: [spec.md](../spec.md)
**Alcance**: HU-08 (autenticación y sesión), más los aspectos de credenciales y control de acceso de HU-09 y HU-10.

> **Cómo usar esta checklist**: cada ítem pregunta si el *requisito está bien escrito*, no si el sistema funciona. Marcar `[x]` solo cuando la spec responda la pregunta de forma inequívoca; si no, anotar el hallazgo y actualizar la spec.

## Completitud de los requisitos de autenticación

- [ ] CHK001 ¿Está definido qué constituye una credencial válida más allá de "correo y contraseña" —por ejemplo, si el correo se compara de forma sensible o insensible a mayúsculas? [Ambigüedad, Spec §FR-001]
- [ ] CHK002 ¿Se especifica el comportamiento y el mensaje del inicio de sesión cuando la cuenta existe pero está desactivada, dado que FR-008 exige un mensaje genérico? [Vacío, Spec §FR-008, §FR-012]
- [ ] CHK003 ¿Están definidos los requisitos de validación de formato del correo electrónico al crear o editar un usuario, o FR-014 solo exige su presencia? [Vacío, Spec §FR-014]
- [ ] CHK004 ¿Se documenta si el sistema admite sesiones simultáneas del mismo usuario en varios navegadores o dispositivos? [Vacío, Spec §Entidad Sesión]
- [ ] CHK005 ¿Se especifica si existe una duración máxima absoluta de sesión además de los 30 minutos de inactividad? [Vacío, Spec §FR-005]
- [ ] CHK006 ¿Están definidos los requisitos de protección del canal de comunicación (transporte cifrado) para el envío de credenciales? [Vacío]
- [ ] CHK007 ¿Se especifica qué debe ocurrir con las sesiones activas de un usuario cuando el administrador le restablece la contraseña? [Vacío, Spec §FR-026, §FR-024]
- [ ] CHK008 ¿Se especifica qué debe ocurrir con la sesión activa de un usuario cuando el administrador le cambia el correo electrónico, que es su identificador de acceso? [Caso límite, Vacío, Spec §FR-010]
- [ ] CHK009 ¿Se define qué ve o qué camino tiene un usuario que olvidó su contraseña, dado que no existe autoservicio en v1? [Vacío, Spec §FR-026, §Fuera de Alcance]
- [ ] CHK010 ¿Se define por qué canal y con qué resguardos el administrador entrega la contraseña inicial al usuario creado? [Supuesto, Spec §Supuestos-7]

## Claridad y medibilidad

- [x] CHK011 ¿Está definido qué cuenta como "actividad" a efectos de reiniciar el temporizador de 30 minutos de inactividad? [Ambigüedad, Spec §FR-005] — **Resuelto 2026-08-15**: FR-005 reescrito. Cuenta toda acción iniciada por la persona; NO cuenta ninguna consulta automática, y el sistema tiene **prohibido** mantener viva una sesión con sondeos en segundo plano. Nuevo SC-024 y verificación D7.
- [ ] CHK012 ¿Es "no almacenar contraseñas en texto plano" un requisito verificable con criterios objetivos, o queda enunciado sin criterio de comprobación? [Medibilidad, Spec §FR-007, §FR-016]
- [ ] CHK013 ¿Se define qué significa "de inmediato" en la invalidación de sesión por desactivación —en la siguiente acción, o con un umbral temporal máximo? [Claridad, Spec §FR-024, §SC-006]
- [x] CHK014 ¿Están cuantificados los límites de la contraseña más allá del mínimo de 8 caracteres —longitud máxima, espacios, caracteres acentuados o Unicode? [Claridad, Spec §FR-032] — **Resuelto 2026-08-15**: FR-032 declara ahora el rango de 8 a 72 caracteres, con la prohibición explícita de recortar en silencio (supuesto 21, SC-016, caso límite). Los acentos y el Unicode están cubiertos por la decisión de medir en **bytes UTF-8**: una contraseña de menos de 72 caracteres acentuados puede superar el límite real, y se rechaza con el mismo mensaje. No se restringen espacios ni ningún carácter concreto: FR-032 no impone exigencias de composición.
- [ ] CHK015 ¿Se define si "5 intentos fallidos consecutivos" se cuenta por cuenta, por origen de la petición, o por ambos? [Ambigüedad, Spec §FR-033]
- [ ] CHK016 ¿Se especifica el estado del contador de intentos fallidos una vez transcurridos los 15 minutos de bloqueo —vuelve a cero o un único fallo vuelve a bloquear? [Ambigüedad, Spec §FR-033]
- [ ] CHK017 ¿Es "mensajes de error genéricos respecto a correo o contraseña" un requisito con criterio verificable de qué información no debe revelarse? [Medibilidad, Spec §FR-008]
- [ ] CHK018 ¿Se define un criterio objetivo para comprobar que el rol se aplica en el procesamiento de la acción y no solo ocultando opciones en pantalla? [Medibilidad, Spec §FR-003, §SC-003]

## Consistencia entre requisitos

- [x] CHK019 ¿Es consistente el mensaje de "cuenta bloqueada temporalmente" (FR-033) con la exigencia de no revelar qué cuentas existen (FR-008)? [Conflicto, Spec §FR-008, §FR-033] — **Resuelto 2026-08-15**: FR-008 y FR-033 reescritos; el conteo es por correo ingresado y el mensaje es idéntico exista o no la cuenta (SC-018, Supuesto 12).
- [x] CHK020 ¿Está recogida en un requisito funcional la regla de que un restablecimiento de contraseña levanta el bloqueo temporal, que hoy solo aparece en Casos Límite? [Consistencia, Spec §Casos Límite, §FR-026, §FR-033] — **Resuelto 2026-08-15**: incorporada a FR-026 y FR-033.
- [ ] CHK021 ¿Es consistente la prohibición de credenciales en el código (FR-007, FR-016) con el mecanismo de configuración externa exigido para el administrador semilla (FR-028)? [Consistencia, Spec §FR-028]
- [ ] CHK022 ¿Son consistentes los requisitos de bloqueo temporal (FR-033) con SC-002, que exige que el 100 % de los intentos con credenciales inválidas se rechacen sin crear sesión? [Consistencia, Spec §SC-002, §FR-033]
- [x] CHK023 ¿Es consistente la verificabilidad de los requisitos de credenciales (FR-007, FR-016) con el Principio IV y SC-010, que exceptúan únicamente a FR-034? [Conflicto, Spec §SC-010, §FR-007] — **Resuelto 2026-08-15**: SC-010 declara ahora la excepción acotada para FR-007/FR-016/FR-028 (Supuesto 13).
- [x] CHK024 ¿Son coherentes entre sí las reglas de autoprotección del administrador (FR-027) y la regla de "el sistema nunca queda sin administrador" (RN-006), incluyendo el caso de un administrador desactivado por otro siendo el último activo? [Conflicto, Spec §FR-027, §RN-006, §Casos Límite] — **Resuelto 2026-08-15**: **son coherentes, y no hacía falta ningún requisito nuevo para el recuento**. Quien ejecuta la acción es siempre un administrador activo y FR-027 le impide aplicarla sobre sí mismo, luego después de la acción queda al menos él: el caso "otro administrador desactiva al último" no puede dejar cero. El razonamiento se escribió en RN-006 y en los casos límite, en lugar de dejarse implícito. Lo que sí faltaba era el camino de vuelta cuando nadie conserva acceso *efectivo* —un estado indetectable desde la aplicación—, resuelto con FR-036.

## Cobertura de escenarios y casos límite

- [x] CHK025 ¿Están definidos los requisitos para el escenario de recuperación en que la configuración externa con la contraseña del administrador semilla no está disponible al arrancar el sistema? [Vacío, Flujo de excepción, Spec §FR-028] — **Resuelto 2026-08-15**: el arranque **falla de forma explícita** nombrando la variable ausente, sin valor de reserva ni arranque degradado (D-010, `quickstart.md` §1). La recuperación del acceso administrativo, que es el caso realmente delicado, se cubre con FR-036.
- [x] CHK026 ¿Se documenta y acepta explícitamente que un usuario degradado de rol conserva los permisos anteriores hasta su próximo inicio de sesión, con la ventana de riesgo que eso implica? [Supuesto, Spec §FR-011, §RN-001] — **Resuelto 2026-08-15**: la ventana **ya no existe**. D-014 revoca las sesiones del usuario afectado en el cambio de rol, de modo que la sesión termina en el acto y el nuevo rol rige en el siguiente inicio de sesión, sin mutación en caliente. Ver `data.md` §CHK018.
- [ ] CHK027 ¿Están definidos los requisitos para el intento de acceso directo a una URL o punto de entrada de otro rol, y no solo para la navegación desde la interfaz? [Cobertura, Spec §FR-003]
- [x] CHK028 ¿Se especifica el comportamiento esperado ante intentos de inicio de sesión sobre un correo que no existe en el padrón, en relación con el conteo de fallos y el bloqueo? [Cobertura, Vacío, Spec §FR-033] — **Resuelto 2026-08-15**: FR-033, nueva entidad "Control de intentos de acceso", caso límite y escenario Gherkin dedicado.
- [ ] CHK029 ¿Se declara explícitamente si los ataques sobre múltiples cuentas o desde múltiples orígenes quedan fuera de alcance en v1? [Exclusión de frontera, Vacío]
- [ ] CHK030 ¿Están definidos los requisitos para el escenario en que la sesión expira exactamente mientras se procesa una acción administrativa que ya modificó datos? [Recuperación, Spec §FR-030, §Casos Límite]
- [x] CHK031 ¿Se especifica el comportamiento cuando un administrador con sesión activa es desactivado o degradado por otro administrador? [Caso límite, Vacío, Spec §FR-024, §FR-027] — **Resuelto 2026-08-15**: su sesión se revoca en la misma transacción (FR-024 para la desactivación, D-014 para el cambio de rol), sin trato especial por ser administrador —RN-003: el acceso lo determina el rol, no la persona—. El sistema no puede quedar sin administradores porque quien ejecuta la acción sigue siendo uno (ver CHK024). Verificado en B23.

## Registro y trazabilidad de seguridad

- [ ] CHK032 ¿Se especifica si los eventos de autenticación —inicios de sesión, fallos, bloqueos temporales, cierres y expiraciones— quedan registrados, o el registro cubre solo las acciones administrativas de HU-09? [Vacío, Spec §FR-034]
- [ ] CHK033 ¿Están definidos los requisitos de retención, protección e inalterabilidad del registro de acciones administrativas? [Completitud, Spec §FR-034]
- [ ] CHK034 ¿Se especifica qué datos del usuario afectado quedan registrados en la bitácora, garantizando que no se incluyan credenciales ni datos innecesarios (Principio X)? [Completitud, Spec §FR-034]
- [ ] CHK035 ¿Está establecido un esquema de identificadores que permita trazar cada escenario Gherkin de seguridad hasta un FR y un SC concretos? [Trazabilidad]

## Notas

- Marcar los ítems resueltos como `[x]` y anotar el hallazgo o la decisión junto al ítem.
- Los ítems que queden sin resolver DEBEN atenderse actualizando `spec.md` (o declarándose fuera de alcance de v1 en la sección correspondiente) antes de ejecutar `/speckit-plan`.
- Los ítems marcados como `[Conflicto]` tienen prioridad: describen contradicciones entre requisitos ya escritos, no solo omisiones.
