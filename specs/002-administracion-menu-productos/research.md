# Investigación y decisiones: E3 · Administración de menú

Continúa la numeración de `specs/001-acceso-y-usuarios/research.md`, que llegó hasta D-019.
Las decisiones de E1 siguen vigentes y **no se repiten aquí**: sesión con estado (D-001), hash
de contraseñas (D-002), Prisma (D-004), Zod como fuente única (D-005), BFF (D-006),
autorización por rol (D-007), estrategia de pruebas (D-009), normalización de búsqueda (D-011)
y contenedores (D-013) se heredan tal cual.

**El Contexto Técnico del plan no contiene ningún `NEEDS CLARIFICATION`**: el stack está fijado
por E1 y las cinco ambigüedades de producto se resolvieron en `/speckit-clarify` y quedaron
integradas en la spec. Lo que sigue son decisiones de diseño, no incógnitas pendientes.

---

## D-020 · Cómo se modela la taxonomía: enum fijo + tabla administrable

**Decisión**: las **dimensiones** son un enum de PostgreSQL y de TypeScript con dos valores
(`TIPO_COMIDA`, `PERFIL_SALUD`); las **categorías** son filas de una tabla `category` con una
columna `dimension` de ese enum.

**Razón**: es exactamente la asimetría que FR-001 y FR-013 (RN-013) declaran. Las dimensiones
no se crean, editan ni desactivan desde la aplicación porque cada una tiene un desplegable
propio en el alta y un filtro propio en el menú; convertirlas en datos obligaría a generar
formularios y filtros dinámicos, complejidad anticipada sin requisito que la pida. Las
categorías sí cambian sin desplegar código, que es el valor de HU-14.

**Alternativas descartadas**:

- **Tabla `dimension` con filas**: añade una entidad, una pantalla que nadie pidió y la
  posibilidad de que existan cero o tres dimensiones, estados que FR-001 prohíbe.
- **Categorías como enum en el código**: rompe HU-14 entera —un local que empieza a vender
  poke tendría que esperar un despliegue—.

---

## D-021 · Unicidad insensible a acentos y mayúsculas: columna normalizada con índice único

**Decisión**: cada tabla lleva una columna `name_normalized` derivada de
`normalizarBusqueda(name)`, con índice único: `UNIQUE(name_normalized)` en `product` y
`UNIQUE(dimension, name_normalized)` en `category`.

**Razón**: FR-004 y FR-014 exigen que «Ají», «aji» y «AJI» sean el mismo nombre, y que la
unicidad alcance a los registros retirados. Persistir la forma normalizada permite que la
**base de datos** garantice la regla. Una comprobación previa en el servicio no basta: dos
peticiones simultáneas pueden consultar ambas, no encontrar nada y escribir las dos —que es
justamente lo que FR-026 y SC-027 obligan a impedir ante un doble clic—.

Que el índice de `category` incluya la dimensión es lo que permite que «Saludable» exista a la
vez como tipo de comida y como perfil de salud (HU14-E05) y no dos veces dentro de la misma
(HU14-E04): una sola línea de esquema expresa las dos mitades de la regla.

**Consecuencia declarada**: `normalizarBusqueda` alimenta ahora **tres** columnas persistidas
—`user.search_normalized`, `category.name_normalized` y `product.name_normalized`—. Cambiarla
no rompe ninguna compilación y deja los datos calculados con dos versiones distintas: unos
nombres colisionarían y otros no, sin error visible. Toda modificación exige una migración que
repueble las tres.

**Alternativas descartadas**:

- **`citext`**: una extensión de PostgreSQL que resuelve las mayúsculas pero **no los
  acentos**, que es la mitad del requisito. Se descartó por la misma razón que en E1 (D-015).
- **Índice funcional sobre una expresión**: replicaría en SQL la lógica de la función de
  `packages/shared`, creando la segunda implementación que D-011 existe para evitar.

---

## D-022 · Búsqueda por nombre en el listado de administración

