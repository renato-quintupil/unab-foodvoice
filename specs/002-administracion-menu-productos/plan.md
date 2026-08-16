# Plan de Implementación: E3 · Administración de menú

**Rama**: `002-administracion-menu-productos` | **Fecha**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de la funcionalidad en `specs/002-administracion-menu-productos/spec.md`

## Resumen

E3 construye el catálogo: dos entidades nuevas —**categoría** y **producto**—, las pantallas
con que el negocio las administra y las pantallas con que los otros tres roles consultan el
menú. No hay ninguna tecnología nueva: se ejecuta íntegramente sobre el stack que E1 dejó
levantado y verificado (Next.js 15 como BFF, NestJS 11, Prisma 6, PostgreSQL 16, Zod en
`packages/shared`), reutilizando su mecanismo de sesión, sus guards de rol, sus convenciones
de error y su función de normalización.

Las tres decisiones de diseño que gobiernan todo lo demás:

1. **Las dimensiones son un enum fijo en el código; las categorías, filas administrables**
   (D-020). La clasificación de un producto son **dos columnas obligatorias**, una por
   dimensión, no una tabla de unión: así el estado que RN-011 prohíbe —un producto activo con
   ninguna o con dos categorías de la misma dimensión— es **irrepresentable**, en vez de
   depender de una validación que alguien pueda olvidar.
2. **El tramo de precio no existe como dato**: se deriva en cada consulta con dos precios de
   corte calculados en SQL (D-023). No hay columna, ni índice, ni recálculo al cambiar un
   precio.
3. **La descripción se valida una sola vez**, en un esquema Zod compartido que aplica el
   mínimo de caracteres y las tres condiciones de sustancia de FR-039 (D-025). El formulario y
   la API ejecutan el mismo código; no hay dos definiciones de «descripción válida».

El riesgo real de la épica no es técnico. Lo dice la propia spec y el plan lo asume: el
esquema es sencillo y lo difícil es que el **contenido** —las descripciones que E6 leerá—
exista y sirva. Por eso la semilla (FR-036) no es el último paso decorativo sino un entregable
con cantidades mínimas exigibles, y la fase final incluye una revisión humana de su contenido
(SC-032) que ninguna prueba automática puede sustituir.

## Contexto Técnico

**Lenguaje/Versión**: TypeScript 5 con `strict: true`, sobre Node.js 22 LTS. Sin cambios
respecto de E1.

**Dependencias principales**: las ya presentes en el monorepo — Next.js 15 (App Router),
React 19, TailwindCSS 4, shadcn/ui, react-hook-form con resolver de Zod, NestJS 11, Prisma 6,
Zod. **E3 no incorpora ninguna dependencia nueva**, ni de producción ni de desarrollo.

**Almacenamiento**: PostgreSQL 16, con `prisma migrate`. Dos tablas nuevas (`category`,
`product`) y un enum nuevo (`dimension`). Ninguna tabla existente cambia.

**Pruebas**: se hereda íntegra la disposición de E1, **sin unificar runners ni mover archivos**.
Unitarios con **Vitest** en `packages/shared` y `apps/web`, y con **Jest** en `services/api`,
todos con los umbrales de cobertura ya configurados. Integración con **Jest** en
`services/api`, contra PostgreSQL efímera en Docker: los archivos viven en
`services/api/test/` y se llaman `<dominio>-<aspecto>.integration-spec.ts`, porque
`jest.integration.config.js` los selecciona con `testRegex: 'test/.*\.integration-spec\.ts$'` y
**una batería fuera de ese patrón no se ejecutaría, pasando por verde sin haber corrido**. Un
archivo por batería, como en E1.

La unicidad normalizada, el conteo de bloqueadores de una categoría y la atomicidad de la
desactivación **no se cubren con unitarios**: son de integración por definición.

**Plataforma objetivo**: navegador (desde 360 px de ancho) y contenedores Linux, igual que E1.

**Tipo de proyecto**: aplicación web en monorepo pnpm + Turborepo, con `apps/web` actuando de
BFF frente a `services/api`.

