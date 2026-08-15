# Checklist de Calidad de Requisitos — UX y mensajes en español: E1 · Acceso y usuarios

**Propósito**: validar que los requisitos de interfaz, mensajería en español, estados vacíos, confirmaciones y accesibilidad estén completos, claros, consistentes y medibles. Es una puerta formal: cada ítem debe resolverse en la spec (o justificarse explícitamente como decisión) antes de ejecutar `/speckit-plan`.
**Creado**: 2026-08-15
**Funcionalidad**: [spec.md](../spec.md)
**Alcance**: mensajes visibles, páginas de inicio por rol, listados y filtros, panel de solo lectura y accesibilidad, en HU-08, HU-09 y HU-10.

> **Cómo usar esta checklist**: cada ítem pregunta si el *requisito está bien escrito*, no si la pantalla se ve bien. Marcar `[x]` solo cuando la spec responda la pregunta de forma inequívoca; si no, anotar el hallazgo y actualizar la spec.

## Calidad de los requisitos de mensajería

- [ ] CHK001 ¿Es "mensaje claro y sin detalles técnicos" un criterio objetivamente verificable, o requiere una definición operativa? [Medibilidad, Spec §FR-003, §FR-014, §FR-022]
- [ ] CHK002 ¿Se especifica dónde y cómo se presenta cada mensaje de error —junto al campo, como aviso global, o como página completa? [Vacío, Spec §FR-014]
- [ ] CHK003 ¿Están definidos los requisitos de confirmación de éxito tras las acciones administrativas (alta, edición, cambio de rol, desactivación, reactivación, restablecimiento)? [Vacío, Spec §FR-009 a §FR-013, §FR-026]
- [ ] CHK004 ¿Se especifica si el mensaje de "no tienes permiso" (FR-003) es una página propia o un aviso sobre la vista actual, y hacia dónde queda el usuario después? [Ambigüedad, Spec §FR-003]
- [ ] CHK005 ¿Es consistente la exigencia de mensajes en español entre los tres tipos de mensaje —error de validación, denegación por rol y ausencia de resultados? [Consistencia, Spec §FR-003, §FR-014, §FR-022]
- [ ] CHK006 ¿Se define la terminología visible de los estados y acciones del usuario ("desactivar" vs. "baja lógica" vs. "dar de baja") de forma única en toda la especificación? [Consistencia, Spec §FR-012, §RN-002]
- [ ] CHK007 ¿Están definidas las etiquetas visibles de los cuatro roles en la interfaz, dado que FR-031 exige mostrar el rol al usuario? [Vacío, Spec §FR-031]
- [ ] CHK008 ¿Se especifica el mensaje y el destino del usuario cuando su sesión expira por inactividad, distinguiéndolo de un cierre de sesión voluntario? [Vacío, Spec §FR-005, §FR-006]

## Completitud de los requisitos de flujo e interfaz

- [ ] CHK009 ¿Se especifica a qué vista llega el usuario tras cerrar sesión explícitamente? [Vacío, Spec §FR-006]
- [ ] CHK010 ¿Están definidos los elementos mínimos exigidos de la página de inicio de cada rol de forma que su ausencia sea detectable? [Completitud, Spec §FR-031]
- [ ] CHK011 ¿Se especifica qué ocurre con los datos que el usuario había ingresado en un formulario cuando la acción se rechaza por sesión expirada? [Vacío, Spec §FR-030]
- [ ] CHK012 ¿Están definidos los requisitos de navegación o menú disponible para cada rol dentro de la aplicación? [Vacío, Spec §FR-002, §FR-031]
- [ ] CHK013 ¿Se especifica el orden por defecto del listado de usuarios paginado? [Vacío, Spec §FR-015]
- [ ] CHK014 ¿Están definidos los requisitos de indicación de progreso o estado de carga para las operaciones sujetas al umbral de 5 segundos? [Vacío, Spec §SC-001, §SC-007]
- [ ] CHK015 ¿Se especifica si los formularios de alta y edición de usuario comparten los mismos campos, validaciones y mensajes, o difieren? [Consistencia, Spec §FR-009, §FR-010]
- [ ] CHK016 ¿Están definidos los requisitos de formato y validación del teléfono, y las longitudes máximas de nombre completo y correo? [Vacío, Spec §FR-009, §FR-014]

## Consistencia entre requisitos

