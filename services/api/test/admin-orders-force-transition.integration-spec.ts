/**
 * `PUT /admin/orders/:id/force-transition` (E8, HU-07 Historia 1,
 * FR-001, FR-002, FR-005 a FR-008, FR-016).
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

const MOTIVO = 'El negocio no respondió en más de una hora.';

describe('PUT /admin/orders/:id/force-transition', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('fuerza creado a en_preparacion y registra el evento con el administrador y el motivo', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-creado-cliente@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({ userId: cliente.id });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', admin)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(200);

    expect(respuesta.body.status).toBe('en_preparacion');

    const evento = await prisma.orderStatusEvent.findFirst({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.EN_PREPARACION },
    });
    expect(evento?.actorRole).toBe(Role.ADMINISTRADOR);
    expect(evento?.reason).toBe(MOTIVO);
    expect(evento?.previousStatus).toBe(OrderStatus.CREADO);
  });

  it('fuerza asignado_repartidor a entregado correctamente', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-entregado-cliente@foodvoice.test');
    const { usuario: repartidor } = await sesionRepartidor(entorno, 'force-entregado-repartidor@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', admin)
      .send({ targetStatus: 'entregado', reason: MOTIVO })
      .expect(200);

    expect(respuesta.body.status).toBe('entregado');
  });

  it('tras forzar asignado_repartidor a entregado, el repartidor queda libre (FR-007)', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-libre-cliente@foodvoice.test');
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'force-libre-repartidor@foodvoice.test',
    );
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', admin)
      .send({ targetStatus: 'entregado', reason: MOTIVO })
      .expect(200);

    const actual = await entorno
      .http()
      .get('/api/v1/delivery/orders/current')
      .set('Cookie', cookieRepartidor)
      .expect(200);
    expect(actual.body).toEqual({ order: null });
  });

  it('409 FORCE_TRANSITION_INVALID al intentar la retroceso reservada al repartidor', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-retroceso-cliente@foodvoice.test');
    const { usuario: repartidor } = await sesionRepartidor(entorno, 'force-retroceso-repartidor@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', admin)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(409);

    expect(respuesta.body.error.code).toBe('FORCE_TRANSITION_INVALID');
  });

  it('409 FORCE_TRANSITION_INVALID sobre un pedido ya rechazado', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-rechazado-cliente@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({ userId: cliente.id, status: 'rechazado' });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', admin)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(409);

    expect(respuesta.body.error.code).toBe('FORCE_TRANSITION_INVALID');
  });

  it('404 NOT_FOUND si el pedido no existe', async () => {
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno
      .http()
      .put('/api/v1/admin/orders/00000000-0000-0000-0000-000000000000/force-transition')
      .set('Cookie', admin)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(404);
  });

  it('400 VALIDATION_ERROR con motivo ausente o solo espacios', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-sin-motivo-cliente@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({ userId: cliente.id });

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', admin)
      .send({ targetStatus: 'en_preparacion', reason: '   ' })
      .expect(400);
  });

  it('403 FORBIDDEN con sesión de CLIENTE, NEGOCIO o REPARTIDOR', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'force-403-cliente@foodvoice.test',
    );
    const pedido = await crearPedido({ userId: cliente.id });

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', cookieCliente)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'force-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', negocio)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(403);

    const { cookie: cookieRepartidor } = await sesionRepartidor(entorno, 'force-403-repartidor@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
      .set('Cookie', cookieRepartidor)
      .send({ targetStatus: 'en_preparacion', reason: MOTIVO })
      .expect(403);
  });

  it('condición de carrera: el negocio acepta el pedido mientras el administrador fuerza la misma transición (FR-016)', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'force-carrera-cliente@foodvoice.test');
    const negocio = await sesionNegocio(entorno, 'force-carrera-negocio@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({ userId: cliente.id });

    const resultados = await Promise.allSettled([
      entorno.http().put(`/api/v1/business/orders/${pedido.id}/accept`).set('Cookie', negocio),
      entorno
        .http()
        .put(`/api/v1/admin/orders/${pedido.id}/force-transition`)
        .set('Cookie', admin)
        .send({ targetStatus: 'en_preparacion', reason: MOTIVO }),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 200);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);

    const eventos = await prisma.orderStatusEvent.findMany({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.EN_PREPARACION },
    });
    expect(eventos).toHaveLength(1);
  });
});
