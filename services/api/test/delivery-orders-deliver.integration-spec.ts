/**
 * `PUT /delivery/orders/:id/deliver` (E7, HU-05, FR-001–FR-004, FR-012).
 */
import { OrderStatus, Role } from '@prisma/client';
import {
  crearEntorno,
  crearPedido,
  sesionCliente,
  sesionDeRol,
  sesionNegocio,
  sesionRepartidor,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

describe('PUT /delivery/orders/:id/deliver', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('transiciona a entregado y registra el evento de historial', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-deliver-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-deliver-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.status).toBe('entregado');

    const fila = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(fila.status).toBe(OrderStatus.ENTREGADO);
    // deliveryUserId NO se limpia (D-074): queda como registro de quién entregó.
    expect(fila.deliveryUserId).toBe(repartidor.id);

    const evento = await prisma.orderStatusEvent.findFirst({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.ENTREGADO },
    });
    expect(evento?.actorUserId).toBe(repartidor.id);
    expect(evento?.actorRole).toBe(Role.REPARTIDOR);
    expect(evento?.previousStatus).toBe(OrderStatus.ASIGNADO_REPARTIDOR);
  });

  it('el repartidor queda sin ningún pedido en curso tras la transición', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-deliver-libre-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-deliver-libre@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookie)
      .expect(200);

    const actual = await entorno
      .http()
      .get('/api/v1/delivery/orders/current')
      .set('Cookie', cookie)
      .expect(200);
    expect(actual.body).toEqual({ order: null });
  });

  it('404 NOT_FOUND si el pedido no existe', async () => {
    const { cookie } = await sesionRepartidor(entorno, 'delivery-deliver-inexistente@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/delivery/orders/00000000-0000-0000-0000-000000000000/deliver')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('409 DELIVERY_ORDER_NOT_YOURS si el pedido no está asignado a ese repartidor', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-deliver-ajeno-cliente@foodvoice.test',
    );
    const { usuario: dueno } = await sesionRepartidor(entorno, 'delivery-deliver-dueno@foodvoice.test');
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: dueno.id,
    });
    const { cookie: otro } = await sesionRepartidor(entorno, 'delivery-deliver-otro@foodvoice.test');

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', otro)
      .expect(409);

    expect(respuesta.body.error.code).toBe('DELIVERY_ORDER_NOT_YOURS');
  });

  it('409 DELIVERY_ORDER_NOT_YOURS en un segundo intento sobre el mismo pedido ya entregado', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-deliver-repetido-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-deliver-repetido@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookie)
      .expect(200);

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookie)
      .expect(409);
    expect(respuesta.body.error.code).toBe('DELIVERY_ORDER_NOT_YOURS');
  });

  it('403 FORBIDDEN con sesión de NEGOCIO o CLIENTE', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'delivery-deliver-403-cliente@foodvoice.test',
    );
    const { usuario: repartidor } = await sesionRepartidor(
      entorno,
      'delivery-deliver-403-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookieCliente)
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'delivery-deliver-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', negocio)
      .expect(403);

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', admin)
      .expect(403);
  });
});