**Decisión**: la búsqueda de FR-023 se resuelve con `LIKE` sobre `product.name_normalized`,
aplicando `normalizarBusqueda` y `escaparLike` al término escrito. **No se añade ninguna
columna de búsqueda adicional.**

**Razón**: a diferencia del padrón de usuarios de E1 —que busca sobre nombre *y* correo y por
eso necesitó una columna combinada—, FR-023 acota la búsqueda **al nombre**. La columna que
D-021 ya obliga a mantener sirve para las dos cosas: garantizar la unicidad y encontrar
coincidencias parciales. Añadir una segunda sería mantener dos columnas con el mismo contenido.

**Alternativa descartada**: búsqueda de texto completo de PostgreSQL. Con decenas de productos
no aporta nada sobre `LIKE`, y obliga a decidir configuración de idioma y a mantener un índice
más (Principio I).

---

## D-023 · Derivación de los tramos de precio en SQL

**Decisión**: los dos precios de corte se obtienen con dos consultas sobre los productos
activos, usando `ORDER BY price ASC, id ASC` con `OFFSET`:

- `c1` = el precio en la posición `techo(n/3)` → `OFFSET techo(n/3) - 1 LIMIT 1`
- `c2` = el precio en la posición `techo(2n/3)` → `OFFSET techo(2n/3) - 1 LIMIT 1`

Con `n < 3`, o cuando `c1 = c2 = ` el precio máximo por ser todos iguales, no hay tramos y
ninguna intención de precio descarta productos. El filtro final compara el precio del producto
contra `c1` y `c2`, nunca su posición en la lista.

**Razón**: traduce literalmente el algoritmo de FR-032, que la spec declara paso a paso. Que
la clasificación dependa **solo del valor** y no de la posición es lo que garantiza que dos
productos con el mismo precio caigan siempre en el mismo tramo, sin importar el orden en que
se listen (§ Casos Límite). El coste es de dos consultas indexadas por `price`, sobre un
conjunto de decenas de filas.

**Alternativas descartadas**:

- **`percentile_cont` / funciones de ventana**: interpolan entre valores y devolverían un corte
  que **no es el precio de ningún producto**, lo que rompe el empate en el borde que la spec
  exige resolver de forma estable.
- **Cargar todos los precios en memoria y ordenarlos en el proceso**: más código para el mismo
  resultado, y peor comportamiento a medida que el catálogo crece.
- **Persistir el tramo en una columna**: descartado por la propia spec —envejece con la
  inflación y obliga a recalcular todo el catálogo cada vez que cambia un precio—.

---

## D-024 · La clasificación son dos columnas obligatorias, no una tabla de unión

**Decisión**: `product` tiene dos claves foráneas **no nulas** a `category`:
`food_type_category_id` y `health_profile_category_id`.

**Razón**: RN-011 exige exactamente una categoría por dimensión en todo producto activo. Con
dos columnas obligatorias, los estados que la regla prohíbe —ninguna categoría, dos de la misma
dimensión— son **irrepresentables**: no hay forma de escribirlos en la base. Con una tabla de
unión habría que añadir una restricción de cardinalidad por dimensión, más código para permitir
un estado que la spec veta.

**Contrapartida asumida**: añadir una tercera dimensión en el futuro sería una migración con
una columna nueva, no una fila nueva. Es coherente con FR-001, que declara las dimensiones
fijas en v1, y con el Principio I: el diseño flexible solo se paga cuando hay un requisito que
lo pida.

**Cómo se garantiza que la categoría sea de la dimensión correcta**: la base de datos no puede
expresarlo con una clave foránea simple. Lo comprueba el servicio al escribir, y hay una
batería de integración que intenta guardar un producto cuyo `food_type_category_id` apunta a
una categoría de perfil de salud y espera el rechazo.

---

## D-025 · Validación de la descripción: un esquema Zod compartido

