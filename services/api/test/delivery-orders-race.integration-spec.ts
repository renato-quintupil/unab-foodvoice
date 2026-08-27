/**
 * Concurrencia real de `PUT /delivery/orders/:id/take` (E5, SC-002, SC-003,
 * SC-004, FR-004, FR-005, D-068, D-069).
 */
import { crearEntorno, crearPedido, sesionCliente, sesionRepartidor, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Concurrencia al tomar pedidos disponibles', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('dos repartidores tomando el mismo pedido: exactamente uno tiene éxito (SC-003)', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'delivery-race-cliente@foodvoice.test');
    const pedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const { cookie: repartidorA } = await sesionRepartidor(entorno, 'delivery-race-a@foodvoice.test');
    const { cookie: repartidorB } = await sesionRepartidor(entorno, 'delivery-race-b@foodvoice.test');

    const resultados = await Promise.allSettled([
      entorno.http().put(`/api/v1/delivery/orders/${pedido.id}/take`).set('Cookie', repartidorA),
      entorno.http().put(`/api/v1/delivery/orders/${pedido.id}/take`).set('Cookie', repartidorB),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 200);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]!.body.error.code).toBe('DELIVERY_ORDER_ALREADY_ASSIGNED');

    const final = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(final.status).toBe('ASIGNADO_REPARTIDOR');
    expect(final.deliveryUserId).not.toBeNull();
  });

  it('el mismo repartidor tomando dos pedidos a la vez: exactamente uno tiene éxito (SC-004)', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-race-doble-cliente@foodvoice.test',
    );
    const pedidoUno = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });
    const pedidoDos = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-race-doble@foodvoice.test',
    );

    const resultados = await Promise.allSettled([
      entorno.http().put(`/api/v1/delivery/orders/${pedidoUno.id}/take`).set('Cookie', cookie),
      entorno.http().put(`/api/v1/delivery/orders/${pedidoDos.id}/take`).set('Cookie', cookie),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 200);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]!.body.error.code).toBe('DELIVERY_ALREADY_HAS_ORDER');

    const asignados = await prisma.order.count({
      where: { deliveryUserId: repartidor.id, status: 'ASIGNADO_REPARTIDOR' },
    });
    expect(asignados).toBe(1);
  });
});
