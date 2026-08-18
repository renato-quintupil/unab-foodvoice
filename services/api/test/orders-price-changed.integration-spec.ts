/**
 * Cambio de precio detectado al confirmar: 409 PRICE_CHANGED, carrito intacto
 * y ningún pedido creado (HU01-E16, FR-028).
 */
import {
  crearCarrito,
  crearClasificacionMinima,
  crearDireccion,
  crearEntorno,
  crearProducto,
  sesionCliente,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

describe('POST /orders — precio cambiado', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('con varias líneas, solo una cambia de precio: 409, carrito intacto, sin pedido', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-price-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-price-1');
    const a = await crearProducto({
      name: 'Producto Precio A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    const b = await crearProducto({
      name: 'Producto Precio B',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 2000,
    });
    await crearCarrito(usuario.id, [
      { productId: a.id, quantity: 1 },
      { productId: b.id, quantity: 1 },
    ]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await prisma.product.update({ where: { id: b.id }, data: { price: 2500 } });

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [
          { productId: a.id, quantity: 1, price: 1000 },
          { productId: b.id, quantity: 1, price: 2000 },
        ],
      })
      .expect(409);
    expect(respuesta.body.error.code).toBe('PRICE_CHANGED');

    const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(carrito.body.lines).toHaveLength(2);

    const pedidos = await entorno.http().get('/api/v1/orders').set('Cookie', cookie).expect(200);
    expect(pedidos.body.items).toHaveLength(0);
  });
});
