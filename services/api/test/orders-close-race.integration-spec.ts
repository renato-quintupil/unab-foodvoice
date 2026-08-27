/**
 * Concurrencia real de cerrar un pedido entregado (E7, FR-013, SC-005).
 */
import { crearEntorno, crearPedido, sesionCliente, sesionRepartidor, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Confirmar y reclamar el mismo pedido entregado, casi al mismo tiempo', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('exactamente una de las dos acciones tiene éxito, sin duplicar el efecto', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'close-race-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-race-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookieRepartidor)
      .expect(200);

    const resultados = await Promise.allSettled([
      entorno.http().put(`/api/v1/orders/${pedido.id}/confirm`).set('Cookie', cookieCliente),
      entorno
        .http()
        .put(`/api/v1/orders/${pedido.id}/complain`)
        .set('Cookie', cookieCliente)
        .send({ reason: 'Llegó frío y sin las papas' }),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 200);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]!.body.error.code).toBe('ORDER_NOT_DELIVERED');

    const final = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(final.status).toBe('CERRADO');

    const eventosCierre = await prisma.orderStatusEvent.count({
      where: { orderId: pedido.id, resultingStatus: 'CERRADO' },
    });
    expect(eventosCierre).toBe(1);
  });
});
