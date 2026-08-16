# Contratos: E3 · Administración de menú

Dos documentos, con la misma división que en E1:

- [`api.md`](./api.md) — la superficie HTTP que `services/api` expone y que `apps/web` consume
  a través de su proxy. Endpoints, cuerpos, códigos de error y quién puede llamar a cada cosa.
- [`shared.md`](./shared.md) — la superficie pública de `packages/shared`: enums, esquemas Zod,
  mensajes fijos, etiquetas, el formateador de precio y los tipos de transferencia.

**Las convenciones de E1 rigen íntegramente y no se repiten.** El formato único de error, el
catálogo cerrado de códigos, el límite de 10 KB por cuerpo, el versionado `v1`, el formato de
fechas ISO 8601 en UTC y la regla de que los mensajes visibles vivan **solo** en
`packages/shared` están declarados en
[`../../001-acceso-y-usuarios/contracts/api.md`](../../001-acceso-y-usuarios/contracts/api.md).
Estos documentos añaden únicamente lo propio del catálogo, y **amplían** el catálogo de códigos
con los cuatro nuevos que la épica necesita.

Regla heredada que conviene tener presente al leer: **ningún texto visible se reproduce aquí**.
Los contratos referencian los mensajes por nombre de constante. Una copia en este documento
sería una segunda fuente que podría divergir de la primera sin que ninguna prueba lo notara.
