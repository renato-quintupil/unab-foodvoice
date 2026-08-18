# Logica de Negocio Checklist: E2 · Gestión de pedidos

**Purpose**: Validar la calidad de los requisitos en cuatro áreas de riesgo de E2 — concurrencia/atomicidad, carrito y snapshots de precio/catálogo, direcciones de entrega, y máquina de estados/bandeja del negocio — antes de pasar a planificación o revisión de PR.
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)
**Depth**: Estándar (revisión de PR)

## Concurrencia y atomicidad

- [x] CHK001 - ¿Está especificado qué acción "gana" cuando dos confirmaciones del mismo carrito ocurren a la vez, o se declara explícitamente que el ganador es indeterminado? [Clarity, Spec §FR-036, Supuesto 7]
- [x] CHK002 - ¿Define la spec el mensaje o comportamiento observable que recibe la acción perdedora en una carrera de aceptar/rechazar simultáneos? [Completeness, Spec §FR-036]
- [x] CHK003 - ¿Es medible/verificable el requisito de atomicidad entre el cambio de estado del pedido y su entrada de historial (FR-044), o depende de una noción no operacionalizada de "único resultado indivisible"? [Measurability, Spec §FR-044]
- [x] CHK004 - ¿Se especifica qué ocurre con el carrito del cliente si la confirmación falla a mitad de camino (p. ej. se crea el pedido pero falla el vaciado del carrito)? [Edge Case, Gap]
- [x] CHK005 - ¿Son consistentes entre sí los requisitos de concurrencia del carrito (FR-036, dos confirmaciones) y los de concurrencia del pedido (FR-036, aceptar/rechazar), o exigen mecanismos distintos sin decirlo? [Consistency, Spec §FR-036]
- [x] CHK006 - ¿Está definido el criterio para decidir cuál de dos confirmaciones concurrentes del mismo carrito se considera la "ganadora" (orden de llegada, primera en persistir, etc.), o se deja deliberadamente sin definir? [Ambiguity, Spec §FR-036, Escenario HU01-E19]
- [ ] CHK007 - ¿Cubre la spec el caso de una acción que pierde la carrera pero cuyo efecto parcial ya fue visible al usuario antes de fallar (p. ej. una pantalla que mostró "pedido creado" y luego debe revertirse)? [Edge Case, Gap]

## Carrito y snapshot de precios/catálogo

- [x] CHK008 - ¿Especifica la spec qué exactamente dispara la revalidación de precio al confirmar — comparación contra "el último precio presentado", y está definido qué pasa si el cliente nunca recargó el carrito antes de confirmar? [Clarity, Spec §FR-028]
- [ ] CHK009 - ¿Está definido el comportamiento cuando cambian simultáneamente el precio y la disponibilidad (se agota) del mismo producto entre que el cliente revisa y confirma? [Edge Case, Gap]
- [x] CHK010 - ¿Son consistentes los requisitos de "no crear pedido" ante cambio de precio (FR-028) con los de "no crear pedido" ante producto agotado/dado de baja (FR-002, FR-007), en cuanto al mensaje y la actualización del carrito que reciben ambos casos? [Consistency, Spec §FR-002, §FR-007, §FR-028]
- [ ] CHK011 - ¿Cuantifica la spec qué significa "recalculado en cada carga" del precio del carrito (FR-006) — en cada apertura de pantalla, en cada acción del usuario, con qué frecuencia si el carrito queda abierto largo tiempo? [Clarity, Spec §FR-006]
- [x] CHK012 - ¿Define la spec el comportamiento cuando el mismo producto cambia de precio más de una vez entre revisiones sucesivas del cliente (múltiples ciclos de "actualizar y volver a confirmar")? [Coverage, Edge Case]
- [ ] CHK013 - ¿Está especificado si la suma de cantidades al agregar un producto repetido (FR-004) tiene algún límite superior, o se declara explícitamente sin tope? [Completeness, Gap]
- [x] CHK014 - ¿Son medibles y verificables por separado los criterios de éxito SC-002 (nombre/precio de línea) y SC-003 (dirección), o dependen de la misma validación combinada sin distinguir qué prueba cada uno? [Measurability, Spec §SC-002, §SC-003]
- [x] CHK015 - ¿Especifica la spec qué le ocurre a una línea de carrito marcada como no disponible (FR-007) si el cliente nunca la revisa ni la quita — queda bloqueando la confirmación indefinidamente sin ningún otro efecto? [Edge Case, Spec §FR-007]