**Objetivos de rendimiento**: menú y listado de administración completos en **menos de 5
segundos** con un catálogo de al menos 50 productos activos (SC-030), medido con cronómetro
sobre el entorno de contenedores, con el mismo método que E1 usó para SC-001 y SC-007. Sin
instrumentación ni pruebas de carga.

**Restricciones**: mono-local; texto visible íntegramente en español; ningún elemento de voz,
ninguna llamada a un modelo de lenguaje y ninguna clave de servicio nueva; sin borrado físico
de productos ni de categorías; el precio es un entero en pesos chilenos.

**Escala/Alcance**: catálogo de decenas de productos —doce como mínimo exigible a la semilla,
cincuenta como catálogo de referencia para medir el tiempo de respuesta—. **Ocho pantallas
nuevas** —tres de categorías, tres de productos, el menú y la ficha— y **doce endpoints
nuevos** —cuatro de categorías, cinco de productos y tres de consulta—, detallados en
§ Estructura del Proyecto y en `contracts/api.md`.

## Constitution Check

*PUERTA: debe pasarse antes de la Fase 0 y volver a evaluarse tras la Fase 1.*

| Principio | Cómo lo cumple este plan |
|---|---|
| **I · Simplicidad ante todo** | Cero dependencias nuevas. Dos tablas y un enum. El tramo de precio no se persiste ni se indexa. La clasificación son dos columnas, no una tabla de unión con reglas de cardinalidad. Se rechazó `pgvector`, el control de concurrencia optimista y el stock numérico, los tres declarados fuera de alcance en la spec. |
| **II · Idioma: todo en español** | Los mensajes fijos nuevos se añaden a `packages/shared/src/messages/es.ts` y las etiquetas visibles a `etiquetas.ts`; ninguna pantalla escribe texto suelto. Los identificadores técnicos siguen en inglés (`product`, `category`, `dimension`). |
| **III · Cero alcance fantasma** | Cada endpoint, pantalla y esquema de este plan se remite a un requisito de la spec en § Trazabilidad. Lo que no aparece ahí, no se construye. |
| **IV · Verificable por una persona no técnica** | La guía de validación (`quickstart.md`) recorre los 32 criterios de éxito con clics y pantallas. Las cuatro excepciones —SC-004, SC-005 y SC-021 exigen invocar la API sin interfaz, y SC-023 comprobar que nada se reescribió— se declaran como tales, igual que E1 declaró las suyas. |
| **V · Datos del usuario con respeto** | E3 no pide ningún dato personal nuevo ni introduce ningún secreto. No hay variables de entorno nuevas. |
| **VI · Voz primero, con paridad manual (NO NEGOCIABLE)** | E3 **es** la mitad manual. FR-033 obliga a que todo lo que E6 resolverá por voz —tipo de comida, perfil de salud, tramo de precio, combinaciones y listado abierto— funcione aquí con filtros, y SC-025 lo comprueba alcanzando tres productos al azar solo con ellos. |
| **VII · Entender la intención** | No aplica en E3: no hay interpretación de lenguaje natural. Lo que sí hace esta épica es **guardar los datos** sobre los que E6 la construirá, y la tabla de § Qué se guarda declara qué frase habilita cada campo. |
| **VIII · El catálogo es la única verdad** | Es el principio que la épica materializa. RN-018 y FR-029 se implementan en la **consulta**, no en la pantalla: un producto no ofrecible nunca sale de la API, de modo que ninguna vía —incluida la futura de voz— pueda devolverlo. |
| **IX · Confirmar antes de actuar y poder deshacer** | Dar de baja y reactivar piden confirmación explícita y cancelable (FR-020). Toda retirada es reversible y no existe ninguna acción de borrado (FR-009, SC-006). Agotar y reponer son la única excepción, justificada en la spec y exigida por SC-002. |
| **X · Privacidad y datos mínimos** | Sin micrófono, sin audio, sin datos personales nuevos. |
| **XI · Calidad guiada por especificación (test-first)** | Los 34 escenarios Gherkin están escritos y trazados a requisito y criterio **antes** de este plan. Cada batería de pruebas se nombra por el escenario que ejerce. |
| **XII · Trazabilidad del pedido** | No aplica en E3 —no hay pedidos—. Lo que sí aporta es su mitad del contrato hacia E2: FR-024 obliga a que el pedido guarde su propio precio, y E3 se compromete a no reescribir nada hacia atrás. |