- [x] CHK017 ¿Es consistente el escenario "Búsqueda y filtrado de usuarios" con FR-015, que solo define filtros por rol y estado y no una búsqueda por texto? [Conflicto, Spec §FR-015, §HU-09 Escenarios] — **Resuelto 2026-08-15**: FR-015 incorpora la búsqueda por texto sobre nombre completo y correo, combinable con los filtros; nuevos escenarios de búsqueda y SC-021 (Supuesto 14).
- [x] CHK018 ¿Cubre el requisito de mensaje de "sin resultados" también al listado de usuarios de HU-09, o está limitado al panel de HU-10? [Consistencia, Vacío, Spec §FR-022, §FR-015] — **Resuelto 2026-08-15**: FR-015 lo extiende al listado de usuarios; SC-020 lo mide en ambos lugares.
- [x] CHK019 ¿Están definidos requisitos de confirmación previa para las acciones administrativas de impacto (desactivar usuario, cambiar rol, restablecer contraseña), conforme al Principio IX (confirmar antes de actuar)? [Conflicto, Vacío, Spec §FR-011, §FR-012, §FR-026] — **Resuelto 2026-08-15**: nuevo FR-035, escenario Gherkin de cancelación y SC-019.
- [ ] CHK020 ¿Se especifica si las acciones administrativas son reversibles desde la interfaz y cómo se comunica esa reversibilidad al administrador (Principio IX)? [Vacío, Spec §FR-013]
- [ ] CHK021 ¿Son consistentes los requisitos de paginación e indicación de total entre el listado de usuarios (HU-09) y los reportes del panel (HU-10)? [Consistencia, Vacío, Spec §FR-015, §FR-020]
- [ ] CHK022 ¿Es consistente el requisito de que el panel no ofrezca acciones de modificación (FR-021) con que el panel sea la página de inicio del administrador (FR-031), desde la que debe poder llegar a la gestión de usuarios? [Consistencia, Spec §FR-021, §FR-031]

## Cobertura de estados y casos límite de interfaz

- [x] CHK023 ¿Están definidos los requisitos del estado vacío del listado de usuarios cuando un filtro combinado no arroja resultados? [Cobertura, Vacío, Spec §FR-015, §FR-022] — **Resuelto 2026-08-15**: FR-015 y escenario "Filtrado de usuarios sin resultados".
- [ ] CHK024 ¿Se especifica el comportamiento de la interfaz cuando una acción falla por una causa no prevista (error del sistema), y no solo por validación? [Flujo de excepción, Vacío]
- [ ] CHK025 ¿Están definidos los requisitos de la última página del listado paginado cuando el filtro cambia y reduce el total de resultados? [Caso límite, Vacío, Spec §FR-015]
- [ ] CHK026 ¿Se especifica el formato de fecha y hora visible y la zona horaria de referencia para los filtros de rango de fechas del panel? [Ambigüedad, Spec §FR-020]
- [ ] CHK027 ¿Se define si el rango de fechas del reporte es inclusivo en sus extremos y qué ocurre si la fecha inicial es posterior a la final? [Ambigüedad, Caso límite, Spec §FR-020]
- [ ] CHK028 ¿Están definidos los requisitos de presentación del panel cuando las métricas de pedidos aún no existen, por depender de E4/E2? [Cobertura, Vacío, Spec §Entrega por fases, §FR-019]
- [ ] CHK029 ¿Se especifica el comportamiento de la interfaz ante el envío duplicado de un formulario administrativo? [Caso límite, Vacío]

## Requisitos no funcionales de experiencia

- [ ] CHK030 ¿Están especificados requisitos de accesibilidad —navegación por teclado, etiquetado de campos, contraste, compatibilidad con lector de pantalla— para las pantallas de esta épica? [Vacío]
- [ ] CHK031 ¿Se definen requisitos de comportamiento en distintos tamaños de pantalla, dado el supuesto de acceso desde navegador? [Vacío, Spec §Supuestos]
- [ ] CHK032 ¿Se especifican los navegadores o versiones mínimas contempladas en v1? [Vacío, Dependencia]
- [ ] CHK033 ¿Son los umbrales de 5 segundos (SC-001, SC-007) medibles con una definición explícita de "condiciones normales de red"? [Medibilidad, Spec §SC-001, §SC-007]
- [ ] CHK034 ¿Es SC-015 —"el 100 % de las vistas del panel carecen de acciones que modifiquen datos"— verificable con un inventario explícito de las vistas del panel? [Medibilidad, Spec §SC-015, §FR-021]
- [ ] CHK035 ¿Cubre SC-010 la verificación por una persona no técnica de todos los mensajes en español exigidos, incluidos los de bloqueo temporal y sin resultados? [Cobertura, Spec §SC-010, §FR-033, §FR-022]

## Notas

- Marcar los ítems resueltos como `[x]` y anotar el hallazgo o la decisión junto al ítem.
- Los ítems que queden sin resolver DEBEN atenderse actualizando `spec.md` (o declarándose fuera de alcance de v1 en la sección correspondiente) antes de ejecutar `/speckit-plan`.
- Los ítems marcados como `[Conflicto]` tienen prioridad: describen contradicciones entre requisitos ya escritos o con la constitución, no solo omisiones.
