/**
 * Creación, edición y validación de categorías (T022, HU14-E01, E02, E03, SC-008).
 *
 * Comprueba que **ninguna categoría llega a guardarse** con una descripción que
 * incumpla FR-003 o FR-039: el criterio de éxito no es que el formulario avise,
 * es que la fila no exista.
 */
import { Dimension } from '@prisma/client';
import { AYUDA_DESCRIPCION_CATEGORIA } from '@foodvoice/shared';
import { crearEntorno, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/categories';

const DESCRIPCION_OK =
  'Agrupa preparaciones horneadas de masa con distintas combinaciones de queso y verduras.';

describe('POST /business/categories · alta (FR-002, HU14-E01)', () => {
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

  it('crea una categoría y la deja **activa desde su creación**, sin paso de publicación', async () => {
    const respuesta = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas', description: DESCRIPCION_OK })
      .expect(201);

    expect(respuesta.body).toMatchObject({
      dimension: Dimension.TIPO_COMIDA,
      name: 'Pizzas',
      description: DESCRIPCION_OK,
      active: true,
    });
    expect(respuesta.body.id).toEqual(expect.any(String));
    expect(respuesta.body.createdAt).toEqual(expect.any(String));
  });

  it('**no expone `nameNormalized`**: es un detalle de almacenamiento (D-021)', async () => {
    const respuesta = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable', description: DESCRIPCION_OK })
      .expect(201);

    expect(respuesta.body).not.toHaveProperty('nameNormalized');
    expect(respuesta.body).not.toHaveProperty('updatedAt');
  });

  it('deriva `nameNormalized` con la función compartida, aunque no la devuelva', async () => {
    await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension: Dimension.TIPO_COMIDA, name: '  Pizzas   Ñoñas ', description: DESCRIPCION_OK })
      .expect(201);

    const guardada = await prisma.category.findFirst({ where: { dimension: 'TIPO_COMIDA' } });
    expect(guardada?.name).toBe('Pizzas   Ñoñas');
    expect(guardada?.nameNormalized).toBe('pizzas nonas');
  });

  it('crea categorías en las dos dimensiones (HU14-E01)', async () => {
    for (const dimension of [Dimension.TIPO_COMIDA, Dimension.PERFIL_SALUD]) {
      await entorno
        .http()
        .post(RUTA)
        .set('Cookie', negocio)
        .send({ dimension, name: `Categoria ${dimension}`, description: DESCRIPCION_OK })
        .expect(201);
    }
    expect(await prisma.category.count()).toBe(2);
  });

  it('rechaza una dimensión que no es de las dos fijas (FR-001)', async () => {
    const respuesta = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension: 'PICANTE', name: 'Picante', description: DESCRIPCION_OK })
      .expect(400);

    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.category.count()).toBe(0);
  });
});

describe('POST /business/categories · descripción (FR-003, FR-039, SC-008, SC-031)', () => {
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

  const intentar = (description: unknown, name = 'Pizzas') =>
    entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension: Dimension.TIPO_COMIDA, name, description });

  it('rechaza la descripción ausente y **no guarda nada** (HU14-E02)', async () => {
    const respuesta = await intentar('').expect(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.category.count()).toBe(0);
  });

  it('rechaza una descripción de solo espacios: se considera ausente', async () => {
    await intentar('        ').expect(400);
    expect(await prisma.category.count()).toBe(0);
  });

  it('rechaza menos de 30 caracteres, con el error **asociado al campo** (SC-008)', async () => {
    const respuesta = await intentar('Pizzas ricas y grandes').expect(400);
    expect(respuesta.body.error.fields).toHaveProperty('description');
    expect(respuesta.body.error.fields.description).toContain('30 caracteres');
    expect(await prisma.category.count()).toBe(0);
  });

  it('rechaza 30 caracteres que **solo repiten el nombre** (HU14-E02, FR-039.2)', async () => {
    // Cinco palabras distintas, todas del nombre: pasa las condiciones 1 y 3 y
    // falla exactamente la 2, que es la que esta prueba aísla.
    const respuesta = await intentar(
      'Pizzas Napolitanas Grandes Ricas Calientes Napolitanas',
      'Pizzas Napolitanas Grandes Ricas Calientes',
    ).expect(400);
    expect(respuesta.body.error.fields.description).toContain('repite el nombre');
    expect(await prisma.category.count()).toBe(0);
  });

  it('rechaza 30 caracteres de una misma palabra repetida (FR-039.3)', async () => {
    const respuesta = await intentar('rica rica rica rica rica rica rica').expect(400);
    expect(respuesta.body.error.fields.description).toContain('palabras distintas');
    expect(await prisma.category.count()).toBe(0);
  });

  it('rechaza menos de cinco palabras aunque supere los 30 caracteres (FR-039.1)', async () => {
    const respuesta = await intentar('Preparaciones horneadas mediterraneas contundentes').expect(
      400,
    );
    expect(respuesta.body.error.fields.description).toContain('cinco palabras');
    expect(await prisma.category.count()).toBe(0);
  });

  it('rechaza más de 500 caracteres', async () => {
    await intentar('masa queso ajo sal tomate '.padEnd(501, 'x')).expect(400);
    expect(await prisma.category.count()).toBe(0);
  });

  it('acepta exactamente 30 caracteres: el mínimo es **inclusivo** (CHK014)', async () => {
    const treinta = 'masa queso ajo sal tomate orex';
    expect(treinta).toHaveLength(30);
    await intentar(treinta).expect(201);
  });

  it('aplana los saltos de línea antes de guardar (D-033)', async () => {
    await intentar('Agrupa preparaciones horneadas\nde masa con queso\ty verduras variadas.').expect(
      201,
    );
    const guardada = await prisma.category.findFirst();
    expect(guardada?.description).toBe(
      'Agrupa preparaciones horneadas de masa con queso y verduras variadas.',
    );
  });

  it('**el ejemplo que la pantalla enseña pasa su propia validación** (HU14-E03)', async () => {
    // Si el ejemplo de la ayuda contextual no fuera aceptable, el formulario
    // estaría pidiendo algo que él mismo rechaza.
    await intentar(AYUDA_DESCRIPCION_CATEGORIA.ejemplo).expect(201);
  });
});

