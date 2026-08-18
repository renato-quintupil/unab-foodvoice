/**
 * Exactamente un evento NULL → creado con actor cliente, rol y fecha
 * (HU01-E17, FR-042).
 */
import { crearCarrito, crearClasificacionMinima, crearDireccion, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Historial: evento inicial de creación', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('registra exactamente un evento NULL → creado con el cliente, su rol y la fecha', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-history-create@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-history-create');
    const producto = await crearProducto({
      name: 'Producto Historial Create',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({ addressId: direccion.id, expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }] })
      .expect(201);

    const eventos = await prisma.orderStatusEvent.findMany({ where: { orderId: respuesta.body.id } });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.previousStatus).toBeNull();
    expect(eventos[0]!.resultingStatus).toBe('CREADO');
    expect(eventos[0]!.actorUserId).toBe(usuario.id);
    expect(eventos[0]!.actorRole).toBe('CLIENTE');
    expect(eventos[0]!.occurredAt).toBeInstanceOf(Date);
  });
});