**Decisión**: un esquema `DescripcionSchema(minimo, obtenerNombre)` en
`packages/shared/src/schemas/description.ts` aplica, en este orden: recorte de espacios,
mínimo y máximo de caracteres, y las tres condiciones de sustancia de FR-039 —cinco palabras de
dos o más caracteres, cinco palabras **distintas**, y no ser una repetición del nombre en forma
normalizada—. Cada condición produce su propio mensaje, y el error va asociado al campo.

**Razón**: es la aplicación directa del Principio de validación única que E1 estableció en
D-005. El formulario del navegador y el controlador de NestJS ejecutan el mismo código, de modo
que no puede existir una descripción que la interfaz acepte y la API rechace, ni al revés.
Comparar con el nombre exige que el esquema vea los dos campos, por eso se valida a nivel del
objeto y no del campo suelto.

**Alternativa descartada**: validar la sustancia solo en el backend. Dejaría al negocio
descubrir el rechazo tras enviar el formulario, cuando el mismo código puede avisarle mientras
escribe.

---

## D-026 · El precio es un entero en pesos chilenos

**Decisión**: columna `price` de tipo `integer`, con restricción de comprobación
`price >= 1 AND price <= 10000000`. Ni `decimal`, ni `money`, ni céntimos.

**Razón**: RN-006 y FR-015 declaran el precio como entero mayor que cero sin decimales, que es
como funciona el peso chileno. Un tipo decimal invitaría a guardar `4990.00` y a que alguien
redondeara en silencio, precisamente lo que FR-015 prohíbe. La restricción en la base es la
segunda línea de defensa tras el esquema Zod: garantiza que ninguna vía de escritura —una
migración, la semilla, una consulta a mano— pueda dejar un precio inválido.

**Alternativa descartada**: `numeric(12,2)`. Añade decimales que el dominio no tiene y obliga a
decidir el redondeo en cada operación.

---

## D-027 · Desactivar una categoría: conteo y transacción

**Decisión**: la desactivación cuenta, **dentro de la misma transacción** que aplica el cambio,
los productos activos que dependen de esa categoría en la dimensión correspondiente. Si el
conteo es mayor que cero, la transacción se deshace y la respuesta incluye el número.

**Razón**: FR-007 exige impedirlo y decir **cuántos** productos lo bloquean, y precisa que la
comprobación se haga «en el momento de aplicar la desactivación, no solo al pintar la
pantalla». Contar fuera de la transacción permitiría que un producto se diera de alta entre el
conteo y la escritura, dejando una categoría desactivada de la que depende un producto activo
—el estado que RN-011 y FR-011 existen para evitar—.

**Alternativa descartada**: una restricción declarativa en la base. PostgreSQL no puede
expresar «no desactives esta fila si otras filas la referencian y están activas» sin un
disparador, que sería lógica de negocio escondida en la base y difícil de leer en una revisión
de código (Principio IV, por analogía).

---

## D-028 · Semilla del catálogo, idempotente por nombre normalizado

**Decisión**: la semilla busca cada registro por su `name_normalized` —y por
`(dimension, name_normalized)` en las categorías—. Si existe, **no lo toca**; si no existe, lo
crea. Se ejecuta con `pnpm --filter api db:seed`, junto a la semilla del administrador de E1.

**Razón**: FR-036 exige idempotencia y que no se sobrescriban cambios hechos a mano, y la
propia spec fijó el criterio de reconocimiento tras el checklist de contenido. Reconocer por
nombre normalizado y no por identificador es lo que permite reejecutarla sobre una base donde
alguien ya cargó el catálogo real sin duplicar «Pizza Napolitana» junto a «pizza napolitana».

**Contrapartida asumida**: si el negocio **renombra** un producto de la semilla, la siguiente
ejecución lo vuelve a crear con el nombre original, y quedan dos. Se acepta porque la
alternativa —seguir el registro por un identificador estable de semilla— exigiría una columna
que solo sirve para eso, y porque reejecutar la semilla sobre un catálogo ya editado no es un
flujo previsto: es una herramienta de arranque y de demostración.

---

