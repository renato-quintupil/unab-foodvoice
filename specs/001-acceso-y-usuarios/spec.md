# Especificación de Funcionalidad: E1 · Acceso y usuarios

**Rama de funcionalidad**: `main` (sin rama dedicada; el directorio de la spec es `specs/001-acceso-y-usuarios`)

**Creada**: 2026-08-14

**Estado**: Borrador

**Épica**: E1 · Acceso y usuarios — HU-08 (Autenticación y sesión), HU-09 (Gestión de usuarios y roles), HU-10 (Panel y reportes del administrador)

**Entrada**: Descripción del usuario: especificación de la épica E1 de FoodVoice, con escenarios Gherkin, requisitos funcionales, reglas de negocio, criterios de aceptación, casos límite y alcance excluido para HU-08, HU-09 y HU-10, más once decisiones cerradas en la sesión de clarificación previa.

## Contexto y motivación

Cada persona que usa la plataforma web de FoodVoice —cliente, negocio, repartidor o administrador— debe acceder únicamente a las funciones que corresponden a su rol, sin exponer funciones ajenas y sin tener que volver a autenticarse en cada acción.

Para que eso sea posible deben existir dos piezas: una gestión de identidades a cargo del administrador (alta, edición, cambio de rol, baja y reactivación) y un mecanismo de autenticación y sesión que reconozca esa identidad y su rol en cada acción.

E1 es la primera épica que se especifica (orden sugerido en `docs/epicas-hu/EPICS.md`: E1 → E4 → E3 → E2 → E6 → E5 → E7 → E8) porque casi todas las demás historias asumen que existe un usuario autenticado con un rol conocido. Dentro de E1 la dependencia interna es: existencia de usuarios con rol (HU-09) → autenticación sobre esos usuarios (HU-08) → panel de solo lectura que consume ambas (HU-10). Las tres se especifican juntas porque comparten la misma entidad central (Usuario) y el mismo control de acceso por rol.

## Roles de usuario

- **Cliente**: usa la plataforma para pedir comida. Se autentica, pero no gestiona otros usuarios ni accede al panel administrativo.
- **Negocio**: administra su oferta de productos y los pedidos entrantes. Esa gestión se define en E3/E2; dentro de E1 solamente se autentica y el sistema reconoce su rol.
- **Repartidor**: recibe y gestiona las entregas asignadas. Esa gestión se define en E5; dentro de E1 solamente se autentica y el sistema reconoce su rol.
- **Administrador**: único rol que gestiona el ciclo de vida de todos los usuarios (HU-09) y que consulta el panel de métricas y reportes de solo lectura (HU-10).

## Clarifications

### Session 2026-08-14

- Q: ¿Qué debe ver un usuario con rol cliente, negocio o repartidor justo después de iniciar sesión, dado que sus funciones propias se construyen en épicas posteriores (E2/E3/E5)? → A: Una página de inicio mínima por rol, con el nombre del usuario, su rol y el botón "Cerrar sesión"; las funciones del rol se agregan en sus épicas.
- Q: ¿Qué reglas debe validar el sistema sobre la contraseña que el administrador asigna al crear un usuario o al restablecerla? → A: Mínimo 8 caracteres, sin otras exigencias de composición; mensaje de error en español si no cumple.
- Q: ¿Debe el sistema limitar los intentos fallidos de inicio de sesión sobre una misma cuenta en v1? → A: Sí; tras 5 intentos fallidos consecutivos la cuenta se bloquea 15 minutos y luego vuelve a permitir intentos automáticamente.
- Q: ¿Cómo debe comportarse el listado de usuarios del administrador cuando el padrón crece más allá de lo que cabe en una pantalla? → A: Paginación de 20 usuarios por página, con indicación del total de resultados del filtro.
- Q: ¿Debe el sistema registrar quién realizó cada acción administrativa sobre un usuario (alta, edición, cambio de rol, desactivación, reactivación, restablecimiento de contraseña)? → A: Sí; se registra el historial (quién, qué acción, sobre quién, cuándo) sin vista de consulta en v1.

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Autenticación y sesión con control por rol (HU-08) (Prioridad: P1)

Una persona registrada en FoodVoice ingresa su correo electrónico y su contraseña, el sistema la reconoce, identifica su rol y la lleva a la vista que le corresponde. Mientras trabaja normalmente no se le vuelve a pedir autenticación; si intenta entrar a una función que no es de su rol, el sistema se lo impide con un mensaje claro. Puede cerrar sesión cuando quiera, y si deja de usar la aplicación durante 30 minutos su sesión expira sola.

**Por qué esta prioridad**: sin autenticación y sin rol reconocido ninguna otra función de la plataforma puede distinguir qué puede ver o hacer cada persona. Es el cimiento de toda la épica y de casi todas las demás épicas del producto.

**Prueba independiente**: se puede verificar íntegramente con el administrador de la semilla inicial y un conjunto mínimo de usuarios ya existentes: iniciar sesión con credenciales correctas e incorrectas, navegar entre pantallas, intentar acceder a una función de otro rol, cerrar sesión y esperar la expiración por inactividad. No requiere que HU-09 ni HU-10 estén construidas.

**Escenarios de Aceptación**:

```gherkin
Característica: Autenticación y sesión

  Escenario: HU08-E01 · Inicio de sesión exitoso
    Dado que soy un usuario registrado y activo con rol "cliente"
    Cuando ingreso mi correo electrónico y mi contraseña correctos
    Entonces el sistema me autentica
    Y me redirige a la página de inicio de mi rol, que muestra mi nombre, mi rol
      y la acción "Cerrar sesión"
    Y mi sesión queda activa

  Escenario: HU08-E02 · Credenciales inválidas
    Dado que estoy en la pantalla de inicio de sesión
    Cuando ingreso una contraseña incorrecta
    Entonces el sistema muestra un mensaje de error en español, claro y sin detalles técnicos
    Y el mensaje no revela si el error estuvo en el correo o en la contraseña
    Y no se crea ninguna sesión

  Escenario: HU08-E03 · Bloqueo temporal por intentos fallidos
    Dado que fallé 5 veces seguidas la contraseña de mi cuenta
    Cuando intento iniciar sesión otra vez, incluso con la contraseña correcta
    Entonces el sistema rechaza el acceso durante 15 minutos
    Y muestra un mensaje en español indicando que la cuenta está bloqueada temporalmente
    Y transcurridos esos 15 minutos puedo iniciar sesión con mi contraseña correcta

  Escenario: HU08-E04 · El bloqueo temporal no revela si la cuenta existe
    Dado que se intentó iniciar sesión 5 veces seguidas con un correo que no está registrado
    Cuando se intenta una sexta vez con ese mismo correo
    Entonces el sistema muestra el mismo mensaje de bloqueo temporal en español
      que mostraría para una cuenta existente
    Y no es posible distinguir, a partir del mensaje, si la cuenta existe o no

  Escenario: HU08-E05 · Acceso a función fuera del rol
    Dado que inicié sesión con rol "repartidor"
    Cuando intento acceder a una función exclusiva del rol "administrador"
    Entonces el sistema me lo impide
    Y muestra un mensaje en español explicando que no tengo permiso

  Escenario: HU08-E06 · Cierre de sesión
    Dado que tengo una sesión activa
    Cuando selecciono "Cerrar sesión"
    Entonces mi sesión termina de inmediato
    Y para volver a acceder debo autenticarme nuevamente

  Escenario: HU08-E07 · Expiración de sesión por inactividad
    Dado que tengo una sesión activa
    Cuando transcurren 30 minutos sin que realice ninguna acción
    Entonces mi sesión expira automáticamente
    Y la próxima acción que intente me pide volver a iniciar sesión

  Escenario: HU08-E08 · Persistencia de la sesión durante el uso normal
    Dado que inicié sesión correctamente
    Cuando navego entre distintas pantallas de la aplicación dentro de los 30 minutos permitidos
    Entonces no se me vuelve a pedir autenticación

  Escenario: HU08-E09 · Sesión invalidada por desactivación del usuario
    Dado que tengo una sesión activa
    Cuando el administrador desactiva mi usuario
    Entonces mi siguiente acción es rechazada
    Y el sistema me pide iniciar sesión
    Y no puedo volver a autenticarme mientras siga desactivado

  Escenario: HU08-E10 · Inicio de sesión con contraseña restablecida por el administrador
    Dado que el administrador restableció mi contraseña
    Cuando intento iniciar sesión con mi contraseña anterior
    Entonces el sistema rechaza el acceso
    Y cuando ingreso la nueva contraseña, el sistema me autentica

  Escenario: HU08-E11 · Expiración de sesión durante una acción en curso
    Dado que mi sesión expiró por inactividad mientras completaba un formulario
    Cuando intento guardar los cambios
    Entonces la acción se rechaza por completo
    Y el sistema me pide volver a iniciar sesión
    Y ningún cambio queda aplicado parcialmente
```

---

### Historia de Usuario 2 - Gestión de usuarios y roles (HU-09) (Prioridad: P2)

El administrador crea, edita, cambia de rol, desactiva y reactiva a las personas que usan la plataforma, y puede restablecer la contraseña de cualquiera de ellas. También puede listar el padrón de usuarios, filtrarlo por rol y por estado y buscar por nombre o correo para encontrar rápidamente a quien busca.

**Por qué esta prioridad**: es lo que permite que existan usuarios reales más allá de la semilla inicial. Sin ella, la plataforma solo puede operar con el administrador precargado y no puede incorporar clientes, negocios ni repartidores.

**Prueba independiente**: se puede verificar iniciando sesión como administrador y ejecutando el ciclo de vida completo de un usuario de prueba —crearlo, editarlo, cambiarle el rol, desactivarlo, reactivarlo, restablecerle la contraseña y encontrarlo en el listado por búsqueda y por filtros— comprobando en cada paso que el usuario afectado puede o no puede iniciar sesión según corresponda. No requiere que HU-10 esté construida.

**Escenarios de Aceptación**:

