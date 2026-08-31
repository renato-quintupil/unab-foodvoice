# Despliegue en producción · FoodVoice

Instructivo de instalación del software en el ambiente productivo, y descripción
de los tres ambientes del proyecto.

## Los tres ambientes

| Ambiente | Dónde corre | Base de datos | Cómo se libera | Quién lo alcanza |
| --- | --- | --- | --- | --- |
| **Desarrollo** | Máquina local · `pnpm dev` o `docker compose up --build` | PostgreSQL en contenedor, con volumen persistente y semilla manual | Rama de funcionalidad `NNN-nombre-en-kebab` | Solo quien desarrolla |
| **Pruebas** | GitHub Actions · `docker-compose.test.yml` | PostgreSQL **efímera**: se crea y se destruye en cada ejecución | Automático en cada push y en cada pull request | Nadie: no queda nada en pie |
| **Producción** | Railway | PostgreSQL gestionada, persistente, sin datos de prueba | Tag `v*` sobre `main`, tras la verificación funcional de la épica | Público, solo a través de `web` por HTTPS |

La separación no es solo de infraestructura: cada ambiente tiene una **regla de
entrada distinta**. A desarrollo entra cualquier commit; a pruebas, cualquier
push; a producción, únicamente un tag creado después de que la épica pasó su
validación funcional a mano.

## Topología en producción

```
Internet ──HTTPS──> web (dominio público)
                     │
                     │ red privada del proyecto (no sale a Internet)
                     ▼
                    api ──────> postgres
```

**Solo `web` tiene dominio público.** `api` y `postgres` viven en la red privada
del proyecto y no son alcanzables desde fuera. Es la misma decisión que gobierna
`docker-compose.yml` en local (D-006, D-013), de modo que la topología de
producción no es una variante improvisada de la de desarrollo, sino la misma.

Consecuencias que conviene tener presentes:

- La cookie de sesión es **same-origin**: el navegador solo habla con `web`, así
  que no hay CORS que relajar.
- Con `NODE_ENV=production` la cookie `fv_session` se marca `Secure`, lo que
  exige HTTPS. El dominio de Railway lo provee.
- La red privada de Railway es **solo IPv6**. Por eso la API se despliega con
  `HOST_API=::`: sin eso, se enlazaría a una interfaz que `web` no puede
  alcanzar.

## Servicios a crear en Railway

Un proyecto, un entorno (`production`), tres servicios:

| Servicio | Origen | Notas |
| --- | --- | --- |
| `postgres` | Plantilla PostgreSQL de Railway | Sin dominio público |
| `api` | Este repositorio · `services/api/Dockerfile` | Sin dominio público. *Root directory* en la raíz del repo |
| `web` | Este repositorio · `apps/web/Dockerfile` | **Único con dominio público**. *Root directory* en la raíz del repo |

Los dos Dockerfile copian `pnpm-workspace.yaml` y `pnpm-lock.yaml` desde la raíz
del monorepo: el contexto de construcción debe ser la raíz, no el subdirectorio
del servicio.

## Variables de entorno en producción

**`api`**

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Referencia a la variable del servicio `postgres` (host interno, no el público) |
| `NODE_ENV` | `production` |
| `PORT_API` | `3001` |
| `HOST_API` | `::` |
| `ADMIN_SEED_EMAIL` | Correo del administrador inicial |
| `ADMIN_SEED_PASSWORD` | Su contraseña, de 8 a 72 caracteres |
| `ADMIN_SEED_ON_BOOT` | `true` |
| `LLM_API_KEY` | Clave de la API de Anthropic (E6, D-064). **Obligatoria**: el arranque de `api` falla sin ella, igual que sin `DATABASE_URL` — no solo la búsqueda por voz queda deshabilitada |
| `LLM_MODEL` | `claude-haiku-4-5-20251001` (opcional; mismo valor por defecto que en local) |
| `LLM_TIMEOUT_MS` | `4000` (opcional) |

**`web`**

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `API_INTERNAL_URL` | `http://<nombre-del-servicio-api>.railway.internal:3001` |
| `PORT` | Lo inyecta la plataforma |

Ningún valor se escribe en el repositorio: la aplicación lee sus secretos
**exclusivamente de variables de entorno** (D-019), de modo que cualquier gestor
que sepa inyectarlas sirve sin tocar una línea de código. Si falta una
obligatoria, el arranque falla nombrándola y termina con código distinto de cero;
no existe arranque degradado.

## Qué ocurre al arrancar `api`

`services/api/docker-entrypoint.sh`, en este orden:

1. `prisma migrate deploy` aplica las migraciones pendientes. Si falla, el
   contenedor termina y **no** atiende peticiones contra un esquema que no
   corresponde al código. Arranques concurrentes no compiten: Prisma toma un
   *advisory lock* en PostgreSQL.
2. Si `ADMIN_SEED_ON_BOOT=true`, ejecuta la semilla del administrador inicial.
   Es **idempotente**: si el administrador ya existe, no toca nada. Si el correo
   está ocupado por alguien que no es un administrador activo, falla en lugar de
   promover la cuenta en silencio.
