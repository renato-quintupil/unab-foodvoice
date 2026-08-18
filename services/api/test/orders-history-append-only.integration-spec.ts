/**
 * Rechaza UPDATE/DELETE directos, conserva entradas y rechaza un segundo
 * evento inicial (FR-044, D-047). Complementa las pruebas de esquema con el
 * escenario end-to-end: historial nacido de una confirmación real por la API.
 */
import { crearCarrito, crearClasificacionMinima, crearDireccion, crearEntorno, crearProducto, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('El historial nacido de la API es append-only', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('rechaza UPDATE y DELETE sobre el evento que produjo POST /orders', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-append-only@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-append-only');
    const producto = await crearProducto({
      name: 'Producto Append Only',
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

    const [evento] = await prisma.orderStatusEvent.findMany({ where: { orderId: respuesta.body.id } });

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE order_status_event SET actor_role = 'NEGOCIO' WHERE id = $1`,
        evento!.id,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM order_status_event WHERE id = $1`, evento!.id),
    ).rejects.toThrow();

    const sigueAhi = await prisma.orderStatusEvent.findUnique({ where: { id: evento!.id } });
    expect(sigueAhi).not.toBeNull();
    expect(sigueAhi!.actorRole).toBe('CLIENTE');
  });

  it('rechaza un segundo evento inicial para el mismo pedido, incluso con formato inválido', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-append-only-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-append-only-2');
    const producto = await crearProducto({
      name: 'Producto Append Only 2',
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

    await expect(
      prisma.orderStatusEvent.create({
        data: {
          orderId: respuesta.body.id,
          previousStatus: null,
          resultingStatus: 'CREADO',
          actorUserId: usuario.id,
          actorRole: 'CLIENTE',
        },
      }),
    ).rejects.toThrow();

    // Forma inválida: previousStatus no nulo pero resultingStatus = creado.
    await expect(
      prisma.orderStatusEvent.create({
        data: {
          orderId: respuesta.body.id,
          previousStatus: 'EN_PREPARACION',
          resultingStatus: 'CREADO',
          actorUserId: usuario.id,
          actorRole: 'CLIENTE',
        },
      }),
    ).rejects.toThrow();
  });
});
