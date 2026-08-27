/**
 * E5 no cambia el contrato de trazabilidad de E4 (SC-006, FR-012):
 * `GET /orders/:id` debe mostrar las transiciones de reparto sin ningún
 * cambio de `OrderDetailDto` (specs/005-trazabilidad-pedido/contracts/shared.md).
 */
import { crearEntorno, crearPedido, sesionCliente, sesionRepartidor, type Entorno } from './helpers';

describe('Trazabilidad de las transiciones de reparto (E4 sin cambios de contrato)', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('muestra tomar y soltar como dos entradas nuevas, en orden cronológico', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'delivery-traza-cliente@foodvoice.test',
    );
    const { cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'delivery-traza-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', cookieRepartidor)
      .expect(200);
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', cookieRepartidor)
      .expect(200);

    const detalle = await entorno
      .http()
      .get(`/api/v1/orders/${pedido.id}`)
      .set('Cookie', cookieCliente)
      .expect(200);

    // creado → en_preparacion (E2) → asignado_repartidor (E5) → en_preparacion (E5).
    expect(detalle.body.history).toHaveLength(4);

    const [, , tomar, soltar] = detalle.body.history;
    expect(tomar).toMatchObject({
      previousStatus: 'en_preparacion',
      resultingStatus: 'asignado_repartidor',
      actorName: 'Repartidor De Prueba',
      actorRole: 'REPARTIDOR',
    });
    expect(soltar).toMatchObject({
      previousStatus: 'asignado_repartidor',
      resultingStatus: 'en_preparacion',
      actorName: 'Repartidor De Prueba',
      actorRole: 'REPARTIDOR',
    });
    expect(new Date(tomar.occurredAt).getTime()).toBeLessThanOrEqual(
      new Date(soltar.occurredAt).getTime(),
    );
  });
});