```gherkin
Característica: Gestión de usuarios y roles

  Escenario: HU09-E01 · Alta de un nuevo usuario
    Dado que inicié sesión como administrador
    Cuando registro un nuevo usuario con nombre completo, correo electrónico, teléfono
      y contraseña inicial, y le asigno el rol "repartidor"
    Entonces el usuario queda creado con estado activo
    Y puede iniciar sesión con el rol "repartidor" asignado

  Escenario: HU09-E02 · Edición de datos de un usuario
    Dado que existe un usuario activo en el sistema
    Cuando el administrador edita sus datos de contacto
    Entonces los cambios quedan reflejados de inmediato
    Y el usuario conserva su rol y su estado previos

  Escenario: HU09-E03 · Cambio de rol de un usuario
    Dado que existe un usuario activo con rol "cliente"
    Cuando el administrador le cambia el rol a "negocio"
    Entonces el usuario pasa a tener el rol "negocio"
    Y en su próximo inicio de sesión accede a las funciones correspondientes a ese rol

  Escenario: HU09-E04 · Desactivación de un usuario
    Dado que existe un usuario activo
    Cuando el administrador lo desactiva
    Entonces el usuario no puede volver a iniciar sesión
    Y su historial de pedidos previos permanece disponible para trazabilidad

  Escenario: HU09-E05 · Reactivación de un usuario
    Dado que existe un usuario desactivado
    Cuando el administrador lo reactiva
    Entonces el usuario puede volver a iniciar sesión con sus credenciales previas

  Escenario: HU09-E06 · Intento de alta con datos incompletos
    Dado que estoy registrando un nuevo usuario
    Cuando omito un dato obligatorio o el rol
    Entonces el sistema muestra un mensaje de error en español, claro y sin detalles técnicos
    Y no se crea el usuario

  Escenario: HU09-E07 · Intento de alta con un correo ya existente
    Dado que ya existe un usuario, activo o desactivado, con el correo "negocio@ejemplo.cl"
    Cuando intento crear otro usuario con ese mismo correo
    Entonces el sistema rechaza el alta con un mensaje claro en español
    Y no se crea el usuario

  Escenario: HU09-E08 · Intento de alta con una contraseña demasiado corta
    Dado que estoy registrando un nuevo usuario
    Cuando asigno una contraseña de menos de 8 caracteres
    Entonces el sistema muestra un mensaje de error en español indicando el mínimo exigido
    Y no se crea el usuario

  Escenario: HU09-E09 · Filtrado de usuarios por rol y estado
    Dado que existen usuarios con distintos roles y estados
    Cuando el administrador filtra el listado por rol "negocio" y estado "activo"
    Entonces el sistema muestra únicamente los usuarios que cumplen ambos criterios
    Y los presenta de a 20 por página, indicando el total de resultados del filtro

  Escenario: HU09-E10 · Búsqueda de un usuario por nombre o por correo
    Dado que existe un usuario llamado "María Pérez" con el correo "maria.perez@ejemplo.cl"
    Cuando el administrador busca "perez" en el listado
    Entonces el sistema muestra a ese usuario entre los resultados
    Y lo encuentra igualmente buscando "MARÍA" o "maria.perez"

  Escenario: HU09-E11 · Búsqueda combinada con filtros
    Dado que existen usuarios con distintos roles y estados cuyo nombre contiene "pérez"
    Cuando el administrador busca "pérez" y además filtra por rol "negocio" y estado "activo"
    Entonces el sistema muestra únicamente los usuarios que cumplen la búsqueda y ambos filtros

  Escenario: HU09-E12 · Búsqueda o filtrado sin resultados
    Dado que ningún usuario cumple la combinación de búsqueda, rol y estado seleccionada
    Cuando el administrador aplica esos criterios en el listado
    Entonces el sistema muestra un mensaje claro en español indicando que no hay
      usuarios para esos criterios, en lugar de una pantalla vacía sin explicación

  Escenario: HU09-E13 · Restablecimiento de contraseña por el administrador
    Dado que existe un usuario que olvidó su contraseña
    Cuando el administrador le restablece la contraseña
    Entonces el usuario puede iniciar sesión con la nueva contraseña
    Y su contraseña anterior deja de ser válida
    Y si la cuenta estaba bloqueada temporalmente por intentos fallidos, el bloqueo se levanta

  Escenario: HU09-E14 · Confirmación antes de una acción de impacto
    Dado que el administrador seleccionó desactivar a un usuario
    Cuando el sistema le pide confirmar la acción y el administrador la cancela
    Entonces el usuario permanece activo
    Y no queda registrada ninguna acción administrativa sobre él

  Escenario: HU09-E15 · Un administrador no puede desactivarse a sí mismo
    Dado que inicié sesión como administrador
    Cuando intento desactivar mi propia cuenta o cambiarme mi propio rol
    Entonces el sistema me lo impide con un mensaje claro en español
    Y sí puedo editar mis propios datos de contacto

  Escenario: HU09-E16 · El sistema conserva siempre un administrador activo
    Dado que inicié sesión como administrador
    Y que existe exactamente otro administrador activo además de mí
    Cuando desactivo a ese otro administrador
    Entonces la acción se aplica
    Y sigo siendo administrador activo, porque no puedo desactivarme a mí mismo
    Y el sistema conserva al menos un administrador con acceso
```

---

### Historia de Usuario 3 - Panel y reportes del administrador (HU-10) (Prioridad: P3)

El administrador entra a un panel donde ve, de un vistazo, el estado operativo general de la plataforma —cuántos usuarios activos hay por rol y cuántos pedidos hay en cada estado— y puede consultar el historial de pedidos filtrándolo por estado y por rango de fechas. El panel solo muestra información: no ofrece ninguna acción que cambie datos.

**Por qué esta prioridad**: aporta visibilidad y control de gestión, pero no habilita ninguna operación nueva. La plataforma funciona sin él, y sus métricas de pedidos dependen de épicas posteriores.

**Prueba independiente**: se puede verificar iniciando sesión como administrador y revisando las métricas de usuarios activos por rol, comprobando que otro rol no puede entrar al panel, que ninguna vista ofrece botones de modificación y que un filtro sin resultados muestra un mensaje explicativo. La parte de pedidos se verifica con los mismos pasos una vez que existan pedidos (E4/E2).

**Escenarios de Aceptación**:

```gherkin
Característica: Panel y reportes del administrador

  Escenario: HU10-E01 · Acceso al panel como administrador
    Dado que inicié sesión con rol "administrador"
    Cuando accedo al panel de administración
    Entonces veo las métricas generales del estado operativo actual del sistema

  Escenario: HU10-E02 · Acceso al panel denegado a otros roles
    Dado que inicié sesión con un rol distinto de "administrador"
    Cuando intento acceder al panel de administración
    Entonces el sistema me lo impide
    Y muestra un mensaje en español explicando que no tengo permiso

  Escenario: HU10-E03 · Consulta de reporte de pedidos por estado
    Dado que estoy en el panel de administración
    Cuando filtro el reporte de pedidos por el estado "entregado"
    Entonces el sistema muestra únicamente los pedidos que se encuentran en ese estado

  Escenario: HU10-E04 · Consulta de reporte de pedidos por rango de fechas
    Dado que estoy en el panel de administración
    Cuando filtro el reporte de pedidos por un rango de fechas determinado
    Entonces el sistema muestra únicamente los pedidos creados dentro de ese rango

  Escenario: HU10-E05 · El panel no permite modificar datos
    Dado que estoy visualizando el reporte de un pedido en el panel
    Cuando reviso las opciones disponibles en esa vista
    Entonces no encuentro ninguna acción que modifique el estado del pedido o del usuario

  Escenario: HU10-E06 · Panel sin datos disponibles
    Dado que no existen pedidos ni usuarios que cumplan los filtros seleccionados
    Cuando consulto el reporte correspondiente
    Entonces el sistema muestra un mensaje claro en español indicando que no hay datos
      para ese filtro, en lugar de un error o una pantalla vacía sin explicación
```

---

### Casos Límite

- **Usuario desactivado con sesión abierta**: la sesión se invalida de inmediato; su siguiente acción es rechazada y no puede volver a autenticarse.
- **Cambio de rol con sesión activa**: el nuevo rol aplica recién en el próximo inicio de sesión, **nunca en caliente sobre la sesión abierta**. Esa sesión termina en el acto (FR-024), de modo que no existe ninguna ventana en que el usuario conserve los privilegios del rol anterior.
- **Restablecimiento de contraseña con sesión activa**: la sesión abierta también termina (FR-024). Sin esto, una sesión seguiría operando con la credencial que el administrador acaba de invalidar, vaciando de sentido a FR-026.
- **Alta con un correo ya existente, incluso de un usuario desactivado**: se rechaza; el correo de un usuario dado de baja queda reservado para que su reactivación siempre sea posible.
- **Filtro del panel sin resultados**: se muestra un mensaje claro, no una pantalla vacía ni un error técnico.
- **Expiración de sesión justo al completar una acción** (por ejemplo, el administrador guardando la edición de un usuario): la acción se rechaza íntegramente y se pide reautenticación; nunca se aplica parcialmente.
- **Último administrador intentando desactivarse**: bloqueado; el sistema nunca puede quedar sin ningún administrador con acceso.
- **Un administrador desactiva o degrada a otro administrador**: permitido, y no puede dejar el sistema sin administradores: quien ejecuta la acción es él mismo un administrador activo, de modo que después de la acción queda al menos uno. Sumado a FR-027, que impide actuar sobre uno mismo, el número de administradores activos nunca puede llegar a cero por una acción de la aplicación (RN-006).
- **Ningún administrador conserva acceso efectivo** (por ejemplo, el último administrador activo olvidó su contraseña y no existe otro que se la restablezca): la aplicación no puede resolverlo por sí sola, porque no hay autoservicio de contraseña (FR-026) y la cuenta sigue activa y válida a ojos del sistema. Se recupera con el procedimiento operativo de FR-036, fuera de la aplicación.
- **Reactivación de un usuario cuyo correo se intentó reutilizar entretanto**: no puede ocurrir, porque la unicidad del correo cubre también a los usuarios desactivados.
- **Contraseña anterior tras un restablecimiento**: deja de ser válida de inmediato.
- **Contraseña de más de 72 caracteres**: se rechaza con un mensaje en español, nunca se recorta para hacerla caber. El límite se mide sobre la representación real del texto, de modo que una contraseña con acentos o emoji puede superarlo con menos de 72 caracteres visibles; el mensaje es el mismo en ambos casos.
- **Cuenta bloqueada temporalmente por intentos fallidos**: durante los 15 minutos se rechaza incluso la contraseña correcta, con un mensaje en español; el bloqueo se levanta solo, sin intervención del administrador. Un restablecimiento de contraseña por el administrador también levanta el bloqueo (FR-026, FR-033).
- **Intentos fallidos sobre un correo inexistente**: se cuentan y bloquean igual que sobre una cuenta real, y el mensaje mostrado es idéntico, para no revelar qué cuentas existen (FR-008, FR-033).
- **Acción administrativa cancelada en la confirmación**: no se aplica ningún cambio ni se registra nada en la bitácora (FR-035, FR-034).
- **Usuario desactivado que intenta entrar con sus credenciales correctas**: se rechaza con el mismo mensaje que unas credenciales incorrectas, y el intento se cuenta como fallido. Decirle que su cuenta está desactivada confirmaría que ese correo existe (FR-008, FR-012).
- **Cambio del correo de un usuario con sesión abierta**: su sesión continúa. La sesión identifica a la persona, no a su correo; el nuevo correo rige para su próximo inicio de sesión, y el anterior deja de servir (FR-010).
- **Sesión que vence mientras una acción administrativa ya está en curso**: no puede dejar la acción a medias. La sesión se comprueba una sola vez, antes de aplicar nada: o la acción se rechaza íntegra, o se completa íntegra (FR-030).
- **Mismo usuario con sesión abierta en dos navegadores**: ambas sesiones son válidas y expiran por separado. Cerrar sesión en una no cierra la otra; una acción administrativa de impacto las termina las dos (FR-006, FR-024, § Entidad Sesión).
- **Dos administradores editando al mismo usuario a la vez**: prevalece el último cambio guardado, sin aviso al primero. v1 no detecta la edición concurrente: con un padrón de un solo local y un puñado de administradores, el conflicto es improbable y una comprobación de versión sería alcance sin requisito (Principio I, Principio III). La consecuencia asumida —una edición puede pisar a otra— se acepta y se declara aquí para que no se descubra como un defecto.

### Trazabilidad de escenarios

Cada escenario de aceptación lleva un identificador estable `HU<nn>-E<nn>` en su título. La tabla lo enlaza con el requisito que ejerce, el criterio de éxito que lo declara superado y el paso de la guía de validación (`quickstart.md`) donde una persona lo comprueba. **Ningún escenario queda sin las tres columnas**: si alguna vez un escenario no tuviera criterio de éxito, sería señal de que se está probando algo que la spec no exige.