## Direcciones de entrega (HU-11)

- [ ] CHK016 - ¿Está definido el criterio exacto de normalización usado para comparar etiquetas de dirección (FR-014) más allá de la referencia a `normalizarBusqueda`, de forma que sea verificable sin leer el código? [Clarity, Spec §FR-014]
- [x] CHK017 - ¿Se especifica qué ocurre si el cliente edita la etiqueta de una dirección guardada a un valor que, normalizado, colisiona con otra etiqueta ya existente? [Edge Case, Gap]
- [ ] CHK018 - ¿Son consistentes los límites de longitud del texto de dirección y de la etiqueta (Supuesto 2) con los requisitos funcionales correspondientes (FR-012, FR-013), o los rangos solo aparecen en Supuestos sin reflejarse como requisito verificable? [Consistency, Spec §FR-012, §FR-013, Supuesto 2]
- [ ] CHK019 - ¿Define la spec qué ocurre si el cliente intenta marcar como predeterminada una dirección que está desactivada? [Edge Case, Gap]
- [ ] CHK020 - ¿Es medible el requisito de que "exactamente una" dirección activa sea predeterminada en todo momento (FR-015) frente a operaciones concurrentes sobre las direcciones del mismo cliente (dos pestañas cambiando predeterminada a la vez)? [Measurability, Spec §FR-015]
- [ ] CHK021 - ¿Especifica la spec el mensaje o resultado cuando el cliente intenta eliminar (no desactivar) una dirección que sí fue usada en algún pedido? [Gap, Spec §FR-019]
- [ ] CHK022 - ¿Están definidos los requisitos de dirección puntual (FR-017) de forma consistente con los límites de longitud y validación de texto en blanco que aplican a las direcciones guardadas (FR-013)? [Consistency, Spec §FR-013, §FR-017]

## Máquina de estados y bandeja del negocio

- [x] CHK023 - ¿Especifica la spec el comportamiento exacto cuando el negocio intenta aceptar y rechazar el mismo pedido en momentos distintos pero muy cercanos (no estrictamente simultáneos), más allá del caso de carrera concurrente? [Edge Case, Gap]
- [ ] CHK024 - ¿Es verificable de forma objetiva el criterio de "orden estable" de la bandeja paginada (FR-041) cuando dos pedidos se crean en el mismo instante o con timestamps iguales? [Measurability, Spec §FR-041]
- [ ] CHK025 - ¿Define la spec qué pasa con la posición de un pedido en la paginación de la bandeja si otro pedido cambia de estado (sale de `creado`) mientras el negocio navega entre páginas? [Edge Case, Gap]
- [x] CHK026 - ¿Son consistentes los requisitos de visibilidad de la bandeja del negocio (FR-038: pedidos `creado` y `en_preparacion`) con la paginación descrita (FR-041: solo pendientes `creado`), en cuanto a si `en_preparacion` también se pagina? [Consistency, Spec §FR-038, §FR-041]
- [ ] CHK027 - ¿Está especificado si existe algún límite de longitud para el motivo de rechazo consistente entre el requisito funcional (FR-033) y el supuesto de longitud (Supuesto 2, 10–500 caracteres)? [Consistency, Spec §FR-033, Supuesto 2]
- [ ] CHK028 - ¿Define la spec qué etiqueta o comportamiento ve el cliente para estados de épicas futuras que aún no existen (FR-037 menciona "etiquetas de estados de épicas futuras cuando existan"), o queda como referencia sin criterio de aceptación propio de E2? [Ambiguity, Spec §FR-037]
- [x] CHK029 - ¿Es medible el criterio "2 clics o menos" para aceptar/rechazar un pedido (SC-005) frente a la exigencia simultánea de motivo obligatorio para el rechazo (FR-033), que requiere al menos un campo de texto adicional? [Consistency, Spec §SC-005, §FR-033]
- [x] CHK030 - ¿Especifica la spec qué ve el negocio si intenta actuar sobre un pedido que cambió de estado (por otra acción concurrente) entre que cargó la bandeja y que pulsó aceptar/rechazar, más allá del mensaje genérico de FR-036? [Coverage, Spec §FR-036]

