/**
 * Exactamente un evento por aceptación/rechazo, con estados, actor negocio,
 * rol y fecha (HU01-E18, FR-043).
 */
import { crearEntorno, crearPedido, crearUsuario, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Historial: evento de transición', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('aceptar agrega exactamente un evento creado → en_preparacion con el negocio actor', async () => {
    const cliente = await crearUsuario({ email: 'orders-history-accept@foodvoice.test' });
    const pedido = await crearPedido({ userId: cliente.id });
    const negocioCookie = await sesionNegocio(entorno, 'orders-history-accept-negocio@foodvoice.test');

    await entorno.http().put(`/api/v1/business/orders/${pedido.id}/accept`).set('Cookie', negocioCookie).expect(200);

    const eventos = await prisma.orderStatusEvent.findMany({
      where: { orderId: pedido.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(eventos).toHaveLength(2);
    const transicion = eventos[1]!;
    expect(transicion.previousStatus).toBe('CREADO');
    expect(transicion.resultingStatus).toBe('EN_PREPARACION');
    expect(transicion.actorRole).toBe('NEGOCIO');
  });

  it('rechazar agrega exactamente un evento creado → rechazado con el negocio actor', async () => {
    const cliente = await crearUsuario({ email: 'orders-history-reject@foodvoice.test' });
    const pedido = await crearPedido({ userId: cliente.id });
    const negocioCookie = await sesionNegocio(entorno, 'orders-history-reject-negocio@foodvoice.test');

    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/reject`)
      .set('Cookie', negocioCookie)
      .send({ reason: 'Motivo de la prueba de historial' })
      .expect(200);

    const eventos = await prisma.orderStatusEvent.findMany({
      where: { orderId: pedido.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(eventos).toHaveLength(2);
    expect(eventos[1]!.previousStatus).toBe('CREADO');
    expect(eventos[1]!.resultingStatus).toBe('RECHAZADO');
    expect(eventos[1]!.actorRole).toBe('NEGOCIO');
  });
});
