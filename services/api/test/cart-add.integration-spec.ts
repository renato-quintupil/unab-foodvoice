/**
 * Agregar al carrito (HU12-E01–E03, FR-002, FR-004).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';

describe('POST /cart/lines', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('agrega un producto activo y disponible con cantidad 1 (HU12-E01)', async () => {
    const { cookie } = await sesionCliente(entorno);
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-add-1');
    const producto = await crearProducto({
      name: 'Pizza Add 1',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 5990,
    });

    const respuesta = await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', cookie)
      .send({ productId: producto.id })
      .expect(201);

    expect(respuesta.body.lines).toEqual([
      { productId: producto.id, productName: 'Pizza Add 1', price: 5990, quantity: 1, available: true },
    ]);
  });

  it('sumar cantidad sobre una línea existente no crea una segunda línea (FR-004)', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-add-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-add-2');
    const producto = await crearProducto({
      name: 'Pizza Add 2',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });
    const respuesta = await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', cookie)
      .send({ productId: producto.id })
      .expect(201);

    expect(respuesta.body.lines).toHaveLength(1);
    expect(respuesta.body.lines[0].quantity).toBe(2);
  });

  it('rechaza un producto agotado (HU12-E02)', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-add-3@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-add-3');
    const producto = await crearProducto({
      name: 'Agotado',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      available: false,
    });

    const respuesta = await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', cookie)
      .send({ productId: producto.id })
      .expect(409);

    expect(respuesta.body.error.code).toBe('CART_HAS_UNAVAILABLE_LINES');
  });

  it('rechaza un producto dado de baja (HU12-E03)', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-add-4@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-add-4');
    const producto = await crearProducto({
      name: 'De baja',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', cookie)
      .send({ productId: producto.id })
      .expect(409);
  });

  it('rechaza un producto inexistente con 404', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-add-5@foodvoice.test');
    await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', cookie)
      .send({ productId: '99999999-9999-4999-8999-999999999999' })
      .expect(404);
  });
});
