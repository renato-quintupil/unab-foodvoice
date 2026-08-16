---
description: "Lista de tareas de implementación: E3 · Administración de menú"
---

# Tareas: E3 · Administración de menú

**Entrada**: documentos de diseño de `specs/002-administracion-menu-productos/`

**Prerrequisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Pruebas**: **sí se incluyen tareas de prueba**, y no como opción. El Principio XI de la
constitución exige criterios de aceptación escritos antes de programar, y D-031 reparte qué se
comprueba en cada capa. Las baterías de integración no son un extra: la unicidad normalizada,
el conteo de bloqueadores y la atomicidad de la desactivación **no se pueden comprobar con
unitarios**.

**Organización**: por historia de usuario, en el orden de prioridad de la spec. La consulta del
menú tiene fase propia porque sus escenarios pertenecen a **las dos** historias; cada tarea
lleva la etiqueta de la historia cuyo escenario cierra.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US1]** = HU-14 · Clasificación (P1) · **[US2]** = HU-02 · Administración del menú (P2)

## Convenciones de ruta

Monorepo pnpm ya existente: `packages/shared/src/`, `services/api/src/` y `apps/web/src/`. Las
rutas de cada tarea son las declaradas en [plan.md](./plan.md) § Estructura del Proyecto.

**Las pruebas de integración van en `services/api/test/`, con el sufijo
`.integration-spec.ts`**, un archivo por batería, como en E1. No es una preferencia de estilo:
`jest.integration.config.js` las selecciona con `testRegex: 'test/.*\.integration-spec\.ts$'`, y
una batería escrita fuera de ese patrón **no se ejecutaría y la suite pasaría en verde sin
haberla corrido**. Los unitarios usan Vitest en `packages/shared` y `apps/web`, y Jest en
`services/api`.

---

## Fase 1: Preparación

**Propósito**: dejar sitio a los tres módulos nuevos sin tocar nada de E1. No hay que inicializar
proyecto, ni instalar dependencias, ni configurar linters: E3 no incorpora **ninguna dependencia
nueva** y hereda la configuración de E1 tal cual.

- [X] T001 [P] Crear el árbol de carpetas vacío de los módulos nuevos en `services/api/src/categories/`, `services/api/src/products/` y `services/api/src/menu/`
- [X] T002 [P] Crear el árbol de carpetas vacío de las pantallas nuevas en `apps/web/src/app/negocio/categorias/`, `apps/web/src/app/negocio/productos/` y `apps/web/src/app/menu/`
- [X] T003 Comprobar que `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build` pasan en verde **antes** de tocar nada, para que cualquier fallo posterior sea atribuible a esta épica; se ejecutan desde la raíz del repositorio, según [quickstart.md](./quickstart.md) § Comprobaciones automáticas

---

## Fase 2: Cimientos (prerrequisito bloqueante)

**Propósito**: los contratos compartidos y el esquema de datos. Todo lo demás depende de esta
fase.

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta que esta fase esté completa. Sin los
esquemas Zod no hay validación, y sin la migración no hay dónde escribir.

### Contratos compartidos — `packages/shared`