| Escenario | Requisitos | Criterios de éxito | Paso de validación |
|---|---|---|---|
| HU08-E01 · Inicio de sesión exitoso | FR-001, FR-002, FR-031 | SC-001 | A1 |
| HU08-E02 · Credenciales inválidas | FR-008 | SC-002, SC-028 | A2, A11 |
| HU08-E03 · Bloqueo temporal por intentos fallidos | FR-033 | SC-017 | A3, A5 |
| HU08-E04 · El bloqueo no revela si la cuenta existe | FR-008, FR-033 | SC-018, SC-028 | A4 |
| HU08-E05 · Acceso a función fuera del rol | FR-003 | SC-003 | A6 |
| HU08-E06 · Cierre de sesión | FR-006 | SC-030 | A8 |
| HU08-E07 · Expiración por inactividad | FR-005 | SC-013, SC-024 | A9 |
| HU08-E08 · Persistencia durante el uso normal | FR-004 | SC-031 | A7 |
| HU08-E09 · Sesión invalidada por desactivación | FR-012, FR-024 | SC-006, SC-025, SC-029 | B8, A13 |
| HU08-E10 · Inicio con contraseña restablecida | FR-024, FR-026 | SC-012, SC-025 | B10 |
| HU08-E11 · Expiración durante una acción en curso | FR-030 | SC-035 | A10 |
| HU09-E01 · Alta de un nuevo usuario | FR-009 | SC-004 | B1, B21 |
| HU09-E02 · Edición de datos | FR-010 | SC-032 | B6, B6b, B19 |
| HU09-E03 · Cambio de rol | FR-011, FR-024, RN-001 | SC-025, SC-026 | B7, B7b |
| HU09-E04 · Desactivación | FR-012, RN-002 | SC-006 | B8 |
| HU09-E05 · Reactivación | FR-013 | SC-033 | B9 |
| HU09-E06 · Alta con datos incompletos | FR-014 | SC-005 | B2 |
| HU09-E07 · Alta con correo ya existente | FR-017, RN-005 | SC-011 | B4, B5 |
| HU09-E08 · Alta con contraseña fuera de rango | FR-032 | SC-016 | B3, B10b |
| HU09-E09 · Filtrado por rol y estado | FR-015 | SC-034 | B12, B22 |
| HU09-E10 · Búsqueda por nombre o correo | FR-015 | SC-021 | B13, B24, B25 |
| HU09-E11 · Búsqueda combinada con filtros | FR-015 | SC-034 | B14 |
| HU09-E12 · Búsqueda o filtrado sin resultados | FR-015 | SC-020 | B15, B26 |
| HU09-E13 · Restablecimiento de contraseña | FR-024, FR-026, FR-033 | SC-012, SC-025 | B10, B11 |
| HU09-E14 · Confirmación antes de una acción de impacto | FR-034, FR-035 | SC-019 | B16, B17 |
| HU09-E15 · Autoprotección del administrador | FR-027 | SC-014 | B18, B19 |
| HU09-E16 · Siempre queda un administrador activo | FR-027, RN-006 | SC-022 | B23 |
| HU10-E01 · Acceso al panel como administrador | FR-019 | SC-007 | C1, C2 |
| HU10-E02 · Panel denegado a otros roles | FR-018 | SC-008 | C3 |
| HU10-E03 · Reporte filtrado por estado | FR-020, FR-023 | SC-009 | C5, C6 |
| HU10-E04 · Reporte filtrado por rango de fechas | FR-020 | SC-009 | C5, C5b, C5c |
| HU10-E05 · El panel no permite modificar datos | FR-021, RN-004 | SC-015 | C4 |
| HU10-E06 · Panel sin datos disponibles | FR-022 | SC-020 | C5 |

Los pasos de validación **D1–D8** de `quickstart.md` no corresponden a ningún escenario Gherkin: cubren las dos excepciones acotadas de SC-010 —el resguardo de credenciales (FR-007, FR-016, FR-028, SC-027) y la bitácora sin vista (FR-034)—, que por definición no son observables desde la interfaz y se comprueban en la revisión de la implementación.

## Requisitos *(obligatorio)*

### Convenciones de interfaz y mensajería

Reglas transversales a las tres historias. Se declaran una vez aquí en lugar de repetirse —o, peor, de darse por supuestas— en cada requisito que menciona un mensaje o una pantalla.

#### Qué significa «mensaje claro y sin detalles técnicos»

FR-003, FR-014, FR-015 y FR-022 exigen mensajes «claros y sin detalles técnicos». Como criterio es inservible: nadie puede decir si un mensaje es «claro» sin discutirlo. Un mensaje cumple esta especificación si y solo si satisface **las cuatro condiciones**, que sí se comprueban leyéndolo:

1. **Está en español**, con su ortografía y sus acentos correctos.
2. **No contiene ningún término técnico**: ni códigos de error, ni nombres de campo del sistema, ni direcciones, ni nombres de tecnologías, ni fragmentos de mensajes del motor de base de datos, ni trazas.
3. **Dice qué ocurrió y qué puede hacer la persona**. «Error en el formulario» incumple la segunda mitad; «Debes ingresar un correo electrónico válido» la cumple.
4. **Una persona no técnica puede repetirlo con sus palabras** tras leerlo una vez, sin preguntar qué significa.

La condición 4 es la que hace el criterio verificable sin discusión, y es la que se aplica en la validación funcional (SC-010). Las tres clases de mensaje —error de validación, denegación por rol y ausencia de resultados— están sujetas a las mismas cuatro condiciones: no hay una regla distinta por tipo.

#### Dónde se presenta cada mensaje

| Situación | Presentación | Dónde queda la persona |
|---|---|---|
| Un campo del formulario es inválido | Junto al campo que falla, con el campo señalado | En el formulario, con lo que escribió intacto |
| La acción se rechaza por una regla que exige consultar datos —correo duplicado, autoprotección— | Aviso sobre la vista actual, no junto a un campo | En el formulario, con lo que escribió intacto |
| La acción se rechaza por un fallo del sistema | Aviso sobre la vista actual | En el formulario, con lo que escribió intacto |
| El rol no permite la acción (FR-003) | Página propia | En esa página, con un enlace a la página de inicio de su rol |
| La sesión expiró o fue revocada (FR-005, FR-024, FR-030) | Aviso en la pantalla de inicio de sesión | En `/login` |
| Un filtro o una búsqueda no produce resultados (FR-015, FR-022) | En el lugar donde irían los resultados | En la misma vista, con los criterios que aplicó |

Un error de validación **nunca** se presenta como página completa, y una denegación por rol **nunca** como aviso sobre la vista que el usuario no debía ver: mostrarle esa vista con un aviso encima ya le habría revelado su contenido.

#### Vocabulario visible

Un mismo concepto se nombra siempre igual en toda la interfaz. Los términos técnicos de esta especificación **no aparecen nunca en pantalla**.

| Concepto | En pantalla se dice | Nunca se dice |
|---|---|---|
| Retirar el acceso a un usuario | **Desactivar** | «dar de baja», «baja lógica», «eliminar», «borrar» |
| Devolver el acceso | **Reactivar** | «restaurar», «habilitar», «dar de alta» |
| Estado del usuario | **Activo** / **Desactivado** | «habilitado», «inactivo», «suspendido» |
| Asignar una contraseña nueva a otro usuario | **Restablecer contraseña** | «resetear», «cambiar la clave» |
| Crear un usuario | **Nuevo usuario** | «registrar», «dar de alta» |

Las etiquetas visibles de los cuatro roles son **Cliente**, **Negocio**, **Repartidor** y **Administrador**, en singular y con inicial mayúscula. Son las que ve el usuario en su página de inicio (FR-031) y las que ofrecen los filtros y formularios del administrador; los identificadores internos en mayúsculas nunca se muestran.

#### Fechas y horas visibles

Las fechas se muestran y se escriben en **`DD/MM/AAAA`** y las horas en formato de 24 horas, que es como se leen en español. El formato interno con que viajan los datos es otro y no aparece nunca en pantalla.

El **huso horario de referencia del producto es `America/Santiago`**, y toda fecha visible se presenta en él. Esto tiene una consecuencia que hay que declarar porque no es evidente: cuando el administrador filtra el reporte de pedidos por «15/08/2026», el sistema consulta **ese día del calendario chileno**, no un intervalo de 24 horas en otro huso. La alternativa —interpretar los días en UTC— se descartó al escribir esta convención: para un producto de un solo local en Chile, un pedido hecho a las 22:00 aparecería en el reporte del día siguiente, y el administrador vería como «del día 16» algo que ocurrió el 15 a la vista de todos. El huso se declara en un único lugar del código compartido, de modo que la interfaz y el servidor no puedan discrepar.

Que v1 no tenga pedidos no hace la decisión menos necesaria: es la que E4/E2 heredarán cuando existan, y tomarla ahora cuesta una constante, mientras que corregirla después costaría revisar reportes ya emitidos.

#### Navegación disponible por rol

| Rol | Navegación en v1 |
|---|---|
| Cliente, Negocio, Repartidor | **Ninguna**: su página de inicio es la única vista que tienen, y solo ofrece «Cerrar sesión» (FR-031). Sus funciones llegan en E2/E3/E5, y con ellas su navegación |
| Administrador | Dos destinos, **Panel** y **Usuarios**, visibles desde cualquier vista administrativa, más «Cerrar sesión» |

Que los tres primeros roles no tengan menú no es una carencia que haya que disimular: es la consecuencia honesta de que sus funciones aún no existan. Inventarles opciones que no llevan a ninguna parte contradice el Principio III y el IV.

### Requisitos Funcionales — HU-08 · Autenticación y sesión

