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

  Escenario: Inicio de sesión exitoso
    Dado que soy un usuario registrado y activo con rol "cliente"
    Cuando ingreso mi correo electrónico y mi contraseña correctos
    Entonces el sistema me autentica
    Y me redirige a la página de inicio de mi rol, que muestra mi nombre, mi rol
      y la acción "Cerrar sesión"
    Y mi sesión queda activa

  Escenario: Credenciales inválidas
    Dado que estoy en la pantalla de inicio de sesión
    Cuando ingreso una contraseña incorrecta
    Entonces el sistema muestra un mensaje de error en español, claro y sin detalles técnicos
    Y el mensaje no revela si el error estuvo en el correo o en la contraseña
    Y no se crea ninguna sesión

  Escenario: Bloqueo temporal por intentos fallidos
    Dado que fallé 5 veces seguidas la contraseña de mi cuenta
    Cuando intento iniciar sesión otra vez, incluso con la contraseña correcta
    Entonces el sistema rechaza el acceso durante 15 minutos
    Y muestra un mensaje en español indicando que la cuenta está bloqueada temporalmente
    Y transcurridos esos 15 minutos puedo iniciar sesión con mi contraseña correcta

  Escenario: Acceso a función fuera del rol
    Dado que inicié sesión con rol "repartidor"
    Cuando intento acceder a una función exclusiva del rol "administrador"
    Entonces el sistema me lo impide
    Y muestra un mensaje en español explicando que no tengo permiso

  Escenario: Cierre de sesión
    Dado que tengo una sesión activa
    Cuando selecciono "Cerrar sesión"
    Entonces mi sesión termina de inmediato
    Y para volver a acceder debo autenticarme nuevamente

  Escenario: Expiración de sesión por inactividad
    Dado que tengo una sesión activa
    Cuando transcurren 30 minutos sin que realice ninguna acción
    Entonces mi sesión expira automáticamente
    Y la próxima acción que intente me pide volver a iniciar sesión

  Escenario: Persistencia de la sesión durante el uso normal
    Dado que inicié sesión correctamente
    Cuando navego entre distintas pantallas de la aplicación dentro de los 30 minutos permitidos
    Entonces no se me vuelve a pedir autenticación

  Escenario: Sesión invalidada por desactivación del usuario
    Dado que tengo una sesión activa
    Cuando el administrador desactiva mi usuario
    Entonces mi siguiente acción es rechazada
    Y el sistema me pide iniciar sesión
    Y no puedo volver a autenticarme mientras siga desactivado

  Escenario: Inicio de sesión con contraseña restablecida por el administrador
    Dado que el administrador restableció mi contraseña
    Cuando intento iniciar sesión con mi contraseña anterior
    Entonces el sistema rechaza el acceso
    Y cuando ingreso la nueva contraseña, el sistema me autentica

  Escenario: Expiración de sesión durante una acción en curso
    Dado que mi sesión expiró por inactividad mientras completaba un formulario
    Cuando intento guardar los cambios
    Entonces la acción se rechaza por completo
    Y el sistema me pide volver a iniciar sesión
    Y ningún cambio queda aplicado parcialmente