- [X] T004 [P] Crear el enum `Dimension` y las etiquetas visibles de sus dos valores en `packages/shared/src/enums/dimension.ts` (FR-001, D-020)
- [X] T005 [P] Crear los enums `PriceTier` y `ProductStatus` en `packages/shared/src/enums/dimension.ts` (FR-032, § Vocabulario visible del catálogo)
- [X] T006 Implementar `validarDescripcion` con el mínimo, el máximo y las tres condiciones de sustancia, devolviendo el motivo concreto del rechazo, y **colapsando saltos de línea, tabulaciones y espacios repetidos a un solo espacio antes de medir y de validar** —la descripción es párrafo plano—, en `packages/shared/src/schemas/description.ts` (FR-039, D-025, D-033)
- [X] T007 [P] Escribir las pruebas unitarias de `validarDescripcion` en `packages/shared/src/schemas/description.spec.ts`, cubriendo los seis motivos, los límites **inclusivos** de 20, 30, 500 y 1.000 caracteres, y el colapso de saltos de línea —una descripción con saltos cuenta sus palabras como si fueran espacios— (SC-031, D-033)
- [X] T008 [P] Implementar `formatearPrecio` con `Intl.NumberFormat` para producir `$4.990`, y sus pruebas unitarias, en `packages/shared/src/format/precio.ts` y su `.spec.ts` (§ Presentación del precio, D-030)
- [X] T087 [P] Implementar `recortarDescripcion` y `MAX_DESCRIPCION_LISTADO`, cortando en el último espacio anterior al límite sin partir palabras, y sus pruebas unitarias, en `packages/shared/src/format/texto.ts` y su `.spec.ts` (§ Presentación de la descripción en los listados, D-033)
- [X] T009 Añadir los mensajes fijos del catálogo a `packages/shared/src/messages/es.ts`, incluidos `MSG_CATEGORIA_EN_USO` y `MSG_CATEGORIA_INACTIVA` como funciones porque su texto lleva un dato variable (contracts/shared.md § Mensajes fijos)
- [X] T010 Añadir a `packages/shared/src/messages/es.ts` las constantes de ayuda contextual `AYUDA_DESCRIPCION_PRODUCTO` y `AYUDA_DESCRIPCION_CATEGORIA`, cada una con su ejemplo completo y su explicación (FR-005, FR-016)
- [X] T011 Añadir `ETIQUETA_DIMENSION`, `ETIQUETA_TRAMO`, `ETIQUETA_ESTADO_PRODUCTO` y `ETIQUETA_ESTADO_CATEGORIA` a `packages/shared/src/messages/etiquetas.ts`, respetando el vocabulario prohibido de la spec (§ Vocabulario visible del catálogo)
- [X] T012 Crear los esquemas de categoría `CreateCategorySchema` y `UpdateCategorySchema` —este último **sin** `dimension`— en `packages/shared/src/schemas/category.ts` (FR-003, FR-006)
- [X] T013 Crear los esquemas de producto `CreateProductSchema` y `UpdateProductSchema`, con el precio entero que rechaza decimales sin redondear, en `packages/shared/src/schemas/product.ts` (FR-013, FR-015)
- [X] T014 [P] Crear los esquemas de cambio de estado `ChangeCategoryStatusSchema`, `ChangeProductStatusSchema` y `ChangeAvailabilitySchema` en `packages/shared/src/schemas/product.ts` y `category.ts` (FR-007, FR-019, FR-020)
- [X] T015 Añadir `ListCategoriesQuerySchema`, `ListProductsQuerySchema` —reutilizando `PAGE_SIZE`— y `MenuQuerySchema` —**sin** `page`— a `packages/shared/src/schemas/query.ts` (FR-023, FR-031, D-029)
- [X] T016 [P] Escribir las pruebas unitarias de los esquemas de categoría y producto en `packages/shared/src/schemas/category.spec.ts` y `product.spec.ts`, incluidos los precios `0`, `-100`, `4990.5` y no numérico (SC-012)
- [X] T017 Añadir los tipos `CategoryDto`, `CategoryRef` y `ProductDto` —sin `nameNormalized` ni `updatedAt`, con `status` y `priceTier` derivados— a `packages/shared/src/types/api.ts` (contracts/shared.md § Tipos de transferencia)
- [X] T018 Exportar toda la superficie nueva desde `packages/shared/src/index.ts` sin filtrar nada que no esté en el contrato

### Esquema de datos — `services/api`

- [X] T019 Añadir el enum `Dimension` y los modelos `Category` y `Product` a `services/api/prisma/schema.prisma`, con las dos claves foráneas obligatorias y todos los índices de data-model.md (D-024)
- [X] T020 Generar la migración con `prisma migrate dev` y añadirle a mano la restricción `CHECK (price >= 1 AND price <= 10000000)`, que Prisma no expresa en el esquema (D-026)
- [X] T021 Comprobar sobre una base efímera que la migración aplica limpia y que los índices únicos existen, en `services/api/test/catalog-schema.integration-spec.ts`

**Punto de control**: los contratos compilan y la base tiene las dos tablas. Las historias
pueden empezar.

---

## Fase 3: Historia de Usuario 1 — Clasificación (HU-14, P1) 🎯 MVP

**Objetivo**: el negocio crea, edita, desactiva y reactiva las categorías de las dos
dimensiones, sin esperar ningún despliegue.