- **FR-001**: El sistema DEBE permitir iniciar sesión mediante correo electrónico y contraseña, y no DEBE exigir ningún otro dato. El correo se compara **sin distinguir mayúsculas de minúsculas y sin espacios sobrantes al inicio o al final**: `Maria@Ejemplo.CL` y `maria@ejemplo.cl` son el mismo identificador de acceso, tanto al iniciar sesión como al comprobar la unicidad de FR-017. La contraseña, en cambio, se compara **carácter por carácter, distinguiendo mayúsculas**, y nunca se normaliza ni se recorta: cualquier transformación silenciosa cambiaría la credencial que la persona eligió.
- **FR-002**: El sistema DEBE identificar el rol del usuario autenticado (cliente, negocio, repartidor, administrador) y usarlo para determinar qué funciones están disponibles.
- **FR-003**: El sistema DEBE rechazar el acceso a funciones que no correspondan al rol del usuario autenticado, mostrando un mensaje en español (Principio II). El rechazo DEBE producirse **al procesar la acción, no solo al pintar la pantalla**: ocultar o deshabilitar una opción en la interfaz no cumple este requisito. La restricción alcanza por igual a los tres caminos por los que puede llegar una petición —la navegación desde la interfaz, la escritura directa de una dirección en el navegador y la llamada directa al punto de entrada de la aplicación sin pasar por la interfaz—, y el resultado DEBE ser el mismo en los tres casos. El rechazo se presenta como **una página propia** con el mensaje en español y un enlace a la página de inicio del rol de esa persona; NO DEBE mostrarse como un aviso superpuesto sobre la vista restringida, porque para entonces ya le habría revelado su contenido. La sesión **no** se cierra: intentar entrar donde no corresponde no es un problema de identidad, y expulsar a quien se equivocó de dirección sería un castigo desproporcionado.
- **FR-004**: El sistema DEBE mantener la sesión activa mientras el usuario interactúa con la aplicación, sin requerir reautenticación en cada acción.
- **FR-005**: El sistema DEBE expirar la sesión automáticamente tras 30 minutos de inactividad, con la misma duración para todos los roles. Cuenta como actividad **toda acción iniciada por el usuario** que llegue al sistema: navegar a una pantalla, aplicar un filtro, enviar un formulario o cerrar sesión. NO cuenta como actividad ninguna consulta que la aplicación realice por su cuenta sin intervención del usuario: el sistema NO DEBE mantener viva una sesión mediante consultas automáticas, periódicas o en segundo plano. La inactividad es el **único** plazo que termina una sesión por el paso del tiempo: **no existe una duración máxima absoluta**. Una persona que trabaje sin pausas de 30 minutos conserva su sesión indefinidamente, y eso es deliberado —un corte absoluto obligaría a reautenticarse en mitad de una tarea sin que ningún requisito lo pida (Principio I, Principio III)—. Las sesiones también terminan por cierre explícito (FR-006) y por las cuatro acciones administrativas de impacto (FR-024), que no dependen del tiempo.
- **FR-006**: El sistema DEBE permitir cerrar sesión explícitamente en cualquier momento, terminando la sesión de inmediato. Tras cerrarla, la persona queda en la pantalla de inicio de sesión **sin ningún mensaje de error o de advertencia**: cerró sesión porque quiso, y decirle «tu sesión expiró» sería informarle de un problema que no ha ocurrido. Es la única diferencia visible con la expiración por inactividad (FR-005), que sí muestra un aviso explicativo, y esa diferencia es obligatoria: quien vuelve a una pestaña abandonada necesita entender por qué se le pide entrar de nuevo, y quien acaba de pulsar «Cerrar sesión» no.
- **FR-007**: El sistema NO DEBE almacenar contraseñas en texto plano ni exponer credenciales o tokens en el código fuente (Principio V).
- **FR-008**: Los mensajes de error de autenticación DEBEN ser genéricos respecto a si el correo o la contraseña es lo incorrecto, para no filtrar qué cuentas existen. Esta regla alcanza también al mensaje de bloqueo temporal (FR-033), que DEBE mostrarse de forma idéntica exista o no una cuenta con el correo ingresado. Para que el requisito sea comprobable y no quede como una intención, se enumera **qué no debe poder deducirse** de un intento fallido de inicio de sesión:

  1. Si existe o no una cuenta con el correo ingresado.
  2. Si la cuenta existente está activa o desactivada (FR-012).
  3. Cuál de los dos campos fue el incorrecto.
  4. Cualquier característica de la contraseña almacenada —su longitud, su formato o su composición—.

  En los cuatro casos el sistema DEBE responder **el mismo mensaje**, y el intento fallido DEBE contarse igual (FR-033). Un usuario desactivado que ingresa sus credenciales correctas recibe exactamente el mismo mensaje que quien se equivoca de contraseña: FR-012 le impide entrar, y decírselo revelaría que su cuenta existe. Esta uniformidad es verificable comparando pantallas, sin leer código (SC-028).
- **FR-024**: El sistema DEBE invalidar de inmediato toda sesión activa del usuario afectado por cualquiera de las cuatro acciones administrativas de impacto —desactivación (FR-012), cambio de rol (FR-011), reactivación (FR-013) y restablecimiento de contraseña (FR-026)—, de modo que su siguiente acción sea rechazada y deba autenticarse de nuevo. La invalidación ocurre junto con la acción que la provoca: si la acción no llega a aplicarse, las sesiones tampoco se invalidan. Nunca se invalidan las sesiones del administrador que ejecuta la acción, sino solo las del usuario afectado.

  **Qué significa «de inmediato»**: que la sesión queda inválida en el mismo instante en que la acción administrativa se aplica, sin plazo de gracia ni umbral temporal alguno. No hay un proceso posterior que la cierre ni una ventana de propagación: cuando el administrador ve la acción aplicada, ya no existe ninguna sesión válida del usuario afectado. Lo que la persona afectada percibe es que **su siguiente acción**, sea cual sea y ocurra cuando ocurra, es rechazada. Formulado así el requisito es medible sin cronómetro: no se mide un retardo, se comprueba que no existe ninguna acción posterior que consiga pasar (SC-006, SC-025).
- **FR-025**: El sistema NO DEBE ofrecer autorregistro; el único camino de alta de usuarios es a través del administrador (HU-09).
- **FR-030**: El sistema DEBE rechazar íntegramente cualquier acción iniciada con una sesión expirada, sin aplicar cambios parciales, y solicitar reautenticación. **Los datos que la persona había escrito se pierden**, y se declara en lugar de dejarlo a la sorpresa: la interfaz lleva a la pantalla de inicio de sesión y no conserva el formulario a medio completar. Se descartó guardar un borrador y restaurarlo tras reautenticarse —exigiría decidir dónde guardarlo, cuánto conservarlo y qué hacer si los datos ya no son válidos, para un caso que exige treinta minutos sin ninguna interacción con el sistema (Principio I, Principio III)—. El caso existe de verdad, aunque sea improbable: escribir en un formulario no llega al servidor, así que un formulario abierto media hora sin enviarse expira. Con los formularios de esta épica —cinco campos como mucho— la pérdida es de segundos de trabajo.

  La validez de la sesión se comprueba **una sola vez, antes de empezar a aplicar la acción**: o la acción se rechaza sin haber tocado ningún dato, o se completa entera. En consecuencia, una sesión que venza mientras la acción ya está en curso **no la interrumpe a medias**; el vencimiento afecta a la petición siguiente. Esto elimina por construcción el escenario de una acción administrativa aplicada a medias por expiración, en lugar de intentar detectarlo y deshacerlo.
- **FR-031**: Tras un inicio de sesión exitoso, el sistema DEBE llevar al usuario a una página de inicio propia de su rol. Para cliente, negocio y repartidor esa página en v1 es mínima: muestra el nombre del usuario, su rol y la acción "Cerrar sesión"; las funciones específicas de cada rol se incorporan en sus épicas (E2/E3/E5). Para el administrador, la página de inicio es el panel de administración (HU-10).

  **Elementos mínimos exigibles**, de modo que su ausencia sea detectable y no una impresión: la página de inicio de cliente, negocio y repartidor DEBE contener (a) el nombre completo del usuario tal como está almacenado, (b) la etiqueta visible de su rol —Cliente, Negocio o Repartidor—, (c) la acción «Cerrar sesión», y (d) **ninguna otra acción**. Los cuatro puntos se comprueban mirando la pantalla, y el cuarto es tan exigible como los otros tres: una página de inicio que ofrezca funciones del rol antes de que su épica las especifique es alcance fantasma (Principio III).
- **FR-033**: El sistema DEBE bloquear temporalmente el inicio de sesión tras 5 intentos fallidos consecutivos, durante 15 minutos, mostrando un mensaje en español. El contador de intentos se asocia al correo electrónico ingresado, exista o no una cuenta con ese correo, y el mensaje de bloqueo es idéntico en ambos casos (FR-008). Pasado ese lapso el bloqueo se levanta automáticamente, sin intervención del administrador, y el contador vuelve a cero. Un inicio de sesión exitoso también reinicia el contador. Un restablecimiento de contraseña por el administrador (FR-026) levanta el bloqueo de inmediato y reinicia el contador.

  **El conteo es por correo y solo por correo**: no se cuenta por origen de la petición, ni por dispositivo, ni por ninguna combinación de ambos. Cinco fallos sobre el mismo correo desde cinco dispositivos distintos bloquean ese correo; cinco fallos sobre cinco correos distintos desde el mismo dispositivo no bloquean nada. Es lo que corresponde a un requisito que protege *una cuenta* de que le adivinen la contraseña, y evita castigar a varias personas legítimas que compartan una salida a Internet.

  **Tras los 15 minutos el contador queda en cero**: el bloqueo no deja rastro. Un único fallo posterior no vuelve a bloquear la cuenta; hacen falta otros cinco fallos consecutivos. Sin esta precisión, una cuenta bloqueada una vez quedaría permanentemente a un error de distancia del siguiente bloqueo.

### Requisitos Funcionales — HU-09 · Gestión de usuarios y roles

- **FR-009**: El sistema DEBE permitir a un administrador crear un usuario con nombre completo, correo electrónico, teléfono, contraseña inicial y un rol (cliente, negocio, repartidor, administrador).
- **FR-010**: El sistema DEBE permitir a un administrador editar los datos de contacto y el correo electrónico de un usuario existente. El cambio de correo **no** termina las sesiones abiertas de ese usuario y **no** figura entre las cuatro acciones de impacto de FR-024: la sesión identifica a la persona, no a su correo, y quien está dentro sigue siendo la misma persona con el mismo rol y la misma contraseña. El nuevo correo rige como identificador de acceso desde el momento en que se guarda, de modo que su próximo inicio de sesión DEBE hacerse con él; el anterior deja de servir y queda libre para otro usuario. El cambio queda registrado como una edición en la bitácora (FR-034) y no exige confirmación adicional (FR-035), por ser reversible con otra edición.

  **Relación con el formulario de alta**: los campos que ambos comparten —nombre completo, correo y teléfono— se validan con **las mismas reglas y muestran los mismos mensajes** (FR-014), de modo que ninguna edición pueda dejar un usuario en un estado que su alta habría rechazado. Difieren solo en lo que cada uno abarca: el alta exige además contraseña inicial y rol, y la edición no incluye ninguno de los dos —ni tampoco el estado—, porque contraseña, rol y estado son acciones de impacto con su propio camino y su propia confirmación (FR-011, FR-012, FR-026, FR-035).
- **FR-011**: El sistema DEBE permitir a un administrador cambiar el rol asignado a un usuario existente; el nuevo rol rige a partir del próximo inicio de sesión de ese usuario. El sistema NO DEBE aplicar el nuevo rol sobre una sesión ya abierta: esa sesión se invalida (FR-024) y el usuario vuelve a autenticarse, momento en el que rige el rol nuevo.
- **FR-012**: El sistema DEBE permitir a un administrador desactivar un usuario, impidiendo que vuelva a iniciar sesión, sin eliminar su historial asociado. Cuando un usuario desactivado intenta entrar con sus credenciales correctas, el sistema DEBE rechazarlo con **el mismo mensaje genérico** que emplea para unas credenciales incorrectas (FR-008): indicarle que su cuenta está desactivada confirmaría a cualquiera que ese correo está registrado. El intento se cuenta además como fallido a efectos del bloqueo temporal (FR-033), por la misma razón.
- **FR-013**: El sistema DEBE permitir a un administrador reactivar un usuario previamente desactivado, conservando sus credenciales previas.
- **FR-014**: El sistema DEBE validar que el nombre completo, el correo electrónico, el teléfono, la contraseña inicial y el rol estén presentes antes de crear un usuario, mostrando un mensaje en español si falta alguno (Principio II). La validación no se limita a la presencia: cada campo tiene un formato y unos límites exigibles, idénticos al crear (FR-009) y al editar (FR-010), de modo que ninguna edición pueda dejar un usuario en un estado que su alta habría rechazado.

  | Campo | Regla |
  |---|---|
  | Nombre completo | Entre 2 y 120 caracteres, una vez descartados los espacios de los extremos |
  | Correo electrónico | Formato de dirección válido —texto, `@`, dominio con al menos un punto—, máximo 254 caracteres, normalizado según FR-001 |
  | Teléfono | Entre 6 y 20 caracteres. **No** se valida su estructura ni el prefijo de país: v1 no llama ni envía mensajes a ese número, y una regla de formato solo serviría para rechazar teléfonos legítimos (Principio I) |
  | Contraseña inicial | Según FR-032 |
  | Rol | Uno de los cuatro valores fijos de FR-009 |

  Un campo que solo contenga espacios se considera ausente. El mensaje en español DEBE indicar qué campo falla y por qué, no un aviso genérico de formulario inválido.