### Las dos lecturas del Principio VIII

El principio habla de «el catálogo y el stock (…) **por local**». Este plan lo cumple con dos
matices —«stock» como el interruptor `disponible` y ningún modelo de local mientras v1 sea
mono-local— que **ya no son una interpretación de esta épica**: están declarados en
`.specify/memory/constitution.md` § Alcance en v1 del Principio VIII, enmienda 1.1.0 del
2026-08-16, motivada precisamente por el análisis de E3.

Lo que sí es responsabilidad de este plan es la parte del principio que no admite excepción:
**ningún producto inexistente, dado de baja o agotado se muestra como pedible**, y eso se
implementa en la consulta (FR-029, RN-018), no en la pantalla. Conviene retener la caducidad
declarada en la enmienda: en cuanto exista un segundo local, el catálogo debe segmentarse
**antes** de admitirlo, no después.

### Reevaluación posterior a la Fase 1

Repetida tras redactar `data-model.md` y los contratos. **Sin violaciones nuevas.** Los tres
puntos que se revisaron expresamente:

- **¿Dos columnas de clasificación en lugar de una tabla de unión es alcance anticipado?** No:
  es la opción más simple **y** la única que hace irrepresentable el estado que RN-011 prohíbe.
  Una tabla de unión sería más código y más reglas para permitir un estado que la spec veta.
- **¿El cálculo de los cortes en SQL es complejidad prematura?** No: la alternativa —traer
  todos los precios al proceso y ordenarlos en memoria— es más código y falla peor al crecer.
  Son dos consultas con `OFFSET`, sin extensiones ni funciones de ventana.
- **¿Las tres condiciones de FR-039 son alcance fantasma?** No: FR-039 es un requisito de la
  spec vigente, añadido tras el checklist de contenido, con su criterio de éxito (SC-031).

## Estructura del Proyecto

### Documentación (esta funcionalidad)

```text
specs/002-administracion-menu-productos/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones D-020 a D-032
├── data-model.md        # Fase 1: entidades, invariantes y esquema Prisma
├── quickstart.md        # Fase 1: puesta en marcha y guía de validación
├── contracts/
│   ├── README.md        # Cómo se leen los dos contratos
│   ├── api.md           # Superficie HTTP de services/api
│   └── shared.md        # Superficie pública de packages/shared
├── checklists/
│   ├── requirements.md  # Calidad de la spec
│   └── contenido-catalogo.md
└── tasks.md             # Fase 2: lo genera /speckit-tasks, no este comando
```

### Código fuente (raíz del repositorio)

Solo se listan los archivos que E3 **crea o modifica**. Todo lo demás del monorepo permanece
intacto.