**Prueba independiente**: con un usuario de rol negocio y **ningún producto en el sistema**, se
recorre entera —crear en ambas dimensiones, validaciones de nombre y descripción, duplicado
dentro de la dimensión, mismo nombre en la otra, editar, desactivar y reactivar—. No requiere
que HU-02 esté construida. Corresponde a los pasos **V-01 a V-12** de quickstart.md.

### Pruebas de la Historia 1

> Se escriben antes que la implementación y deben fallar primero.

- [ ] T022 [P] [US1] Batería de integración de creación y validación de categorías en `services/api/test/categories-create.integration-spec.ts`, cubriendo HU14-E01, E02 y E03, y comprobando que ninguna categoría llega a guardarse con descripción de menos de 30 caracteres (SC-008)
- [ ] T023 [P] [US1] Batería de integración de unicidad en `services/api/test/categories-unique.integration-spec.ts`: duplicado en la misma dimensión con acentos y mayúsculas distintas, mismo nombre en la otra dimensión, y colisión con una categoría **desactivada** (HU14-E04, E05, SC-014)
- [ ] T024 [P] [US1] Batería de integración de desactivación y reactivación en `services/api/test/categories-status.integration-spec.ts`, incluido el rechazo con conteo de bloqueadores y el envío simultáneo de dos peticiones idénticas (HU14-E08, E09, E18, SC-015, SC-027)
- [ ] T025 [P] [US1] Batería de integración del **efecto** de la desactivación en `services/api/test/categories-visibility.integration-spec.ts`: una categoría desactivada desaparece de `GET /menu/categories` y de las que ofrece el alta de productos, y los productos que ya la tenían **la conservan** (FR-011, RN-009, HU14-E08)
- [ ] T026 [P] [US1] Batería de integración de autorización en `services/api/test/categories-roles.integration-spec.ts`: cada endpoint de `/business/categories` invocado con sesión de cliente, repartidor y administrador devuelve `403` (FR-027, SC-021)

### Implementación de la Historia 1

- [ ] T027 [US1] Implementar `CategoriesService` con creación, edición y listado, derivando `nameNormalized` con `normalizarBusqueda` y traduciendo la violación del índice único a `CATEGORY_NAME_ALREADY_EXISTS`, en `services/api/src/categories/categories.service.ts` (FR-002, FR-004, FR-006, D-021)
- [ ] T028 [US1] Implementar la desactivación en `CategoriesService` contando los productos activos bloqueadores **dentro de la misma transacción** que aplica el cambio, y la reactivación conservando nombre, descripción y dimensión, en `services/api/src/categories/categories.service.ts` (FR-007, FR-008, D-027)
- [ ] T029 [US1] Implementar `CategoriesController` con los cuatro endpoints de contracts/api.md, sin ningún verbo `DELETE`, y con `@Roles(NEGOCIO)` en la clase entera, en `services/api/src/categories/categories.controller.ts` (FR-009, FR-027)
- [ ] T030 [US1] Registrar `CategoriesModule` en `services/api/src/app.module.ts` y crear `services/api/src/categories/categories.module.ts`
- [ ] T031 [P] [US1] Construir el formulario de categoría con react-hook-form y el resolver de los esquemas compartidos, mostrando la ayuda contextual **visible sin interacción previa** junto al campo de descripción, en `apps/web/src/app/negocio/categorias/_components/formulario-categoria.tsx` (FR-005, SC-019)
- [ ] T032 [US1] Construir la pantalla de alta en `apps/web/src/app/negocio/categorias/nueva/page.tsx` (FR-002)
- [ ] T033 [US1] Construir la pantalla de edición, con la dimensión visible pero **no editable**, en `apps/web/src/app/negocio/categorias/[id]/editar/page.tsx` (FR-006)
- [ ] T034 [US1] Construir el listado agrupado por dimensión y filtrable por estado, con las acciones de desactivar y reactivar y **ninguna acción de borrado**, en `apps/web/src/app/negocio/categorias/page.tsx` (FR-010, FR-009)
- [ ] T035 [US1] Presentar el rechazo de desactivación con el número de productos que lo bloquean, tomado de `blockingProducts` y no analizando el texto, en `apps/web/src/app/negocio/categorias/page.tsx` (FR-007)
- [ ] T036 [US1] Asociar cada mensaje de error a su campo, añadir la confirmación de éxito en español tras cada acción y **deshabilitar cada control mientras espera respuesta** para que un doble clic no dispare dos veces, en las tres pantallas de categorías de `apps/web/src/app/negocio/categorias/` (FR-025, FR-026, FR-037, SC-027)

