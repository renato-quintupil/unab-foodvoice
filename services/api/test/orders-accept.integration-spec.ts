/**
 * Aceptar un pedido: creado → en_preparacion; rechazo de estados no
 * pendientes (HU01-E05, E08).
 */
import { crearEntorno, crearPedido, sesionCliente, sesionNegocio, type Entorno } from './helpers';

describe('PUT /business/orders/:id/accept', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('acepta un pedido en creado: pasa a en_preparacion (HU01-E05)', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-accept-1@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id });
    const negocio = await sesionNegocio(entorno, 'orders-accept-1-negocio@foodvoice.test');

    const respuesta = await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/accept`)
      .set('Cookie', negocio)
      .expect(200);
    expect(respuesta.body.status).toBe('en_preparacion');
  });

  it('rechaza aceptar un pedido ya rechazado (HU01-E08)', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-accept-2@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id, status: 'rechazado' });
    const negocio = await sesionNegocio(entorno, 'orders-accept-2-negocio@foodvoice.test');

    const respuesta = await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/accept`)
      .set('Cookie', negocio)
      .expect(409);
    expect(respuesta.body.error.code).toBe('ORDER_NOT_PENDING');
  });

  it('rechaza aceptar un pedido ya en preparación', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-accept-3@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id, status: 'en_preparacion' });
    const negocio = await sesionNegocio(entorno, 'orders-accept-3-negocio@foodvoice.test');

    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/accept`)
      .set('Cookie', negocio)
      .expect(409);
  });

  it('404 si el pedido no existe', async () => {
    const negocio = await sesionNegocio(entorno, 'orders-accept-4-negocio@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/business/orders/99999999-9999-4999-8999-999999999999/accept')
      .set('Cookie', negocio)
      .expect(404);
  });
});