## D-029 · El menú se sirve en una sola consulta, sin paginación

**Decisión**: `GET /menu/products` devuelve todos los productos activos que cumplen los filtros,
sin `page` ni `pageSize`. La respuesta es una lista, no la forma `Paginated<T>` que E1
definió.

**Razón**: es la primera clarificación de la spec, ya integrada en FR-031. Devolver una forma
paginada con una sola página sería mentir sobre el contrato para que se pareciera al de
administración. Los tramos de precio se calculan sobre el catálogo activo completo, nunca sobre
lo devuelto, de modo que la ausencia de paginación no afecta a D-023.

**Consecuencia**: `SC-030` acota el compromiso —cincuenta productos en menos de cinco
segundos—, y ahí termina la garantía. Un catálogo mucho mayor sería un requisito nuevo con su
propia decisión.

---

## D-030 · El formato del precio vive en `packages/shared`

**Decisión**: una función `formatearPrecio(valor: number): string` devuelve `"$4.990"` —símbolo
de peso, punto de miles, sin decimales—. Es la única fuente del formato; ninguna pantalla lo
compone a mano.

**Razón**: § Presentación del precio de la spec lo exige, con el mismo criterio con que E1
centralizó el formato de fechas. Un precio escrito de dos formas en dos pantallas del mismo
producto es un defecto visible, y la inconsistencia se heredaría en los totales de E2.

**Detalle de implementación**: se usa `Intl.NumberFormat` con configuración regional de Chile y
sin decimales, no una construcción manual con expresiones regulares. La entrada del formulario
**no** aplica el formato mientras se escribe: el campo recibe el entero desnudo, tal como
FR-015 lo define.

---

## D-031 · Pruebas: qué va a unitarios y qué exige integración

**Decisión**: se hereda D-009 de E1 y se reparte así el material nuevo.

| Comprobación | Capa | Por qué |
|---|---|---|
| Mínimo y máximo de caracteres, las tres condiciones de FR-039, precio entero y en rango, forma de los esquemas | Unitaria, en `packages/shared` | Es lógica pura sin base de datos |
| `formatearPrecio` y las etiquetas de estado | Unitaria | Ídem |
| Derivación de tramos ante catálogos de 0, 1, 2, 3 y n productos, precios iguales y empate en el borde | Integración | Depende del orden y del conteo reales que devuelve PostgreSQL |
| Unicidad normalizada, incluidos los registros retirados, y doble envío simultáneo | Integración | Solo el índice único de la base lo garantiza (D-021) |
| Conteo de bloqueadores y atomicidad de la desactivación | Integración | Es una transacción (D-027) |
| Un producto no ofrecible nunca sale de ninguna consulta | Integración | RN-018 es una propiedad de la consulta, no de una función |
| Bloqueo por rol al procesar, no al pintar | Integración | SC-021 exige comprobarlo sin interfaz |
| Idempotencia de la semilla | Integración | Se ejecuta dos veces contra una base real |

Los umbrales de cobertura ya configurados siguen rigiendo; ninguna de las capas nuevas los
relaja.

---

## D-032 · La ficha de producto y su respuesta ante un producto no activo

**Decisión**: `GET /menu/products/:id` devuelve `404 NOT_FOUND` cuando el producto no existe
**o no está activo**, con el mismo cuerpo en los dos casos. La pantalla `/menu/[id]` muestra la
página de «no encontrado» en español.

**Razón**: FR-028 exige que un producto dado de baja no aparezca «por ningún medio», incluido
el acceso directo por su dirección, y FR-034 lo declara desde la clarificación. Responder algo
distinto —un `403`, o un `404` con un mensaje que diga «este producto fue dado de baja»—
revelaría que el identificador existe, que es exactamente lo que la regla evita.

**Nota**: un producto **agotado** sí tiene ficha visible. Agotado es activo con
`disponible = false`: se muestra marcado y sin ninguna acción para pedirlo (FR-029).

---

## D-033 · La descripción es párrafo plano, y en los listados se recorta

