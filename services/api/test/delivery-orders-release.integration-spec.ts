/**
 * `PUT /delivery/orders/:id/release` (E5, HU-04, FR-008, FR-009, FR-010,
 * FR-012). Dispara la transición de retroceso de la enmienda constitucional
 * 3.0.0.
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

describe('PUT /delivery/orders/:id/release', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('transiciona de vuelta a en_preparacion sin repartidor y registra el evento', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-release-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-release-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.status).toBe('en_preparacion');

    const fila = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(fila.status).toBe(OrderStatus.EN_PREPARACION);
    expect(fila.deliveryUserId).toBeNull();
    expect(fila.assignedAt).toBeNull();

    const evento = await prisma.orderStatusEvent.findFirst({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.EN_PREPARACION },
      orderBy: { occurredAt: 'desc' },
    });
    expect(evento?.previousStatus).toBe(OrderStatus.ASIGNADO_REPARTIDOR);
    expect(evento?.actorUserId).toBe(repartidor.id);
    expect(evento?.actorRole).toBe(Role.REPARTIDOR);
  });

  it('404 NOT_FOUND si el pedido no existe', async () => {
    const { cookie } = await sesionRepartidor(entorno, 'delivery-release-inexistente@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/delivery/orders/00000000-0000-0000-0000-000000000000/release')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('409 DELIVERY_ORDER_NOT_YOURS si no está asignado al repartidor autenticado', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-release-ajeno-cliente@foodvoice.test',
    );
    const { usuario: dueno } = await sesionRepartidor(
      entorno,
      'delivery-release-dueno@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: dueno.id,
    });

    const { cookie: otro } = await sesionRepartidor(entorno, 'delivery-release-otro@foodvoice.test');

    const respuesta = await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', otro)
      .expect(409);

    expect(respuesta.body.error.code).toBe('DELIVERY_ORDER_NOT_YOURS');
  });

  it('el pedido soltado reaparece en GET /delivery/orders/available y puede tomarlo cualquiera', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-release-reaparece-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-release-reaparece@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', cookie)
      .expect(200);

    const disponibles = await entorno
      .http()
      .get('/api/v1/delivery/orders/available')
      .set('Cookie', cookie)
      .expect(200);
    expect(disponibles.body.items.map((p: { id: string }) => p.id)).toContain(pedido.id);

    // El mismo repartidor que lo soltó puede volver a tomarlo (FR-009).
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/take`)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('403 FORBIDDEN con sesión de NEGOCIO o CLIENTE (FR-010)', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'delivery-release-403-cliente@foodvoice.test',
    );
    const { usuario: repartidor } = await sesionRepartidor(
      entorno,
      'delivery-release-403-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', cookieCliente)
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'delivery-release-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', negocio)
      .expect(403);

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedido.id}/release`)
      .set('Cookie', admin)
      .expect(403);
  });
});