```text
packages/shared/src/
├── enums/
│   └── dimension.ts                  # NUEVO · Dimension, PriceTier
├── schemas/
│   ├── category.ts                   # NUEVO · crear/editar categoría
│   ├── product.ts                    # NUEVO · crear/editar producto
│   ├── description.ts                # NUEVO · mínimo + tres condiciones de FR-039
│   └── query.ts                      # MODIFICADO · ListProductsQuery, MenuQuery
├── messages/
│   ├── es.ts                         # MODIFICADO · mensajes fijos del catálogo
│   └── etiquetas.ts                  # MODIFICADO · estados, dimensiones, tramos
├── format/
│   ├── precio.ts                     # NUEVO · formatearPrecio() → "$4.990"
│   └── texto.ts                      # NUEVO · recortarDescripcion() para los listados
├── types/
│   └── api.ts                        # MODIFICADO · CategoryDto, ProductDto
└── index.ts                          # MODIFICADO · superficie pública

services/api/
├── prisma/
│   ├── schema.prisma                 # MODIFICADO · enum Dimension, category, product
│   ├── migrations/                   # NUEVO · una migración
│   └── seed/
│       └── catalogo.ts               # NUEVO · semilla del catálogo (FR-036)
└── src/
    ├── categories/                   # NUEVO · módulo de categorías (HU-14)
    │   ├── categories.controller.ts
    │   ├── categories.service.ts
    │   └── categories.module.ts
    ├── products/                     # NUEVO · módulo de productos (HU-02)
    │   ├── products.controller.ts
    │   ├── products.service.ts
    │   └── products.module.ts
    ├── menu/                          # NUEVO · consulta del catálogo
    │   ├── menu.controller.ts
    │   ├── menu.service.ts            # incluye la derivación de tramos (D-023)
    │   └── menu.module.ts
    └── app.module.ts                  # MODIFICADO · registra los tres módulos

apps/web/src/
├── app/
│   ├── negocio/
│   │   ├── categorias/                # NUEVO · listado, alta y edición
│   │   │   ├── nueva/
│   │   │   └── [id]/editar/
│   │   ├── productos/                 # NUEVO · listado, alta, edición
│   │   │   ├── nuevo/
│   │   │   └── [id]/editar/
│   │   └── _components/               # NUEVO · formularios y acciones de fila
│   └── menu/                          # NUEVO · consulta para los cuatro roles
│       ├── page.tsx                   # listado con filtros, sin paginación
│       └── [id]/page.tsx              # ficha de producto (FR-034)
└── components/ui/                     # MODIFICADO · solo si falta alguna primitiva

services/api/test/                      # baterías de integración, junto a las de E1
├── catalog-schema.integration-spec.ts       # NUEVO · migración e índices
├── categories-create|unique|status|roles.integration-spec.ts   # NUEVO
├── products-create|unique|classification|switches|reactivate|list|roles.integration-spec.ts  # NUEVO
├── menu-price-tiers|filters|visibility|detail.integration-spec.ts  # NUEVO
└── catalog-seed.integration-spec.ts         # NUEVO · idempotencia de la semilla
```

El sufijo `.integration-spec.ts` y la carpeta `services/api/test/` **no son negociables**:
`jest.integration.config.js` selecciona las baterías con
`testRegex: 'test/.*\.integration-spec\.ts$'`, de modo que una prueba escrita en otro sitio no
se ejecutaría y la suite pasaría en verde sin haberla corrido. Un archivo por batería, como en
E1 (`users-list`, `users-email`, …).

**Decisión de estructura**: se conserva íntegra la de E1 —tres espacios de trabajo, monolito
modular en NestJS, App Router agrupado por rol en Next.js—. Los tres módulos nuevos siguen el
patrón de `users`: controlador delgado que valida con el esquema compartido, servicio con la
lógica y las transacciones, y módulo que los registra. La consulta del menú vive en su propio
módulo (`menu`) y no dentro de `products` porque su control de acceso es distinto: `products`
es exclusivo del rol negocio y `menu` está abierto a los cuatro roles autenticados.

## Fases de entrega

Cada fase termina con sus pruebas en verde. El orden no es negociable en los dos primeros
saltos: sin `packages/shared` no hay validación, y sin categorías no hay productos (RN-012).

### Fase A · Cimientos (habilitante)

Enum `Dimension` y `PriceTier`, esquemas Zod de categoría y producto, el esquema de descripción
con las tres condiciones de FR-039, `formatearPrecio`, los mensajes fijos y las etiquetas, los
tipos `CategoryDto` y `ProductDto`. Migración de Prisma con las dos tablas, sus columnas
normalizadas y sus índices únicos. **No entrega ninguna pantalla**: entrega la base sobre la
que las dos historias se construyen sin duplicar reglas.

### Fase B · HU-14 · Clasificación (P1)

Módulo `categories` completo —crear, editar, desactivar con conteo de bloqueadores, reactivar y
listar— y las pantallas del negocio. Cubre FR-001 a FR-011 y los escenarios HU14-E01 a
HU14-E05, E08 a E10 y E18. Al terminar, la historia es demostrable por sí sola con un usuario
de rol negocio y ningún producto en el sistema, tal como la spec exige de una P1.

### Fase C · HU-02 · Productos (P2)

Módulo `products` y las pantallas de administración: alta con un desplegable por dimensión,
edición, agotar y reponer desde el listado en dos clics, baja lógica con confirmación,
reactivación bloqueada por categoría desactivada, listado paginado con filtros y búsqueda.
Cubre FR-012 a FR-027 y FR-039, y los escenarios HU02-E01 a HU02-E05, E07 a E09, E11 y E14 a
E15, más HU14-E06, E07, E11 y E19.

