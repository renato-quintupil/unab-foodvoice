# Checklist de Calidad de Diseño — Contratos y API: E1 · Acceso y usuarios

**Propósito**: validar que los contratos HTTP y los contratos de dominio compartidos estén completos, sean inequívocos, consistentes entre sí y trazables a un requisito de la spec. Es una puerta formal: cada ítem debe resolverse en `contracts/` (o justificarse explícitamente como decisión) antes de ejecutar `/speckit-tasks`.

**Creado**: 2026-08-15

**Funcionalidad**: [spec.md](../spec.md)

**Artefactos bajo prueba**: [contracts/api.md](../contracts/api.md), [contracts/shared.md](../contracts/shared.md), [contracts/README.md](../contracts/README.md)

**Alcance**: los 12 endpoints de `services/api`, el contrato del proxy BFF y la superficie pública de `packages/shared`.

> **Cómo usar esta checklist**: cada ítem pregunta si el *contrato está bien escrito*, no si el código funciona. Marcar `[x]` solo cuando el artefacto responda la pregunta de forma inequívoca; si no, anotar el hallazgo y actualizar el contrato.

## Completitud del contrato HTTP

- [x] CHK001 ¿Está definido el criterio de ordenamiento por defecto del listado de usuarios, dado que la paginación de 20 por página es determinista solo si el orden lo es? [Vacío, Contrato §GET /admin/users, Spec §FR-015] — **Resuelto 2026-08-15**: `created_at DESC, id DESC` (D-016), incorporado a FR-015 y al contrato, con índice de apoyo. El desempate por `id` es obligatorio: sin él el orden no es total y dos altas simultáneas pueden intercambiarse entre páginas. Nuevo SC-023 y paso B22.
- [x] CHK002 ¿Se especifica el formato de las fechas que la API devuelve (`createdAt`, `occurredAt`) y el huso horario en que se expresan? [Vacío, Contrato §Tipos de transporte] — **Resuelto 2026-08-15**: ISO 8601 en UTC con sufijo `Z` y milisegundos. La API no formatea ni convierte husos; eso corresponde a la interfaz.
- [x] CHK003 ¿Está definido el comportamiento cuando `page` excede el número total de páginas —conjunto vacío, error de validación o última página? [Vacío, Contrato §GET /admin/users] — **Resuelto 2026-08-15**: 200 con `items: []`, conservando `total`, `page` y `totalPages` reales. No es un error: es lo que ocurre naturalmente cuando un filtro se estrecha mientras se navega. Verificado en B26.
- [ ] CHK004 ¿Se especifica el formato de las fechas aceptadas en los parámetros `from` y `to` del reporte de pedidos? [Vacío, Contrato §GET /admin/dashboard/orders, Spec §FR-020]
- [ ] CHK005 ¿Están definidos los requisitos de respuesta del proxy de Next.js cuando el servicio NestJS no responde o devuelve un error de red? [Vacío, Contrato §Contrato del proxy]
- [x] CHK006 ¿Se especifica si el administrador puede crear usuarios con rol `ADMINISTRADOR`, dado que `CreateUserSchema` lo admite pero ningún requisito lo confirma explícitamente? [Ambigüedad, Contrato §POST /admin/users, Spec §FR-009] — **Resuelto 2026-08-15**: **sí puede**, y el requisito sí lo confirma: FR-009 enumera literalmente los cuatro roles, administrador incluido. No era una laxitud del esquema. Se explicitó en el contrato, con dos razones de peso: sin ello el sistema quedaría atado para siempre al único administrador semilla, y RN-003 establece que no hay permisos diferenciados dentro de un rol. Verificado en B21.
- [ ] CHK007 ¿Está definido el comportamiento de `PUT /admin/users/:id/status` cuando el estado solicitado coincide con el actual (idempotencia), y si registra o no una entrada en la bitácora? [Vacío, Contrato §PUT status, Spec §FR-034]
- [ ] CHK008 ¿Se especifican requisitos de límite de tamaño del cuerpo de las peticiones para los endpoints que reciben texto libre? [Vacío]
- [ ] CHK009 ¿Está documentada la estrategia de versionado más allá del prefijo `/api/v1` —qué constituye un cambio incompatible y cómo se señaliza? [Vacío, Contrato §Base]

