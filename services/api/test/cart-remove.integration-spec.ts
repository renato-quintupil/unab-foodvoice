/**
 * Quitar una línea del carrito (HU12-E06, FR-005).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';

describe('DELETE /cart/lines/:productId', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('quita la línea sin importar su cantidad', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-remove-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-remove-1');
    const producto = await crearProducto({
      name: 'Producto Remove 1',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    const respuesta = await entorno
      .http()
      .delete(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.lines).toEqual([]);
  });

  it('404 si la línea no existía', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-remove-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-remove-2');
    const producto = await crearProducto({
      name: 'Producto Remove 2',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    await entorno.http().delete(`/api/v1/cart/lines/${producto.id}`).set('Cookie', cookie).expect(404);
  });
});