- **FR-015**: El sistema DEBE permitir listar y filtrar usuarios por rol y por estado (activo/desactivado), y buscarlos por texto sobre su nombre completo y su correo electrónico, de forma combinable entre sí. La búsqueda DEBE encontrar coincidencias parciales, sin distinguir mayúsculas de minúsculas ni acentos, y DEBE aplicarse sobre ambos campos a la vez. El listado DEBE paginarse de a 20 usuarios por página e indicar el total de resultados que cumplen los criterios aplicados, presentándolos siempre en un **orden estable y predecible: del alta más reciente a la más antigua**, de modo que un mismo conjunto de criterios devuelva siempre los mismos usuarios en la misma página. Cuando la combinación de filtros y búsqueda no produce resultados, el listado DEBE mostrar un mensaje claro en español indicando que no hay usuarios para esos criterios, en lugar de una pantalla vacía sin explicación, con el mismo criterio que FR-022 aplica al panel (Principio II).
- **FR-016**: El sistema NO DEBE almacenar contraseñas en texto plano ni exponer credenciales en el código fuente (Principio V), de forma consistente con HU-08.
- **FR-017**: El sistema DEBE impedir el alta de dos usuarios con el mismo correo electrónico; la unicidad aplica también a los usuarios desactivados, cuyo correo queda reservado.
- **FR-026**: El sistema DEBE permitir a un administrador restablecer la contraseña de cualquier usuario, invalidando la anterior de inmediato, terminando sus sesiones abiertas (FR-024) y levantando cualquier bloqueo temporal vigente sobre esa cuenta (FR-033). No existe flujo de recuperación de contraseña por autoservicio en v1, **ni tampoco un cambio de contraseña por el propio usuario**: el restablecimiento por el administrador es el único camino por el que una contraseña cambia después del alta.

  **Qué ve quien olvidó su contraseña**: la pantalla de inicio de sesión DEBE indicar en español, de forma permanente y visible antes de fallar ningún intento, que el restablecimiento lo realiza el administrador y que hay que solicitárselo. El sistema NO DEBE ofrecer un enlace de «¿olvidaste tu contraseña?» que prometa un envío por correo o un formulario de recuperación, porque ninguno de los dos existe: un camino que no lleva a ninguna parte es peor que la ausencia de camino (Principio II, Principio IV). La persona queda así con una instrucción accionable —a quién dirigirse— en lugar de reintentando hasta bloquearse la cuenta (FR-033).
- **FR-027**: El sistema DEBE impedir que un administrador se desactive a sí mismo o cambie su propio rol; sí DEBE permitirle editar sus propios datos de contacto.
- **FR-036**: El sistema DEBE ofrecer un procedimiento de recuperación del acceso administrativo, ejecutable por quien opera el despliegue **sin necesidad de iniciar sesión en la aplicación**, que restablezca la cuenta del administrador semilla (FR-028) —su contraseña, su rol y su estado activo— a partir de la configuración externa al repositorio. Este procedimiento es el único camino de recuperación cuando ningún administrador conserva acceso efectivo, dado que no existe autoservicio de contraseña (FR-026) y que la aplicación por sí sola no puede distinguir esa situación.
- **FR-028**: El sistema DEBE contar con al menos un administrador desde su arranque, provisto como semilla inicial cuya contraseña proviene de configuración externa al repositorio (Principio V). Esto **no contradice** la prohibición de FR-007 y FR-016 de exponer credenciales en el código fuente, sino que es su aplicación: lo prohibido es que la credencial viva en un archivo versionado, y este mecanismo existe precisamente para que no viva ahí. Tres condiciones lo mantienen consistente: la configuración externa nunca se versiona; el repositorio solo contiene una plantilla que **nombra** las variables sin valores; y el arranque falla de forma explícita si la variable no está definida, en lugar de recurrir a un valor por defecto —que sería, ese sí, una credencial de fábrica publicada en el código—.
- **FR-032**: El sistema DEBE exigir que toda contraseña asignada por el administrador —tanto la inicial (FR-009) como la restablecida (FR-026)— tenga **al menos 8 y como máximo 72 caracteres**, sin otras exigencias de composición, y DEBE rechazar la operación con un mensaje en español si no cumple, indicando cuál de los dos límites se incumplió (Principio II). El sistema NO DEBE aceptar una contraseña más larga recortándola en silencio: si excede el máximo, la operación se rechaza y el administrador lo sabe.
- **FR-034**: El sistema DEBE registrar cada acción administrativa sobre un usuario —alta, edición, cambio de rol, desactivación, reactivación y restablecimiento de contraseña— dejando constancia de qué administrador la realizó, sobre qué usuario, qué acción fue y cuándo ocurrió. El registro solo admite entradas nuevas: nunca se edita ni se borra, y NO incluye contraseñas. En v1 no existe una vista para consultarlo.

  **Qué se registra exactamente, y qué no**. Cada entrada contiene cuatro datos y ninguno más: una referencia al administrador que actuó, una referencia al usuario afectado, cuál de las seis acciones fue y el instante en que ocurrió. Los usuarios se registran **por referencia, nunca por copia**: no se guardan el nombre, el correo, el teléfono ni ningún otro dato personal del afectado, ni sus valores anteriores o posteriores. Registrar solo lo necesario para responder «quién le hizo qué a quién y cuándo» es lo que exige el Principio X, y tiene una consecuencia asumida: la bitácora dice que se editó a un usuario, pero no qué campo cambió. Se acepta —el propósito del registro es la responsabilidad sobre la acción, no la reconstrucción del dato—.

  **Inalterabilidad y retención**. El carácter de solo-agregar es una propiedad del sistema, no una recomendación: no DEBE existir ninguna función, pantalla ni punto de entrada capaz de modificar o borrar una entrada, y su ausencia es comprobable revisando la implementación. Las entradas se conservan **indefinidamente**: v1 no purga ni archiva la bitácora, y no fija un plazo de retención. Con el volumen previsto —un solo local, unas pocas acciones administrativas al día— una política de purga sería alcance sin requisito (Principio I, Principio III). La bitácora sobrevive a la desactivación del usuario afectado y a la del administrador que actuó, porque ambas son referencias a cuentas que nunca se borran físicamente (RN-002).

  **Los eventos de autenticación quedan fuera**. Este registro cubre **solo** las seis acciones administrativas de HU-09. Los inicios de sesión, los intentos fallidos, los bloqueos temporales, los cierres y las expiraciones de sesión **no** se registran en v1. Es una decisión deliberada y no un olvido: ninguna historia de esta épica plantea consultar ese historial, no hay vista donde mostrarlo y construir un registro que nadie lee sería alcance fantasma (Principio III). La consecuencia asumida se declara sin rodeos: **v1 no permite investigar a posteriori quién intentó entrar a una cuenta ni cuándo**; solo se sabe que un bloqueo ocurrió mientras está vigente. Si esa capacidad llega a hacer falta, será un requisito nuevo con su propia entidad y su propia vista, no una ampliación silenciosa de este registro.
- **FR-035**: El sistema DEBE pedir al administrador una confirmación explícita antes de ejecutar una acción de impacto sobre otro usuario —cambio de rol (FR-011), desactivación (FR-012), reactivación (FR-013) y restablecimiento de contraseña (FR-026)—, mostrando en español a quién afecta y qué efecto tiene, y permitiendo cancelarla sin que se aplique ningún cambio (Principio IX). El alta (FR-009) y la edición de datos de contacto (FR-010) NO requieren confirmación adicional.

  **El diálogo DEBE decir si la acción se puede deshacer**, porque el Principio IX exige tanto confirmar antes de actuar como poder deshacer, y de las cuatro acciones **una no es reversible**:

  | Acción | ¿Reversible desde la interfaz? | Qué dice la confirmación |
  |---|---|---|
  | Desactivar (FR-012) | Sí, reactivando (FR-013) | Que el usuario podrá volver a entrar si se le reactiva |
  | Reactivar (FR-013) | Sí, desactivando | Que el usuario recupera el acceso con sus credenciales previas |
  | Cambiar de rol (FR-011) | Sí, asignando de nuevo el rol anterior | Qué rol tendrá y que su sesión terminará |
  | Restablecer contraseña (FR-026) | **No** | Que la contraseña anterior dejará de servir de forma definitiva y que deberá entregarle la nueva |

  Distinguirlas importa: presentar las cuatro con el mismo tono llevaría al administrador a tratar con la misma ligereza una desactivación —que se deshace en un clic— y un restablecimiento, que deja al usuario fuera hasta que alguien le comunique su contraseña nueva. Ninguna acción de esta épica es destructiva en el sentido de borrar datos: no existe el borrado (§ Fuera de Alcance).

- **FR-037**: Tras aplicar cualquier acción administrativa —alta, edición, cambio de rol, desactivación, reactivación y restablecimiento de contraseña—, el sistema DEBE mostrar una **confirmación de éxito en español** que nombre al usuario afectado y la acción realizada. La confirmación aparece solo cuando el cambio quedó firme (FR-030); si la acción se rechaza, se muestra el mensaje de error correspondiente y nunca ambos. Sin este requisito, FR-035 dejaría al administrador confirmando acciones cuyo resultado no puede distinguir de un fallo silencioso: pedirle que confirme antes y no decirle nada después es la peor mitad del Principio IX.

- **FR-038**: Toda acción que espere respuesta del sistema DEBE mostrar que está en curso e **impedir que se dispare dos veces**: el control que la inició queda inutilizable hasta que llega la respuesta. Cubre dos exigencias a la vez —que las operaciones sujetas al umbral de 5 segundos (SC-001, SC-007) no parezcan congeladas, y que un doble clic o un doble envío del formulario no produzca dos altas— y por eso es un solo requisito y no dos. El resguardo es de interfaz y no la única defensa: el sistema DEBE seguir comportándose correctamente si la petición llega dos veces, rechazando el correo duplicado (FR-017) y tratando como sin efecto la petición que no cambia nada (FR-012, FR-013).

- **FR-039**: Las pantallas de esta épica DEBEN cumplir cuatro condiciones de accesibilidad, todas comprobables sin herramientas especializadas: (a) toda la aplicación se puede recorrer y operar **solo con el teclado**, incluidos los diálogos de confirmación de FR-035; (b) el elemento con el foco es **visible en todo momento**; (c) cada campo de formulario tiene una **etiqueta asociada** que un lector de pantalla anuncia, y su mensaje de error queda asociado a ese campo y no suelto en la página; (d) el texto tiene **contraste suficiente** frente a su fondo para leerse sin esfuerzo. Quedan **fuera del alcance de v1** una auditoría formal de conformidad y las pruebas con lectores de pantalla reales; se declara para que su ausencia no se confunda con un descuido, y porque las cuatro condiciones anteriores son las que sostienen el Principio IV cuando quien valida no usa un ratón.

