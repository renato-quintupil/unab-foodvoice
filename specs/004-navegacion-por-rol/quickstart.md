# Guía de puesta en marcha y validación: E9 · Navegación y experiencia visual

Esta guía levanta la épica en local y recorre los **8 criterios de éxito** (SC-001 a SC-008)
uno por uno, con dos roles y dos anchos de pantalla.

## Requisitos previos

Los mismos de E1/E3/E2: Node.js 22 LTS, pnpm 9, Docker con Compose. **E9 no introduce ninguna
variable de entorno nueva** ni ninguna migración: reutiliza la base de datos y el catálogo ya
sembrados.

## Puesta en marcha

```bash
cp .env.example .env               # si aún no existe
pnpm install
docker compose up -d postgres
pnpm --filter api db:migrate       # sin cambios de esquema respecto a E2
pnpm --filter api db:seed          # administrador de E1 + catálogo de E3, idempotente
pnpm dev                           # api :3001 · web :3000
```

Alternativa íntegra en contenedores: `docker compose up --build`.

Para la validación hace falta: un usuario de rol **cliente** con **al menos dos direcciones
activas** registradas (para probar el cambio de predeterminada), un usuario de rol **negocio**,
y el catálogo activo de E3. Los usuarios se crean desde el panel de administración de E1; las
direcciones, desde `/cliente/direcciones` (E2).

## Comprobaciones automáticas

```bash
pnpm test              # unitarios; falla si no se cumplen los umbrales de cobertura
pnpm test:integration  # sin baterías nuevas — E9 no toca services/api
pnpm lint && pnpm typecheck && pnpm build
```

## Validación funcional

### Preparación

Una sesión de **cliente** y una de **negocio**. Para los pasos de ancho de celular, usar las
herramientas de desarrollador del navegador para simular un viewport de 360–390 px, o un
teléfono real.

### A · Navegación de cliente (HU-15, SC-001, SC-003, SC-004, SC-008)

Con la sesión del **cliente**, en escritorio.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-01** | Iniciar sesión como cliente | Aterriza en una pantalla con un encabezado con Menú, Carrito y Mis pedidos, y el selector de dirección |
| **V-02** | Desde el encabezado, ir a Menú, luego a Carrito, luego a Mis pedidos, sin escribir ninguna URL | Cada pantalla carga correctamente y el destino correspondiente del encabezado se distingue como activo (SC-001) |
| **V-03** | Mirar el selector de dirección sin abrirlo | Muestra la etiqueta y el texto de la dirección predeterminada (ej. "Casa · Av. Providencia 1234") sin navegar a otra pantalla (SC-003) |
| **V-04** | Abrir el selector de dirección | Lista las demás direcciones activas y un acceso a "Gestionar direcciones" |
| **V-05** | Elegir una dirección distinta desde el selector | Pasa a mostrarse como la predeterminada de inmediato, sin salir de la pantalla (SC-008) |
| **V-06** | Recargar la página tras V-05 | La dirección elegida en V-05 sigue predeterminada — confirma que `PUT /addresses/:id/default` persistió, no solo cambió visualmente |
| **V-07** | Ir a `/cliente/direcciones` desde el selector | Abre la pantalla de gestión de direcciones ya construida en E2, sin cambios |

### B · Cliente sin direcciones (escenario límite de HU-15)

Con un cliente **sin ninguna dirección registrada** (o desactivando todas desde
`/cliente/direcciones`).

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-08** | Mirar el encabezado | En vez de una dirección, muestra un acceso directo para registrar una — nunca un espacio vacío |

### C · Navegación de negocio (HU-15, SC-002)

Con la sesión del **negocio**, en escritorio.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-09** | Iniciar sesión como negocio | Aterriza en una pantalla con un encabezado con Pedidos, Productos y Categorías |
| **V-10** | Desde el encabezado, ir a Productos, luego a Categorías, luego a Pedidos, sin escribir ninguna URL | Cada pantalla carga correctamente y el destino activo se distingue visualmente (SC-002) |

### D · Categorías del menú (HU-15, FR-008, FR-009)

Con cualquiera de las dos sesiones, en `/menu`.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-11** | Mirar debajo del encabezado | Fila de íconos: Todas, Pizzas, Sándwiches, Ensaladas — además de los tres desplegables de filtro ya existentes |
| **V-12** | Elegir "Pizzas" desde la fila de íconos | El menú se filtra a pizzas y el desplegable "Tipo de comida" muestra "Pizzas" seleccionado (SC-004) |
| **V-13** | Cambiar el desplegable "Tipo de comida" a "Sándwiches" | La fila de íconos refleja "Sándwiches" como activo — mismo criterio en ambos sentidos (FR-009) |

### E · Patrón mobile (HU-15, FR-010, SC-006)

Con cualquiera de las dos sesiones, en un viewport de 360–390 px de ancho.

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-14** | Mirar la navegación | Aparece como una barra inferior con íconos y etiquetas, no como el encabezado superior de escritorio |
| **V-15** | Navegar entre los destinos del rol usando la barra inferior | Funciona igual que en escritorio, sin recortar ni superponer contenido (SC-006) |

### F · Identidad visual (HU-16, SC-007)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-16** | Cerrar sesión y mirar la pantalla de login | Panel de marca con motivo de voz, paleta cálida — ya no el formulario plano anterior; los mismos campos y el mismo comportamiento de antes |
| **V-17** | Iniciar sesión y comparar el encabezado (cliente o negocio) con el login recién visto | Comparten paleta, tipografía y marca — se perciben como el mismo producto (SC-007) |

### G · Alcance excluido (FR-014, FR-015, Principio III)

| Paso | Qué hacer | Qué debe ocurrir |
|---|---|---|
| **V-18** | Iniciar sesión como administrador | El encabezado y la paleta de `admin` son exactamente los de antes de esta épica — sin ningún cambio visual |
| **V-19** | Revisar el encabezado de cliente y de negocio | No hay ningún número/badge sobre Carrito ni sobre Pedidos — no se construyó, aunque el mockup de referencia lo mostraba |
| **V-20** | Usar el carrito, las direcciones (crear/editar/desactivar) y la confirmación de pedido con normalidad | Todo se comporta exactamente igual que antes de E9 — esta épica no tocó ninguna lógica de negocio (FR-014) |
