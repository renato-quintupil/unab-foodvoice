/**
 * Dos confirmaciones simultáneas del mismo carrito: un pedido, un evento
 * inicial, un carrito consumido y la perdedora recibe CART_EMPTY (FR-036,
 * FR-042, D-037).
 */
import { crearCarrito, crearClasificacionMinima, crearDireccion, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Dos confirmaciones concurrentes del mismo carrito', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('solo una produce un pedido; la otra falla con CART_EMPTY', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-conc-confirm@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-conc-confirm');
    const producto = await crearProducto({
      name: 'Producto Carrera Confirm',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    const cuerpo = {
      addressId: direccion.id,
      expectedLines: [{ productId: producto.id, quantity: 1, price: 1000 }],
    };

    const resultados = await Promise.allSettled([
      entorno.http().post('/api/v1/orders').set('Cookie', cookie).send(cuerpo),
      entorno.http().post('/api/v1/orders').set('Cookie', cookie).send(cuerpo),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 201);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]!.body.error.code).toBe('CART_EMPTY');

    const pedidos = await prisma.order.findMany({ where: { userId: usuario.id } });
    expect(pedidos).toHaveLength(1);

    const eventos = await prisma.orderStatusEvent.findMany({ where: { orderId: pedidos[0]!.id } });
    expect(eventos).toHaveLength(1);

    const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(carrito.body.lines).toEqual([]);
  });
});