**Punto de control**: HU-14 es demostrable por sí sola. Es el MVP de la épica.

---

## Fase 4: Historia de Usuario 2 — Administración del menú (HU-02, P2)

**Objetivo**: el negocio da de alta productos bien descritos, los agota y repone durante el
servicio, y los da de baja sin perderlos.

**Prueba independiente**: existiendo al menos una categoría activa por dimensión, se recorre
con un usuario de rol negocio y uno de rol cliente —alta completa, validaciones de nombre,
precio y descripción, agotar y reponer, baja y reactivación—. Corresponde a los pasos **V-13 a
V-31**.

**Depende de**: la Fase 3. Sin una categoría activa por dimensión no se puede dar de alta
ningún producto (RN-012). Es la única dependencia entre historias de la épica, y está declarada
en la spec.

### Pruebas de la Historia 2

- [ ] T037 [P] [US2] Batería de integración de alta de producto en `services/api/test/products-create.integration-spec.ts`: alta completa que queda activa y disponible, y rechazo de la descripción que cumple longitud pero no sustancia (HU02-E01, E04, SC-007, SC-013, SC-031)
- [ ] T038 [P] [US2] Batería de integración de unicidad de nombre de producto en `services/api/test/products-unique.integration-spec.ts`, incluida la colisión con un producto **dado de baja** y el doble envío simultáneo (HU02-E02, RN-005, SC-027)
- [ ] T039 [P] [US2] Batería de integración de clasificación en `services/api/test/products-classification.integration-spec.ts`: alta sin categoría, con una categoría desactivada, y con una categoría de la **dimensión equivocada** (HU14-E06, FR-012, SC-007, D-024)
- [ ] T040 [P] [US2] Batería de integración de los dos interruptores en `services/api/test/products-switches.integration-spec.ts`: agotar, reponer, dar de baja conservando `available`, y reactivar volviendo a disponible, comprobando que el cambio rige para la consulta siguiente sin ningún paso de publicación (HU02-E07, E08, E09, SC-003)
- [ ] T041 [P] [US2] Batería de integración del cambio de precio en `services/api/test/products-price-forward.integration-spec.ts`: tras cambiar el precio de un producto, el catálogo devuelve el nuevo y **ninguna otra fila del producto ni de ninguna otra tabla ha cambiado** —se compara el estado completo antes y después, salvo `price` y `updated_at`—; comprobar además que no existe ninguna tabla ni columna de histórico de precios que E3 escriba (HU02-E13, FR-024, RN-010, SC-023)
- [ ] T042 [P] [US2] Batería de integración de la reactivación bloqueada por categoría desactivada en `services/api/test/products-reactivate.integration-spec.ts` (HU02-E15, FR-021, SC-010)
- [ ] T043 [P] [US2] Batería de integración del listado en `services/api/test/products-list.integration-spec.ts`: 20 por página con total, orden estable, filtros combinados, búsqueda parcial sin acentos, y que **sin filtros no aparezcan los dados de baja** (HU02-E14, FR-023, SC-024)
- [ ] T044 [P] [US2] Batería de integración de autorización de `/business/products` con los otros tres roles en `services/api/test/products-roles.integration-spec.ts` (FR-027, SC-021)

### Implementación de la Historia 2