3. Arranca NestJS.

La semilla se ejecuta desde `dist-seed/prisma/seed.js`, compilada aparte por
`build:seed`. La versión de desarrollo (`pnpm db:seed`) ejecuta el `.ts` con
`tsx`, una dependencia de desarrollo: que siga presente en la imagen final es un
efecto colateral de cómo `pnpm prune --prod` trata los espacios de trabajo de un
monorepo, no una garantía. El arranque de producción no se apoya en eso.

## Configurar el entorno `production` en GitHub

`.github/workflows/deploy.yml` lee estos valores del **entorno de GitHub**
`production` del repositorio (`Settings → Environments → production`). Mientras
no existan, el paso "Comprobar si hay destino de despliegue" los detecta
ausentes y **omite el despliegue sin marcar el flujo en rojo** — un tag se
puede crear igual, pero no publica nada hasta que estén cargados.

| Nombre | Tipo | Valor |
| --- | --- | --- |
| `RAILWAY_TOKEN` | Secret | Token de proyecto de Railway (`railway login` → `Project settings → Tokens`) |
| `RAILWAY_PROJECT_ID` | Variable | ID del proyecto en Railway |
| `RAILWAY_SERVICIO_API` | Variable | Nombre del servicio `api` dentro del proyecto |
| `RAILWAY_SERVICIO_WEB` | Variable | Nombre del servicio `web` dentro del proyecto |
| `URL_PRODUCCION` | Variable | URL pública de `web` (también queda como el enlace del entorno en la UI de GitHub) |

Configurar en el entorno una **regla de aprobación** (`Required reviewers`) es
opcional pero recomendable: con ella, un tag deja el despliegue detenido hasta
que una persona lo autorice, en vez de publicar automáticamente.

## Despliegue

### Automático, por tag

`.github/workflows/deploy.yml` se dispara con cualquier tag `v*`:

1. Reejecuta **el flujo de CI completo** sobre el commit etiquetado —lint,
   typecheck, build, unitarios e integración—. No da por bueno que el commit ya
   pasó por CI: un tag puede moverse.
2. Publica `api` y luego `web`, en ese orden, porque `web` no sirve de nada
   contra un esquema que todavía no existe.
3. Comprueba que el dominio público responde `200`, con diez reintentos. Que el
   despliegue termine sin error no significa que la aplicación esté en pie.

```bash
git tag -a v0.1.0 -m "E1 · Acceso y usuarios verificada"
git push origin v0.1.0
```

### Manual, la primera vez

```bash
npm install -g @railway/cli
railway login
railway link                       # elegir el proyecto y el entorno production
railway up --service api
railway up --service web
```

### Instalación equivalente en cualquier servidor con Docker

```bash
git clone https://github.com/renato-quintupil/unab-foodvoice.git
cd unab-foodvoice
git checkout v0.1.0                # se despliega el tag, nunca main
cp .env.example .env               # completar; sin las obligatorias no arranca
docker compose up --build -d       # postgres + api + web
docker compose exec api sh -c 'cd /repo/services/api && npx prisma migrate deploy'
docker compose exec api node dist-seed/prisma/seed.js
```

En este camino las migraciones ya las aplica el `entrypoint`; las órdenes se
incluyen por si hace falta repetirlas.

## Verificación posterior al despliegue

| # | Comprobación | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir el dominio público | Pantalla de inicio de sesión |
| 2 | Iniciar sesión con el administrador semilla | Panel visible en menos de 5 s (SC-001, SC-007) |
| 3 | Inspeccionar la cookie `fv_session` | Marcada `httpOnly` y `Secure` |
| 4 | Intentar alcanzar la API directamente | No resuelve: no tiene dominio público |
| 5 | Pegar la URL del panel con una sesión de otro rol | Rechazado con mensaje de permiso denegado (SC-003) |
| 6 | Reiniciar el servicio `api` | Vuelve a arrancar sin duplicar al administrador (semilla idempotente) |
| 7 | Como cliente, buscar un producto por voz o texto en `/menu` | Devuelve resultados en menos de 5 s (SC-004) — confirma que `LLM_API_KEY` es válida contra el proveedor real, no solo que estaba presente al arrancar |

## Recuperación de acceso administrativo

Si ningún administrador conserva acceso (FR-036), se fija temporalmente
`ADMIN_SEED_RECOVER=true` junto con `ADMIN_SEED_ON_BOOT=true` y se reinicia
`api`. El modo de recuperación fuerza la cuenta a administrador activo, revoca
sus sesiones vivas y deja constancia en la bitácora con actor igual al afectado
—una igualdad imposible desde la aplicación, y por tanto la marca inequívoca de
una recuperación operativa—. **Hay que devolver la variable a `false` después.**

## Nota sobre el costo

Railway no tiene una capa gratuita permanente: el crédito de prueba es único y
los planes posteriores son de pago. Tres servicios encendidos de forma continua
consumen ese crédito. Para una demostración puntual conviene desplegar unos días
antes y no dejar el proyecto corriendo indefinidamente.
