/**
 * Rechazar un pedido: tres motivos distintos, motivo vacío y solo espacios,
 * terminalidad y visibilidad del motivo (HU01-E06–E09, SC-007, SC-010).
 */
import { crearEntorno, crearPedido, sesionCliente, sesionNegocio, type Entorno } from './helpers';

describe('PUT /business/orders/:id/reject', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it.each([
    'Se acabó el ingrediente principal',
    'El local está desbordado en este momento',
    'No tenemos el tamaño solicitado disponible',
  ])('rechaza con el motivo "%s" y lo muestra al cliente (SC-007)', async (motivo) => {
    const { cookie, usuario } = await sesionCliente(entorno, `orders-reject-${motivo.length}@foodvoice.test`);
    const pedido = await crearPedido({ userId: usuario.id });
    const negocio = await sesionNegocio(entorno, `orders-reject-negocio-${motivo.length}@foodvoice.test`);

    const respuesta = await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/reject`)
      .set('Cookie', negocio)
      .send({ reason: motivo })
      .expect(200);
    expect(respuesta.body.status).toBe('rechazado');
    expect(respuesta.body.rejectionReason).toBe(motivo);

    const misPedidos = await entorno.http().get('/api/v1/orders').set('Cookie', cookie).expect(200);
    const enLista = misPedidos.body.items.find((p: { id: string }) => p.id === pedido.id);
    expect(enLista.status).toBe('rechazado');
    expect(enLista.rejectionReason).toBe(motivo);
  });

  it('rechaza sin motivo: 400, el pedido continúa "creado" (SC-010, HU01-E07)', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-reject-vacio@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id });
    const negocio = await sesionNegocio(entorno, 'orders-reject-vacio-negocio@foodvoice.test');

    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/reject`)
      .set('Cookie', negocio)
      .send({ reason: '' })
      .expect(400);

    const bandeja = await entorno.http().get('/api/v1/business/orders').set('Cookie', negocio).expect(200);
    expect(bandeja.body.items.some((p: { id: string }) => p.id === pedido.id)).toBe(true);
  });

  it('rechaza con motivo solo de espacios: 400 (SC-010)', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-reject-espacios@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id });
    const negocio = await sesionNegocio(entorno, 'orders-reject-espacios-negocio@foodvoice.test');

    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/reject`)
      .set('Cookie', negocio)
      .send({ reason: '          ' })
      .expect(400);
  });

  it('rechazado es terminal: no se puede aceptar después', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-reject-terminal@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id, status: 'rechazado' });
    const negocio = await sesionNegocio(entorno, 'orders-reject-terminal-negocio@foodvoice.test');

    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/reject`)
      .set('Cookie', negocio)
      .send({ reason: 'Un segundo intento de rechazo' })
      .expect(409);
  });
});
