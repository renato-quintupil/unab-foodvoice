/**
 * Alta de producto (T037, HU02-E01, E04, SC-007, SC-013, SC-031).
 *
 * Lo que esta batería fija es que **el producto recién creado queda activo y
 * disponible sin ninguna acción adicional** (RN-007) y que ninguna descripción
 * que incumpla FR-039 llega a guardarse: el criterio no es que el formulario
 * avise, es que la fila no exista.
 */
import { AYUDA_DESCRIPCION_PRODUCTO } from '@foodvoice/shared';
import {
  crearClasificacionMinima,
  crearEntorno,
  sesionNegocio,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('POST /business/products · alta completa (FR-012, HU02-E01)', () => {
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
    clasificacion = await crearClasificacionMinima();
  });

  const productoValido = () => ({
    name: 'Pizza Napolitana',
    description: DESCRIPCION_OK,
    ingredients: 'Masa, tomate, mozzarella, albahaca',
    price: 8990,
    foodTypeCategoryId: clasificacion.foodType.id,
    healthProfileCategoryId: clasificacion.healthProfile.id,
  });

  const crear = (cuerpo: object) =>
    entorno.http().post(RUTA).set('Cookie', negocio).send(cuerpo);

  it('crea el producto y lo deja **activo y disponible** sin nada más (SC-013, RN-007)', async () => {
    const respuesta = await crear(productoValido()).expect(201);

    expect(respuesta.body).toMatchObject({
      name: 'Pizza Napolitana',
      description: DESCRIPCION_OK,
      ingredients: 'Masa, tomate, mozzarella, albahaca',
      price: 8990,
      active: true,
      available: true,
      status: 'DISPONIBLE',
    });
  });

  it('devuelve las dos categorías con su nombre y su dimensión', async () => {
    const respuesta = await crear(productoValido()).expect(201);

    expect(respuesta.body.foodTypeCategory).toEqual({
      id: clasificacion.foodType.id,
      name: 'Pizzas',
      dimension: 'TIPO_COMIDA',
    });
    expect(respuesta.body.healthProfileCategory).toEqual({
      id: clasificacion.healthProfile.id,
      name: 'Indulgente',
      dimension: 'PERFIL_SALUD',
    });
  });

  it('**no expone `nameNormalized` ni `updatedAt`**', async () => {
    const respuesta = await crear(productoValido()).expect(201);
    expect(respuesta.body).not.toHaveProperty('nameNormalized');
    expect(respuesta.body).not.toHaveProperty('updatedAt');
  });

  it('deriva `nameNormalized` con la función compartida', async () => {
    await crear({ ...productoValido(), name: '  Pizza   Ñoña  ' }).expect(201);
    const guardado = await prisma.product.findFirst();
    expect(guardado?.name).toBe('Pizza   Ñoña');
    expect(guardado?.nameNormalized).toBe('pizza nona');
  });

  it('acepta un producto **sin ingredientes** y los guarda como `null` (FR-017)', async () => {
    const { ingredients: _sinEllos, ...sinIngredientes } = productoValido();
    const respuesta = await crear(sinIngredientes).expect(201);

    expect(respuesta.body.ingredients).toBeNull();
  });

  it('trata como ausente un campo de ingredientes con solo espacios (CHK034)', async () => {
    const respuesta = await crear({ ...productoValido(), ingredients: '    ' }).expect(201);
    expect(respuesta.body.ingredients).toBeNull();
  });

  it('conserva los saltos de línea de los ingredientes: son texto libre', async () => {
    const respuesta = await crear({
      ...productoValido(),
      ingredients: 'Masa\nTomate\nMozzarella',
    }).expect(201);
    expect(respuesta.body.ingredients).toBe('Masa\nTomate\nMozzarella');
  });

  it('**ignora `active` y `available` del cuerpo**: el alta los fija (RN-007)', async () => {
    const respuesta = await crear({
      ...productoValido(),
      active: false,
      available: false,
    }).expect(201);

    expect(respuesta.body.active).toBe(true);
    expect(respuesta.body.available).toBe(true);
  });

  it('devuelve `priceTier: null` con menos de tres productos activos (RN-016)', async () => {
    const respuesta = await crear(productoValido()).expect(201);
    // No es «no se pudo calcular»: es que no hay tramos, y una intención de
    // precio no descarta ninguno.
    expect(respuesta.body.priceTier).toBeNull();
  });
});

