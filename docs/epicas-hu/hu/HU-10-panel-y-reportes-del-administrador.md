# HU-10 — Panel y reportes del administrador

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E1 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E1 · Acceso y usuarios ya está construida y verificada, a partir de
> `specs/001-acceso-y-usuarios/spec.md` (Historia de Usuario 3) y del código
> resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-08](./HU-08-autenticacion-y-sesion.md) y
> [HU-09](./HU-09-gestion-de-usuarios-y-roles.md), de las que depende
> directamente.

**Como** administrador, **quiero** ver de un vistazo el estado operativo del
sistema —usuarios activos por rol y pedidos por estado— y consultar un
historial filtrable de pedidos, **para** entender cómo va el servicio sin
tener que revisar cada pantalla por separado.

| Campo | Valor |
| --- | --- |
| **Épica** | E1 · Acceso y usuarios |
| **Prioridad** | P3 dentro de su spec (fase D, la última de la épica) |
| **MVP (web)** | Sí, aunque sus métricas de pedidos se completan recién con E4/E2 |
| **Causa raíz** | El panel es la página de inicio del administrador (FR-031 de HU-08): sin ella, entrar como administrador no llevaría a ninguna parte propia del rol. |
| **Depende de** | HU-08 (rol y sesión), HU-09 (usuarios activos por rol, que el panel agrega) |
| **Consumida por** | Ninguna HU futura; es una vista de solo lectura, terminal en el flujo. E4 (HU-03) y E2 (HU-01) la completan al proveer los pedidos que el panel consulta, sin que HU-10 tenga que cambiar |

---

## Alcance de esta HU

**Qué entra**: restringir el panel al rol administrador; mostrar cantidad de
usuarios activos por rol y de pedidos por estado, siempre con los cuatro
roles y los cinco estados visibles aunque valgan cero; el reporte de
pedidos filtrable por estado y por rango de fechas; el mensaje de "sin
datos" cuando un filtro no produce resultados; y la garantía de que el panel
no ofrece ninguna acción que modifique datos operativos.

**Qué no entra**: cualquier acción que cambie el estado de un pedido o de un
usuario — eso es HU-07 (E8) para pedidos y HU-09 para usuarios; crear,
editar o mostrar el detalle completo de un pedido con su historial de
transiciones — eso es HU-03 (E4); exportar el reporte a archivos externos o
actualizarlo en tiempo real — fuera de alcance de v1.

---

## Entrega por fases: lo que se verifica dentro de E1 y lo que espera a E4/E2