**Decisión**: el esquema de descripción **colapsa** saltos de línea, tabulaciones y espacios
repetidos a un solo espacio antes de validar y de guardar; en los dos listados, la descripción
se muestra recortada a **160 caracteres** con `recortarDescripcion` de `packages/shared`, y
completa en la ficha y en los formularios.

**Razón**: son las dos enmiendas que cerraron los ítems CHK005 y CHK035 del checklist de
contenido, y cada una evita que la implementación improvise. Colapsar hace que un salto de
línea separe palabras a efectos de FR-039 —si no, «rica\nrica\nrica\nrica\nrica» podría contarse
como una sola palabra o como cinco según cómo se parta la cadena— y que lo que E6 lea sea prosa
continua, no un texto con estructura que nadie declaró. Recortar es necesario porque el menú del
cliente **no se pagina** (D-029): doce descripciones de 1.000 caracteres seguidas dejarían el
final del catálogo fuera de alcance con el desplazamiento.

Que el recorte viva en `packages/shared` y no en cada listado es el mismo criterio de D-030 con
el precio: dos listados que recortan distinto son un defecto visible. Y que sea **solo
presentación** es lo que mantiene intactos el filtro y la búsqueda, que siguen operando sobre el
texto completo.

**Alternativas descartadas**:

- **Conservar los saltos**: obligaría a decidir cómo se pinta el texto multilínea en el listado
  y en la ficha, y abriría el caso de una descripción que cumple 20 caracteres con veinte saltos
  de línea. Ninguna historia pide formato en la descripción.
- **Ocultar la descripción del listado**: dejaría al cliente eligiendo solo por nombre y precio,
  cuando FR-034 declara que la descripción es lo que le permite decidir sin fotografías.
- **Un control para desplegarla en el listado**: un mecanismo de interfaz más para un catálogo
  de decenas de productos que ya tiene la ficha para eso (Principio I).

---

## Trazabilidad de las decisiones

| Decisión | Requisitos que la originan |
|---|---|
| D-020 · Enum fijo + tabla administrable | FR-001, FR-002, RN-013 |
| D-021 · Columna normalizada con índice único | FR-004, FR-014, RN-005, RN-014, SC-014, SC-027 |
| D-022 · Búsqueda por `LIKE` sobre la columna normalizada | FR-023, SC-024 |
| D-023 · Cortes de precio en SQL | FR-032, RN-016, SC-016, SC-017 |
| D-024 · Dos columnas de clasificación | FR-012, RN-011, RN-012 |
| D-025 · Esquema de descripción compartido | FR-003, FR-016, FR-039, SC-031 |
| D-026 · Precio entero con restricción | FR-015, RN-006, SC-012 |
| D-027 · Conteo dentro de la transacción | FR-007, RN-015, SC-015 |
| D-028 · Semilla idempotente por nombre normalizado | FR-036, SC-026, SC-032 |
| D-029 · Menú sin paginación | FR-031, SC-030 |
| D-030 · Formato del precio en `shared` | § Presentación del precio, FR-015 |
| D-031 · Reparto de las capas de prueba | Principio XI, SC-004, SC-021 |
| D-032 · `404` para el producto no activo | FR-028, FR-034, SC-005 |
| D-033 · Párrafo plano y recorte en listados | § Límites de los campos, § Presentación de la descripción en los listados, FR-023, FR-031, FR-039 |

## Costos asumidos

- **Renombrar un producto de la semilla y reejecutarla deja dos filas** (D-028).
- **Añadir una tercera dimensión sería una migración, no una fila** (D-024).
- **El compromiso de rendimiento termina en cincuenta productos** (D-029).
- **`normalizarBusqueda` es ahora más cara de cambiar**: tres columnas que repoblar (D-021).

## Resumen de versiones

Ninguna. E3 no incorpora ninguna dependencia nueva ni cambia la versión de ninguna existente;
el inventario vigente es el de `specs/001-acceso-y-usuarios/research.md` § Resumen de
versiones.