- [ ] T045 [US2] Implementar en `ProductsService` el alta y la edición, derivando `nameNormalized` con `normalizarBusqueda`, **traduciendo la violación del índice único a `PRODUCT_NAME_ALREADY_EXISTS`** —la unicidad la garantiza la base, no una consulta previa (D-021)— y comprobando dentro de la transacción que ambas categorías existen, son de su dimensión y están activas, en `services/api/src/products/products.service.ts` (FR-012, FR-014, FR-018, FR-022)
- [ ] T046 [US2] Implementar en `ProductsService` el cambio de disponibilidad y el de estado, con la comprobación de categorías activas solo en la reactivación y tratando como sin efecto la petición que no cambia nada, en `services/api/src/products/products.service.ts` (FR-019, FR-020, FR-021, FR-026)
- [ ] T047 [US2] Implementar en `ProductsService` el listado paginado con búsqueda por `LIKE` sobre `nameNormalized`, orden `created_at DESC, id DESC` y el valor por defecto que oculta los dados de baja, en `services/api/src/products/products.service.ts` (FR-023, D-022)
- [ ] T048 [US2] Implementar `ProductsController` con los cinco endpoints de contracts/api.md y `@Roles(NEGOCIO)` en la clase, en `services/api/src/products/products.controller.ts` (FR-027)
- [ ] T049 [US2] Registrar `ProductsModule` en `services/api/src/app.module.ts` y crear `services/api/src/products/products.module.ts`
- [ ] T050 [P] [US2] Construir el formulario de producto con un desplegable **de selección única por dimensión**, poblado **solo con categorías activas** (FR-011), y la ayuda contextual de la descripción, en `apps/web/src/app/negocio/productos/_components/formulario-producto.tsx` (FR-011, FR-012, FR-016, SC-019)
- [ ] T051 [US2] Resolver en el formulario el caso de una dimensión sin ninguna categoría activa: explicarlo en español, ofrecer ir a crearla e impedir guardar, en lugar de mostrar un desplegable vacío, en `apps/web/src/app/negocio/productos/_components/formulario-producto.tsx` (HU14-E19, FR-012, SC-010)
- [ ] T052 [US2] Construir las pantallas de alta y edición en `apps/web/src/app/negocio/productos/nuevo/page.tsx` y `apps/web/src/app/negocio/productos/[id]/editar/page.tsx` (FR-012, FR-018)
- [ ] T053 [US2] Construir el listado con paginación, total de resultados, filtros por estado y categoría, y búsqueda por nombre, en `apps/web/src/app/negocio/productos/page.tsx` (FR-023)
- [ ] T054 [US2] Añadir al listado las acciones de agotar y reponer **en dos clics o menos, sin diálogo de confirmación**, en `apps/web/src/app/negocio/productos/_components/acciones-fila.tsx` (FR-019, SC-002)
- [ ] T055 [US2] Añadir las acciones de dar de baja y reactivar **con confirmación explícita y cancelable**, operable con teclado, en `apps/web/src/app/negocio/productos/_components/dialogo-confirmacion.tsx` (FR-020, FR-037)
- [ ] T056 [US2] Deshabilitar cada control mientras espera respuesta, en las tres pantallas de `apps/web/src/app/negocio/productos/`, para que un doble clic no dispare dos veces (FR-026, SC-027)
- [ ] T057 [US2] Presentar el rechazo por categoría desactivada nombrando la dimensión y ofreciendo reclasificar, en `apps/web/src/app/negocio/productos/page.tsx` (FR-021, SC-010)

**Punto de control**: las dos historias funcionan y el negocio administra su catálogo entero.

---

## Fase 5: Consulta del menú

**Propósito**: cerrar los escenarios de consulta, que pertenecen a **las dos** historias. Cada
tarea lleva la etiqueta de la historia cuyo escenario cierra. Corresponde a los pasos **V-32 a
V-42**.

**Depende de**: Fases 3 y 4. Sin catálogo no hay nada que consultar.

### Pruebas de la consulta

- [ ] T058 [P] [US1] Batería de integración de los tramos de precio en `services/api/test/menu-price-tiers.integration-spec.ts`: catálogos de 0, 1, 2 y 3 productos, todos al mismo precio, empate en el borde del tercio, y recálculo automático al abaratar el catálogo (HU14-E12, E13, E14, SC-016, SC-017)
- [ ] T059 [P] [US1] Batería de integración de filtros combinados en `services/api/test/menu-filters.integration-spec.ts`, comprobando que la combinación es conjuntiva y **nunca** sustituye por productos que cumplan solo una condición (HU14-E17, FR-035, SC-018)
- [ ] T060 [P] [US2] Batería de integración de productos no ofrecibles en `services/api/test/menu-visibility.integration-spec.ts`: ningún producto dado de baja sale por ninguna vía —listado, filtro, tramo o ficha directa— y los agotados salen marcados (HU02-E10, HU14-E16, RN-018, SC-004, SC-005)
- [ ] T061 [P] [US2] Batería de integración de la ficha en `services/api/test/menu-detail.integration-spec.ts`: `404` idéntico para un producto dado de baja y para un identificador inexistente (FR-034, D-032)

### Implementación de la consulta