```

---

### Historia de Usuario 2 - Gestión de usuarios y roles (HU-09) (Prioridad: P2)

El administrador crea, edita, cambia de rol, desactiva y reactiva a las personas que usan la plataforma, y puede restablecer la contraseña de cualquiera de ellas. También puede listar y filtrar el padrón de usuarios por rol y por estado para encontrar rápidamente a quien busca.

**Por qué esta prioridad**: es lo que permite que existan usuarios reales más allá de la semilla inicial. Sin ella, la plataforma solo puede operar con el administrador precargado y no puede incorporar clientes, negocios ni repartidores.

**Prueba independiente**: se puede verificar iniciando sesión como administrador y ejecutando el ciclo de vida completo de un usuario de prueba —crearlo, editarlo, cambiarle el rol, desactivarlo, reactivarlo, restablecerle la contraseña y filtrarlo en el listado— comprobando en cada paso que el usuario afectado puede o no puede iniciar sesión según corresponda. No requiere que HU-10 esté construida.

**Escenarios de Aceptación**:

```gherkin
Característica: Gestión de usuarios y roles

  Escenario: Alta de un nuevo usuario
    Dado que inicié sesión como administrador
    Cuando registro un nuevo usuario con nombre completo, correo electrónico, teléfono
      y contraseña inicial, y le asigno el rol "repartidor"
    Entonces el usuario queda creado con estado activo
    Y puede iniciar sesión con el rol "repartidor" asignado

  Escenario: Edición de datos de un usuario
    Dado que existe un usuario activo en el sistema
    Cuando el administrador edita sus datos de contacto
    Entonces los cambios quedan reflejados de inmediato
    Y el usuario conserva su rol y su estado previos

  Escenario: Cambio de rol de un usuario
    Dado que existe un usuario activo con rol "cliente"
    Cuando el administrador le cambia el rol a "negocio"
    Entonces el usuario pasa a tener el rol "negocio"
    Y en su próximo inicio de sesión accede a las funciones correspondientes a ese rol

  Escenario: Desactivación de un usuario
    Dado que existe un usuario activo
    Cuando el administrador lo desactiva
    Entonces el usuario no puede volver a iniciar sesión
    Y su historial de pedidos previos permanece disponible para trazabilidad

  Escenario: Reactivación de un usuario
    Dado que existe un usuario desactivado
    Cuando el administrador lo reactiva
    Entonces el usuario puede volver a iniciar sesión con sus credenciales previas

  Escenario: Intento de alta con datos incompletos
    Dado que estoy registrando un nuevo usuario
    Cuando omito un dato obligatorio o el rol
    Entonces el sistema muestra un mensaje de error en español, claro y sin detalles técnicos
    Y no se crea el usuario

  Escenario: Intento de alta con un correo ya existente
    Dado que ya existe un usuario, activo o desactivado, con el correo "negocio@ejemplo.cl"
    Cuando intento crear otro usuario con ese mismo correo
    Entonces el sistema rechaza el alta con un mensaje claro en español
    Y no se crea el usuario

  Escenario: Intento de alta con una contraseña demasiado corta
    Dado que estoy registrando un nuevo usuario
    Cuando asigno una contraseña de menos de 8 caracteres
    Entonces el sistema muestra un mensaje de error en español indicando el mínimo exigido
    Y no se crea el usuario

  Escenario: Búsqueda y filtrado de usuarios
    Dado que existen usuarios con distintos roles y estados
    Cuando el administrador filtra el listado por rol "negocio" y estado "activo"
    Entonces el sistema muestra únicamente los usuarios que cumplen ambos criterios
    Y los presenta de a 20 por página, indicando el total de resultados del filtro

  Escenario: Restablecimiento de contraseña por el administrador
    Dado que existe un usuario que olvidó su contraseña
    Cuando el administrador le restablece la contraseña
    Entonces el usuario puede iniciar sesión con la nueva contraseña
    Y su contraseña anterior deja de ser válida

  Escenario: Un administrador no puede desactivarse a sí mismo
    Dado que inicié sesión como administrador
    Cuando intento desactivar mi propia cuenta o cambiarme mi propio rol
    Entonces el sistema me lo impide con un mensaje claro en español
    Y sí puedo editar mis propios datos de contacto
