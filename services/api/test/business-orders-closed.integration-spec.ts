/**
 * `GET /business/orders/closed` (E7, HU-05, FR-011, D-081, hallazgo C1 de
 * `/speckit.analyze`).
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

describe('GET /business/orders/closed', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve solo pedidos cerrados, con el reclamo cuando lo hay', async () => {
    const { usuario: cliente, cookie: cookieCliente } = await sesionCliente(
      entorno,
      'closed-list-cliente@foodvoice.test',
    );
    const { usuario: repartidor, cookie: cookieRepartidor } = await sesionRepartidor(
      entorno,
      'closed-list-repartidor@foodvoice.test',
    );
    const pedidoCerrado = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedidoCerrado.id}/deliver`)
      .set('Cookie', cookieRepartidor)
      .expect(200);
    await entorno
      .http()
      .put(`/api/v1/orders/${pedidoCerrado.id}/complain`)
      .set('Cookie', cookieCliente)
      .send({ reason: 'Llegó frío y sin las papas' })
      .expect(200);

    const pedidoEnPreparacion = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const negocio = await sesionNegocio(entorno, 'closed-list-negocio@foodvoice.test');
    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/closed')
      .set('Cookie', negocio)
      .expect(200);

    const ids = respuesta.body.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(pedidoCerrado.id);
    expect(ids).not.toContain(pedidoEnPreparacion.id);

    const encontrado = respuesta.body.items.find((p: { id: string }) => p.id === pedidoCerrado.id);
    expect(encontrado.complaintReason).toBe('Llegó frío y sin las papas');
  });

  it('items: [] cuando no hay ninguno cerrado', async () => {
    const negocio = await sesionNegocio(entorno, 'closed-list-vacio@foodvoice.test');
    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/closed')
      .set('Cookie', negocio)
      .expect(200);
    expect(respuesta.body.items).toEqual([]);
  });

  it('403 para roles distintos de NEGOCIO', async () => {
    const { cookie: cliente } = await sesionCliente(entorno, 'closed-list-403-cliente@foodvoice.test');
    await entorno.http().get('/api/v1/business/orders/closed').set('Cookie', cliente).expect(403);

    const { cookie: repartidor } = await sesionRepartidor(
      entorno,
      'closed-list-403-repartidor@foodvoice.test',
    );
    await entorno.http().get('/api/v1/business/orders/closed').set('Cookie', repartidor).expect(403);

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().get('/api/v1/business/orders/closed').set('Cookie', admin).expect(403);
  });
});
