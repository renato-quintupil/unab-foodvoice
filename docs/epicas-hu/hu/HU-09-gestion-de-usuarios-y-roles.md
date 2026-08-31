# HU-09 — Gestión de usuarios y roles

> Reconstrucción retrospectiva. A diferencia de HU-02, HU-04, HU-05, HU-06,
> HU-07, HU-13 y HU-14, esta HU **no se redactó como borrador previo a la
> spec**: E1 se especificó directo con `/speckit.specify` sobre un borrador
> consolidado de la épica completa. Este documento se escribe después de que
> E1 · Acceso y usuarios ya está construida y verificada, a partir de
> `specs/001-acceso-y-usuarios/spec.md` (Historia de Usuario 2) y del código
> resultante, para dejar el mapa de HU completo. Se lee junto a
> [HU-08](./HU-08-autenticacion-y-sesion.md), de la que depende directamente,
> y [HU-10](./HU-10-panel-y-reportes-del-administrador.md), la otra historia
> exclusiva del rol administrador.

**Como** administrador, **quiero** crear, editar, desactivar, reactivar y
asignar el rol de los usuarios del sistema, **para** controlar quién tiene
acceso y con qué funciones, sin depender de un autorregistro que nadie
supervisa.

| Campo | Valor |
| --- | --- |
| **Épica** | E1 · Acceso y usuarios |
| **Prioridad** | P2 dentro de su spec (fase C, tras la autenticación) |
| **MVP (web)** | Sí |
| **Causa raíz** | Sin autorregistro (decisión de alcance de v1), el único camino para que exista un cliente, un negocio o un repartidor es que el administrador lo dé de alta. |
| **Depende de** | HU-08 (sesión y rol ya resueltos, la sesión que se invalida en las acciones de impacto) |
| **Consumida por** | HU-10 (las métricas de usuarios activos por rol que muestra el panel se alimentan de aquí); todas las épicas posteriores, que necesitan usuarios de cada rol para poder construirse y validarse |

---

## Alcance de esta HU

**Qué entra**: crear un usuario con nombre, correo, teléfono, contraseña
inicial y rol; editar los datos de contacto y el correo de uno existente;
cambiar su rol; desactivarlo y reactivarlo; restablecerle la contraseña;
listar, filtrar por rol y estado, y buscar por nombre o correo; la
confirmación explícita antes de cada acción de impacto; la bitácora
inmutable de estas seis acciones; y la autoprotección del administrador
sobre sí mismo.

**Qué no entra**: el mecanismo de sesión y el rechazo por rol en sí — eso es
HU-08, que HU-09 consume; el panel de métricas y el reporte de pedidos —
eso es HU-10; cualquier función específica del rol asignado (catálogo,
pedidos, reparto), que llega con sus propias épicas.

---

## Reglas de negocio

- **RN-001 · Un rol activo a la vez**: un usuario tiene exactamente un rol
  vigente; cambiarlo no le deja las dos funciones ni conserva la anterior.
- **RN-002 · Baja lógica sin pérdida de historial**: un usuario desactivado
  no puede autenticarse y su sesión se invalida de inmediato, pero su
  historial (por ejemplo, sus entregas pasadas) se conserva.
- **RN-003 · El acceso lo determina el rol, no la persona**: no hay permisos
  diferenciados dentro de un mismo rol en v1.
- **RN-005 · Correo único, incluso entre desactivados**: el correo de un
  usuario desactivado queda reservado, para que su eventual reactivación
  siempre sea posible con el mismo correo.
- **RN-006 · El sistema nunca queda sin administrador**: lo garantiza que un
  administrador no puede desactivarse ni cambiarse su propio rol a sí mismo
  (FR-027); no existe una comprobación de conteo adicional porque nunca
  podría dispararse.
- **RN-007 · Toda alta pasa por el administrador**: no existe autorregistro.
- **RN-008 · Confirmación explícita y cancelable antes de una acción de
  impacto**: cambio de rol, desactivación, reactivación y restablecimiento
  de contraseña exigen confirmación, cada una con su propio texto sobre si
  es reversible o no; el alta y la edición de contacto no la exigen, por ser
  reversibles y de bajo impacto (FR-035).