Las métricas y el reporte de pedidos (parte de FR-019, más FR-020 y FR-023)
se especifican completos en esta HU, pero dependen de que existan pedidos —
definidos recién en E2 y consultables recién con E4. Mientras esas épicas no
existían, el panel mostraba el mismo mensaje de "sin datos" que aplica a
cualquier filtro sin resultados, y no un espacio en blanco ni un aviso sobre
épicas futuras. Las métricas de usuarios activos por rol, el control de
acceso al panel, la ausencia de acciones de modificación y el mensaje de
"sin datos" sí eran verificables íntegramente dentro de E1, y así se
verificaron. La verificación funcional de las métricas y el reporte de
pedidos completos se cerró recién el 2026-08-23, cuando E4 (HU-03) entregó
el historial que las hace consultables (ver "Cierra una verificación
pendiente de HU-10" en `CLAUDE.md`).

---

## Reglas de negocio

- **RN-003 · El acceso lo determina el rol**: todos los usuarios con rol
  "administrador" acceden al panel sin excepciones individuales, heredado
  de HU-09.
- **RN-004 · El panel es de solo lectura**: no puede alterar el estado de
  pedidos ni de usuarios; para forzar el avance de un pedido atascado, el
  administrador usa HU-07 (E8), no esta pantalla.
- **RN · Navegar no es modificar**: que el panel enlace a la gestión de
  usuarios no incumple RN-004, porque el enlace no cambia ningún dato — lo
  cambian las acciones de HU-09, ya dentro de esa otra vista y con sus
  propias confirmaciones.
- **RN · Cero cuenta igual que cualquier otro valor**: los cuatro roles y
  los cinco estados de pedido aparecen siempre en las métricas, incluso en
  cero; una cifra que desaparece al valer cero obliga a adivinar si el dato
  falta o es nulo.
- **RN · El panel respeta la máquina de estados que ya existe**: refleja el
  estado de los pedidos con la misma máquina de estados de HU-01/HU-03, sin
  definir estados propios.

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Panel y reportes del administrador

  Escenario: HU10-E01 · Acceso al panel de administración
    Dado que inicié sesión como administrador
    Cuando entro a la aplicación
    Entonces llego al panel con las métricas generales visibles

  Escenario: HU10-E02 · Acceso denegado a otros roles
    Dado que inicié sesión con un rol distinto de "administrador"
    Cuando intento acceder al panel de administración
    Entonces el sistema me lo impide

  Escenario: HU10-E03 · Reporte de pedidos filtrado por estado
    Dado un conjunto de pedidos en distintos estados
    Cuando el administrador filtra el reporte por estado "rechazado"
    Entonces ve únicamente los pedidos en ese estado

  Escenario: HU10-E04 · Reporte de pedidos filtrado por rango de fechas
    Dado pedidos creados en distintas fechas
    Cuando el administrador filtra el reporte entre dos fechas, ambas inclusivas
    Entonces ve únicamente los pedidos creados dentro de ese rango, en el huso horario de referencia del producto

  Escenario: HU10-E05 · El panel no ofrece acciones de modificación
    Dado que el administrador recorre el panel y el reporte de pedidos
    Cuando busca alguna acción que cambie un estado o un dato de usuario
    Entonces no encuentra ninguna, salvo enlaces de navegación hacia otras pantallas

  Escenario: HU10-E06 · Mensaje de filtro sin resultados
    Dado que ningún pedido cumple el filtro aplicado
    Cuando el administrador consulta el reporte
    Entonces ve un mensaje claro en español, no una pantalla vacía
```

---

## Casos límite cubiertos

- Un rango de fechas con la fecha inicial posterior a la final se rechaza
  con un mensaje explicativo, en lugar de devolver un conjunto vacío que se
  confundiría con "no hay pedidos".
- Elegir la misma fecha de inicio y de fin consulta ese día completo, porque
  ambos extremos son inclusivos.
- Las fechas del filtro se interpretan en el huso horario de referencia del
  producto (`America/Santiago`), nunca en el huso del navegador de quien
  consulta: dos administradores en husos distintos ven el mismo reporte
  para el mismo rango.
- Mientras las métricas de pedidos no existían (antes de E2/E4), el panel
  mostraba "sin datos", nunca un espacio en blanco ni un aviso sobre
  épicas futuras.
- El panel nunca ofrece exportar a archivos externos ni se actualiza en
  tiempo real: quien necesita datos más recientes recarga la página.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-007 | Un administrador accede al panel y ve las métricas generales en menos de 5 segundos. |
| SC-008 | El 100 % de los intentos de acceso al panel por usuarios sin rol "administrador" son bloqueados. |
| SC-009 | El 100 % de las consultas de reporte filtradas devuelven únicamente datos que cumplen los criterios de filtro seleccionados. |
| SC-015 | El 100 % de las vistas del panel —verificadas contra un inventario cerrado de esas vistas— carecen de acciones que modifiquen datos operativos. |
| SC-020 | El 100 % de las búsquedas y filtros sin resultados, también en el panel, muestran un mensaje explicativo en español. |

---

## Frontera con HU-03 (E4) y HU-07 (E8) — a respetar

HU-10 **consulta** pedidos y usuarios; no los crea, ni los modifica, ni
expone su historial de transiciones. HU-03 (E4) es quien construye la
consulta del historial completo de un pedido — HU-10 solo agrega y filtra
sobre lo mismo que HU-03 detalla. Cuando un pedido queda atascado y hace
falta intervenir, esa acción vive en HU-07 (E8): el panel puede mostrar que
un pedido lleva mucho tiempo en un estado, pero no ofrece ningún botón para
forzarlo — RN-004 lo prohíbe explícitamente.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Cualquier acción que modifique datos operativos desde el panel**:
  corresponde a HU-07 (E8, pedidos) o HU-09 (usuarios).
- **Exportación de reportes a archivos externos** (PDF, Excel, CSV).
- **Actualización en tiempo real del panel**.
- **Alertas o señales automáticas** sobre pedidos atascados o antiguos: la
  detección es siempre discrecional del administrador (frontera con HU-07).
- **Soporte multi-local**: el reporte no se segmenta por local.

---

## Qué construyó realmente (resumen de implementación)

- **`packages/shared`**: sin tipos ni esquemas propios más allá de los
  filtros de fecha/estado, reutilizados de HU-01/HU-03; la etiqueta visible
  de cada estado de pedido ya vive en `packages/shared` desde HU-01.
- **`services/api`**: `DashboardController`, exclusivo del rol
  administrador, con las métricas agregadas (usuarios activos por rol,
  pedidos por estado) y el reporte filtrable. Antes de que existieran
  pedidos, respondía con el mismo criterio de "sin datos" que cualquier
  filtro vacío. Tras E4, este mismo controlador incorporó
  `GET /admin/dashboard/orders/:id` para el detalle de un pedido con su
  historial (ver HU-03).
- **`apps/web`**: `/admin` (el panel, página de inicio del rol) con sus
  métricas y su reporte filtrable por estado y rango de fechas.
- **Verificación funcional**: 2026-08-15 para el control de acceso, las
  métricas de usuarios y el mensaje de "sin datos"; sin defectos
  encontrados en esa parte. La verificación de las métricas y el reporte de
  pedidos completos, condicionada a la existencia de pedidos, se cerró el
  2026-08-23 junto con E4 (HU-03), también sin defectos. Detalle en
  `specs/001-acceso-y-usuarios/verificacion.md`.