- [ ] T062 [US1] Implementar en `MenuService` la derivación de los dos precios de corte con las dos consultas de `OFFSET` sobre los productos activos, devolviendo `null` cuando hay menos de tres o todos valen lo mismo, en `services/api/src/menu/menu.service.ts` (FR-032, RN-016, D-023)
- [ ] T063 [US1] Implementar en `MenuService` la consulta del menú con los tres filtros combinables, excluyendo siempre los productos no activos, en `services/api/src/menu/menu.service.ts` (FR-028, FR-031, RN-018)
- [ ] T064 [US2] Implementar en `MenuService` la ficha por identificador, devolviendo `404` cuando el producto no existe o no está activo, en `services/api/src/menu/menu.service.ts` (FR-034, D-032)
- [ ] T065 [US1] Implementar `MenuController` con los tres endpoints, protegido solo por `SessionGuard` y **sin** restricción de rol, devolviendo en `GET /menu/categories` **únicamente las categorías activas** (FR-011), en `services/api/src/menu/menu.controller.ts` (FR-011, supuesto 12)
- [ ] T066 [US1] Registrar `MenuModule` en `services/api/src/app.module.ts` y crear `services/api/src/menu/menu.module.ts`
- [ ] T067 [US1] Construir la pantalla del menú **sin paginación**, con los filtros por las dos dimensiones y por tramo de precio, combinables, en `apps/web/src/app/menu/page.tsx` (FR-031, FR-033, D-029)
- [ ] T068 [US2] Marcar los productos agotados con la etiqueta «Agotado» visible sin interacción y sin ninguna acción para seleccionarlos, en `apps/web/src/app/menu/page.tsx` (FR-029, SC-004)
- [ ] T069 [US2] Construir la ficha de producto con nombre, descripción, precio, estado e ingredientes con su advertencia obligatoria, en `apps/web/src/app/menu/[id]/page.tsx` (FR-034, FR-017, SC-020)
- [ ] T070 [US2] Mostrar la página de «no encontrado» en español cuando la ficha corresponde a un producto no activo, en `apps/web/src/app/menu/[id]/page.tsx` (FR-028, D-032)
- [ ] T071 [US2] Mostrar el mensaje de catálogo vacío cuando no hay ningún producto activo, sin error ni pantalla en blanco ni carga permanente, en `apps/web/src/app/menu/page.tsx` (FR-030, SC-022)
- [ ] T072 [US1] Mostrar el mensaje de «sin resultados» cuando una combinación de filtros no devuelve nada, sin sustituirlo por resultados parciales, en `apps/web/src/app/menu/page.tsx` (FR-035, SC-018)
- [ ] T073 [US1] Enlazar el menú desde la vista de los cuatro roles en `apps/web/src/app/cliente/`, `apps/web/src/app/negocio/`, `apps/web/src/app/repartidor/` y `apps/web/src/app/admin/`, y comprobar que administrador y repartidor lo consultan igual que el cliente y no ven la administración del catálogo (§ Roles de usuario, supuesto 13, paso V-42)

**Punto de control**: la paridad manual del Principio VI queda cumplida: todo lo que E6
resolverá por voz se alcanza aquí con filtros.

---

## Fase 6: Semilla, presentación y validación

**Propósito**: lo transversal, y el cierre de la épica. **Esta fase no es un trámite**: en E1,
dos de los criterios sin cobertura automática no se cumplían cuando solo se había auditado el
código.