## Dependencias y supuestos

- [x] CHK031 - ¿Está validado o al menos declarado como riesgo el supuesto de que "cuál gana no está definido" en concurrencia (Supuesto 7) es aceptable para los criterios de éxito medibles que dependen de un resultado determinista (SC-012)? [Assumption, Spec §Supuesto 7, §SC-012]
- [ ] CHK032 - ¿Documenta la spec la dependencia hacia la función `normalizarBusqueda` de `packages/shared` con suficiente detalle para que un requisito (FR-014) sea verificable sin acceder al código fuente de esa función? [Dependency, Spec §FR-014]

## Notes

Revisión hecha a mano contra `spec.md` el 2026-08-17: 12/32 pasan, 20 abiertos.

**Actualización 2026-08-17 (post `/speckit-clarify` + `/speckit-analyze`)**: se resolvieron los 5 ítems de mayor riesgo mediante una sesión de clarificación (ver `## Clarifications` en `spec.md`). Un `/speckit-analyze` posterior detectó que dos de las cinco respuestas contradecían el diseño ya construido en `plan.md`/`data-model.md`/`tasks.md`/`contracts/api.md`/`quickstart.md`; se corrigieron para alinearse con ese diseño existente en vez de reabrirlo. Ahora **17/32 pasan**:

- **CHK026** (resuelto): FR-038 y FR-041 quedan alineados con D-043 — la bandeja pagina de a 20 sobre `creado` y `en_preparacion` combinados, con filtro opcional por estado (no dos listas separadas, corregido tras detectar la contradicción con `data-model.md`/`tasks.md`).
- **CHK029** (resuelto): SC-005 ("2 clics o menos") aplica a aceptar y a rechazar por igual, sin contar la escritura del motivo como clic (alineado con quickstart.md V-26 y tasks.md T097, corregido tras detectar la contradicción).
- **CHK004** (resuelto): FR-044 ahora incluye el vaciado del carrito dentro de la misma operación atómica que la creación del pedido y su historial — coincide con el paso 8 de `contracts/api.md`.
- **CHK008** (resuelto): FR-028 aclara que el precio de referencia es el que el carrito mostró en su última carga (alineado con D-036), revalidado igualmente contra el precio vigente dentro de la transacción.
- **CHK017** (resuelto): FR-016 ahora exige revalidar unicidad de etiqueta (FR-014) también al editar, no solo al crear — coincide con `409 ADDRESS_LABEL_ALREADY_EXISTS` ya documentado en `contracts/api.md` para `PATCH /addresses/:id`; se agregó el caso correspondiente a T049 en `tasks.md`.

Los 15 ítems que siguen abiertos son de menor impacto y quedan diferidos (no bloquean `/speckit-plan`):

- **CHK018 / CHK027 (mismo patrón)**: los límites de longitud (dirección, etiqueta, motivo de rechazo) solo aparecen en "Supuestos" (10–500, 2–60 caracteres) y no están repetidos como texto verificable dentro de los FR correspondientes (FR-012, FR-013, FR-033). Fácil de arreglar: citar los rangos directamente en el FR.
- **CHK016 / CHK032 (mismo patrón)**: la unicidad de etiquetas depende de `normalizarBusqueda`, una función externa a la spec; el criterio de normalización (tildes, mayúsculas, espacios) no está descrito en texto dentro de `spec.md`, solo por referencia.
- **CHK007, CHK009, CHK019, CHK021, CHK024, CHK025**: casos límite de segundo orden (combinaciones de dos condiciones a la vez, o interacción entre paginación y cambios concurrentes) que no están cubiertos ni declarados fuera de alcance.
- **CHK011, CHK013, CHK020, CHK022, CHK028**: ambigüedades de redacción menores — términos como "cada carga", el límite de cantidad, o el comportamiento de la dirección puntual frente a los límites de FR-013 no están del todo cuantificados.

Ninguno de los 15 bloquea el paso a planificación; son refinamientos de redacción o casos límite de baja probabilidad, no contradicciones.
