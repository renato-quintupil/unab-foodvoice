/**
 * Cambiar cantidad de una línea del carrito (HU12-E04–E05, FR-003).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';

describe('PATCH /cart/lines/:productId', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('sube la cantidad a 3 y actualiza el subtotal implícito (price * quantity)', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-qty-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-qty-1');
    const producto = await crearProducto({
      name: 'Producto Qty 1',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    const respuesta = await entorno
      .http()
      .patch(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', cookie)
      .send({ quantity: 3 })
      .expect(200);

    expect(respuesta.body.lines[0].quantity).toBe(3);
    expect(respuesta.body.lines[0].price).toBe(1000);
  });

  it('bajar la cantidad a 0 elimina la línea (HU12-E05)', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-qty-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-qty-2');
    const producto = await crearProducto({
      name: 'Producto Qty 2',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    const respuesta = await entorno
      .http()
      .patch(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', cookie)
      .send({ quantity: 0 })
      .expect(200);

    expect(respuesta.body.lines).toEqual([]);
  });

  it('rechaza una cantidad negativa con 400', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-qty-3@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-qty-3');
    const producto = await crearProducto({
      name: 'Producto Qty 3',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    await entorno
      .http()
      .patch(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', cookie)
      .send({ quantity: -1 })
      .expect(400);
  });

  it('rechaza una cantidad no entera con 400', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-qty-4@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-qty-4');
    const producto = await crearProducto({
      name: 'Producto Qty 4',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    await entorno
      .http()
      .patch(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', cookie)
      .send({ quantity: 1.5 })
      .expect(400);
  });

  it('404 si la línea no existe en el carrito de este cliente', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-qty-5@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-qty-5');
    const producto = await crearProducto({
      name: 'Producto Qty 5',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    await entorno
      .http()
      .patch(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', cookie)
      .send({ quantity: 2 })
      .expect(404);
  });
});
