# Modelo de datos · E9 Navegación y experiencia visual

**E9 no crea, modifica ni migra ninguna entidad.** No hay `data-model.md` de esquema Prisma
para esta épica porque no toca `services/api/prisma/schema.prisma`.

Lo único que E9 **consume** es la entidad `Address`, ya construida en E2
(`specs/003-gestion-pedidos/data-model.md`), a través de su DTO público existente:

```ts
// packages/shared/src/types/api.ts — sin cambios
type AddressDto = {
  id: string;
  label: string;      // ej. "Casa" — la "clasificación" que muestra el selector
  text: string;        // ej. "Av. Providencia 1234, depto 502"
  isDefault: boolean;  // cuál se muestra colapsada en el encabezado
  active: boolean;     // el selector solo lista las activas (FR-006)
  createdAt: string;
};
```

El encabezado de cliente (`cliente/_components/navegacion.tsx`) recibe `AddressDto[]` ya
filtrado a `active === true` desde `cliente/layout.tsx` (que llama `GET /addresses`, endpoint
de E2). Elegir una dirección invoca `PUT /addresses/:id/default` (E2) — ver
`contracts/README.md`. Ningún campo de `AddressDto` se agrega, quita ni reinterpreta.