- **RN-009 · La bitácora registra por referencia, nunca por copia**: cada
  entrada guarda quién actuó, sobre quién, qué acción y cuándo — nunca
  contraseñas ni los valores anteriores o posteriores del dato cambiado — y
  es de solo-agregar: ninguna función puede editarla ni borrarla.

---

## Criterios de aceptación (Gherkin)

```gherkin
Característica: Gestión de usuarios y roles

  Escenario: HU09-E01 · Crear un usuario nuevo
    Dado que inicié sesión como administrador
    Cuando creo un usuario con nombre, correo, teléfono, contraseña inicial y rol "repartidor"
    Entonces el usuario queda creado y activo con ese rol

  Escenario: HU09-E02 · Editar los datos de contacto de un usuario
    Dado un usuario existente
    Cuando el administrador edita su nombre, correo o teléfono
    Entonces los cambios quedan reflejados en la siguiente consulta

  Escenario: HU09-E03 · Cambiar el rol de un usuario
    Dado un usuario con rol "cliente" y sesión activa
    Cuando el administrador le cambia el rol a "negocio"
    Entonces su sesión actual termina de inmediato
    Y su próximo inicio de sesión rige con el rol "negocio"

  Escenario: HU09-E04 · Desactivar un usuario
    Dado un usuario activo
    Cuando el administrador lo desactiva
    Entonces no puede volver a iniciar sesión
    Y su historial asociado se conserva

  Escenario: HU09-E05 · Reactivar un usuario
    Dado un usuario previamente desactivado
    Cuando el administrador lo reactiva
    Entonces puede volver a iniciar sesión con sus credenciales previas

  Escenario: HU09-E06 · Rechazo por datos incompletos
    Dado un formulario de alta sin el teléfono
    Cuando el administrador intenta crear el usuario
    Entonces el sistema lo rechaza con un mensaje en español que indica qué falta

  Escenario: HU09-E07 · Rechazo por correo duplicado
    Dado un correo ya usado por otro usuario, activo o desactivado
    Cuando el administrador intenta dar de alta a alguien con ese mismo correo
    Entonces el sistema rechaza el alta

  Escenario: HU09-E08 · Rechazo por contraseña corta
    Dado un formulario de alta con una contraseña de 6 caracteres
    Cuando el administrador intenta crear el usuario
    Entonces el sistema lo rechaza indicando el mínimo de 8 caracteres

  Escenario: HU09-E09 · Filtrar por rol y estado
    Dado un padrón con usuarios de varios roles y estados
    Cuando el administrador filtra por rol "repartidor" y estado "activo"
    Entonces solo ve usuarios que cumplen ambos criterios, paginados de a 20

  Escenario: HU09-E10 · Buscar por nombre o correo
    Dado un padrón con muchos usuarios
    Cuando el administrador busca "maria"
    Entonces ve solo los usuarios cuyo nombre o correo contienen ese texto, sin distinguir mayúsculas ni acentos

  Escenario: HU09-E11 · Búsqueda y filtro combinados
    Dado un padrón con usuarios de varios roles
    Cuando el administrador filtra por rol "negocio" y además busca "central"
    Entonces ve solo usuarios que cumplen ambos criterios a la vez

  Escenario: HU09-E12 · Mensaje de sin resultados
    Dado que ningún usuario cumple los criterios aplicados
    Cuando el administrador aplica esos filtros
    Entonces ve un mensaje claro en español, no una pantalla vacía

  Escenario: HU09-E13 · Restablecer la contraseña de un usuario
    Dado un usuario bloqueado temporalmente por intentos fallidos
    Cuando el administrador le restablece la contraseña
    Entonces la contraseña anterior deja de servir
    Y el bloqueo temporal se levanta de inmediato

  Escenario: HU09-E14 · Confirmación antes de una acción de impacto
    Dado que el administrador inicia la desactivación de un usuario
    Cuando se le presenta el diálogo de confirmación y lo cancela
    Entonces el usuario continúa activo, sin ningún cambio aplicado

  Escenario: HU09-E15 · Autoprotección del administrador
    Dado que el administrador ve su propio usuario en el listado
    Cuando intenta desactivarse o cambiarse su propio rol
    Entonces el sistema se lo impide
    Y sí le permite editar sus propios datos de contacto

  Escenario: HU09-E16 · El sistema siempre retiene al menos un administrador activo
    Dado que existe más de un administrador activo
    Cuando uno de ellos desactiva a otro administrador
    Entonces la acción se permite
    Y siempre queda al menos un administrador activo en el sistema
```

