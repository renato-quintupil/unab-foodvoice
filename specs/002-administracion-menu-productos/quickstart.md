# Guía de puesta en marcha y validación: E3 · Administración de menú

Esta guía sirve a dos propósitos: levantar la épica en local y **recorrer los 32 criterios de
éxito** uno por uno. Los pasos de validación llevan identificador estable (`V-nn`) y la tabla
final los enlaza con su criterio, de modo que ninguno quede sin comprobar.

## Requisitos previos

Los mismos de E1, sin añadidos: Node.js 22 LTS, pnpm 9, Docker con Compose. **E3 no introduce
ninguna variable de entorno nueva** ni ninguna clave de servicio: el `.env` de E1 sirve tal
cual.

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # aplica la migración del catálogo
pnpm --filter api db:seed          # administrador de E1 + catálogo de E3, idempotente
pnpm dev                           # api :3001 · web :3000
```

Alternativa íntegra en contenedores: `docker compose up --build`.

Tras la semilla, la base contiene el administrador de E1 y el catálogo de E3: las dos
dimensiones, al menos tres categorías activas por dimensión y al menos doce productos activos
que cubren los tres tramos de precio (FR-036).

Para la validación hace falta además **un usuario de rol negocio** y **uno de rol cliente**. Se
crean desde el panel de administración de E1, con la sesión del administrador semilla.

## Comprobaciones automáticas

```bash
pnpm test              # unitarios; falla si no se cumplen los umbrales de cobertura
pnpm test:integration  # API contra PostgreSQL efímera en Docker
pnpm lint && pnpm typecheck && pnpm build
```

Las cuatro deben pasar antes de empezar la validación funcional. Que pasen **no basta**: cuatro
criterios de esta épica no tienen cobertura automática y solo se comprueban mirando la
aplicación (ver § Cobertura de los criterios de éxito).

## Validación funcional

### Preparación

Dos navegadores, o uno normal y otro en ventana privada, para tener abiertas a la vez la sesión
del **negocio** y la del **cliente**. Buena parte de la épica consiste precisamente en
comprobar que lo que hace uno se refleja en lo que ve el otro.

### A · Clasificación (HU-14)

Con la sesión del **negocio**, en `/negocio/categorias`.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Crear una categoría en «Tipo de comida» con nombre y descripción válidos | Queda activa; aparece en el alta de productos y en el filtro del cliente |
| **V-02** | Cronometrar V-01 y clasificar un producto con ella | Menos de 2 minutos, sin intervención técnica |
| **V-03** | Intentar guardar con la descripción vacía, y luego con 20 caracteres | Rechazo con mensaje **junto al campo**, no suelto en la página |
| **V-04** | Intentar guardar una descripción de 30 caracteres que repita el nombre, y otra que repita una palabra seis veces | Rechazo en ambos casos, con el mensaje nombrando la condición incumplida |
| **V-05** | Mirar el campo de descripción **sin escribir nada** | Se ven el ejemplo y la explicación, legibles sin interacción previa |
| **V-06** | Crear «pizzas» en la dimensión que ya tiene «Pizzas» | Rechazo asociado al campo del nombre |
| **V-07** | Crear «Saludable» en «Perfil de salud» existiendo ya en «Tipo de comida» | Se acepta: son dos categorías independientes |
| **V-08** | Recorrer toda la administración de categorías buscando una acción de borrado | **No existe ninguna**, por ningún camino |
| **V-09** | Desactivar una categoría de la que dependan tres productos activos | Se impide, y el mensaje dice **cuántos** productos lo bloquean |
| **V-10** | Desactivar una categoría sin productos activos que dependan solo de ella | Desaparece de los filtros del cliente y del alta; sigue visible en la administración, marcada |
| **V-11** | Reactivarla | Vuelve a ofrecerse, con su nombre y su descripción intactos |
| **V-12** | Editar una categoría e intentar cambiarle la dimensión | La dimensión no es editable: no hay control para hacerlo |
| **V-57** | Filtrar el listado por «Desactivada», luego por «Activa» y volver a «Todas»; recargar con el filtro puesto | Cada filtro estrecha el listado y viaja en la dirección, de modo que recargar no lo pierde. Sin filtro se siguen viendo activas y desactivadas. Si un filtro no devuelve nada, aparece el mensaje de «sin resultados» y **no** la invitación a crear la primera categoría (FR-010) |

### B · Productos (HU-02)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-13** | Dar de alta un producto completo y cronometrar hasta verlo en la sesión del cliente | Menos de 3 minutos, sin ayuda técnica |
| **V-14** | Comprobar el estado del producto recién creado | Activo y disponible, sin ninguna acción adicional |
| **V-15** | Intentar dar de alta «pizza napolitana» existiendo «Pizza Napolitana» | Rechazo asociado al campo del nombre |
| **V-16** | Dar de baja un producto e intentar crear otro con su mismo nombre | Rechazo: el nombre sigue reservado |
| **V-17** | Probar precios `0`, `-100`, `4990,50` y `abc` | Los cuatro se rechazan, con el mensaje junto al campo del precio y **sin corrección silenciosa** |
| **V-18** | Intentar guardar sin elegir tipo de comida | Rechazo asociado a ese campo |
| **V-19** | Mirar los desplegables de clasificación | Uno por dimensión, de selección única |
| **V-20** | Desactivar todas las categorías de «Perfil de salud» y entrar al alta | Explica en español que falta crear la primera categoría de esa dimensión, ofrece ir a crearla y no deja guardar |
| **V-21** | Marcar un producto como agotado **desde el listado**, contando los clics | 2 clics o menos, sin entrar a la ficha y sin diálogo de confirmación |
| **V-22** | Recargar la pantalla del cliente | El producto aparece marcado «Agotado» y no hay ninguna acción para seleccionarlo |
| **V-23** | Reponerlo y recargar la del cliente | La marca desaparece y vuelve a ser seleccionable |
| **V-24** | Dar de baja un producto | Pide confirmación cancelable; desaparece del menú del cliente y sigue en la administración |
| **V-25** | Reactivarlo | Vuelve al menú con todos sus datos intactos |
| **V-26** | Dar de baja un producto, desactivar su categoría de tipo de comida y reactivar el producto | Se impide, con un mensaje que **nombra la dimensión**, y ofrece reclasificarlo |
| **V-27** | Reclasificar un producto de «Pizzas/Indulgente» a «Ensaladas/Saludable» | Aparece bajo la nueva clasificación y deja de aparecer bajo la anterior |
| **V-28** | Con más de 20 productos, abrir el listado de administración | 20 por página, con el total de resultados |
| **V-29** | Buscar un producto escribiendo parte de su nombre en minúsculas y sin acentos | Lo encuentra |
| **V-30** | Abrir el listado sin aplicar ningún filtro | Solo aparecen los activos; los dados de baja se recuperan con el filtro de estado |
| **V-31** | Hacer doble clic rápido sobre «Guardar» al crear un producto | Se crea **uno solo**; el control queda inutilizable hasta la respuesta |

### C · Consulta del menú

Con la sesión del **cliente** salvo que se indique otra cosa.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-32** | Filtrar por «Pizzas» | Solo productos activos de esa categoría; los agotados aparecen marcados |
| **V-33** | Combinar categoría «Saludable» con tramo «Económico» | Solo los que cumplen **ambas**; nunca se sustituyen por productos que cumplan solo una |
| **V-34** | Con un catálogo de $2.000, $5.000 y $12.000, consultar el tramo económico | Devuelve el de $2.000 y no el de $12.000 |
| **V-35** | Dar de alta varios productos más baratos y volver a consultar | El producto que antes era económico ya no lo es, **sin que nadie lo editara** |
| **V-36** | Dejar solo dos productos activos y consultar por tramo | No descarta ninguno |
| **V-37** | Aplicar una combinación de filtros sin resultados | Mensaje en español de «sin resultados»; **no** se ofrecen productos que cumplan solo parte |
| **V-38** | Abrir la ficha de un producto con ingredientes | Se ven los ingredientes y, junto a ellos, la advertencia de que son referenciales y no una declaración de alérgenos |
| **V-39** | Copiar la dirección de la ficha, dar de baja el producto desde el negocio y volver a abrirla | Página de «no encontrado» en español; el producto no aparece por ningún medio |
| **V-40** | Dar de baja **todos** los productos y abrir el menú | Mensaje en español explicando que todavía no hay productos; ni error, ni pantalla en blanco, ni carga permanente |
| **V-41** | Elegir tres productos de la semilla con el criterio de SC-025 —uno de cada tramo de precio, los tres de categorías de tipo de comida distintas— y alcanzar cada uno **solo con filtros**. Anotar cuáles fueron | Se llega a los tres sin micrófono ni búsqueda por voz |
| **V-42** | Con la sesión del **administrador** y la del **repartidor**, abrir el menú | Lo consultan igual que el cliente; ninguno tiene acceso a la administración del catálogo |
| **V-58** | Dar de alta un producto **sin ingredientes** —el campo es opcional— y abrir su ficha | No aparece la sección «Ingredientes» ni su advertencia: sin dato al que acompañar, la advertencia hablaría de una lista que no existe. En un producto que sí los declara (V-38), ambas siguen apareciendo (FR-017, § Casos Límite) |

### D · Mensajes, presentación y accesibilidad

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-43** | Recorrer todas las pantallas de la épica | Todo el texto visible está en español, con acentos correctos, y ningún término técnico interno aparece en pantalla |
| **V-44** | Mirar cómo se presenta cada precio, en el menú, en la ficha y en la administración | Siempre `$4.990`: punto de miles, sin decimales, idéntico en las tres |
| **V-45** | Aplicar cada acción del catálogo | Tras cada una, confirmación de éxito en español que nombra el elemento y la acción |
| **V-46** | Recorrer y operar las nueve pantallas **solo con el teclado**, incluidos los diálogos de confirmación | Todo alcanzable, con el foco visible en todo momento |
| **V-47** | Revisar cada campo de formulario | Todos tienen etiqueta asociada, y su error aparece junto al campo |
| **V-48** | Reducir la ventana a 360 px de ancho | Ningún contenido queda inalcanzable; el listado de productos se desplaza o se reorganiza, pero no se recorta |
| **V-49** | Leer una por una las descripciones **y los ingredientes** de la semilla | Cada descripción menciona algo que su nombre no dice, y cada campo de ingredientes enumera al menos tres componentes reconocibles, no adjetivos (SC-032) |
| **V-56** | Escribir en un producto una descripción de 1.000 caracteres y mirarla en el menú, en el listado de administración y en su ficha | En los dos listados aparece recortada a 160 caracteres, cortada en un espacio y con puntos suspensivos; en la ficha, íntegra. El filtro y la búsqueda siguen operando sobre el texto completo |

### E · Verificación técnica

Cuatro criterios no se pueden comprobar mirando la pantalla, y así se declara —igual que E1
declaró los suyos—. Se ejecutan con `curl` o equivalente, con la cookie de sesión del rol
indicado.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-50** | Con sesión de **cliente**, llamar directamente a `POST /api/v1/business/products` y a `PUT /api/v1/business/categories/:id/status` | `403` en ambos casos. Que la opción no aparezca en pantalla no cuenta como bloqueo |
| **V-51** | Con sesión de cliente, llamar a `GET /api/v1/menu/products` con y sin filtros, y buscar en la respuesta cualquier producto dado de baja o agotado | Ningún producto con `active = false` aparece por ninguna vía; los agotados aparecen marcados y sin acción para pedirlos |
| **V-52** | Llamar a `GET /api/v1/menu/products/:id` con el identificador de un producto dado de baja | `404`, con el mismo cuerpo que un identificador inexistente |
| **V-53** | Anotar los datos de un producto, cambiar su precio y volver a consultarlo | El catálogo muestra el precio nuevo y **ningún registro anterior se reescribió**. La comprobación sobre pedidos concretos espera a E2 |
| **V-54** | Ejecutar `pnpm --filter api db:seed` dos veces seguidas y contar los registros | No se duplica nada; los registros ya existentes quedan intactos |
| **V-55** | Cargar el catálogo hasta 50 productos activos y cronometrar el menú y el listado de administración, con y sin filtros | Menos de 5 segundos en los cuatro casos |

## Cobertura de los criterios de éxito

| Criterio | Pasos | Cobertura automática |
|---|---|---|
| SC-001 | V-13 | No — se cronometra |
| SC-002 | V-21 | No — se cuentan los clics |
| SC-003 | V-22, V-23 | Parcial (integración) |
| SC-004 | V-22, V-51 | Sí (integración) |
| SC-005 | V-39, V-51, V-52 | Sí (integración) |
| SC-006 | V-08, V-10, V-11, V-24, V-25 | Parcial — la ausencia de acciones se mira |
| SC-007 | V-03, V-18 | Sí (unitaria + integración) |
| SC-008 | V-03 | Sí (unitaria) |
| SC-009 | V-02 | No — se cronometra |
| SC-010 | V-20, V-26 | Sí (integración) |
| SC-011 | V-32 a V-38, V-41 | Parcial — la tabla se recorre a mano |
| SC-012 | V-17 | Sí (unitaria) |
| SC-013 | V-14 | Sí (integración) |
| SC-014 | V-06, V-07, V-15, V-16 | Sí (integración) |
| SC-015 | V-09 | Sí (integración) |
| SC-016 | V-34, V-35 | Sí (integración) |
| SC-017 | V-36 | Sí (integración) |
| SC-018 | V-33, V-37 | Sí (integración) |
| SC-019 | V-05 | No — se mira la pantalla |
| SC-020 | V-38, V-58 | Parcial |
| SC-021 | V-50 | Sí (integración) |
| SC-022 | V-40 | Parcial |
| SC-023 | V-53 | Parcial — la mitad de E2 espera |
| SC-024 | V-28, V-29 | Sí (integración) |
| SC-025 | V-41 | No — se recorre a mano, con el criterio de selección declarado |
| SC-026 | V-54 | Sí (integración) |
| SC-027 | V-31 | Sí (integración) |
| SC-028 | V-46, V-47 | No — teclado y foco |
| SC-029 | V-43 | No — se lee la pantalla |
| SC-030 | V-55 | No — se cronometra |
| SC-031 | V-04 | Sí (unitaria) |
| SC-032 | V-49 | **No — revisión humana, por definición** |

**V-57 no aparece en esta tabla y no es un olvido**: FR-010 es uno de los requisitos que la
spec no traza a ningún criterio de éxito propio —no tiene escenario Gherkin ni fila en
§ Trazabilidad—, de modo que su paso responde al requisito directamente. Su mitad de interfaz sí
tiene cobertura automática, en `apps/web/tests/categorias.test.tsx`.

**Los ocho criterios sin ninguna cobertura automática** —SC-001, SC-002, SC-009, SC-019,
SC-025, SC-028, SC-029, SC-030 y SC-032— son la razón por la que esta guía existe. En E1, dos
de los cuatro equivalentes **no se cumplían** cuando solo se había auditado el código: el error
de formulario no quedaba asociado a su campo y cuatro pantallas usaban un mensaje recortado en
lugar del compartido. Conviene recorrerlos con esa expectativa, no como un trámite.

## Criterio de aceptación de la épica

E3 se da por terminada cuando:

1. `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build` pasan.
2. Los 58 pasos de esta guía se han ejecutado y anotado.
3. Los 32 criterios de éxito están verificados, **salvo la mitad de SC-023 que depende de E2**,
   declarada en § Entrega por fases de la spec.
4. El contenido de la semilla ha sido leído por una persona, no solo contado por una prueba.

El resultado se registra en `verificacion.md`, con el mismo formato que E1.

**V-57 y V-58** se añadieron el 2026-08-16, con las tareas T089 y T090 de la fase de
convergencia: el filtro por estado del listado de categorías (FR-010) y la ficha de un producto
sin ingredientes declarados (FR-017, § Casos Límite). Llevan número al final para no renumerar
los 56 pasos ya anotados en `verificacion.md`, pero **se ejecutan en su sección** —V-57 en A ·
Clasificación, junto a las demás acciones sobre categorías; V-58 en C · Consulta del menú, justo
después de V-38, que es su caso contrario—. Es el mismo criterio con que V-56 se numeró al
final y se ejecuta en D.
