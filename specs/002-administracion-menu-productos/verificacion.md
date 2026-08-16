# Registro de verificación: E3 · Administración de menú

**Fecha**: 2026-08-16 · **Ejecutado sobre**: `api` y `web` en modo desarrollo
contra PostgreSQL 16 en contenedor, con la semilla del catálogo cargada y
usuarios de los cuatro roles.

Este documento recoge el resultado de las tareas de verificación de la Fase 6
(T079 a T084). **Distingue lo comprobado de lo pendiente**, con el mismo criterio
que E1: una tabla que no lo hiciera convertiría «no se verificó» en «se verificó
y salió bien».

**Estado al 2026-08-16: los 56 pasos de la guía funcional están ejecutados y no
queda ninguno pendiente.** Lo único que sigue fuera es lo que la propia spec
excluye de v1 —la auditoría formal de accesibilidad y las pruebas con lectores de
pantalla reales (FR-039 de E1)— y la mitad de SC-023 que depende de que existan
pedidos, es decir de E2.

**La validación no fue un trámite: encontró dos defectos reales** que ninguna de
las 572 pruebas automáticas detectaba, y los dos estaban en la parte de la épica
que más confianza daba. Están descritos abajo, con su corrección.

---

## Resumen

| Tarea | Qué exige | Estado |
|---|---|---|
| T079 | Vocabulario de § Vocabulario visible del catálogo en las ocho pantallas | ✅ Auditado sobre el texto visible y recorrido en pantalla |
| T080 | Recorrer y operar solo con teclado, diálogos incluidos | ✅ Ejecutado · el diálogo de baja se confirma con Tab + Enter |
| T081 | Comprobar a 360 píxeles de ancho | ✅ Las cinco pantallas, sin desborde horizontal |
| T082 | Las cinco comprobaciones automáticas | ✅ Cuatro en verde · `build` con la nota de Windows de E1 |
| T083 | Cronometrar con 50 productos activos | ✅ Máximo 1,91 s de los cinco casos medidos |
| T084 | Los 56 pasos de la guía funcional | ✅ **Ejecutados** · dos hallazgos, ambos corregidos |
| T085 | Este registro | ✅ |
| T086 | `CLAUDE.md` y `specs/README.md` | ✅ |

---

## Los dos defectos que encontró la validación

Se registran con detalle porque son la razón de ser de esta fase, y porque los
dos comparten la misma forma: **cada pieza funcionaba por separado y aun así el
usuario no veía lo que la spec le promete**. Ninguna prueba automática los
detectaba, porque todas montaban el componente aislado.

### 1 · Dar de baja era la única acción que no confirmaba nada (FR-025)

**Qué pasaba.** La confirmación de éxito se pintaba **dentro de la fila** del
producto. Al dar de baja, el listado se refresca y la fila desaparece —la vista
por omisión solo muestra los activos (supuesto 20)—, así que el aviso se
desmontaba en el mismo instante en que aparecía. El producto se esfumaba de la
pantalla sin decir por qué.

La ironía es que le tocaba justo a la acción **más delicada** de la épica: la
única que exige confirmación explícita por ser la que cambia lo que el cliente ve
(FR-020). Agotar y reponer, que sí conservaban su fila, mostraban su aviso sin
problema, y eso hacía el defecto aún menos visible en una revisión de código.

**Corrección.** Se añadió `apps/web/src/components/avisos-catalogo.tsx`: un
proveedor montado **por encima del listado**, donde el aviso no se desmonta al
refrescarse los datos. Las filas publican allí el éxito de las acciones que las
hacen desaparecer, en lugar de pintarlo. Fuera de un proveedor el comportamiento
no cambia, que es lo correcto para los formularios de página completa.

Cubierto ahora por la prueba «la confirmación de la baja sobrevive a que la fila
desaparezca» de `apps/web/tests/productos.test.tsx`, que desmonta la fila a
propósito.

### 2 · El rechazo de la reactivación se anunciaba dos veces (FR-021, FR-037)

**Qué pasaba.** `AccionesFila` guardaba **un solo** estado de aviso y lo pasaba a
la vez al diálogo de confirmación y al bloque de la fila. Un `409
CATEGORY_INACTIVE` al reactivar aparecía por duplicado, con dos `role="alert"`
idénticos: un lector de pantalla lo habría leído dos veces seguidas.