---

## Casos límite cubiertos

- Un usuario desactivado con sesión abierta: la sesión se invalida de
  inmediato, no al expirar por inactividad.
- Un cambio de rol con sesión activa: el nuevo rol nunca se aplica sobre la
  sesión ya abierta; esa sesión termina y el rol nuevo rige recién en el
  siguiente inicio de sesión.
- Un restablecimiento de contraseña con sesión activa: también la termina.
- El correo de un usuario desactivado bloquea el alta de otro con ese mismo
  correo, así la reactivación del original siempre es posible.
- Un filtro sin resultados muestra un mensaje, no una pantalla vacía.
- Una sesión que expira a mitad de un alta o una edición: se rechaza
  completa, sin aplicar cambios parciales.
- El último administrador no puede autodesactivarse (RN-006); otro
  administrador desactivando a otro administrador sí es posible y el
  sistema sigue garantizado por RN-006.
- No existe un procedimiento dentro de la aplicación para recuperar el
  acceso si ningún administrador conserva credenciales efectivas: es un
  procedimiento operativo fuera de la aplicación (FR-036).
- Reutilizar el correo de un usuario desactivado para otro usuario es
  imposible: la unicidad de correo cubre también a los desactivados.
- La contraseña anterior de un usuario deja de servir de inmediato tras un
  restablecimiento.
- Una contraseña de más de 72 caracteres se rechaza, nunca se recorta en
  silencio.
- Un intento fallido sobre una cuenta bloqueada se rechaza igual que uno
  sobre credenciales incorrectas, sin distinción visible.
- Cancelar una acción de impacto en el diálogo de confirmación no deja
  ningún cambio aplicado ni ninguna entrada en la bitácora.
- Un usuario desactivado que intenta iniciar sesión con sus credenciales
  correctas recibe el mismo mensaje que uno con contraseña incorrecta, y
  cuenta igual para el bloqueo temporal (frontera con HU-08, FR-008/FR-012).
- Cambiar el correo de un usuario con sesión activa no la termina: la
  sesión identifica a la persona, no a su correo (frontera con HU-08).
- Dos administradores editando al mismo usuario a la vez: prevalece el
  último cambio guardado, sin detección de conflicto — limitación declarada,
  no un defecto.

---

## Criterios de éxito (medibles, verificables sin leer código)