## Claridad y ausencia de ambigüedad

- [ ] CHK010 ¿Es inequívoco si la respuesta `423 ACCOUNT_LOCKED` incluye el tiempo restante de bloqueo, y si hacerlo es compatible con la exigencia de mensaje idéntico? [Ambigüedad, Contrato §Convenciones de error, Spec §FR-008, §SC-018]
- [x] CHK011 ¿Está claramente definido qué significa "petición autenticada" a efectos de refrescar `last_activity_at` —incluye o excluye la propia llamada a `GET /auth/me` que el frontend pueda hacer en segundo plano? [Ambigüedad, Contrato §GET /auth/me, Spec §FR-005] — **Resuelto 2026-08-15**: `GET /auth/me` **sí** refresca, como cualquier petición, pero se prohíbe la categoría entera de llamadas en segundo plano: `apps/web` no puede consultar la API por temporizador ni sondeo. El servidor no puede distinguir si hubo una persona detrás, así que la garantía vive en el cliente. FR-005 reescrito, nuevo SC-024, escenario A9 endurecido (pestaña abierta y quieta) y verificación D7.
- [ ] CHK012 ¿Es inequívoco el criterio que distingue un `401 UNAUTHENTICATED` de un `401 INVALID_CREDENTIALS` para el código que consume la API? [Claridad, Contrato §Convenciones de error]
- [ ] CHK013 ¿Está definido de forma medible qué significa "reenvío transparente" en el proxy —qué cabeceras se propagan y cuáles no? [Medibilidad, Contrato §Contrato del proxy]
- [ ] CHK014 ¿Se especifica si el campo `fields` del error de validación puede exponer nombres de campo que no existen en la petición original? [Claridad, Contrato §Convenciones de error]

## Consistencia entre contratos

- [ ] CHK015 ¿Son consistentes los mensajes fijos declarados en `api.md` y en `shared.md`, y existe una única fuente de verdad para cada uno? [Consistencia, Contrato §Mensajes fijos]
- [ ] CHK016 ¿Coincide el conjunto de códigos de error de `api.md` con lo que los esquemas de `shared.md` pueden producir, sin códigos huérfanos ni faltantes? [Consistencia]
- [ ] CHK017 ¿Es consistente la afirmación de que `UpdateUserSchema` "no admite `password`" con la existencia de un endpoint separado de restablecimiento, sin dejar ninguna ruta alternativa de cambio de contraseña sin especificar? [Consistencia, Contrato §PATCH, §POST password-reset]
- [ ] CHK018 ¿Concuerda la forma paginada del reporte de pedidos con la del listado de usuarios, o difieren en algún campo sin justificación? [Consistencia, Contrato §GET dashboard/orders]
- [ ] CHK019 ¿Es consistente el uso de `PUT` para rol y estado frente a `PATCH` para datos de contacto, y está justificada la diferencia? [Consistencia]

## Trazabilidad requisito ↔ contrato

- [ ] CHK020 ¿Cada uno de los 12 endpoints se remite explícitamente a al menos un requisito funcional de la spec, sin superficie no especificada? [Trazabilidad, Constitución §Principio III]
- [ ] CHK021 ¿Existe algún requisito funcional de HU-08, HU-09 o HU-10 que no tenga un endpoint o comportamiento correspondiente en el contrato? [Cobertura, Spec §Requisitos]
- [x] CHK022 ¿Está formalmente registrada como decisión la revocación de sesiones en el restablecimiento de contraseña, dado que la spec exige invalidar la contraseña anterior pero no menciona las sesiones? [Supuesto, Contrato §POST password-reset, Spec §FR-026] — **Resuelto 2026-08-15**: formalizada como D-014, y generalizada a las cuatro acciones de impacto en lugar de quedar como excepción aislada. Registrada en Complexity Tracking y propuesta como enmienda a FR-024.
- [ ] CHK023 ¿Se documenta qué endpoints devuelven deliberadamente datos vacíos en E1 y bajo qué condición dejarán de hacerlo? [Trazabilidad, Contrato §HU-10, Spec §Entrega por fases]

## Cobertura de escenarios y casos límite

