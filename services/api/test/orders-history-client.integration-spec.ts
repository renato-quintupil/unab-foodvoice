/**
 * Consulta del historial por el cliente (E4, FR-001–FR-003, FR-005).
 */
import { Role } from '@prisma/client';
import { crearEntorno, crearPedido, crearUsuario, sesionCliente, type Entorno } from './helpers';

describe('GET /orders/:id · cliente', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve el detalle con el historial cronológico y el actor de cada cambio', async () => {
    const { usuario, cookie } = await sesionCliente(
      entorno,
      'orders-history-client@foodvoice.test',
    );
    const negocio = await crearUsuario({
      email: 'orders-history-client-negocio@foodvoice.test',
      fullName: 'Panadería Don José',
      role: Role.NEGOCIO,
    });
    const pedido = await crearPedido({
      userId: usuario.id,
      status: 'en_preparacion',
      negocioActorId: negocio.id,
    });

    const respuesta = await entorno
      .http()
      .get(`/api/v1/orders/${pedido.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: pedido.id,
      status: 'en_preparacion',
      history: [
        {
          previousStatus: null,
          resultingStatus: 'creado',
          actorName: 'Cliente De Prueba',
          actorRole: 'CLIENTE',
        },
        {
          previousStatus: 'creado',
          resultingStatus: 'en_preparacion',
          actorName: 'Panadería Don José',
          actorRole: 'NEGOCIO',
        },
      ],
    });
    expect(respuesta.body.history).toHaveLength(2);
    expect(respuesta.body.history.every((evento: { occurredAt?: string }) => evento.occurredAt))
      .toBe(true);
    expect(
      respuesta.body.history.map((evento: { occurredAt: string }) => evento.occurredAt),
    ).toEqual(
      respuesta.body.history
        .map((evento: { occurredAt: string }) => evento.occurredAt)
        .toSorted(),
    );
    expect(
      respuesta.body.history.filter(
        (evento: { previousStatus: string | null }) => evento.previousStatus === null,
      ),
    ).toHaveLength(1);
  });

  it('responde con el mismo 404 para un pedido ajeno y uno inexistente', async () => {
    const { cookie } = await sesionCliente(entorno, 'orders-history-client-owner@foodvoice.test');
    const otro = await crearUsuario({ email: 'orders-history-client-other@foodvoice.test' });
    const ajeno = await crearPedido({ userId: otro.id });

    const respuestaAjeno = await entorno
      .http()
      .get(`/api/v1/orders/${ajeno.id}`)
      .set('Cookie', cookie)
      .expect(404);
    const respuestaInexistente = await entorno
      .http()
      .get('/api/v1/orders/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(404);

    expect(respuestaAjeno.body).toEqual(respuestaInexistente.body);
    expect(respuestaAjeno.body.error.code).toBe('NOT_FOUND');
  });
});