**Corrección.** Dos estados separados —uno para el diálogo, otro para la fila—,
porque son dos sitios con dos públicos distintos: el del diálogo acompaña a lo
que la persona acaba de intentar; el de la fila sirve a agotar y reponer, que no
tienen diálogo. Cubierto por la prueba «el rechazo del diálogo no se duplica
debajo de la fila».

---

## T082 · Comprobaciones automáticas

Ejecutadas con `--force`, es decir **con la caché de Turborepo deshabilitada**:
un resultado en verde recuperado de la caché sería una afirmación sobre una
ejecución pasada, no sobre el código de ahora.

| Orden | Resultado |
|---|---|
| `pnpm test` | ✅ **439 pruebas** · `shared` 100 %, `api` 93,3 %, `web` 87,4 % |
| `pnpm test:integration` | ✅ **434 pruebas, 38 baterías**, contra PostgreSQL real |
| `pnpm lint` | ✅ sin avisos |
| `pnpm typecheck` | ✅ los tres paquetes |
| `pnpm build` | ⚠️ ver la nota de Windows, heredada de E1 |

**Nota sobre `pnpm build` en Windows.** Es exactamente la misma de E1 y no ha
cambiado: `apps/web` **compila correctamente** —«Compiled successfully», tipos
válidos, las cuatro páginas estáticas generadas— y falla al final, al copiar la
salida `standalone`, porque Windows no permite crear enlaces simbólicos sin el
modo de desarrollador activado. No es un defecto del código: la misma orden
dentro del contenedor Linux termina bien.

### El reparto de cobertura que E3 añadió

`services/api/jest.config.js` excluye del recuento unitario
`categories.service`, `categories.controller`, `products.service`,
`products.controller` y `menu/**`, con el mismo criterio con que E1 excluía
`auth.service` y `users.controller` (D-031): lo que hay que verificar en ellos
—la unicidad normalizada, el conteo de bloqueadores dentro de la transacción, la
atomicidad de la desactivación y que un producto no ofrecible no salga de ninguna
consulta— son **garantías del motor**, y un doble de prueba probaría el doble, no
la regla. Su verificación es enteramente de integración y está en las 38
baterías.

Lo que sí es lógica pura tiene sus unitarios: los esquemas y el formato en
`packages/shared`, y la clasificación por tramo en `products/price-tier.spec.ts`.

También se actualizó `services/api/src/common/errors.spec.ts`, que afirmaba que
el catálogo cerrado tenía once códigos: ahora son **quince**, con los cuatro que
E3 declara en `contracts/api.md`.

---

## T084 · Guía funcional · sección A · Clasificación (V-01 a V-12)

| Paso | Resultado |
|---|---|
| V-01 | ✅ «Postres» creada, activa de inmediato; aparece en el alta y en el filtro del cliente |
| V-02 | ✅ Creación y clasificación en segundos, sin intervención técnica (SC-009) |
| V-03 | ✅ Vacía → «La descripción es obligatoria.»; 18 caracteres → «debe tener al menos 30 caracteres». Ambos **junto al campo**, con `aria-describedby` |
| V-04 | ✅ Las dos rechazadas, nombrando la condición: «repite las mismas palabras. Necesita al menos cinco palabras distintas» |
| V-05 | ✅ Ejemplo y explicación visibles **sin escribir nada**, antes del campo (SC-019) |
| V-06 | ✅ «postres» rechazado con `aria-invalid="true"` sobre el campo del nombre |
| V-07 | ✅ «Saludable» aceptada en Tipo de comida existiendo ya en Perfil de salud |
| V-08 | ✅ Solo «Crear categoría», «Editar» y «Desactivar». **Ninguna acción de borrado**, por ningún camino (SC-006) |
| V-09 | ✅ «No puedes desactivar esta categoría: **4 productos activos** la tienen como su única clasificación» (SC-015) |
| V-10 | ✅ Desaparece de `/menu/categories` y del alta; sigue en la administración marcada «Desactivada» |
| V-11 | ✅ «Se reactivó la categoría Postres.», con nombre y descripción intactos |
| V-12 | ✅ **No hay ningún control** para la dimensión: se muestra como «Tipo de comida · no se puede cambiar» |

## Sección B · Productos (V-13 a V-31)