- **FR-040**: La aplicación DEBE ser usable en pantallas desde **360 píxeles de ancho** hasta las de escritorio, sin que ningún contenido quede inalcanzable: los listados con muchas columnas se desplazan o se reorganizan, pero no se recortan. Los navegadores contemplados en v1 son las **dos últimas versiones estables** de Chrome, Firefox, Edge y Safari. No se da soporte a navegadores sin actualizaciones vigentes, y esa exclusión se declara aquí para que no haya que descubrirla defecto a defecto.

### Requisitos Funcionales — HU-10 · Panel y reportes del administrador

- **FR-018**: El sistema DEBE restringir el acceso al panel de administración exclusivamente al rol "administrador", apoyándose en el mecanismo de autenticación y rol de HU-08.
- **FR-019**: El sistema DEBE mostrar en el panel métricas generales del estado operativo: cantidad de usuarios activos por rol y cantidad de pedidos por estado. **Los cuatro roles y los cinco estados aparecen siempre**, incluso con valor cero: una cifra que desaparece cuando vale cero deja un hueco en el panel y obliga a quien lo lee a averiguar si el dato falta o es nulo.

  **Mientras las métricas de pedidos no existan** —dependen de E4/E2—, el panel las presenta con el mismo mensaje de «sin datos» que FR-022 aplica a cualquier filtro sin resultados, y no con un espacio en blanco, un indicador de carga permanente ni un aviso sobre épicas futuras. El administrador ve que no hay pedidos, que es exactamente la verdad; el calendario del proyecto no es información suya.
- **FR-020**: El sistema DEBE permitir consultar un reporte/historial de pedidos filtrable por estado y por rango de fechas, de forma combinable. El reporte DEBE presentarse **con la misma paginación que el listado de usuarios** —20 por página, con el total de resultados indicado (FR-015)—, para que las dos superficies paginadas del producto se lean y se recorran igual.

  **Rango de fechas**: ambos extremos son **inclusivos**, de modo que elegir la misma fecha de inicio y de fin consulte ese día completo; con extremos exclusivos devolvería cero y parecería un defecto. Cada extremo es independiente: solo el inicio significa «desde esa fecha en adelante» y solo el fin, «hasta esa fecha». Si la fecha inicial es posterior a la final, el sistema DEBE rechazar la consulta con un mensaje en español que lo explique, en lugar de devolver un conjunto vacío que se confundiría con «no hay pedidos». Las fechas se interpretan siempre en **días del calendario del huso horario de referencia del producto** (§ Convenciones de interfaz), nunca en el huso del navegador de quien consulta: dos administradores en husos distintos deben ver exactamente el mismo reporte para el mismo rango.
- **FR-021**: El sistema NO DEBE ofrecer, desde el panel, ninguna acción que modifique datos operativos (estados de pedido, usuarios); toda acción de modificación corresponde a HU-07 o HU-09. **Navegar no es modificar**: que el panel sea la página de inicio del administrador (FR-031) y ofrezca un enlace a la gestión de usuarios no incumple este requisito, porque el enlace no cambia ningún dato —lo cambian las acciones de HU-09, ya dentro de esa otra vista y con sus propias confirmaciones (FR-035)—. La distinción es necesaria: sin ella, cumplir FR-021 obligaría a dejar al administrador en una pantalla sin salida.
- **FR-022**: El sistema DEBE mostrar un mensaje claro en español cuando un filtro no produce resultados, en lugar de una pantalla vacía sin explicación (Principio II).
- **FR-023**: El sistema DEBE reflejar en el panel el estado de los pedidos de forma consistente con la máquina de estados definida en HU-03 (creado → en preparación → asignado a repartidor → entregado → cerrado), sin definir estados propios.
- **FR-029**: El sistema NO DEBE incluir exportación de reportes a archivos externos ni actualización en tiempo real del panel en v1.

> **Entrega por fases de HU-10**: las métricas y reportes de pedidos (parte de FR-019, más FR-020 y FR-023) dependen de que existan pedidos, definidos en E4 y E2. Se especifican completos aquí, pero su verificación funcional queda condicionada a la disponibilidad de esas épicas. Las métricas de usuarios activos por rol, el control de acceso al panel, la ausencia de acciones de modificación y el mensaje de "sin datos" son verificables íntegramente dentro de E1.

### Reglas de Negocio

- **RN-001 · Un rol activo a la vez**: un usuario tiene exactamente un rol vigente. *Ejemplo*: si el administrador cambia el rol de un usuario de "cliente" a "negocio", su sesión abierta termina (FR-024) y, al volver a entrar, deja de tener las funciones de cliente y pasa a tener únicamente las de negocio. En ningún momento tiene los dos conjuntos de funciones ni conserva el anterior.
- **RN-002 · Baja lógica sin pérdida de historial**: un usuario desactivado no puede autenticarse y su sesión abierta se invalida de inmediato, pero su historial se conserva. *Ejemplo*: un repartidor desactivado no puede seguir operando ni volver a entrar, pero sus entregas pasadas siguen apareciendo en la trazabilidad (HU-03) y en los reportes del panel (HU-10).
- **RN-003 · El acceso lo determina el rol, no la persona**: no existen permisos diferenciados dentro de un mismo rol en v1 (Principio I). *Ejemplo*: todos los usuarios con rol "administrador" acceden al panel (HU-10) y a la gestión de usuarios (HU-09), sin excepciones individuales.
- **RN-004 · El panel es de solo lectura**: no puede alterar el estado de pedidos ni de usuarios. *Ejemplo*: desde el reporte del panel un administrador puede ver que un pedido quedó atascado en un estado, pero para forzar su avance debe usar HU-07 (Controles de flujos críticos), no HU-10.
- **RN-005 · Correo electrónico único, incluso entre desactivados**: *Ejemplo*: si ya existe un usuario con el correo `negocio@ejemplo.cl`, activo o desactivado, el sistema rechaza el alta de un segundo usuario con ese mismo correo; así la reactivación del original siempre es posible.
- **RN-006 · El sistema nunca queda sin administrador**: el número de administradores activos nunca puede llegar a cero por una acción de la aplicación. Lo garantiza FR-027: quien ejecuta una desactivación o un cambio de rol es siempre un administrador activo y no puede aplicarla sobre sí mismo, de modo que después de la acción queda al menos él. *Ejemplo*: un administrador no puede autodesactivarse ni degradarse su propio rol; si se necesita retirar a un administrador, otro administrador debe hacerlo, y ese otro sigue en pie. La pérdida de acceso *efectivo* —credenciales olvidadas, sin otro administrador que las restablezca— no es un estado que la aplicación pueda detectar ni impedir, y se recupera con el procedimiento operativo de FR-036.
- **RN-007 · Toda alta pasa por el administrador**: no existe autorregistro en v1. *Ejemplo*: un cliente nuevo no puede crearse una cuenta por su cuenta; el administrador la crea y le entrega la contraseña inicial.

### Entidades Clave

- **Usuario**: persona que accede a la plataforma. Atributos: nombre completo, correo electrónico (identificador de acceso, único en todo el sistema), teléfono, credencial de acceso (nunca en texto plano), rol y estado (activo/desactivado). Un usuario tiene exactamente un rol.
- **Control de intentos de acceso**: cuenta de intentos fallidos consecutivos y momento hasta el cual el acceso está bloqueado, asociados al **correo electrónico ingresado** en la pantalla de inicio de sesión, exista o no un usuario con ese correo (FR-033). Se lleva por separado del Usuario precisamente para que el comportamiento observable sea idéntico en ambos casos y no revele qué cuentas existen (FR-008). Se reinicia por inicio de sesión exitoso, por vencimiento de los 15 minutos o por restablecimiento de contraseña.
- **Rol**: categoría fija que determina el conjunto de funciones disponibles. Valores en v1: cliente, negocio, repartidor, administrador. No es editable ni extensible por el usuario final.
- **Sesión**: vínculo temporal entre un usuario autenticado y su uso de la aplicación. Se crea al iniciar sesión, guarda el rol vigente en ese momento, y termina por cierre explícito, por 30 minutos de inactividad o por cualquiera de las cuatro acciones administrativas de impacto sobre ese usuario (FR-024). El rol guardado nunca cambia mientras la sesión vive: un cambio de rol termina la sesión en lugar de mutarla.

  **Sesiones simultáneas**: un mismo usuario PUEDE tener varias sesiones vivas a la vez, en distintos navegadores o dispositivos. Iniciar sesión no cierra las demás, y cada una lleva su propio temporizador de inactividad de forma independiente: usar una no mantiene viva a otra. Se permite porque es lo que la persona espera —el teléfono y el computador a la vez— y porque limitarlo exigiría decidir a cuál de las dos expulsar, una regla que ningún requisito pide (Principio I, Principio III). Dos consecuencias se derivan de aquí y son obligatorias: las cuatro acciones de impacto de FR-024 terminan **todas** las sesiones del usuario afectado, no solo la última, y cerrar sesión (FR-006) termina **solo aquella desde la que se cierra**, dejando las demás intactas.