```

---

### Historia de Usuario 3 - Panel y reportes del administrador (HU-10) (Prioridad: P3)

El administrador entra a un panel donde ve, de un vistazo, el estado operativo general de la plataforma —cuántos usuarios activos hay por rol y cuántos pedidos hay en cada estado— y puede consultar el historial de pedidos filtrándolo por estado y por rango de fechas. El panel solo muestra información: no ofrece ninguna acción que cambie datos.

**Por qué esta prioridad**: aporta visibilidad y control de gestión, pero no habilita ninguna operación nueva. La plataforma funciona sin él, y sus métricas de pedidos dependen de épicas posteriores.

**Prueba independiente**: se puede verificar iniciando sesión como administrador y revisando las métricas de usuarios activos por rol, comprobando que otro rol no puede entrar al panel, que ninguna vista ofrece botones de modificación y que un filtro sin resultados muestra un mensaje explicativo. La parte de pedidos se verifica con los mismos pasos una vez que existan pedidos (E4/E2).

**Escenarios de Aceptación**:

```gherkin
Característica: Panel y reportes del administrador

  Escenario: Acceso al panel como administrador
    Dado que inicié sesión con rol "administrador"
    Cuando accedo al panel de administración
    Entonces veo las métricas generales del estado operativo actual del sistema

  Escenario: Acceso al panel denegado a otros roles
    Dado que inicié sesión con un rol distinto de "administrador"
    Cuando intento acceder al panel de administración
    Entonces el sistema me lo impide
    Y muestra un mensaje en español explicando que no tengo permiso

  Escenario: Consulta de reporte de pedidos por estado
    Dado que estoy en el panel de administración
    Cuando filtro el reporte de pedidos por el estado "entregado"
    Entonces el sistema muestra únicamente los pedidos que se encuentran en ese estado

  Escenario: Consulta de reporte de pedidos por rango de fechas
    Dado que estoy en el panel de administración
    Cuando filtro el reporte de pedidos por un rango de fechas determinado
    Entonces el sistema muestra únicamente los pedidos creados dentro de ese rango

  Escenario: El panel no permite modificar datos
    Dado que estoy visualizando el reporte de un pedido en el panel
    Cuando reviso las opciones disponibles en esa vista
    Entonces no encuentro ninguna acción que modifique el estado del pedido o del usuario

  Escenario: Panel sin datos disponibles
    Dado que no existen pedidos ni usuarios que cumplan los filtros seleccionados
    Cuando consulto el reporte correspondiente
    Entonces el sistema muestra un mensaje claro en español indicando que no hay datos
      para ese filtro, en lugar de un error o una pantalla vacía sin explicación