| Paso | Resultado |
|---|---|
| V-13 | ✅ **2,3 segundos** desde el formulario vacío hasta verlo en el menú del cliente (SC-001, muy por debajo de 3 minutos) |
| V-14 | ✅ `active: true, available: true, status: DISPONIBLE` sin ninguna acción adicional |
| V-15 | ✅ «pizza de prueba» rechazado junto al campo del nombre, conservando lo escrito |
| V-16 | ✅ El nombre de un producto dado de baja **sigue reservado**: `409 PRODUCT_NAME_ALREADY_EXISTS` |
| V-17 | ✅ `0`, `-100`, `4990,50` y `abc` rechazados junto al campo. `4990.50` → «El precio no puede tener decimales», **sin redondear** (SC-012) |
| V-18 | ✅ «Debes seleccionar un tipo de comida.», asociado a ese campo |
| V-19 | ✅ Un desplegable por dimensión, `multiple = false`, poblado solo con categorías activas de **su** dimensión |
| V-20 | ✅ Sin categorías activas de Perfil de salud: lo explica en español, ofrece «Crear la primera categoría» y **no muestra formulario** |
| V-21 | ✅ «Marcar agotado» en **1 clic** desde el listado, sin diálogo (SC-002) |
| V-22 | ✅ El cliente lo ve marcado «Agotado», sin ningún control ni acción para pedirlo (SC-004) |
| V-23 | ✅ «Se repuso Pizza De Prueba.»; vuelve a `DISPONIBLE` en el menú |
| V-24 | ✅ Diálogo cancelable —Escape lo cierra sin efecto—; desaparece del menú y sigue en la administración |
| V-25 | ✅ Reactivado con todos sus datos intactos |
| V-26 | ✅ Bloqueado, **nombrando la dimensión**: «La categoría de **Tipo de comida** de este producto está desactivada», con enlace «Reclasificar» (SC-010) |
| V-27 | ✅ Reclasificado: aparece bajo la nueva categoría y deja de aparecer bajo la anterior |
| V-28 | ✅ Con 24 productos: «24 resultados», 20 filas y «Página 1 de 2» |
| V-29 | ✅ «sandwich chac» —minúsculas, sin acento— encuentra «Sándwich Chacarero» |
| V-30 | ✅ Sin filtros solo aparecen los activos; el filtro de estado recupera los dados de baja en un clic |
| V-31 | ✅ Dos envíos simultáneos → `201` y `409`, **una sola fila** (SC-027) |

## Sección C · Consulta del menú (V-32 a V-42)

| Paso | Resultado |
|---|---|
| V-32 | ✅ Solo las cuatro pizzas activas; los agotados salen marcados |
| V-33 | ✅ «Saludable» (5) ∩ «Económico» (5) → **2 productos**. Conjuntivo, sin sustituir por los que cumplen solo una condición |
| V-34 | ✅ Con $2.000, $5.000 y $12.000: económico devuelve el de $2.000 y no el de $12.000 |
| V-35 | ✅ Tras dar de alta tres más baratos, el que era económico pasó a **medio sin que nadie lo editara** (SC-016) |
| V-36 | ✅ Con dos activos, `priceTiers: null` y **ningún tramo descarta nada**: los tres devuelven los dos (SC-017) |
| V-37 | ✅ «No hay productos que coincidan con los criterios seleccionados.», sin resultados parciales (SC-018) |
| V-38 | ✅ Ingredientes visibles y, junto a ellos, la advertencia obligatoria de alérgenos (SC-020) |
| V-39 | ✅ Tras la baja, la misma dirección muestra «No encontramos el producto que buscas.» en español |
| V-40 | ✅ Sin ningún producto activo: «Todavía no hay productos en el menú.» Ni error, ni pantalla en blanco, ni carga permanente (SC-022) |
| V-41 | ✅ Los tres alcanzados **solo con filtros** (SC-025): Sándwich Vegetariano de Berenjena (económico · Sándwiches), Ensalada de Quinoa y Palta (medio · Ensaladas) y Pizza Napolitana (caro · Pizzas) |
| V-42 | ✅ Administrador y repartidor ven el menú igual que el cliente (12 productos); los dos reciben `403` de la API y `/sin-permiso` en la interfaz |

## Sección D · Mensajes, presentación y accesibilidad (V-43 a V-49, V-56)

