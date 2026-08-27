/**
 * `PUT /orders/:id/complain` (E7, HU-05, FR-005 a FR-008, FR-010, FR-012).
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

describe('PUT /orders/:id/complain', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  async function pedidoEntregado(sufijo: string) {
    const { usuario: cliente, cookie } = await sesionCliente(
      entorno,
      `close-complain-cliente-${sufijo}@foodvoice.test`,
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      `close-complain-repartidor-${sufijo}@foodvoice.test`,
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
    return { cliente, cookie, pedido };
  }

  it('transiciona de entregado a cerrado con el complaintReason guardado y registra el evento', async () => {
    const { cliente, cookie, pedido } = await pedidoEntregado('ok');

    const respuesta = await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookie)
      .send({ reason: 'Llegó frío y sin las papas' })
      .expect(200);

    expect(respuesta.body.status).toBe('cerrado');
    expect(respuesta.body.complaintReason).toBe('Llegó frío y sin las papas');

    const fila = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(fila.status).toBe(OrderStatus.CERRADO);
    expect(fila.complaintReason).toBe('Llegó frío y sin las papas');

    const evento = await prisma.orderStatusEvent.findFirst({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.CERRADO },
    });
    expect(evento?.actorUserId).toBe(cliente.id);
    expect(evento?.actorRole).toBe(Role.CLIENTE);
  });

  it('400 VALIDATION_ERROR si el motivo está ausente', async () => {
    const { cookie, pedido } = await pedidoEntregado('sin-motivo');
    const respuesta = await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 VALIDATION_ERROR si el motivo es demasiado corto o solo espacios', async () => {
    const { cookie, pedido } = await pedidoEntregado('corto');
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookie)
      .send({ reason: 'corto' })
      .expect(400);
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookie)
      .send({ reason: '            ' })
      .expect(400);
  });

  it('404 NOT_FOUND si no existe o no es del cliente', async () => {
    const { cookie } = await sesionCliente(entorno, 'close-complain-inexistente@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/orders/00000000-0000-0000-0000-000000000000/complain')
      .set('Cookie', cookie)
      .send({ reason: 'Un motivo cualquiera' })
      .expect(404);

    const { pedido } = await pedidoEntregado('ajeno');
    const { cookie: otro } = await sesionCliente(entorno, 'close-complain-otro@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', otro)
      .send({ reason: 'Un motivo cualquiera' })
      .expect(404);
  });

  it('409 ORDER_NOT_DELIVERED si el pedido no está en entregado', async () => {
    const { usuario: cliente, cookie } = await sesionCliente(
      entorno,
      'close-complain-no-entregado@foodvoice.test',
    );
    const pedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookie)
      .send({ reason: 'Un motivo cualquiera' })
      .expect(409);
    expect(respuesta.body.error.code).toBe('ORDER_NOT_DELIVERED');
  });

  it('403 FORBIDDEN con sesión de NEGOCIO o REPARTIDOR', async () => {
    const { cookieRepartidor, pedido } = await pedidoConCookieRepartidor();

    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', cookieRepartidor)
      .send({ reason: 'Un motivo cualquiera' })
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'close-complain-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/orders/${pedido.id}/complain`)
      .set('Cookie', negocio)
      .send({ reason: 'Un motivo cualquiera' })
      .expect(403);
  });

  async function pedidoConCookieRepartidor() {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'close-complain-403-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-complain-403-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });
    return { cookieRepartidor, pedido };
  }
});
