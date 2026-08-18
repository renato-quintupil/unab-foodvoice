/**
 * Una línea cuyo producto se agotó o se dio de baja no se quita sola: queda
 * marcada `available: false` (HU12-E09, FR-007–FR-008).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Línea no disponible: se conserva y se marca (FR-007, FR-008)', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('marca available: false cuando el producto se agota después de agregarlo', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-unavail-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-unavail-1');
    const producto = await crearProducto({
      name: 'Se Agota Despues',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    await prisma.product.update({ where: { id: producto.id }, data: { available: false } });

    const respuesta = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(respuesta.body.lines).toHaveLength(1);
    expect(respuesta.body.lines[0].available).toBe(false);
  });

  it('marca available: false cuando el producto se da de baja después de agregarlo', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-unavail-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-unavail-2');
    const producto = await crearProducto({
      name: 'Se Da De Baja Despues',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });

    await prisma.product.update({ where: { id: producto.id }, data: { active: false } });

    const respuesta = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(respuesta.body.lines[0].available).toBe(false);
  });

  it('el sistema no la quita solo: solo el cliente puede quitarla', async () => {
    const { cookie } = await sesionCliente(entorno, 'cart-unavail-3@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('cart-unavail-3');
    const producto = await crearProducto({
      name: 'No Se Quita Sola',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno.http().post('/api/v1/cart/lines').set('Cookie', cookie).send({ productId: producto.id });
    await prisma.product.update({ where: { id: producto.id }, data: { active: false } });

    await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);

    const tras = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(tras.body.lines).toHaveLength(1);

    await entorno.http().delete(`/api/v1/cart/lines/${producto.id}`).set('Cookie', cookie).expect(200);
    const final = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(final.body.lines).toHaveLength(0);
  });
});
