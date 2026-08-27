/**
 * `PUT /delivery/orders/:id/take` (E5, HU-04, FR-002–FR-005, FR-010, FR-012).
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

describe('PUT /delivery/orders/:id/take', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('transiciona a asignado_repartidor y registra el evento de historial', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'delivery-take-cliente@foodvoice.test');
    const pedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-take-repartidor@foodvoice.test',
    );

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.status).toBe('asignado_repartidor');

    const fila = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(fila.status).toBe(OrderStatus.ASIGNADO_REPARTIDOR);
    expect(fila.deliveryUserId).toBe(repartidor.id);
    expect(fila.assignedAt).not.toBeNull();

    const evento = await prisma.orderStatusEvent.findFirst({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.ASIGNADO_REPARTIDOR },
    });
    expect(evento?.actorUserId).toBe(repartidor.id);
    expect(evento?.actorRole).toBe(Role.REPARTIDOR);
    expect(evento?.previousStatus).toBe(OrderStatus.EN_PREPARACION);
  });

  it('404 NOT_FOUND si el pedido no existe', async () => {
    const { cookie } = await sesionRepartidor(entorno, 'delivery-take-inexistente@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/delivery/orders/00000000-0000-0000-0000-000000000000/take')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('409 DELIVERY_ORDER_ALREADY_ASSIGNED si ya no está disponible', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-take-no-disponible-cliente@foodvoice.test',
    );
    const { usuario: otroRepartidor } = await sesionRepartidor(
      entorno,
      'delivery-take-ya-tomado@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: otroRepartidor.id,
    });

    const { cookie } = await sesionRepartidor(
      entorno,
      'delivery-take-no-disponible-repartidor@foodvoice.test',
    );

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', cookie)
      .expect(409);

    expect(respuesta.body.error.code).toBe('DELIVERY_ORDER_ALREADY_ASSIGNED');
  });

  it('409 DELIVERY_ALREADY_HAS_ORDER si el repartidor ya tiene uno en curso', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-take-ya-tiene-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-take-ya-tiene@foodvoice.test',
    );
    await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });
    const segundoPedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${segundoPedido.id}/take`)
      .set('Cookie', cookie)
      .expect(409);

    expect(respuesta.body.error.code).toBe('DELIVERY_ALREADY_HAS_ORDER');
  });

  it('403 FORBIDDEN con sesión de NEGOCIO o CLIENTE (FR-010)', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'delivery-take-403-cliente@foodvoice.test',
    );
    const pedido = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', cookieCliente)
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'delivery-take-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', negocio)
      .expect(403);

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', admin)
      .expect(403);
  });
});