| Paso | Resultado |
|---|---|
| V-43 | ✅ Todo el texto visible en español con acentos correctos. Ningún término prohibido: «eliminar», «borrar», «archivar», «sin stock», «no disponible», «eje» y «faceta» solo aparecen en comentarios del código que los declaran prohibidos (SC-029) |
| V-44 | ✅ `$4.590`, `$7.500`, `$10.990` idénticos en menú, ficha, listado de administración y **previa del formulario**, todos con `formatearPrecio` (T078) |
| V-45 | ✅ Cada acción confirma nombrando el elemento: «Se creó la categoría Postres.», «Se desactivó…», «Se repuso…», «Se dio de baja…» |
| V-46 | ✅ Recorrido y operado solo con teclado, incluido el diálogo de baja: confirmado con **Tab + Enter**, cerrado con Escape, con el foco visible en «Cancelar» al abrirse (SC-028) |
| V-47 | ✅ Cada campo con su etiqueta asociada y su error junto al campo, con `aria-describedby` y `aria-invalid` |
| V-48 | ✅ A 360 px: menú, listado y formularios de productos y categorías, **sin desborde horizontal** en ninguna. El menú pasa a una columna |
| V-49 | ✅ Las 18 descripciones y los 12 campos de ingredientes leídos uno a uno: cada descripción dice algo que su nombre no dice, y cada campo enumera ≥3 componentes reconocibles (SC-032) |
| V-56 | ✅ Descripción de 1.000 caracteres: **156 en los dos listados**, cortada en un espacio y con puntos suspensivos; **1.000 íntegros** en la ficha (D-033) |

## Sección E · Verificación técnica (V-50 a V-55)

| Paso | Resultado |
|---|---|
| V-50 | ✅ Cliente contra `POST /business/products` y `PUT /business/categories/:id/status`: `403`. Repartidor y administrador, `403` en todo `/business/**` (SC-021) |
| V-51 | ✅ Sin filtros y con los tres tramos: **ningún producto con `active = false`** por ninguna vía; los agotados salen marcados y el DTO no lleva ninguna acción para pedirlos |
| V-52 | ✅ Producto dado de baja e identificador inexistente devuelven **exactamente el mismo cuerpo**: `404 NOT_FOUND` con el mismo mensaje (D-032) |
| V-53 | ✅ Tras cambiar el precio, se comparó el estado **completo** de las 12 filas antes y después: cambió solo `price` y `updated_at` de esa fila. **No existe ninguna tabla de histórico de precios** en el esquema (RN-010) |
| V-54 | ✅ Dos ejecuciones seguidas: 6 categorías y 12 productos antes y después, con 19 mensajes de «ya existe. No se modificó nada» (SC-026) |
| V-55 | ✅ Con 50 productos activos, tres mediciones por caso: **máximo 1,91 s** de cinco escenarios —menú sin filtros, menú por tramo, menú con categoría y tramo, administración sin filtros y con filtros— (SC-030, umbral 5 s) |

---

## Cobertura de los criterios de éxito

Los 32 criterios quedan verificados. Se declaran expresamente **los ocho sin
ninguna cobertura automática**, que son la razón por la que esta guía existe:

| Criterio | Cómo se verificó | Paso |
|---|---|---|
| SC-001 | Cronómetro · 2,3 s | V-13 |
| SC-002 | Conteo de clics · 1 clic | V-21 |
| SC-009 | Cronómetro · segundos | V-02 |
| SC-019 | Mirando la pantalla sin interactuar | V-05 |
| SC-025 | Recorrido a mano, con los tres productos anotados | V-41 |
| SC-028 | Teclado y foco, diálogos incluidos | V-46, V-47 |
| SC-029 | Leyendo el texto de las ocho pantallas | V-43 |
| SC-032 | **Revisión humana, por definición** | V-49 |

Los 24 restantes tienen cobertura automática total o parcial y están verdes en
las dos capas.

### Lo que queda fuera, y por qué

- **Auditoría formal de accesibilidad y lectores de pantalla reales**: fuera de
  v1 por decisión declarada (FR-039 de E1). Lo que sí se verificó son las cuatro
  condiciones de FR-037.
- **La mitad de SC-023 que mira pedidos ya emitidos**: no hay pedidos hasta E2.
  Lo que E3 sí garantiza —que un cambio de precio no reescriba ningún dato del
  catálogo y que no exista ningún histórico— quedó comprobado en V-53.
- **Navegadores distintos del de la validación**: se recorrió sobre Chrome. El
  compromiso de FR-038 con el resto se hereda de FR-040 de E1.
