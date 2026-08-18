# Contratos de E2 · Gestión de pedidos

Dos documentos, mismo criterio que E1 y E3:

- **`api.md`** — la superficie HTTP nueva de `services/api`, expuesta a `apps/web` a través del
  proxy BFF ya construido en E1. Es lo que un cliente HTTP —incluida la futura voz de E6— ve.
- **`shared.md`** — la superficie pública nueva de `packages/shared`: esquemas Zod, tipos,
  enums y funciones. Es lo que `apps/web` y `services/api` importan del paquete compartido.

Ambos amplían, sin modificar, los contratos ya publicados de E1
(`specs/001-acceso-y-usuarios/contracts/`) y de E3
(`specs/002-administracion-menu-productos/contracts/`).