- [ ] CHK024 ¿Está especificado el comportamiento cuando el administrador ejecuta una acción sobre un usuario que fue eliminado o modificado concurrentemente por otro administrador? [Cobertura, Vacío]
- [x] CHK025 ¿Se define el comportamiento del listado cuando el término de búsqueda contiene caracteres con significado en el patrón `LIKE` (por ejemplo `%` o `_`)? [Caso límite, Vacío, Spec §FR-015] — **Resuelto 2026-08-15**: función `escaparLike` en `packages/shared`, aplicada después de normalizar, que neutraliza `\`, `%` y `_`. Sin ella, buscar `%` devolvería el padrón completo. Verificado en B25 y con un test unitario del paquete.
- [ ] CHK026 ¿Está definido el comportamiento cuando `from` y `to` del reporte son válidos individualmente pero el rango es de amplitud extrema? [Caso límite, Vacío]
- [ ] CHK027 ¿Se especifica qué ocurre si la cookie de sesión presenta un identificador con formato válido pero inexistente en la base de datos? [Cobertura, Vacío]
- [ ] CHK028 ¿Están cubiertos los requisitos de respuesta cuando dos peticiones concurrentes intentan crear el mismo correo electrónico? [Cobertura, Spec §FR-017]

## Calidad del contrato compartido

- [x] CHK029 ¿Está definido el límite superior de longitud de la contraseña, dado que la elección de bcrypt impone un truncamiento a 72 bytes que ningún esquema declara? [Vacío, Contrato §PasswordSchema, Investigación §D-002] — **Resuelto 2026-08-15**: ver `data.md` §CHK002.
- [ ] CHK030 ¿Se especifica la política de compatibilidad de `packages/shared` —qué ocurre si frontend y backend se despliegan con versiones distintas del paquete? [Vacío, Dependencia]
- [ ] CHK031 ¿Es inequívoca la frontera declarada entre lo que valida Zod y lo que validan los servicios, sin reglas que puedan caer en ambos lados o en ninguno? [Claridad, Contrato §Frontera de responsabilidad]
- [x] CHK032 ¿Está justificado que `LoginSchema` no aplique el mínimo de 8 caracteres, y es esa asimetría con `PasswordSchema` una decisión documentada y no una omisión? [Supuesto, Contrato §LoginSchema, Spec §FR-008] — **Resuelto 2026-08-15**: es deliberada y está documentada en `shared.md`. Al iniciar sesión no se valida longitud alguna —ni mínima ni máxima—: hacerlo revelaría por diferencia de mensaje información sobre las credenciales almacenadas, contra FR-008. Cualquier fallo produce el mismo `MSG_CREDENCIALES_INVALIDAS`. La asimetría es la consecuencia correcta de que FR-032 rija al **asignar** contraseñas, no al usarlas.
- [x] CHK033 ¿Se define el comportamiento de normalización del correo (recorte y minúsculas) de forma idéntica en todos los esquemas que lo contienen? [Consistencia, Contrato §shared.md] — **Resuelto 2026-08-15**: `.trim().toLowerCase()` en todos los esquemas que contienen correo, y esa uniformidad es ahora una garantía **necesaria**, no cosmética: D-015 apoya en ella la unicidad insensible a mayúsculas. Cubierta por un test del paquete y por el test de integración de FR-017 que varía las mayúsculas.
- [x] CHK034 ¿Está especificado que la constante `PAGE_SIZE` es la única fuente del tamaño de página, sin que ningún contrato lo repita como literal? [Consistencia, Contrato §ListUsersQuerySchema] — **Resuelto 2026-08-15**: declarado explícitamente en `shared.md` y en `api.md`. Ningún documento ni módulo repite el número 20 como literal.

## Notas

- Esta checklist valida los **contratos**, no la spec. Los huecos de la spec se registran en [`requirements.md`](./requirements.md), [`security.md`](./security.md) y [`ux.md`](./ux.md).
- Un ítem marcado `[x]` con una decisión anotada (en lugar de un cambio en el contrato) es un resultado válido, siempre que la decisión quede escrita en `research.md`.
- CHK022 y CHK029 son los dos ítems con mayor probabilidad de derivar en un cambio real del contrato: el primero por añadir comportamiento no exigido por la spec, el segundo por una restricción del algoritmo elegido que ningún requisito refleja.