describe('POST /business/products · descripción (FR-013, FR-016, FR-039, SC-007, SC-031)', () => {
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
    clasificacion = await crearClasificacionMinima();
  });

  const conDescripcion = (description: unknown, name = 'Pizza Napolitana') =>
    entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name,
        description,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      });

  it('rechaza la descripción ausente y **no guarda nada** (HU02-E04)', async () => {
    await conDescripcion('').expect(400);
    expect(await prisma.product.count()).toBe(0);
  });

  it('rechaza menos de 20 caracteres, con el error asociado al campo (SC-007)', async () => {
    const respuesta = await conDescripcion('Pizza rica').expect(400);
    expect(respuesta.body.error.fields.description).toContain('20 caracteres');
    expect(await prisma.product.count()).toBe(0);
  });

  it('rechaza 20 caracteres que repiten una misma palabra (HU02-E04, FR-039.3)', async () => {
    const respuesta = await conDescripcion('rica rica rica rica rica rica').expect(400);
    expect(respuesta.body.error.fields.description).toContain('palabras distintas');
    expect(await prisma.product.count()).toBe(0);
  });

  it('rechaza una descripción que solo repite el nombre (FR-039.2)', async () => {
    const respuesta = await conDescripcion(
      'Pizza Napolitana Grande Rica Especial Napolitana',
      'Pizza Napolitana Grande Rica Especial',
    ).expect(400);
    expect(respuesta.body.error.fields.description).toContain('repite el nombre');
  });

  it('rechaza menos de cinco palabras (FR-039.1)', async () => {
    const respuesta = await conDescripcion('Masa mozzarella albahaca aceituna').expect(400);
    expect(respuesta.body.error.fields.description).toContain('cinco palabras');
  });

  it('rechaza más de 1.000 caracteres', async () => {
    await conDescripcion('masa queso ajo sal tomate '.padEnd(1001, 'x')).expect(400);
    expect(await prisma.product.count()).toBe(0);
  });

  it('acepta exactamente 20 caracteres: el mínimo es **inclusivo** (CHK014)', async () => {
    const veinte = 'masa ques ajo sal to';
    expect(veinte).toHaveLength(20);
    await conDescripcion(veinte).expect(201);
  });

  it('aplana los saltos de línea antes de guardar (D-033)', async () => {
    await conDescripcion('Masa delgada\ncon mozzarella\tfresca y albahaca del huerto.').expect(201);
    const guardado = await prisma.product.findFirst();
    expect(guardado?.description).toBe(
      'Masa delgada con mozzarella fresca y albahaca del huerto.',
    );
  });

  it('**el ejemplo que la pantalla enseña pasa su propia validación** (HU02-E05)', async () => {
    await conDescripcion(AYUDA_DESCRIPCION_PRODUCTO.ejemplo).expect(201);
  });
});

describe('POST /business/products · precio (FR-015, SC-012)', () => {
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
    clasificacion = await crearClasificacionMinima();
  });

  const conPrecio = (price: unknown) =>
    entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      });

  it('rechaza el cero, el negativo, el decimal y el no numérico (SC-012)', async () => {
    for (const invalido of [0, -100, 4990.5, 'abc']) {
      const respuesta = await conPrecio(invalido).expect(400);
      expect(respuesta.body.error.fields).toHaveProperty('price');
    }
    expect(await prisma.product.count()).toBe(0);
  });

  it('**no redondea ni trunca en silencio** un precio con decimales (FR-015)', async () => {
    const respuesta = await conPrecio(4990.5).expect(400);
    expect(respuesta.body.error.fields.price).toBe('El precio no puede tener decimales.');
    // Y desde luego no se guardó un 4990 ni un 4991.
    expect(await prisma.product.count()).toBe(0);
  });

  it('indica **cuál** de las condiciones se incumplió, no un mensaje único', async () => {
    const cero = await conPrecio(0).expect(400);
    const decimal = await conPrecio(4990.5).expect(400);
    expect(cero.body.error.fields.price).not.toBe(decimal.body.error.fields.price);
  });

  it('rechaza por encima del máximo declarado', async () => {
    await conPrecio(10_000_001).expect(400);
  });

  it('acepta los dos extremos inclusivos', async () => {
    await conPrecio(1).expect(201);
    await prisma.product.deleteMany();
    await conPrecio(10_000_000).expect(201);
  });
});
