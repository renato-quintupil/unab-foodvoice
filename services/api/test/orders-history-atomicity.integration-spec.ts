/**
 * Un trigger temporal fuerza el fallo de inserción del evento durante
 * creación y transición: toda la operación revierte; en creación, además, el
 * carrito permanece intacto (HU01-E19, FR-044).
 */
import { crearCarrito, crearClasificacionMinima, crearDireccion, crearEntorno, crearPedido, crearProducto, crearUsuario, sesionCliente, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

async function conFalloDeInsercion<T>(accion: () => Promise<T>): Promise<T> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION fail_order_status_event_insert()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'fallo forzado de prueba';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER force_order_status_event_failure
    BEFORE INSERT ON order_status_event
    FOR EACH ROW EXECUTE FUNCTION fail_order_status_event_insert();
  `);
  try {
    return await accion();
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS force_order_status_event_failure ON order_status_event;`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS fail_order_status_event_insert();`);
  }
}

describe('Atomicidad del historial: rollback completo ante fallo del evento', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('la creación revierte por completo si falla el evento: sin pedido y carrito intacto', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-atom-create@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-atom-create');
    const producto = await crearProducto({
      name: 'Producto Atomicidad Create',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await conFalloDeInsercion(() =>
      entorno
        .http()
        .post('/api/v1/orders')
        .set('Cookie', cookie)
        .send({ addressId: direccion.id, expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }] })
        .expect(500),
    );

    const pedidos = await prisma.order.findMany({ where: { userId: usuario.id } });
    expect(pedidos).toHaveLength(0);

    const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(carrito.body.lines).toHaveLength(1);

    const direccionTrasFallo = await prisma.address.findUniqueOrThrow({ where: { id: direccion.id } });
    expect(direccionTrasFallo.usedInOrder).toBe(false);
  });

  it('aceptar revierte por completo si falla el evento: el pedido sigue creado', async () => {
    const cliente = await crearUsuario({ email: 'orders-atom-accept@foodvoice.test' });
    const pedido = await crearPedido({ userId: cliente.id });
    const negocio = await sesionNegocio(entorno, 'orders-atom-accept-negocio@foodvoice.test');

    await conFalloDeInsercion(() =>
      entorno.http().put(`/api/v1/business/orders/${pedido.id}/accept`).set('Cookie', negocio).expect(500),
    );

    const tras = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(tras.status).toBe('CREADO');

    const eventos = await prisma.orderStatusEvent.findMany({ where: { orderId: pedido.id } });
    expect(eventos).toHaveLength(1); // solo el inicial, sembrado por crearPedido
  });
});
