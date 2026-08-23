/**
 * Aptitud vegana desde el alta/edición de producto (E6, FR-012, D-059).
 */
import { crearClasificacionMinima, crearEntorno, sesionNegocio, type Entorno } from './helpers';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('Producto · aptitud vegana (FR-012)', () => {
  let entorno: Entorno;
  let negocio: string;
  let clasificacion: Awaited<ReturnType<typeof crearClasificacionMinima>>;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    clasificacion = await crearClasificacionMinima('-dietary-tags');
  });

  const productoBase = () => ({
    name: `Ensalada Vegana ${Date.now()}`,
    description: DESCRIPCION_OK,
    price: 6990,
    foodTypeCategoryId: clasificacion.foodType.id,
    healthProfileCategoryId: clasificacion.healthProfile.id,
  });

  it('crea el producto con la aptitud "Vegano" cuando vegan: true', async () => {
    const respuesta = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ ...productoBase(), vegan: true })
      .expect(201);

    expect(respuesta.body.dietaryTags).toEqual(['Vegano']);
  });

  it('crea el producto sin ninguna aptitud cuando no se envía vegan', async () => {
    const respuesta = await entorno.http().post(RUTA).set('Cookie', negocio).send(productoBase()).expect(201);

    expect(respuesta.body.dietaryTags).toEqual([]);
  });

  it('permite desmarcar la aptitud al editar', async () => {
    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ ...productoBase(), vegan: true })
      .expect(201);

    const editado = await entorno
      .http()
      .patch(`${RUTA}/${creado.body.id}`)
      .set('Cookie', negocio)
      .send({ ...productoBase(), name: creado.body.name, vegan: false })
      .expect(200);

    expect(editado.body.dietaryTags).toEqual([]);
  });

  it('reutiliza la misma fila de DietaryTag para dos productos veganos distintos', async () => {
    const a = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ ...productoBase(), name: `Vegano A ${Date.now()}`, vegan: true })
      .expect(201);
    const b = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({ ...productoBase(), name: `Vegano B ${Date.now()}`, vegan: true })
      .expect(201);

    expect(a.body.dietaryTags).toEqual(['Vegano']);
    expect(b.body.dietaryTags).toEqual(['Vegano']);
  });
});