| ID | Criterio |
| --- | --- |
| SC-004 | Un usuario nuevo puede iniciar sesión con el rol asignado en menos de un minuto desde el alta. |
| SC-005 | El 100 % de los intentos de alta con datos obligatorios o rol faltantes son rechazados sin crear el usuario. |
| SC-011 | El 100 % de los intentos de alta con un correo ya usado, activo o desactivado, son rechazados. |
| SC-012 | Tras un restablecimiento de contraseña, el 100 % de los intentos con la contraseña anterior son rechazados. |
| SC-014 | El 100 % de los intentos de un administrador de desactivarse a sí mismo o cambiar su propio rol son bloqueados. |
| SC-016 | El 100 % de los intentos de asignar una contraseña fuera del rango de 8 a 72 caracteres son rechazados, indicando cuál límite se incumplió, y ninguna se recorta. |
| SC-019 | El 100 % de las acciones de impacto exigen confirmación explícita, y el 100 % de las canceladas dejan al usuario afectado sin ningún cambio. |
| SC-020 | El 100 % de las búsquedas y filtros sin resultados muestran un mensaje explicativo en español. |
| SC-021 | Un administrador encuentra a un usuario concreto en un padrón de cualquier tamaño escribiendo parte de su nombre o correo. |
| SC-022 | Tras cualquier secuencia de desactivaciones y cambios de rol, siempre queda al menos un administrador activo. |
| SC-023 | Recorrer dos veces las mismas páginas del listado con los mismos criterios devuelve exactamente los mismos usuarios en el mismo orden. |
| SC-025 | El 100 % de las acciones de impacto terminan las sesiones abiertas del usuario afectado. |
| SC-032 | El 100 % de las ediciones de contacto quedan reflejadas en la siguiente consulta y conservan intactos el rol y el estado. |
| SC-033 | El 100 % de los usuarios reactivados vuelven a iniciar sesión con las credenciales que tenían antes de su desactivación. |
| SC-034 | El 100 % de los listados filtrados por rol, estado o ambos devuelven solo usuarios que cumplen todos los criterios, paginados de a 20. |
| SC-037 | El 100 % de las acciones aplicadas muestran una confirmación de éxito, y el 100 % de las rechazadas muestran un mensaje de error. |
| SC-039 | Un doble clic sobre cualquier acción administrativa produce un solo efecto, nunca dos usuarios creados ni dos entradas de bitácora. |

---

## Frontera con HU-08 y HU-10 — a respetar

HU-09 ejecuta acciones sobre usuarios usando el mecanismo de sesión y rol
que define HU-08 (las cuatro acciones de impacto invalidan sesiones a
través de ese mismo mecanismo, no uno propio de HU-09). Las métricas de
usuarios activos por rol que muestra el panel de HU-10 son una **lectura**
de lo que HU-09 escribe; HU-10 no puede modificar ningún usuario (RN-004 de
HU-10) — toda acción de modificación pasa por aquí.

---

## Fuera de alcance de v1 (declarado, no omitido)

- **Autorregistro**: toda alta pasa exclusivamente por el administrador.
- **Cambio de contraseña por el propio usuario**, ni siquiera el
  administrador sobre la suya: el único camino es el restablecimiento por
  otro administrador.
- **Vista de consulta de la bitácora de acciones administrativas**: se
  guarda, pero en v1 no se expone en pantalla.
- **Modelo de permisos granular dentro de un mismo rol**.
- **Eliminación física de un usuario**: solo baja lógica, por trazabilidad
  de pedidos históricos.
- **Notificaciones al usuario afectado** por correo o mensaje ante una
  acción administrativa: la persona lo descubre al intentar entrar.
- **Envío de la contraseña inicial por el sistema**: el administrador la
  entrega por fuera de la aplicación, por el canal que estime.

---

## Qué construyó realmente (resumen de implementación)

- **`packages/shared`**: esquemas Zod de alta, edición, cambio de rol y
  filtros de listado; los mensajes fijos de validación de cada campo y de
  "sin resultados".
- **`services/api`**: el módulo `users`, exclusivo del rol administrador
  (`@Roles`), con los seis endpoints de acción y el listado paginado y
  filtrable. `AdminAuditLog` (modelo Prisma) con el enum `AdminAction`
  (`CREAR`, `EDITAR`, `CAMBIAR_ROL`, `DESACTIVAR`, `REACTIVAR`,
  `RESTABLECER_PASSWORD`), de solo-agregar, protegida por el mismo criterio
  de trigger que luego reutiliza `OrderStatusEvent` en E2. La autoprotección
  del administrador (RN-006) se resuelve sin un conteo explícito: basta con
  que quien ejecuta la acción nunca pueda aplicarla sobre sí mismo.
- **`apps/web`**: `/admin/usuarios`, con el formulario de alta/edición, los
  filtros combinables, la búsqueda y los diálogos de confirmación por
  acción, cada uno con su propio texto de reversibilidad.
- **Verificación funcional**: 2026-08-15, junto con HU-08. Encontró que
  cuatro pantallas usaban un mensaje recortado en lugar del mensaje
  compartido de `packages/shared`, corregido antes de cerrar la épica
  (T134). Detalle en `specs/001-acceso-y-usuarios/verificacion.md`.