```

---

### Casos Límite

- **Usuario desactivado con sesión abierta**: la sesión se invalida de inmediato; su siguiente acción es rechazada y no puede volver a autenticarse.
- **Cambio de rol con sesión activa**: el nuevo rol aplica recién en el próximo inicio de sesión, no en caliente sobre la sesión abierta.
- **Alta con un correo ya existente, incluso de un usuario desactivado**: se rechaza; el correo de un usuario dado de baja queda reservado para que su reactivación siempre sea posible.
- **Filtro del panel sin resultados**: se muestra un mensaje claro, no una pantalla vacía ni un error técnico.
- **Expiración de sesión justo al completar una acción** (por ejemplo, el administrador guardando la edición de un usuario): la acción se rechaza íntegramente y se pide reautenticación; nunca se aplica parcialmente.
- **Último administrador intentando desactivarse**: bloqueado; el sistema nunca puede quedar sin ningún administrador con acceso.
- **Reactivación de un usuario cuyo correo se intentó reutilizar entretanto**: no puede ocurrir, porque la unicidad del correo cubre también a los usuarios desactivados.
- **Contraseña anterior tras un restablecimiento**: deja de ser válida de inmediato.
- **Cuenta bloqueada temporalmente por intentos fallidos**: durante los 15 minutos se rechaza incluso la contraseña correcta, con un mensaje en español; el bloqueo se levanta solo, sin intervención del administrador. Un restablecimiento de contraseña por el administrador también levanta el bloqueo.

## Requisitos *(obligatorio)*

### Requisitos Funcionales — HU-08 · Autenticación y sesión

- **FR-001**: El sistema DEBE permitir iniciar sesión mediante correo electrónico y contraseña.
- **FR-002**: El sistema DEBE identificar el rol del usuario autenticado (cliente, negocio, repartidor, administrador) y usarlo para determinar qué funciones están disponibles.
- **FR-003**: El sistema DEBE rechazar el acceso a funciones que no correspondan al rol del usuario autenticado, mostrando un mensaje en español (Principio II).
- **FR-004**: El sistema DEBE mantener la sesión activa mientras el usuario interactúa con la aplicación, sin requerir reautenticación en cada acción.
- **FR-005**: El sistema DEBE expirar la sesión automáticamente tras 30 minutos de inactividad, con la misma duración para todos los roles.
- **FR-006**: El sistema DEBE permitir cerrar sesión explícitamente en cualquier momento, terminando la sesión de inmediato.
- **FR-007**: El sistema NO DEBE almacenar contraseñas en texto plano ni exponer credenciales o tokens en el código fuente (Principio V).
- **FR-008**: Los mensajes de error de autenticación DEBEN ser genéricos respecto a si el correo o la contraseña es lo incorrecto, para no filtrar qué cuentas existen.
- **FR-024**: El sistema DEBE invalidar de inmediato toda sesión activa de un usuario que sea desactivado, de modo que su siguiente acción sea rechazada.
- **FR-025**: El sistema NO DEBE ofrecer autorregistro; el único camino de alta de usuarios es a través del administrador (HU-09).
- **FR-030**: El sistema DEBE rechazar íntegramente cualquier acción iniciada con una sesión expirada, sin aplicar cambios parciales, y solicitar reautenticación.
- **FR-031**: Tras un inicio de sesión exitoso, el sistema DEBE llevar al usuario a una página de inicio propia de su rol. Para cliente, negocio y repartidor esa página en v1 es mínima: muestra el nombre del usuario, su rol y la acción "Cerrar sesión"; las funciones específicas de cada rol se incorporan en sus épicas (E2/E3/E5). Para el administrador, la página de inicio es el panel de administración (HU-10).
- **FR-033**: El sistema DEBE bloquear temporalmente el inicio de sesión de una cuenta tras 5 intentos fallidos consecutivos, durante 15 minutos, mostrando un mensaje en español; pasado ese lapso el bloqueo se levanta automáticamente, sin intervención del administrador. Un inicio de sesión exitoso reinicia el contador de intentos fallidos.

### Requisitos Funcionales — HU-09 · Gestión de usuarios y roles

- **FR-009**: El sistema DEBE permitir a un administrador crear un usuario con nombre completo, correo electrónico, teléfono, contraseña inicial y un rol (cliente, negocio, repartidor, administrador).
- **FR-010**: El sistema DEBE permitir a un administrador editar los datos de contacto y el correo electrónico de un usuario existente.
- **FR-011**: El sistema DEBE permitir a un administrador cambiar el rol asignado a un usuario existente; el nuevo rol rige a partir del próximo inicio de sesión de ese usuario.
- **FR-012**: El sistema DEBE permitir a un administrador desactivar un usuario, impidiendo que vuelva a iniciar sesión, sin eliminar su historial asociado.
- **FR-013**: El sistema DEBE permitir a un administrador reactivar un usuario previamente desactivado, conservando sus credenciales previas.
- **FR-014**: El sistema DEBE validar que el nombre completo, el correo electrónico, el teléfono, la contraseña inicial y el rol estén presentes antes de crear un usuario, mostrando un mensaje en español si falta alguno (Principio II).
- **FR-015**: El sistema DEBE permitir listar y filtrar usuarios por rol y por estado (activo/desactivado), de forma combinable. El listado DEBE paginarse de a 20 usuarios por página e indicar el total de resultados que cumplen el filtro aplicado.
- **FR-016**: El sistema NO DEBE almacenar contraseñas en texto plano ni exponer credenciales en el código fuente (Principio V), de forma consistente con HU-08.
- **FR-017**: El sistema DEBE impedir el alta de dos usuarios con el mismo correo electrónico; la unicidad aplica también a los usuarios desactivados, cuyo correo queda reservado.
- **FR-026**: El sistema DEBE permitir a un administrador restablecer la contraseña de cualquier usuario, invalidando la anterior de inmediato. No existe flujo de recuperación de contraseña por autoservicio en v1.
- **FR-027**: El sistema DEBE impedir que un administrador se desactive a sí mismo o cambie su propio rol; sí DEBE permitirle editar sus propios datos de contacto.
- **FR-028**: El sistema DEBE contar con al menos un administrador desde su arranque, provisto como semilla inicial cuya contraseña proviene de configuración externa al repositorio (Principio V).
- **FR-032**: El sistema DEBE exigir que toda contraseña asignada por el administrador —tanto la inicial (FR-009) como la restablecida (FR-026)— tenga al menos 8 caracteres, sin otras exigencias de composición, y DEBE rechazar la operación con un mensaje en español si no cumple (Principio II).
- **FR-034**: El sistema DEBE registrar cada acción administrativa sobre un usuario —alta, edición, cambio de rol, desactivación, reactivación y restablecimiento de contraseña— dejando constancia de qué administrador la realizó, sobre qué usuario, qué acción fue y cuándo ocurrió. El registro solo admite entradas nuevas: nunca se edita ni se borra, y NO incluye contraseñas. En v1 no existe una vista para consultarlo.

### Requisitos Funcionales — HU-10 · Panel y reportes del administrador

- **FR-018**: El sistema DEBE restringir el acceso al panel de administración exclusivamente al rol "administrador", apoyándose en el mecanismo de autenticación y rol de HU-08.
- **FR-019**: El sistema DEBE mostrar en el panel métricas generales del estado operativo: cantidad de usuarios activos por rol y cantidad de pedidos por estado.
- **FR-020**: El sistema DEBE permitir consultar un reporte/historial de pedidos filtrable por estado y por rango de fechas, de forma combinable.
- **FR-021**: El sistema NO DEBE ofrecer, desde el panel, ninguna acción que modifique datos operativos (estados de pedido, usuarios); toda acción de modificación corresponde a HU-07 o HU-09.
- **FR-022**: El sistema DEBE mostrar un mensaje claro en español cuando un filtro no produce resultados, en lugar de una pantalla vacía sin explicación (Principio II).
- **FR-023**: El sistema DEBE reflejar en el panel el estado de los pedidos de forma consistente con la máquina de estados definida en HU-03 (creado → en preparación → asignado a repartidor → entregado → cerrado), sin definir estados propios.
- **FR-029**: El sistema NO DEBE incluir exportación de reportes a archivos externos ni actualización en tiempo real del panel en v1.

> **Entrega por fases de HU-10**: las métricas y reportes de pedidos (parte de FR-019, más FR-020 y FR-023) dependen de que existan pedidos, definidos en E4 y E2. Se especifican completos aquí, pero su verificación funcional queda condicionada a la disponibilidad de esas épicas. Las métricas de usuarios activos por rol, el control de acceso al panel, la ausencia de acciones de modificación y el mensaje de "sin datos" son verificables íntegramente dentro de E1.

### Reglas de Negocio

- **RN-001 · Un rol activo a la vez**: un usuario tiene exactamente un rol vigente. *Ejemplo*: si el administrador cambia el rol de un usuario de "cliente" a "negocio", el usuario deja de tener las funciones de cliente y pasa a tener únicamente las de negocio en su próximo inicio de sesión.
- **RN-002 · Baja lógica sin pérdida de historial**: un usuario desactivado no puede autenticarse y su sesión abierta se invalida de inmediato, pero su historial se conserva. *Ejemplo*: un repartidor desactivado no puede seguir operando ni volver a entrar, pero sus entregas pasadas siguen apareciendo en la trazabilidad (HU-03) y en los reportes del panel (HU-10).
- **RN-003 · El acceso lo determina el rol, no la persona**: no existen permisos diferenciados dentro de un mismo rol en v1 (Principio I). *Ejemplo*: todos los usuarios con rol "administrador" acceden al panel (HU-10) y a la gestión de usuarios (HU-09), sin excepciones individuales.
- **RN-004 · El panel es de solo lectura**: no puede alterar el estado de pedidos ni de usuarios. *Ejemplo*: desde el reporte del panel un administrador puede ver que un pedido quedó atascado en un estado, pero para forzar su avance debe usar HU-07 (Controles de flujos críticos), no HU-10.
- **RN-005 · Correo electrónico único, incluso entre desactivados**: *Ejemplo*: si ya existe un usuario con el correo `negocio@ejemplo.cl`, activo o desactivado, el sistema rechaza el alta de un segundo usuario con ese mismo correo; así la reactivación del original siempre es posible.
- **RN-006 · El sistema nunca queda sin administrador**: *Ejemplo*: un administrador no puede autodesactivarse ni degradarse su propio rol; si se necesita retirar a un administrador, otro administrador debe hacerlo.
- **RN-007 · Toda alta pasa por el administrador**: no existe autorregistro en v1. *Ejemplo*: un cliente nuevo no puede crearse una cuenta por su cuenta; el administrador la crea y le entrega la contraseña inicial.

### Entidades Clave

- **Usuario**: persona que accede a la plataforma. Atributos: nombre completo, correo electrónico (identificador de acceso, único en todo el sistema), teléfono, credencial de acceso (nunca en texto plano), rol y estado (activo/desactivado). Registra además los intentos fallidos consecutivos de inicio de sesión y, si corresponde, el momento hasta el cual su acceso está bloqueado temporalmente (FR-033). Un usuario tiene exactamente un rol.
- **Rol**: categoría fija que determina el conjunto de funciones disponibles. Valores en v1: cliente, negocio, repartidor, administrador. No es editable ni extensible por el usuario final.
- **Sesión**: vínculo temporal entre un usuario autenticado y su uso de la aplicación. Se crea al iniciar sesión, guarda el rol vigente en ese momento, y termina por cierre explícito, por 30 minutos de inactividad o por desactivación del usuario.
- **Registro de acciones administrativas**: bitácora de solo-agregar que conserva, por cada acción de HU-09, el administrador que la realizó, el usuario afectado, el tipo de acción y su fecha y hora. Nunca contiene contraseñas y no tiene vista de consulta en v1.
- **Panel de métricas** (vista de solo lectura): agregación de datos existentes —usuarios activos por rol y pedidos por estado— sin entidad propia ni datos editables.
- **Pedido** (entidad externa a esta épica): definida en E4/E2. HU-10 solo la consulta para reportes y respeta su máquina de estados (HU-03).

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: Un usuario con credenciales correctas inicia sesión y llega a la vista de su rol en menos de 5 segundos en condiciones normales de red.
- **SC-002**: El 100 % de los intentos con credenciales inválidas son rechazados sin crear sesión.
- **SC-003**: El 100 % de los intentos de acceder a una función fuera del rol del usuario autenticado son bloqueados.
- **SC-004**: Un administrador crea un usuario nuevo y este puede iniciar sesión con el rol asignado en menos de un minuto desde el alta, en condiciones normales de uso.
- **SC-005**: El 100 % de los intentos de alta con datos obligatorios o rol faltantes son rechazados sin crear el usuario.
- **SC-006**: El 100 % de los usuarios desactivados pierden el acceso de inmediato —incluida su sesión abierta— sin perder su historial de pedidos asociado.
- **SC-007**: Un administrador accede al panel y ve las métricas generales en menos de 5 segundos en condiciones normales de red.
- **SC-008**: El 100 % de los intentos de acceso al panel por usuarios sin rol "administrador" son bloqueados.
- **SC-009**: El 100 % de las consultas de reporte filtradas devuelven únicamente datos que cumplen los criterios de filtro seleccionados.
- **SC-010**: Una persona no técnica puede verificar todos los escenarios de esta especificación usando la aplicación directamente —iniciar y cerrar sesión, esperar la expiración, crear, editar y desactivar usuarios, filtrar el panel— sin leer código ni logs (Principio IV).
- **SC-011**: El 100 % de los intentos de alta con un correo ya usado por otro usuario, activo o desactivado, son rechazados.
- **SC-012**: Tras el restablecimiento de contraseña por el administrador, el 100 % de los intentos con la contraseña anterior son rechazados.
- **SC-013**: El 100 % de las sesiones sin actividad durante 30 minutos exigen reautenticación en la siguiente acción.
- **SC-014**: El 100 % de los intentos de un administrador de desactivarse a sí mismo o de cambiar su propio rol son bloqueados.
- **SC-015**: El 100 % de las vistas del panel de administración carecen de acciones que modifiquen datos operativos, verificable revisando las opciones disponibles en pantalla.
- **SC-016**: El 100 % de los intentos de asignar una contraseña de menos de 8 caracteres —al crear un usuario o al restablecerla— son rechazados con un mensaje en español.
- **SC-017**: El 100 % de los intentos de inicio de sesión realizados dentro de los 15 minutos posteriores a 5 fallos consecutivos son rechazados, y el acceso vuelve a permitirse automáticamente una vez transcurrido ese lapso.

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

Supuestos adicionales de contexto:

- **Mono-local**: v1 no contempla múltiples locales en la misma plataforma (decisión de alcance de `docs/epicas-hu/EPICS.md`), por lo que los roles "negocio" no se segmentan por local.
- **Plataforma web**: el acceso se produce desde un navegador; no hay aplicación móvil nativa en v1.
- **Máquina de estados de pedidos**: se toma como dada desde HU-03 (Principio XII); esta épica la consume, no la define.

## Fuera de Alcance (v1)

- Recuperación o restablecimiento de contraseña por parte del propio usuario (lo hace el administrador vía HU-09).
- Autenticación federada (Google, redes sociales u otros proveedores externos).
- Autorregistro de usuarios: toda alta pasa exclusivamente por el administrador.
- Eliminación física (borrado permanente) de un usuario; solo baja lógica, por trazabilidad de pedidos históricos (HU-03).
- Modelo de permisos granular por función dentro de un mismo rol; el rol determina de forma fija el conjunto de funciones disponibles (Principio I).
- Cualquier acción que modifique datos operativos desde el panel; corresponde a HU-07 (Controles de flujos críticos, E8).
- Vista de consulta del registro de acciones administrativas (FR-034): el registro se guarda, pero en v1 no se expone en pantalla; por eso es la única parte de esta épica no verificable por una persona no técnica desde la aplicación (excepción acotada a SC-010).
- Exportación de reportes a archivos externos (PDF, Excel, CSV).
- Actualización en tiempo real del panel.
- Soporte multi-local.
- Datos biométricos o de voz como parte de la autenticación (Principio X); la voz en FoodVoice se usa solo para búsqueda de productos y carrito (E6), nunca para iniciar sesión.

## Dependencias

- **Hacia adelante**: E4 (Trazabilidad del pedido) y E2 (Gestión de pedidos) deben existir para poder verificar funcionalmente las métricas y reportes de pedidos de HU-10.
- **Hacia atrás**: ninguna. E1 es la primera épica del orden de especificación y no depende de ninguna otra para su construcción.
- **Configuración externa**: la contraseña del administrador semilla debe provenir de una fuente de configuración externa al repositorio del proyecto, nunca escrita en el código (Principio V). El mecanismo concreto se define en la fase de planificación.
