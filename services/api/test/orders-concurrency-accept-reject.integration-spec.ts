/**
 * Aceptar y rechazar el mismo pedido casi simultáneamente: un único ganador,
 * un único evento nuevo, ningún evento de la perdedora (FR-036, FR-044, D-038).
 */
import { crearEntorno, crearPedido, sesionCliente, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Aceptar/rechazar concurrentes sobre el mismo pedido', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('gana solo una acción; la otra falla sin duplicar el efecto', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-conc-transition@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id });
    const negocio = await sesionNegocio(entorno, 'orders-conc-transition-negocio@foodvoice.test');

    const resultados = await Promise.allSettled([
      entorno.http().put(`/api/v1/business/orders/${pedido.id}/accept`).set('Cookie', negocio),
      entorno
        .http()
        .put(`/api/v1/business/orders/${pedido.id}/reject`)
        .set('Cookie', negocio)
        .send({ reason: 'Motivo de la carrera de rechazo' }),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 200);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]!.body.error.code).toBe('ORDER_NOT_PENDING');

    const eventos = await prisma.orderStatusEvent.findMany({
      where: { orderId: pedido.id },
      orderBy: { occurredAt: 'asc' },
    });
    // Uno inicial (creado por crearPedido) + exactamente uno de la transición ganadora.
    expect(eventos).toHaveLength(2);

    const final = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(['EN_PREPARACION', 'RECHAZADO']).toContain(final.status);
  });
});