describe('PATCH /business/categories/:id · edición (FR-006)', () => {
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

  const crear = async (name = 'Pizzas', dimension: Dimension = Dimension.TIPO_COMIDA) => {
    const r = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ dimension, name, description: DESCRIPCION_OK })
      .expect(201);
    return r.body.id as string;
  };

  it('edita nombre y descripción, y el cambio rige de inmediato', async () => {
    const id = await crear();
    const nueva = 'Ahora agrupa masas finas, gruesas y rellenas con distintos quesos del sur.';

    const respuesta = await entorno
      .http()
      .patch(`${RUTA}/${id}`)
      .set('Cookie', negocio)
      .send({ name: 'Pizzas Artesanales', description: nueva })
      .expect(200);

    expect(respuesta.body).toMatchObject({ name: 'Pizzas Artesanales', description: nueva });
    const guardada = await prisma.category.findUnique({ where: { id } });
    expect(guardada?.nameNormalized).toBe('pizzas artesanales');
  });

  it('**la dimensión no es editable**: enviarla no la cambia (FR-006)', async () => {
    const id = await crear();
    await entorno
      .http()
      .patch(`${RUTA}/${id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizzas',
        description: DESCRIPCION_OK,
        dimension: Dimension.PERFIL_SALUD,
      })
      .expect(200);

    const guardada = await prisma.category.findUnique({ where: { id } });
    expect(guardada?.dimension).toBe(Dimension.TIPO_COMIDA);
  });

  it('aplica **las mismas reglas** de descripción que el alta (§ Límites, CHK028)', async () => {
    const id = await crear();
    const respuesta = await entorno
      .http()
      .patch(`${RUTA}/${id}`)
      .set('Cookie', negocio)
      .send({ name: 'Pizzas', description: 'corta' })
      .expect(400);

    expect(respuesta.body.error.fields).toHaveProperty('description');
    const guardada = await prisma.category.findUnique({ where: { id } });
    expect(guardada?.description).toBe(DESCRIPCION_OK);
  });

  it('devuelve 404 para una categoría inexistente', async () => {
    await entorno
      .http()
      .patch(`${RUTA}/99999999-9999-4999-8999-999999999999`)
      .set('Cookie', negocio)
      .send({ name: 'Pizzas', description: DESCRIPCION_OK })
      .expect(404);
  });

  it('permite editar una categoría **desactivada** (CHK037)', async () => {
    const id = await crear();
    await entorno
      .http()
      .put(`${RUTA}/${id}/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(200);

    await entorno
      .http()
      .patch(`${RUTA}/${id}`)
      .set('Cookie', negocio)
      .send({ name: 'Pizzas Guardadas', description: DESCRIPCION_OK })
      .expect(200);

    const guardada = await prisma.category.findUnique({ where: { id } });
    expect(guardada?.name).toBe('Pizzas Guardadas');
    expect(guardada?.active).toBe(false);
  });
});

describe('GET /business/categories · listado (FR-010)', () => {
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
    await prisma.category.createMany({
      data: [
        {
          dimension: Dimension.TIPO_COMIDA,
          name: 'Pizzas',
          nameNormalized: 'pizzas',
          description: DESCRIPCION_OK,
        },
        {
          dimension: Dimension.TIPO_COMIDA,
          name: 'Ensaladas',
          nameNormalized: 'ensaladas',
          description: DESCRIPCION_OK,
          active: false,
        },
        {
          dimension: Dimension.PERFIL_SALUD,
          name: 'Saludable',
          nameNormalized: 'saludable',
          description: DESCRIPCION_OK,
        },
      ],
    });
  });

  it('**sin filtros devuelve activas y desactivadas** (FR-010)', async () => {
    const respuesta = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    expect(respuesta.body.items).toHaveLength(3);
    expect(respuesta.body.items.some((c: { active: boolean }) => !c.active)).toBe(true);
  });

  it('filtra por dimensión', async () => {
    const respuesta = await entorno
      .http()
      .get(`${RUTA}?dimension=PERFIL_SALUD`)
      .set('Cookie', negocio)
      .expect(200);
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].name).toBe('Saludable');
  });

  it('filtra por estado', async () => {
    const activas = await entorno
      .http()
      .get(`${RUTA}?active=true`)
      .set('Cookie', negocio)
      .expect(200);
    expect(activas.body.items).toHaveLength(2);

    const desactivadas = await entorno
      .http()
      .get(`${RUTA}?active=false`)
      .set('Cookie', negocio)
      .expect(200);
    expect(desactivadas.body.items).toHaveLength(1);
    expect(desactivadas.body.items[0].name).toBe('Ensaladas');
  });

  it('ordena por dimensión y luego por nombre, para que la vista sea estable', async () => {
    const respuesta = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    const orden = respuesta.body.items.map((c: { name: string }) => c.name);
    expect(orden).toEqual(['Ensaladas', 'Pizzas', 'Saludable']);
  });

  it('**no se pagina**: devuelve `items` sin `total` ni `page`', async () => {
    const respuesta = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    expect(respuesta.body).not.toHaveProperty('page');
    expect(respuesta.body).not.toHaveProperty('totalPages');
  });
});
