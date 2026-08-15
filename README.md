# FoodVoice

Aplicación web para pedir comida a un local por voz o de forma manual, con
trazabilidad del pedido de punta a punta.

**Estado**: E1 · Acceso y usuarios, implementada. Entrega el cimiento de
identidad del producto —padrón de usuarios con rol, autenticación con sesión, y
panel de solo lectura del administrador—. Las épicas siguientes construyen sobre
ella.

## Estructura

```text
apps/web/          Next.js 15 · App Router. Actúa además como BFF: el navegador
                   solo habla con Next.js, que reenvía a la API por la red
                   interna de Docker.
services/api/      NestJS 11 · monolito con módulos internos (auth, users,
                   dashboard, audit, health).
packages/shared/   Contratos de dominio: enums, esquemas Zod, mensajes en
                   español y máquina de estados del pedido. Única fuente de
                   verdad de los tres, y no puede depender de los otros dos.
```

## Puesta en marcha

Las instrucciones completas —variables de entorno, arranque, comprobaciones y
validación funcional— están en
[`specs/001-acceso-y-usuarios/quickstart.md`](./specs/001-acceso-y-usuarios/quickstart.md).
No se repiten aquí: una segunda copia es una copia que puede divergir.

En resumen, y solo como orientación:

```bash
cp .env.example .env    # sin las variables obligatorias, el arranque falla
pnpm install
docker compose up --build
```

## Documentación del producto

| Documento | Qué contiene |
|---|---|
| [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) | Las reglas de producto que rigen sobre todas las épicas |
| [`specs/README.md`](./specs/README.md) | Estado del producto y sus épicas |
| [`specs/001-acceso-y-usuarios/spec.md`](./specs/001-acceso-y-usuarios/spec.md) | Qué hace E1 y por qué |
| [`specs/001-acceso-y-usuarios/plan.md`](./specs/001-acceso-y-usuarios/plan.md) | Cómo se construye, con sus decisiones y sus desviaciones declaradas |
| [`specs/001-acceso-y-usuarios/contracts/`](./specs/001-acceso-y-usuarios/contracts/) | Los doce endpoints y la superficie de `packages/shared` |
| [`CLAUDE.md`](./CLAUDE.md) | Convenciones del repositorio |

## Convenciones

Todo texto visible al usuario va en español y vive en `packages/shared`; los
identificadores técnicos, en inglés. Cada endpoint, pantalla y prueba se remite
a un requisito de la especificación: **si algo no está en la spec, no se
construye — se enmienda la spec primero.**
