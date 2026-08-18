/**
 * Producto agotado o dado de baja justo antes de confirmar: sin pedido ni
 * vaciado (FR-028, D-045).
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

describe('POST /orders — disponibilidad revalidada al confirmar', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('producto agotado justo antes de confirmar: 409, sin pedido ni vaciado', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-unavail-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-unavail-1');
    const producto = await crearProducto({
      name: 'Producto Se Agota',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await prisma.product.update({ where: { id: producto.id }, data: { available: false } });

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: producto.id, quantity: 1, price: 1000 }],
      })
      .expect(409);
    expect(respuesta.body.error.code).toBe('CART_HAS_UNAVAILABLE_LINES');

    const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(carrito.body.lines).toHaveLength(1);
  });

  it('producto dado de baja justo antes de confirmar: 409, sin pedido ni vaciado', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-unavail-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-unavail-2');
    const producto = await crearProducto({
      name: 'Producto Se Da De Baja',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await prisma.product.update({ where: { id: producto.id }, data: { active: false } });

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: producto.id, quantity: 1, price: 1000 }],
      })
      .expect(409);

    const pedidos = await entorno.http().get('/api/v1/orders').set('Cookie', cookie).expect(200);
    expect(pedidos.body.items).toHaveLength(0);
  });
});
