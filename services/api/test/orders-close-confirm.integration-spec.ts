/**
 * `PUT /orders/:id/confirm` (E7, HU-05, FR-005, FR-006, FR-009, FR-012).
 */
import { OrderStatus, Role } from '@prisma/client';
import {
  crearEntorno,
  crearPedido,
  sesionCliente,
  sesionNegocio,
  sesionRepartidor,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

describe('PUT /orders/:id/confirm', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('transiciona de entregado a cerrado sin complaintReason y registra el evento', async () => {
    const { usuario: cliente, cookie } = await sesionCliente(
      entorno,
      'close-confirm-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-confirm-repartidor@foodvoice.test',
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

    const respuesta = await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.status).toBe('cerrado');
    expect(respuesta.body.complaintReason).toBeNull();

    const fila = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(fila.status).toBe(OrderStatus.CERRADO);
    expect(fila.complaintReason).toBeNull();

    const evento = await prisma.orderStatusEvent.findFirst({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.CERRADO },
    });
    expect(evento?.actorUserId).toBe(cliente.id);
    expect(evento?.actorRole).toBe(Role.CLIENTE);
    expect(evento?.previousStatus).toBe(OrderStatus.ENTREGADO);
  });

  it('404 NOT_FOUND si el pedido no existe', async () => {
    const { cookie } = await sesionCliente(entorno, 'close-confirm-inexistente@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/orders/00000000-0000-0000-0000-000000000000/confirm')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('404 NOT_FOUND si el pedido no es del cliente autenticado', async () => {
    const { usuario: dueno } = await sesionCliente(entorno, 'close-confirm-dueno@foodvoice.test');
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-confirm-ajeno-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: dueno.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/deliver`)
      .set('Cookie', cookieRepartidor)
      .expect(200);

    const { cookie: otro } = await sesionCliente(entorno, 'close-confirm-otro@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', otro)
      .expect(404);
  });

  it('409 ORDER_NOT_DELIVERED si el pedido no está en entregado', async () => {
    const { usuario: cliente, cookie } = await sesionCliente(
      entorno,
      'close-confirm-no-entregado@foodvoice.test',
    );
    const pedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', cookie)
      .expect(409);
    expect(respuesta.body.error.code).toBe('ORDER_NOT_DELIVERED');
  });

  it('409 ORDER_NOT_DELIVERED si el pedido ya está cerrado', async () => {
    const { usuario: cliente, cookie } = await sesionCliente(
      entorno,
      'close-confirm-ya-cerrado@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-confirm-ya-cerrado-repartidor@foodvoice.test',
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
    await entorno.http().put(`/api/v1/orders/${pedido.id}/confirm`).set('Cookie', cookie).expect(200);

    const respuesta = await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', cookie)
      .expect(409);
    expect(respuesta.body.error.code).toBe('ORDER_NOT_DELIVERED');
  });

  it('403 FORBIDDEN con sesión de NEGOCIO o REPARTIDOR', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'close-confirm-403-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-confirm-403-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', cookieRepartidor)
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'close-confirm-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/confirm`)
      .set('Cookie', negocio)
      .expect(403);
  });
});
