/**
 * Unicidad del nombre de categoría (T023, HU14-E04, E05, SC-014, FR-004, D-021).
 *
 * La regla tiene dos mitades y las dos importan: **no** dos veces en la misma
 * dimensión, **sí** en la otra. Una sola línea de esquema las expresa —el índice
 * `UNIQUE (dimension, name_normalized)`— y estas pruebas comprueban que la API
 * traduce su violación a la regla de negocio y no a un `500`.
 */
import { Dimension } from '@prisma/client';
import { crearEntorno, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/categories';
const DESCRIPCION_OK =
  'Agrupa preparaciones horneadas de masa con distintas combinaciones de queso y verduras.';

describe('Unicidad del nombre de categoría (FR-004, RN-014, SC-014)', () => {
  let entorno: Entorno;
  let negocio: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
  });

  const crear = (dimension: Dimension, name: string) =>
    entorno.http().post(RUTA).set('Cookie', negocio).send({ dimension, name, description: DESCRIPCION_OK });

  it('rechaza un duplicado exacto con `409 CATEGORY_NAME_ALREADY_EXISTS` (HU14-E04)', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(201);
    const respuesta = await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(409);

    expect(respuesta.body.error.code).toBe('CATEGORY_NAME_ALREADY_EXISTS');
    expect(await prisma.category.count()).toBe(1);
  });

  it('asocia el rechazo **al campo del nombre**, no suelto en la página (HU14-E04)', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(201);
    const respuesta = await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(409);
    expect(respuesta.body.error.fields).toHaveProperty('name');
  });

  it('rechaza un duplicado que solo cambia mayúsculas (SC-014)', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(201);
    await crear(Dimension.TIPO_COMIDA, 'PIZZAS').expect(409);
    await crear(Dimension.TIPO_COMIDA, 'pizzas').expect(409);
    expect(await prisma.category.count()).toBe(1);
  });

  it('rechaza un duplicado que solo cambia acentos o eñes (SC-014)', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Ají').expect(201);
    await crear(Dimension.TIPO_COMIDA, 'aji').expect(409);
    await crear(Dimension.TIPO_COMIDA, 'AJÍ').expect(409);

    await crear(Dimension.PERFIL_SALUD, 'Ñoño').expect(201);
    await crear(Dimension.PERFIL_SALUD, 'nono').expect(409);
  });

  it('rechaza un duplicado que solo cambia espacios de los extremos o repetidos', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Pizzas Grandes').expect(201);
    await crear(Dimension.TIPO_COMIDA, '  Pizzas   Grandes  ').expect(409);
  });

  it('**acepta el mismo nombre en la otra dimensión** (HU14-E05, SC-014)', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Saludable').expect(201);
    const enLaOtra = await crear(Dimension.PERFIL_SALUD, 'Saludable').expect(201);

    expect(enLaOtra.body.dimension).toBe(Dimension.PERFIL_SALUD);
    expect(await prisma.category.count()).toBe(2);
  });

  it('acepta el mismo nombre en la otra dimensión incluso variando acentos', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Ají').expect(201);
    await crear(Dimension.PERFIL_SALUD, 'AJI').expect(201);
    expect(await prisma.category.count()).toBe(2);
  });

  it('la unicidad alcanza a una categoría **desactivada** (RN-014)', async () => {
    const creada = await crear(Dimension.TIPO_COMIDA, 'Completos').expect(201);
    await entorno
      .http()
      .put(`${RUTA}/${creada.body.id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    // El nombre sigue reservado, para que su reactivación sea siempre posible.
    await crear(Dimension.TIPO_COMIDA, 'completos').expect(409);
    expect(await prisma.category.count()).toBe(1);
  });

  it('al **editar**, tampoco se puede colisionar con otra existente', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(201);
    const otra = await crear(Dimension.TIPO_COMIDA, 'Ensaladas').expect(201);

    const respuesta = await entorno
      .http()
      .patch(`${RUTA}/${otra.body.id}`)
      .set('Cookie', negocio)
      .send({ name: 'pizzas', description: DESCRIPCION_OK })
      .expect(409);

    expect(respuesta.body.error.code).toBe('CATEGORY_NAME_ALREADY_EXISTS');
    const sinCambios = await prisma.category.findUnique({ where: { id: otra.body.id } });
    expect(sinCambios?.name).toBe('Ensaladas');
  });

  it('al editar **sí** se puede conservar el propio nombre: no colisiona consigo misma', async () => {
    const creada = await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(201);
    const nueva = 'Ahora agrupa masas finas, gruesas y rellenas con distintos quesos del sur.';

    await entorno
      .http()
      .patch(`${RUTA}/${creada.body.id}`)
      .set('Cookie', negocio)
      .send({ name: 'Pizzas', description: nueva })
      .expect(200);
  });

  it('**dos altas simultáneas del mismo nombre producen una sola** (SC-027, FR-026)', async () => {
    // Es el doble clic de FR-026 visto desde el servidor: la garantía la da el
    // índice único, no una comprobación previa que ambas peticiones sortearían.
    const respuestas = await Promise.all([
      crear(Dimension.TIPO_COMIDA, 'Sushi'),
      crear(Dimension.TIPO_COMIDA, 'Sushi'),
    ]);

    const estados = respuestas.map((r) => r.status).sort();
    expect(estados).toEqual([201, 409]);
    expect(await prisma.category.count()).toBe(1);
  });

  it('el rechazo **no filtra** el nombre de la restricción ni detalles del motor', async () => {
    await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(201);
    const respuesta = await crear(Dimension.TIPO_COMIDA, 'Pizzas').expect(409);

    const cuerpo = JSON.stringify(respuesta.body);
    expect(cuerpo).not.toContain('name_normalized');
    expect(cuerpo).not.toContain('P2002');
    expect(cuerpo).not.toContain('Unique constraint');
    expect(cuerpo).not.toContain('prisma');
  });
});