- [ ] T074 Escribir la semilla del catálogo con sus mínimos exigibles —las dos dimensiones, tres categorías activas por dimensión, doce productos con ingredientes y los tres tramos cubiertos— reconociendo los registros existentes por nombre normalizado, en `services/api/prisma/seed/catalogo.ts` (FR-036, D-028)
- [ ] T075 Redactar el contenido real de la semilla en `services/api/prisma/seed/catalogo.ts` y revisarlo leyéndolo entero, aplicando los dos criterios operativos de SC-032: **cada descripción menciona algo que su nombre no dice** y ninguna se limita a cumplir el mínimo mecánico de FR-039; y **cada campo de ingredientes enumera al menos tres componentes reconocibles**, no adjetivos ni frases (SC-032, paso V-49)
- [ ] T076 Enlazar la semilla del catálogo con la de E1 en el comando `db:seed` de `services/api/package.json`, de forma que una sola ejecución cargue ambas
- [ ] T077 [P] Batería de integración de la semilla en `services/api/test/catalog-seed.integration-spec.ts`: sobre base vacía carga los mínimos y cubre los tres tramos; ejecutada dos veces no duplica ni modifica nada (SC-026)
- [ ] T088 [P] Aplicar `recortarDescripcion` en los dos listados —`apps/web/src/app/menu/page.tsx` y `apps/web/src/app/negocio/productos/page.tsx`— y comprobar que la ficha y los formularios muestran la descripción íntegra (§ Presentación de la descripción en los listados, D-033, paso V-56)
- [ ] T078 [P] Aplicar `formatearPrecio` en las cuatro superficies que muestran precios —`apps/web/src/app/menu/page.tsx`, `apps/web/src/app/menu/[id]/page.tsx`, `apps/web/src/app/negocio/productos/page.tsx` y el formulario de producto— y comprobar que ninguna lo compone a mano (§ Presentación del precio, paso V-44)
- [ ] T079 Recorrer las ocho pantallas nuevas de `apps/web/src/app/negocio/` y `apps/web/src/app/menu/` comprobando el vocabulario de § Vocabulario visible del catálogo y que ningún sinónimo prohibido aparece en pantalla (SC-029, paso V-43)
- [ ] T080 Recorrer y operar las ocho pantallas **solo con teclado**, incluidos los diálogos de confirmación de `apps/web/src/app/negocio/productos/_components/dialogo-confirmacion.tsx`, verificando foco visible y etiqueta asociada en cada campo (FR-037, SC-028, pasos V-46 y V-47)
- [ ] T081 Comprobar las ocho pantallas a 360 píxeles de ancho, en particular `apps/web/src/app/negocio/productos/page.tsx`, que tiene más columnas que el listado de usuarios de E1 (FR-038, paso V-48)
- [ ] T082 Ejecutar desde la raíz del repositorio `pnpm test`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck` y `pnpm build`, y dejarlas en verde ([quickstart.md](./quickstart.md) § Comprobaciones automáticas)
- [ ] T083 Cargar el catálogo hasta 50 productos activos y cronometrar `apps/web/src/app/menu/page.tsx` y `apps/web/src/app/negocio/productos/page.tsx`, con y sin filtros (SC-030, paso V-55)
- [ ] T084 Ejecutar los 56 pasos de [quickstart.md](./quickstart.md) § Validación funcional, anotando el resultado de cada uno. **Es la única cobertura de los ocho criterios que ninguna prueba automática alcanza** —SC-001 y SC-009 (cronómetro), SC-002 (conteo de clics), SC-006 (ausencia de acciones de borrado), SC-011 (recorrido de la tabla de intenciones), SC-019 (ayuda visible sin interacción), SC-025 (llegar a un producto solo con filtros) y SC-029 (texto en español)—
- [ ] T085 Registrar el resultado de la validación en `specs/002-administracion-menu-productos/verificacion.md`, con el mismo formato que E1, declarando explícitamente los ocho criterios sin cobertura automática y la mitad de SC-023 que espera a E2
- [ ] T086 Actualizar `CLAUDE.md` y `specs/README.md` con el estado de E3 una vez verificada

---

## Dependencias y orden de ejecución

### Entre fases

- **Fase 1 · Preparación**: sin dependencias.
- **Fase 2 · Cimientos**: depende de la Fase 1. **Bloquea todo lo demás.**
- **Fase 3 · US1**: depende de la Fase 2.
- **Fase 4 · US2**: depende de la Fase 3 —no solo de la 2—. Es la única dependencia entre
  historias, y viene de RN-012: sin una categoría activa por dimensión no se puede dar de alta
  ningún producto.
- **Fase 5 · Consulta**: depende de las Fases 3 y 4.
- **Fase 6 · Cierre**: depende de todo lo anterior.

### Dentro de `packages/shared` (Fase 2)

`validarDescripcion` (T006) antes que los esquemas que la usan (T012, T013). Los enums (T004,
T005) antes que los tipos (T017). El índice (T018) al final, cuando todo lo demás existe.

### Dentro de cada historia

Pruebas → servicio → controlador → módulo → pantallas. El servicio antes que el controlador
porque este último solo valida y delega; las pantallas al final, cuando hay API contra la que
trabajar.

### Oportunidades de paralelismo

- **Fase 2**: T004, T005, T007, T008, T014 y T016 son archivos distintos y pueden ir a la vez.
  T009, T010 y T011 tocan los dos archivos de mensajes, así que **no** son paralelizables entre
  sí.
- **Fase 3**: las **cinco** baterías T022 a T026 se escriben en paralelo, cada una en su propio
  archivo. T031 puede empezar mientras se implementa el servicio.
- **Fase 4**: las **ocho** baterías T037 a T044 en paralelo. T050 en paralelo con el servicio.
- **Fase 5**: las cuatro baterías T058 a T061 en paralelo.
- **Fase 6**: T077 y T078 con el resto de la fase.

Las tareas del mismo archivo **nunca** se marcan como paralelas: T045, T046 y T047 tocan las
tres `products.service.ts` y van una tras otra. Tampoco hay ninguna tarea que toque archivos de
**dos historias distintas**: el resguardo de doble disparo se aplica en T036 para las pantallas
de categorías y en T056 para las de productos, cada uno dentro de su fase, en lugar de una sola
tarea a caballo entre ambas.

## Ejemplo de ejecución paralela: Historia 1

```bash
# Las cuatro baterías de la Historia 1, a la vez:
Tarea: "Batería de creación y validación en services/api/test/categories-create.integration-spec.ts"
Tarea: "Batería de unicidad en services/api/test/categories-unique.integration-spec.ts"
Tarea: "Batería de desactivación y reactivación en services/api/test/categories-status.integration-spec.ts"
Tarea: "Batería de autorización en services/api/test/categories-roles.integration-spec.ts"
```

Cada una en su propio archivo, de modo que el paralelismo es real y no exige coordinar bloques
`describe` dentro de un archivo compartido. **Se ejecutan en serie de todos modos** —
`jest.integration.config.js` fija `maxWorkers: 1` porque comparten una única base de datos—;
lo que se paraleliza es escribirlas, no correrlas.

## Estrategia de implementación

### MVP primero

1. Fases 1 y 2 completas.
2. Fase 3 · HU-14 entera.
3. **Parar y validar**: pasos V-01 a V-12 con un usuario de rol negocio y ningún producto.
4. Ya hay algo demostrable: el negocio organiza su catálogo sin esperar un despliegue.

### Entrega incremental

1. Cimientos → contratos y esquema listos.
2. + HU-14 → validar → demostrable (MVP).
3. + HU-02 → validar → el negocio administra su catálogo entero.
4. + Consulta del menú → validar → el cliente llega a cualquier producto solo con filtros.
5. + Semilla y cierre → E3 verificada.

### Con varias personas

Las dos historias **no** son paralelizables entre sí: HU-02 necesita HU-14. Lo que sí admite
reparto es, dentro de cada fase, separar API e interfaz —el contrato de `contracts/api.md` es
lo bastante preciso para trabajar contra él antes de que exista—, y escribir las baterías de
integración mientras se implementa el servicio.

## Notas

- `[P]` = archivos distintos, sin dependencias pendientes.
- La etiqueta de historia sirve para la trazabilidad: en la Fase 5 indica **qué escenario cierra
  la tarea**, no en qué fase se ejecuta.
- Commit por tarea o por grupo lógico, con el asunto en español.
- Ninguna tarea introduce una dependencia nueva. Si alguna parece necesitarla, es señal de que
  hay que revisar el plan antes de instalarla.
- Cada tarea remite a un requisito o a un escenario. Si algo no está en la spec, no se
  construye: se enmienda la spec primero.

## Resumen

| Fase | Tareas | Historia |
|---|---|---|
| 1 · Preparación | T001–T003 (3) | — |
| 2 · Cimientos | T004–T021 + T087 (19) | — |
| 3 · Clasificación | T022–T036 (15) | US1 (P1) |
| 4 · Administración del menú | T037–T057 (21) | US2 (P2) |
| 5 · Consulta del menú | T058–T073 (16) | US1 y US2 |
| 6 · Semilla y cierre | T074–T086 + T088 (14) | — |
| **Total** | **88** | |

**T087 y T088** se añadieron el 2026-08-16, al cerrar los ítems CHK005 y CHK035 del checklist de contenido: la descripción es párrafo plano y en los listados se recorta (D-033). Llevan número al final para no renumerar las 86 tareas ya trazadas, pero se ejecutan en su fase —T087 en Cimientos, junto a `formatearPrecio`; T088 en el cierre, junto a la aplicación del formato de precio—.
