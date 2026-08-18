/**
 * Carrera confirmar/eliminar la misma dirección: si confirma primero queda
 * usada; si elimina primero no nace pedido y el carrito queda intacto (D-049).
 */
import { crearCarrito, crearClasificacionMinima, crearDireccion, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Carrera confirmar pedido / eliminar dirección', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('exactamente uno de los dos gana; el estado final es consistente', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-addr-race@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-addr-race');
    const producto = await crearProducto({
      name: 'Producto Carrera Direccion',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa', text: 'Los Aromos 123' });

    const [confirmar, eliminar] = await Promise.allSettled([
      entorno
        .http()
        .post('/api/v1/orders')
        .set('Cookie', cookie)
        .send({ addressId: direccion.id, expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }] }),
      entorno.http().delete(`/api/v1/addresses/${direccion.id}`).set('Cookie', cookie),
    ]);

    const confirmarOk = confirmar.status === 'fulfilled' && confirmar.value.status === 201;
    const eliminarOk = eliminar.status === 'fulfilled' && eliminar.value.status === 204;

    const direccionFinal = await prisma.address.findUnique({ where: { id: direccion.id } });
    const pedidos = await prisma.order.findMany({ where: { userId: usuario.id } });

    if (confirmarOk) {
      // Si confirmó primero, la dirección queda usada y no se pudo eliminar
      // después: sigue existiendo, marcada.
      expect(direccionFinal).not.toBeNull();
      expect(direccionFinal!.usedInOrder).toBe(true);
      expect(pedidos).toHaveLength(1);
    } else {
      // Si eliminó primero, no nace pedido y el carrito queda intacto.
      expect(eliminarOk).toBe(true);
      expect(direccionFinal).toBeNull();
      expect(pedidos).toHaveLength(0);
      const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
      expect(carrito.body.lines).toHaveLength(1);
    }
  });
});