- **Registro de acciones administrativas**: bitácora de solo-agregar que conserva, por cada acción de HU-09, el administrador que la realizó, el usuario afectado, el tipo de acción y su fecha y hora. Nunca contiene contraseñas y no tiene vista de consulta en v1.
- **Panel de métricas** (vista de solo lectura): agregación de datos existentes —usuarios activos por rol y pedidos por estado— sin entidad propia ni datos editables.
- **Pedido** (entidad externa a esta épica): definida en E4/E2. HU-10 solo la consulta para reportes y respeta su máquina de estados (HU-03).

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: Un usuario con credenciales correctas inicia sesión y llega a la vista de su rol en menos de 5 segundos. Se mide con un cronómetro, desde que se envía el formulario hasta que la vista del rol es visible, sobre el entorno de contenedores del proyecto y con el padrón de datos de prueba. Basta con observarlo: no se exige instrumentación ni medición automatizada (ver supuesto 22).
- **SC-002**: El 100 % de los intentos con credenciales inválidas son rechazados sin crear sesión.
- **SC-003**: El 100 % de los intentos de acceder a una función fuera del rol del usuario autenticado son bloqueados. El criterio se comprueba **sin usar la interfaz**: se toma la sesión de un usuario de otro rol y se invoca directamente el punto de entrada de la función restringida, escribiendo su dirección en el navegador. Que la opción no aparezca en pantalla no cuenta como bloqueo; solo cuenta que la acción sea rechazada al procesarla (FR-003).
- **SC-004**: Un administrador crea un usuario nuevo y este puede iniciar sesión con el rol asignado en menos de un minuto desde el alta, en condiciones normales de uso.
- **SC-005**: El 100 % de los intentos de alta con datos obligatorios o rol faltantes son rechazados sin crear el usuario.
- **SC-006**: El 100 % de los usuarios desactivados pierden el acceso de inmediato —incluida su sesión abierta— sin perder su historial de pedidos asociado.
- **SC-007**: Un administrador accede al panel y ve las métricas generales en menos de 5 segundos, medido con el mismo criterio y en el mismo entorno que SC-001.
- **SC-008**: El 100 % de los intentos de acceso al panel por usuarios sin rol "administrador" son bloqueados.
- **SC-009**: El 100 % de las consultas de reporte filtradas devuelven únicamente datos que cumplen los criterios de filtro seleccionados.
- **SC-010**: Una persona no técnica puede verificar todos los escenarios de esta especificación usando la aplicación directamente —iniciar y cerrar sesión, esperar la expiración, crear, editar y desactivar usuarios, filtrar el panel— sin leer código ni logs (Principio IV). Se exceptúan de forma acotada y explícita dos aspectos, cuya verificación es técnica y se realiza en la revisión de la implementación: el registro de acciones administrativas (FR-034), que no tiene vista en v1, y el resguardo de credenciales (FR-007, FR-016, FR-028), que por su naturaleza no es observable desde la interfaz.
- **SC-011**: El 100 % de los intentos de alta con un correo ya usado por otro usuario, activo o desactivado, son rechazados.
- **SC-012**: Tras el restablecimiento de contraseña por el administrador, el 100 % de los intentos con la contraseña anterior son rechazados.
- **SC-013**: El 100 % de las sesiones sin actividad durante 30 minutos exigen reautenticación en la siguiente acción.
- **SC-014**: El 100 % de los intentos de un administrador de desactivarse a sí mismo o de cambiar su propio rol son bloqueados.
- **SC-015**: El 100 % de las vistas del panel de administración carecen de acciones que modifiquen datos operativos. La verificación se hace **contra un inventario explícito de las vistas del panel**, no recorriendo la aplicación a ojo: sin una lista cerrada, «el 100 % de las vistas» no es comprobable, porque nadie puede afirmar que las ha visitado todas. Los enlaces de navegación hacia la gestión de usuarios no cuentan como acciones de modificación (FR-021).
- **SC-016**: El 100 % de los intentos de asignar una contraseña fuera del rango de 8 a 72 caracteres —al crear un usuario o al restablecerla— son rechazados con un mensaje en español que indica cuál de los dos límites se incumplió. Ninguna contraseña aceptada se recorta.
- **SC-017**: El 100 % de los intentos de inicio de sesión realizados dentro de los 15 minutos posteriores a 5 fallos consecutivos son rechazados, y el acceso vuelve a permitirse automáticamente una vez transcurrido ese lapso.
- **SC-018**: El mensaje mostrado tras 5 intentos fallidos es idéntico, palabra por palabra, para un correo registrado y para uno no registrado, verificable comparando ambas pantallas.
- **SC-019**: El 100 % de las acciones de impacto sobre otro usuario —cambio de rol, desactivación, reactivación y restablecimiento de contraseña— exigen una confirmación explícita, y el 100 % de las confirmaciones canceladas dejan al usuario afectado sin ningún cambio.
- **SC-020**: El 100 % de las búsquedas y filtros sin resultados —tanto en el listado de usuarios como en los reportes del panel— muestran un mensaje explicativo en español en lugar de una pantalla vacía.
- **SC-021**: Un administrador encuentra a un usuario concreto en un padrón de cualquier tamaño escribiendo parte de su nombre o de su correo, sin recorrer páginas del listado, y el 100 % de los resultados devueltos contienen el texto buscado en alguno de esos dos campos.
- **SC-022**: Tras cualquier secuencia de desactivaciones y cambios de rol ejecutada desde la aplicación, siempre queda al menos un usuario con rol administrador en estado activo, verificable revisando el listado filtrado por rol "administrador" y estado "activo".
- **SC-023**: Recorrer dos veces las mismas páginas del listado con los mismos criterios devuelve exactamente los mismos usuarios en el mismo orden, sin repeticiones ni ausencias entre páginas.
- **SC-024**: Una sesión dejada abierta y sin intervención del usuario durante 30 minutos exige reautenticación, aunque la aplicación haya permanecido abierta en el navegador durante todo ese lapso.
- **SC-025**: El 100 % de las acciones administrativas de impacto —desactivación, cambio de rol, reactivación y restablecimiento de contraseña— terminan las sesiones abiertas del usuario afectado, cuya siguiente acción exige autenticarse de nuevo.
- **SC-026**: Tras un cambio de rol, en ningún momento el usuario afectado puede ejercer una función de su rol anterior: no existe ventana alguna entre el cambio y el fin de su sesión.
- **SC-027**: El resguardo de credenciales se verifica en la revisión de la implementación con tres comprobaciones objetivas, no con un juicio: (a) ninguna contraseña aparece legible en el almacén de datos —lo guardado es un hash con sal, reconocible por su formato y distinto para dos usuarios con la misma contraseña—; (b) ninguna respuesta del sistema ni ningún registro de diagnóstico contiene la contraseña ni su hash, comprobable inspeccionando la respuesta del alta de un usuario y la salida del sistema durante un inicio de sesión; (c) el repositorio no contiene ninguna contraseña ni valor secreto, y el archivo de configuración local está excluido del control de versiones. Es la contrapartida medible de la excepción declarada en SC-010 para FR-007, FR-016 y FR-028.
- **SC-028**: Los cuatro intentos fallidos de inicio de sesión que enumera FR-008 —correo inexistente, correo existente con contraseña incorrecta, cuenta desactivada con credenciales correctas y cuenta bloqueada temporalmente— producen mensajes que una persona no técnica no puede distinguir entre sí salvo por el hecho de estar bloqueada, verificable comparando las cuatro pantallas una junto a otra.
- **SC-029**: El 100 % de las sesiones abiertas del usuario afectado —incluidas las de otros navegadores o dispositivos— terminan tras una acción administrativa de impacto, y el 100 % de las sesiones del administrador que la ejecuta continúan vivas.
- **SC-030**: El 100 % de los cierres de sesión explícitos terminan la sesión desde la que se ejecutan, y ninguna acción posterior realizada con ella es aceptada —incluido volver atrás en el navegador—.
- **SC-031**: Durante un uso continuado sin pausas de 30 minutos, el 100 % de las acciones se aceptan sin volver a pedir autenticación.
- **SC-032**: El 100 % de las ediciones de datos de contacto quedan reflejadas en la siguiente consulta del usuario y conservan intactos su rol y su estado.
- **SC-033**: El 100 % de los usuarios reactivados vuelven a iniciar sesión con las credenciales que tenían antes de su desactivación, sin que el administrador tenga que restablecérselas.
- **SC-034**: El 100 % de los listados filtrados por rol, por estado o por ambos devuelven únicamente usuarios que cumplen todos los criterios aplicados, paginados de a 20 e indicando el total.
- **SC-035**: El 100 % de las acciones enviadas con una sesión ya expirada se rechazan sin aplicar ningún cambio, comprobable verificando que el dato que la acción pretendía modificar conserva su valor anterior.
- **SC-036**: El 100 % de los mensajes visibles de esta épica cumplen las cuatro condiciones de «mensaje claro y sin detalles técnicos» (§ Convenciones de interfaz), verificable leyéndolos: una persona no técnica los repite con sus palabras sin preguntar qué significan. El inventario a recorrer son los mensajes fijos del sistema más los de validación de cada campo, e incluye expresamente el de bloqueo temporal (FR-033) y los dos de «sin resultados» (FR-015, FR-022).
- **SC-037**: El 100 % de las acciones administrativas aplicadas muestran una confirmación de éxito que nombra al usuario afectado, y el 100 % de las rechazadas muestran un mensaje de error; ninguna acción termina sin que la pantalla diga qué ocurrió.
- **SC-038**: El 100 % de las pantallas se recorren y operan solo con el teclado, con el foco visible en todo momento, incluidos los diálogos de confirmación; y el 100 % de los campos de formulario tienen etiqueta asociada.
- **SC-039**: Un doble clic sobre cualquier acción administrativa produce un solo efecto, comprobable en el listado y en la bitácora: nunca dos usuarios creados ni dos entradas de registro por una sola intención.

## Supuestos

Los siguientes puntos fueron resueltos con la persona responsable del producto antes de redactar esta especificación y quedan fijados como decisiones, no como preguntas abiertas:

1. **Inactividad**: 30 minutos, uniforme para todos los roles (se descartó una duración diferenciada por rol por Principio I, Simplicidad ante todo).
2. **Desactivación con sesión abierta**: invalida la sesión de inmediato, no al expirar.
3. **Autorregistro**: no existe; toda alta pasa exclusivamente por el administrador.
4. **Contraseña olvidada**: la restablece el administrador desde HU-09; no hay flujo de autoservicio, correo de recuperación ni tokens temporales en v1.
5. **Correo de un usuario desactivado**: queda reservado; la unicidad cubre activos y desactivados.
6. **Identificador de acceso**: el correo electrónico, un único campo (se descartó "correo o teléfono" para no duplicar reglas de unicidad y validación).
7. **Panel**: sin exportación de reportes a archivos externos y sin actualización en tiempo real.
8. **Primer administrador**: se crea como semilla inicial del sistema, con la contraseña provista por configuración externa al repositorio (Principio V).
9. **Reportes de pedidos**: se especifican completos en esta épica y su verificación funcional se realiza cuando E4/E2 hayan entregado los pedidos.
10. **Datos obligatorios del usuario**: nombre completo, correo electrónico, teléfono y contraseña inicial, además del rol.
11. **Autoprotección del administrador**: no puede autodesactivarse ni cambiarse su propio rol; sí puede editar sus datos de contacto.

Decisiones tomadas el 2026-08-15 para resolver conflictos internos detectados en la revisión de calidad de requisitos (`checklists/security.md`, `checklists/ux.md`):

12. **Bloqueo temporal y no revelación de cuentas**: el conteo de intentos fallidos se lleva por correo ingresado —exista o no la cuenta— y el mensaje de bloqueo es idéntico en ambos casos. Se descartó mostrar un mensaje específico solo a cuentas reales, porque habría filtrado qué correos están registrados, contradiciendo FR-008.
13. **Verificabilidad de los requisitos de credenciales**: FR-007, FR-016 y FR-028 se declaran excepción acotada al Principio IV, junto con FR-034. No son observables desde la interfaz y se verifican en la revisión de la implementación; la alternativa —exponer indicios del almacenamiento en pantalla— habría sido en sí misma una debilidad de seguridad.
14. **Búsqueda por nombre y correo en el padrón**: el escenario Gherkin insinuaba una búsqueda que ningún requisito respaldaba. Se resolvió ampliando FR-015 con búsqueda por texto sobre nombre completo y correo, combinable con los filtros por rol y estado, porque a medida que crece el padrón los filtros por rol y estado no bastan para llegar a una persona concreta dentro de páginas de 20. La búsqueda es parcial e insensible a mayúsculas y acentos; no se incorporan búsquedas por otros campos ni operadores avanzados (Principio I).
15. **Confirmación antes de acciones de impacto**: cambio de rol, desactivación, reactivación y restablecimiento de contraseña exigen confirmación explícita y cancelable (FR-035), para dar cumplimiento al Principio IX. El alta y la edición de datos de contacto quedan fuera por ser reversibles y de bajo impacto.

Decisiones tomadas el 2026-08-15 para resolver los bloqueadores detectados en la revisión de calidad de diseño (`checklists/api.md`, `checklists/data.md`, `checklists/ops.md`):

