/**
 * `GET /business/orders/in-progress`. Corrección post-verificación: sin este
 * endpoint, un pedido dejaba de ser visible para el negocio en cuanto un
 * repartidor lo tomaba (`asignado_repartidor`/`entregado`), y solo volvía a
 * aparecer si el cliente lo cerraba o nunca, si no actuaba.
 */
import { Role } from '@prisma/client';
import {
  crearEntorno,
  crearPedido,
  sesionCliente,
  sesionDeRol,
  sesionNegocio,
  sesionRepartidor,
  type Entorno,
} from './helpers';

describe('GET /business/orders/in-progress', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve pedidos asignado_repartidor y entregado, no otros estados', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'in-progress-cliente@foodvoice.test');
    const { usuario: repartidor1 } = await sesionRepartidor(
      entorno,
      'in-progress-repartidor-1@foodvoice.test',
    );
    const { usuario: repartidor2, cookie: cookieRepartidor2 } = await sesionRepartidor(
      entorno,
      'in-progress-repartidor-2@foodvoice.test',
    );

    // Dos repartidores distintos: el índice único parcial de E5 (D-069) no
    // permite que un mismo repartidor tenga dos pedidos en `asignado_repartidor`.
    const pedidoAsignado = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor1.id,
    });

    const pedidoEntregado = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor2.id,
    });
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedidoEntregado.id}/deliver`)
      .set('Cookie', cookieRepartidor2)
      .expect(200);

    const pedidoEnPreparacion = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const negocio = await sesionNegocio(entorno, 'in-progress-negocio@foodvoice.test');
    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/in-progress')
      .set('Cookie', negocio)
      .expect(200);

    const ids = respuesta.body.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(pedidoAsignado.id);
    expect(ids).toContain(pedidoEntregado.id);
    expect(ids).not.toContain(pedidoEnPreparacion.id);
  });

  it('items: [] cuando no hay ninguno en curso', async () => {
    const negocio = await sesionNegocio(entorno, 'in-progress-vacio@foodvoice.test');
    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/in-progress')
      .set('Cookie', negocio)
      .expect(200);
    expect(respuesta.body.items).toEqual([]);
  });

  it('403 para roles distintos de NEGOCIO', async () => {
    const { cookie: cliente } = await sesionCliente(
      entorno,
      'in-progress-403-cliente@foodvoice.test',
    );
    await entorno.http().get('/api/v1/business/orders/in-progress').set('Cookie', cliente).expect(403);

    const { cookie: repartidor } = await sesionRepartidor(
      entorno,
      'in-progress-403-repartidor@foodvoice.test',
    );
    await entorno
      .http()
      .get('/api/v1/business/orders/in-progress')
      .set('Cookie', repartidor)
      .expect(403);

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().get('/api/v1/business/orders/in-progress').set('Cookie', admin).expect(403);
  });
});
