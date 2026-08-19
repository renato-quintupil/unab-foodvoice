# Contratos · E9 Navegación y experiencia visual

**E9 no agrega ningún endpoint nuevo a `services/api`.** Es exclusivamente frontend
(`apps/web`); no hay `api.md` para esta épica.

La única llamada HTTP con efecto real que introduce el encabezado de cliente ya existe,
construida y probada en E2 (`specs/003-gestion-pedidos/contracts/api.md`):

| Endpoint | Para qué lo usa E9 |
|---|---|
| `GET /api/v1/addresses` | `cliente/layout.tsx` la llama server-side para poblar el selector de dirección con las direcciones activas del cliente (orden ya viene `isDefault DESC, createdAt DESC`, así que la predeterminada siempre es la primera). |
| `PUT /api/v1/addresses/:id/default` | `SelectorDireccion` la llama al elegir una dirección distinta desde el encabezado (FR-006, escenario 7 de HU-15). Transaccional y ya probada bajo concurrencia en E2 (D-049) — E9 no le agrega ninguna garantía nueva, solo un segundo punto de entrada en la UI. |

Ningún otro endpoint de E1/E2/E3 se modifica. El resto de las pantallas nuevas de E9
(encabezados, fila de categorías) son exclusivamente de navegación y presentación: no llaman a
ningún endpoint que no llamaran ya sus pantallas contenedoras (`/menu`, `/negocio/pedidos`,
etc., sin cambios en sus propias consultas).
