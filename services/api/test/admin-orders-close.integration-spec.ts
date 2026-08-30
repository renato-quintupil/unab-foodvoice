/**
 * `PUT /admin/orders/:id/close` (E8, HU-07 Historia 2, FR-003, FR-004,
 * FR-006 a FR-008, FR-016).
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

const MOTIVO = 'Local cerrado por emergencia, pedido no se puede completar.';

describe('PUT /admin/orders/:id/close', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it.each(['creado', 'en_preparacion'] as const)(
    'cierra administrativamente un pedido en %s, con el motivo registrado',
    async (estado) => {
      const { usuario: cliente } = await sesionCliente(entorno, `close-${estado}-cliente@foodvoice.test`);
      const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
      const pedido = await crearPedido({ userId: cliente.id, status: estado });

      const respuesta = await entorno
        .http()
        .put(`/api/v1/admin/orders/${pedido.id}/close`)
        .set('Cookie', admin)
        .send({ reason: MOTIVO })
        .expect(200);

      expect(respuesta.body.status).toBe('cerrado');

      const evento = await prisma.orderStatusEvent.findFirst({
        where: { orderId: pedido.id, resultingStatus: OrderStatus.CERRADO },
      });
      expect(evento?.actorRole).toBe(Role.ADMINISTRADOR);
      expect(evento?.reason).toBe(MOTIVO);
    },
  );

  it('cierra administrativamente un pedido en asignado_repartidor y libera al repartidor (FR-007)', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'close-asignado-cliente@foodvoice.test');
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-asignado-repartidor@foodvoice.test',
    );
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/close`)
      .set('Cookie', admin)
      .send({ reason: MOTIVO })
      .expect(200);

    const actual = await entorno
      .http()
      .get('/api/v1/delivery/orders/current')
      .set('Cookie', cookieRepartidor)
      .expect(200);
    expect(actual.body).toEqual({ order: null });
  });

  it('cierra administrativamente un pedido en entregado', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'close-entregado-cliente@foodvoice.test');
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'close-entregado-repartidor@foodvoice.test',
    );
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
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

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/close`)
      .set('Cookie', admin)
      .send({ reason: MOTIVO })
      .expect(200);
  });

  it('409 ORDER_ALREADY_TERMINAL sobre un pedido ya cerrado o rechazado', async () => {
    const { usuario: clienteRechazado } = await sesionCliente(
      entorno,
      'close-terminal-rechazado-cliente@foodvoice.test',
    );
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedidoRechazado = await crearPedido({ userId: clienteRechazado.id, status: 'rechazado' });

    const respuestaRechazado = await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedidoRechazado.id}/close`)
      .set('Cookie', admin)
      .send({ reason: MOTIVO })
      .expect(409);
    expect(respuestaRechazado.body.error.code).toBe('ORDER_ALREADY_TERMINAL');

    const { usuario: clienteCerrado } = await sesionCliente(
      entorno,
      'close-terminal-cerrado-cliente@foodvoice.test',
    );
    const pedidoCreado = await crearPedido({ userId: clienteCerrado.id });
    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedidoCreado.id}/close`)
      .set('Cookie', admin)
      .send({ reason: MOTIVO })
      .expect(200);

    const respuestaCerrado = await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedidoCreado.id}/close`)
      .set('Cookie', admin)
      .send({ reason: MOTIVO })
      .expect(409);
    expect(respuestaCerrado.body.error.code).toBe('ORDER_ALREADY_TERMINAL');
  });

  it('400 VALIDATION_ERROR con motivo ausente o solo espacios', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'close-sin-motivo-cliente@foodvoice.test');
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const pedido = await crearPedido({ userId: cliente.id });

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/close`)
      .set('Cookie', admin)
      .send({ reason: '   ' })
      .expect(400);
  });

  it('403 FORBIDDEN con sesión de CLIENTE, NEGOCIO o REPARTIDOR', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'close-403-cliente@foodvoice.test',
    );
    const pedido = await crearPedido({ userId: cliente.id });

    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/close`)
      .set('Cookie', cookieCliente)
      .send({ reason: MOTIVO })
      .expect(403);

    const negocio = await sesionNegocio(entorno, 'close-403-negocio@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/close`)
      .set('Cookie', negocio)
      .send({ reason: MOTIVO })
      .expect(403);

    const { cookie: cookieRepartidor } = await sesionRepartidor(entorno, 'close-403-repartidor@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/admin/orders/${pedido.id}/close`)
      .set('Cookie', cookieRepartidor)
      .send({ reason: MOTIVO })
      .expect(403);
  });

  it('condición de carrera: dos cierres administrativos simultáneos sobre el mismo pedido (FR-016)', async () => {
    // Dos administradores, no un solo actor: cubre la primera cláusula de
    // FR-016 ("dos acciones administrativas compiten"), distinta de la
    // carrera admin-vs-rol-normal que ya cubre US1.
    const { usuario: cliente } = await sesionCliente(entorno, 'close-carrera-cliente@foodvoice.test');
    const admin1 = await sesionDeRol(entorno, Role.ADMINISTRADOR, 'close-carrera-admin1@foodvoice.test');
    const admin2 = await sesionDeRol(entorno, Role.ADMINISTRADOR, 'close-carrera-admin2@foodvoice.test');
    const pedido = await crearPedido({ userId: cliente.id });

    const resultados = await Promise.allSettled([
      entorno
        .http()
        .put(`/api/v1/admin/orders/${pedido.id}/close`)
        .set('Cookie', admin1)
        .send({ reason: `${MOTIVO} (admin 1)` }),
      entorno
        .http()
        .put(`/api/v1/admin/orders/${pedido.id}/close`)
        .set('Cookie', admin2)
        .send({ reason: `${MOTIVO} (admin 2)` }),
    ]);

    const respuestas = resultados.map((r) => (r.status === 'fulfilled' ? r.value : null));
    const exitosas = respuestas.filter((r) => r && r.status === 200);
    const fallidas = respuestas.filter((r) => r && r.status === 409);
    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0]!.body.error.code).toBe('ORDER_ALREADY_TERMINAL');

    const eventos = await prisma.orderStatusEvent.findMany({
      where: { orderId: pedido.id, resultingStatus: OrderStatus.CERRADO },
    });
    // Exactamente un evento de cierre, sin duplicar el efecto.
    expect(eventos).toHaveLength(1);
  });
});