16. **Mínimo de un administrador activo**: se examinó si hacía falta una comprobación explícita del número de administradores activos y se concluyó que **no**. FR-027 ya lo garantiza: quien ejecuta una desactivación o un cambio de rol es siempre un administrador activo y tiene prohibido aplicarla sobre sí mismo, luego después de la acción queda al menos él. Añadir un recuento sería una comprobación que nunca podría dispararse (Principio I, y Principio III: cero alcance fantasma). Lo que sí faltaba era el camino de recuperación cuando ningún administrador conserva acceso *efectivo* —un estado que la aplicación no puede detectar, porque la cuenta sigue activa y válida—, y eso se resolvió con FR-036, fuera de la aplicación. Se descartó marcar al administrador semilla como irrevocable: crearía una cuenta privilegiada por identidad y no por rol, contra RN-003.
17. **Actividad de sesión**: solo las acciones iniciadas por la persona refrescan la sesión. Se descartó contar cualquier petición autenticada, porque una consulta periódica de la aplicación al servidor mantendría la sesión viva indefinidamente y vaciaría de sentido a FR-005 y SC-013.
18. **Orden del listado de usuarios**: del alta más reciente a la más antigua. Sin un orden declarado, la paginación de 20 por página no es determinista y un mismo usuario puede aparecer dos veces o ninguna al pasar de página. Se descartó el orden alfabético por nombre porque en el uso previsto —revisar altas recientes— el orden cronológico inverso pone delante lo que el administrador busca.
19. **Mensaje de "sin resultados" transversal**: la exigencia que FR-022 imponía solo al panel se extiende al listado de usuarios de HU-09 (FR-015), para que el comportamiento ante un filtro vacío sea uno solo en toda la épica.

Decisiones aprobadas por la persona responsable del producto el 2026-08-15, tras revisar D-014 y D-002:

20. **Revocación de sesiones en las cuatro acciones de impacto** (enmienda a FR-024): originalmente FR-024 solo exigía invalidar sesiones al desactivar un usuario. Eso dejaba abiertas dos incoherencias: un usuario degradado de rol conservaba los privilegios anteriores **hasta 30 minutos**, contra la intención de RN-003; y una sesión abierta seguía operando tras un restablecimiento que acababa de invalidar su credencial, vaciando de sentido a FR-026. Se amplía FR-024 a las cuatro acciones de impacto. Se descartaron tres alternativas: revocar solo en la desactivación (mantiene ambas incoherencias); aplicar el nuevo rol en caliente sobre la sesión viva (contradice el caso límite «cambio de rol con sesión activa»); y revocar solo en desactivación y restablecimiento (resuelve un problema y deja el otro, y una excepción sin regla es más difícil de mantener que una regla uniforme, Principio I). La reactivación se incluye por uniformidad, aunque en la práctica no encuentre sesiones vivas. Registrada como D-014 en `research.md`.

21. **Longitud máxima de contraseña** (enmienda a FR-032): originalmente FR-032 solo fijaba el mínimo de 8 caracteres. El algoritmo de hash elegido (bcrypt, D-002) **recorta silenciosamente su entrada a 72 bytes**, de modo que sin un máximo declarado dos contraseñas que compartieran sus primeros 72 bytes serían equivalentes para el sistema sin que nadie lo advirtiera. Se fija el máximo en 72. No es una regla de negocio nueva sino la exposición honesta de una restricción técnica: la alternativa —aceptar la contraseña y recortarla en silencio— es un comportamiento oculto que contradice el Principio IV, y deja al usuario creyendo que su contraseña es más fuerte de lo que realmente es. El límite se mide en **bytes UTF-8**, no en caracteres, porque el recorte de bcrypt ocurre en bytes; el mensaje al usuario habla de caracteres, que es lo que la persona percibe. Registrada como D-002 en `research.md`.

Decisión tomada el 2026-08-15 tras el análisis de consistencia entre spec, plan y tareas (`/speckit-analyze`):

22. **Cómo se miden los 5 segundos** (SC-001, SC-007): con un cronómetro, sobre el entorno de contenedores del proyecto y el padrón de prueba, observando la pantalla. La expresión «en condiciones normales de red» quedaba sin definición operativa y hacía el criterio no medible de forma reproducible. Se descartó instrumentar la aplicación o montar pruebas de carga: con el volumen de v1 —un solo local— no hay presión de rendimiento, y construir medición automatizada para un umbral que se comprueba a ojo sería alcance no pedido (Principio I, Principio III). La contrapartida asumida es que estos dos criterios **no tienen cobertura automática**: si el rendimiento se degradara, lo detectaría una persona validando, no la batería de pruebas.

Decisiones tomadas el 2026-08-15 al cerrar la revisión de calidad de seguridad y de contratos (`checklists/security.md`, `checklists/api.md`):

23. **Entrega de la contraseña inicial**: el administrador la elige al crear el usuario y se la comunica **por fuera del sistema**, por el canal que él estime —en persona, por teléfono o por mensajería—. v1 no envía correos ni mensajes: no hay servicio de correo en el alcance, y añadirlo arrastraría configuración, plantillas y un modo de fallo nuevo para un producto de un solo local (Principio I, Principio III). El resguardo que sí impone el sistema es que **la contraseña solo es visible en el formulario donde el administrador acaba de escribirla**: nunca se vuelve a mostrar, no se puede consultar después y ninguna pantalla la recupera. Si se pierde, el camino es restablecerla (FR-026), no recuperarla. La consecuencia asumida es que la seguridad del canal de entrega queda en manos del administrador y fuera de lo que el sistema puede garantizar.

24. **Transporte cifrado**: el cifrado del canal (TLS/HTTPS) es responsabilidad del despliegue, no de la aplicación, y queda fuera del alcance de v1 —el proyecto es académico y se ejecuta en local—. La aplicación hace la parte que sí le corresponde y no depende del entorno: la credencial viaja únicamente en el cuerpo de la petición de inicio de sesión, nunca en la dirección; el identificador de sesión vive en una cookie inaccesible desde el código de la página; y esa cookie se marca como exigible solo por canal seguro en cuanto la aplicación corre en modo producción. Se declara aquí explícitamente para que la ausencia de TLS en v1 se lea como una decisión de alcance y no como un descuido: **un despliegue real de esta aplicación sin TLS por delante expondría las contraseñas en tránsito**.

25. **Ataques distribuidos y sobre múltiples cuentas**: fuera de alcance en v1. El bloqueo de FR-033 protege *una cuenta* de que le adivinen la contraseña y nada más. No hay límite por origen de la petición, ni detección de un mismo origen probando muchos correos, ni prueba de que haya una persona detrás, ni ninguna medida contra el uso de credenciales filtradas de otros servicios. Se descartaron por dos razones: ninguna historia de la épica las plantea, y todas exigen infraestructura de la que v1 carece —un almacén de reputación por origen, un servicio externo de verificación—. La consecuencia asumida se declara sin adornos: **v1 no resiste un ataque distribuido**, y el día que deba hacerlo será con requisitos propios, no ampliando FR-033.

26. **Sesiones simultáneas**: se admiten varias sesiones vivas del mismo usuario, cada una con su propio temporizador de inactividad. Se descartó limitar a una sesión por usuario porque obligaría a decidir a cuál de las dos expulsar y a explicárselo a quien se queda fuera, para resolver un problema que ninguna historia plantea (Principio I, Principio III).

27. **Registro de eventos de autenticación**: fuera de alcance en v1; la bitácora de FR-034 cubre solo las seis acciones administrativas. Se descartó registrar inicios de sesión, fallos y bloqueos porque no hay vista donde consultarlos ni requisito que los pida, y un registro que nadie lee es alcance fantasma (Principio III). La consecuencia asumida es que v1 no permite investigar a posteriori los intentos de acceso a una cuenta.

Supuestos adicionales de contexto:

- **Mono-local**: v1 no contempla múltiples locales en la misma plataforma (decisión de alcance de `docs/epicas-hu/EPICS.md`), por lo que los roles "negocio" no se segmentan por local.
- **Plataforma web**: el acceso se produce desde un navegador; no hay aplicación móvil nativa en v1.
- **Máquina de estados de pedidos**: se toma como dada desde HU-03 (Principio XII); esta épica la consume, no la define.

## Fuera de Alcance (v1)

- Recuperación o restablecimiento de contraseña por parte del propio usuario (lo hace el administrador vía HU-09). Alcanza también al **cambio voluntario de contraseña** por quien la conoce: en v1 no existe ninguna pantalla donde un usuario cambie su propia contraseña, ni siquiera el administrador la suya. El único camino es FR-026 (supuesto 23).
- Envío de correos o mensajes por parte del sistema: no hay servicio de correo en v1. La contraseña inicial la entrega el administrador por fuera del sistema (supuesto 23).
- Cifrado del canal de comunicación (TLS/HTTPS): corresponde al despliegue, no a la aplicación (supuesto 24).
- Defensas frente a ataques distribuidos, sobre múltiples cuentas o desde múltiples orígenes: límites por origen de la petición, pruebas de que hay una persona detrás y detección de credenciales filtradas quedan fuera. FR-033 protege una cuenta concreta y nada más (supuesto 25).
- Registro consultable de los eventos de autenticación —inicios de sesión, fallos, bloqueos, cierres y expiraciones— (supuesto 27).
- Límite de sesiones simultáneas por usuario y vista de "sesiones activas" desde la que cerrarlas (supuesto 26).
- Control de edición concurrente sobre un mismo usuario: prevalece el último cambio guardado, sin aviso (§ Casos Límite).
- Autenticación federada (Google, redes sociales u otros proveedores externos).
- Autorregistro de usuarios: toda alta pasa exclusivamente por el administrador.
- Eliminación física (borrado permanente) de un usuario; solo baja lógica, por trazabilidad de pedidos históricos (HU-03).
- Modelo de permisos granular por función dentro de un mismo rol; el rol determina de forma fija el conjunto de funciones disponibles (Principio I).
- Cualquier acción que modifique datos operativos desde el panel; corresponde a HU-07 (Controles de flujos críticos, E8).
- Vista de consulta del registro de acciones administrativas (FR-034): el registro se guarda, pero en v1 no se expone en pantalla; junto con el resguardo de credenciales (FR-007, FR-016, FR-028) son las dos únicas partes de esta épica no verificables por una persona no técnica desde la aplicación (excepciones acotadas declaradas en SC-010).
- Exportación de reportes a archivos externos (PDF, Excel, CSV).
- Actualización en tiempo real del panel.
- Soporte multi-local.
- Datos biométricos o de voz como parte de la autenticación (Principio X); la voz en FoodVoice se usa solo para búsqueda de productos y carrito (E6), nunca para iniciar sesión.
- Auditoría formal de conformidad de accesibilidad y pruebas con lectores de pantalla reales; v1 se limita a las cuatro condiciones comprobables de FR-039.
- Soporte a navegadores sin actualizaciones vigentes: v1 contempla las dos últimas versiones estables de Chrome, Firefox, Edge y Safari (FR-040).
- Conservación de los datos escritos en un formulario cuando la sesión expira antes de enviarlo: se pierden y hay que reescribirlos (FR-030).
- Selección de idioma o de huso horario por parte del usuario: la interfaz está solo en español y las fechas se presentan en el huso de referencia del producto (§ Convenciones de interfaz).

## Dependencias

- **Hacia adelante**: E4 (Trazabilidad del pedido) y E2 (Gestión de pedidos) deben existir para poder verificar funcionalmente las métricas y reportes de pedidos de HU-10.
- **Hacia atrás**: ninguna. E1 es la primera épica del orden de especificación y no depende de ninguna otra para su construcción.
- **Configuración externa**: la contraseña del administrador semilla debe provenir de una fuente de configuración externa al repositorio del proyecto, nunca escrita en el código (Principio V). El mecanismo concreto se define en la fase de planificación.
