/**
 * El precio del carrito es siempre el vigente, recalculado en cada lectura,
 * nunca congelado (HU12-E10, FR-006, RN-003).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('El precio del carrito no se congela', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('un cambio de precio del negocio se refleja en la siguiente carga del carrito', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-price-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-price-1');
    const producto = await crearProducto({
      name: 'Producto Precio Vivo',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 5000,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    const antes = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(antes.body.lines[0].price).toBe(5000);

    await prisma.product.update({ where: { id: producto.id }, data: { price: 6000 } });

    const despues = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(despues.body.lines[0].price).toBe(6000);
  });
});
