/**
 * E7 no cambia el contrato de trazabilidad de E4 (FR-014, SC-006):
 * `GET /orders/:id` y `GET /business/orders/:id` deben mostrar las
 * transiciones de entrega y cierre, y el motivo del reclamo cuando lo hay,
 * sin ningún cambio de `OrderDetailDto`.
 */
import { crearEntorno, crearPedido, sesionCliente, sesionNegocio, sesionRepartidor, type Entorno } from './helpers';

describe('Trazabilidad de las transiciones de cierre (E4 sin cambios de contrato)', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('muestra entregar y confirmar como dos entradas nuevas, en orden cronológico', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'close-traza-confirmar-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-traza-confirmar-repartidor@foodvoice.test',
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
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', cookieCliente)
      .expect(200);

    const detalle = await entorno
      .http()
      .get(`/api/v1/orders/${pedido.id}`)
      .set('Cookie', cookieCliente)
      .expect(200);

    // creado → en_preparacion (E2) → asignado_repartidor (E5) → entregado (E7) → cerrado (E7).
    expect(detalle.body.history).toHaveLength(5);
    expect(detalle.body.complaintReason).toBeNull();

    const [, , , entregado, cerrado] = detalle.body.history;
    expect(entregado).toMatchObject({
      previousStatus: 'asignado_repartidor',
      resultingStatus: 'entregado',
      actorName: 'Repartidor De Prueba',
      actorRole: 'REPARTIDOR',
    });
    expect(cerrado).toMatchObject({
      previousStatus: 'entregado',
      resultingStatus: 'cerrado',
      actorName: 'Cliente De Prueba',
      actorRole: 'CLIENTE',
    });
    expect(new Date(entregado.occurredAt).getTime()).toBeLessThanOrEqual(
      new Date(cerrado.occurredAt).getTime(),
    );
  });

  it('el negocio ve el motivo del reclamo en el detalle, sin cambio de contrato', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'close-traza-reclamar-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-traza-reclamar-repartidor@foodvoice.test',
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
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookieCliente)
      .send({ reason: 'Llegó frío y sin las papas' })
      .expect(200);

    const negocio = await sesionNegocio(entorno, 'close-traza-reclamar-negocio@foodvoice.test');
    const detalle = await entorno
      .http()
      .get(`/api/v1/business/orders/${pedido.id}`)
      .set('Cookie', negocio)
      .expect(200);

    expect(detalle.body.complaintReason).toBe('Llegó frío y sin las papas');
    expect(detalle.body.history.at(-1)).toMatchObject({
      resultingStatus: 'cerrado',
      actorRole: 'CLIENTE',
    });
  });
});