### Fase D · Consulta del menú

Módulo `menu`, la pantalla del menú sin paginación, la ficha de producto con su dirección
propia y la derivación de tramos de precio. Cubre FR-028 a FR-035 y FR-038, y los escenarios
HU14-E12 a E17, HU02-E06, E10, E12 y E13.

### Fase E · Semilla, accesibilidad y validación funcional

Semilla del catálogo con sus cantidades mínimas y su contenido revisado a mano; repaso de las
cuatro condiciones de accesibilidad de FR-037 sobre las ocho pantallas nuevas; y el recorrido
completo de `quickstart.md`, incluida la revisión humana de SC-032. **Esta fase no es un
trámite**: en E1, dos de los cuatro criterios sin cobertura automática no se cumplían cuando
solo se había auditado el código.

## Complexity Tracking

Ninguna violación de la constitución que justificar. Se registran, en cambio, las tres
decisiones que **aumentan** el trabajo respecto de la solución mínima concebible, con lo que se
compra a cambio.

| Decisión | Trabajo que añade | Por qué se acepta |
|---|---|---|
| Columnas `name_normalized` persistidas con índice único (D-021) | Una columna más por tabla y la obligación de repoblarla si `normalizarBusqueda` cambiara | Es la única forma de que la unicidad insensible a acentos y mayúsculas la garantice la **base de datos** y no una comprobación previa, que dos peticiones simultáneas pueden sortear. Mismo criterio que E1 con `search_normalized` |
| Tres condiciones de sustancia en la descripción (D-025, FR-039) | Un esquema más y sus pruebas | Sin ellas, la única defensa de la calidad del contenido es un contador de caracteres que «rica rica rica rica rica rica» supera. Es el riesgo declarado de la épica |
| Módulo `menu` separado de `products` (§ Estructura) | Un módulo más en NestJS | Los dos tienen control de acceso opuesto. Fundirlos obligaría a decidir el rol endpoint por endpoint dentro de un mismo controlador, que es exactamente cómo se cuela un agujero de autorización |

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El contenido de la semilla se escribe deprisa y queda pobre, y E6 lo hereda | Alto: es el riesgo que la propia spec declara como el real de la épica | SC-032 exige leer una por una las descripciones y comprobar que cada una menciona algo que su nombre no dice. Es revisión humana y así está declarado |
| `normalizarBusqueda` cambia más adelante y deja las columnas normalizadas calculadas con dos versiones | Alto y silencioso: unos nombres colisionarían y otros no, sin error visible | La función ya lleva la advertencia de E1; `data-model.md` la repite para las dos columnas nuevas. Todo cambio exige una migración que las repueble |
| Los tramos de precio se malinterpretan al implementarse (por rango en lugar de por cantidad) | Medio: el filtro devolvería resultados plausibles pero equivocados | FR-032 declara el algoritmo paso a paso y D-023 lo traduce a SQL; las pruebas incluyen el catálogo de precios agrupados y el de empate en el borde |
| Se implementa el bloqueo de acceso solo ocultando opciones en la interfaz | Alto: SC-021 falla y el agujero es real | FR-027 exige el rechazo al procesar; la validación funcional lo comprueba **sin interfaz**, invocando el endpoint con la sesión de otro rol |
| La reactivación de un producto con categoría desactivada se pasa por alto | Medio: produciría productos activos invisibles para los filtros | FR-021 y HU02-E15, con batería de integración propia |

## Trazabilidad requisito → fase

| Requisitos | Fase |
|---|---|
| FR-039 (sustancia de la descripción), mensajes, etiquetas y formato de precio | A |
| FR-001 a FR-011 | B |
| FR-012 a FR-027 | C |
| FR-028 a FR-035, FR-038 | D |
| FR-036 (semilla), FR-037 (accesibilidad) | E |

Los criterios de éxito se trazan uno a uno en `quickstart.md` § Cobertura de los criterios de
éxito, que es donde se declara además cuáles no tienen cobertura automática.
