/**
 * Vaciar el carrito completo (HU12-E11, FR-010).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';

describe('DELETE /cart', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('vacía un carrito con varias líneas', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-clear-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-clear-1');
    const a = await crearProducto({
      name: 'Producto Clear A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const b = await crearProducto({
      name: 'Producto Clear B',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: a.id });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: b.id });

    const respuesta = await entorno.http().delete('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(respuesta.body.lines).toEqual([]);

    const getRespuesta = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(getRespuesta.body.lines).toEqual([]);
  });

  it('es idempotente sobre un carrito ya vacío o inexistente', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-clear-2@foodvoice.test');
    await entorno.http().delete('/api/v1/cart').set('Cookie', cookie).expect(200);
    await entorno.http().delete('/api/v1/cart').set('Cookie', cookie).expect(200);
  });
});
