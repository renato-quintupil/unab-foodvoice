# Contratos de E1 · Acceso y usuarios

Los contratos de esta épica se dividen en dos superficies:

| Archivo | Superficie |
|---|---|
| [`api.md`](./api.md) | Endpoints HTTP del servicio NestJS (`services/api`) |
| [`shared.md`](./shared.md) | Contratos de dominio TypeScript de `packages/shared`, consumidos por frontend y backend |

## Principios que rigen ambos

1. **Una sola definición por regla.** Toda validación de forma se declara en `packages/shared` con Zod y se aplica en los dos lados (D-005). Si una regla aparece dos veces, es un defecto.
2. **Todo texto visible al usuario va en español** (Principio II). Los identificadores técnicos —rutas, campos JSON, códigos de error— van en inglés.
3. **Los mensajes de error no filtran información.** En particular, el fallo de autenticación y el bloqueo temporal usan textos fijos e idénticos, exista o no la cuenta (FR-008, SC-018).
4. **El backend es la autoridad.** Las comprobaciones del frontend existen para la experiencia de usuario; ninguna decisión de seguridad depende de ellas (D-007).

## Camino de una petición

```text
navegador ──► Next.js Route Handler ──► NestJS ──► PostgreSQL
           (same-origin, cookie          (red interna
            httpOnly)                     de Docker)
```

El navegador nunca contacta a NestJS directamente (D-006). Las rutas de `apps/web/src/app/api/**` reenvían con el mismo verbo, cuerpo y cookie, y devuelven la respuesta sin transformarla.
