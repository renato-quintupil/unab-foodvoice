/**
 * `GET /delivery/orders/current` (E5, HU-04, FR-007, FR-010, SC-007).
 */
import { Role } from '@prisma/client';
import {
  crearEntorno,
  crearPedido,
  crearUsuario,
  sesionCliente,
  sesionDeRol,
  sesionNegocio,
  sesionRepartidor,
  type Entorno,
} from './helpers';

describe('GET /delivery/orders/current', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve { order: null } sin pedido en curso', async () => {
    const { cookie } = await sesionRepartidor(entorno, 'delivery-current-vacio@foodvoice.test');

    const respuesta = await entorno
      .http()
      .get('/api/v1/delivery/orders/current')
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body).toEqual({ order: null });
  });

  it('devuelve el pedido con customerPhone cuando hay uno en curso', async () => {
    const cliente = await crearUsuario({
      email: 'delivery-current-cliente@foodvoice.test',
      role: Role.CLIENTE,
      phone: '+56999998888',
    });
    const { usuario: repartidor, cookie } = await sesionRepartidor(
      entorno,
      'delivery-current-repartidor@foodvoice.test',
    );
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: repartidor.id,
    });

    const respuesta = await entorno
      .http()
      .get('/api/v1/delivery/orders/current')
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body.order.id).toBe(pedido.id);
    expect(respuesta.body.order.customerPhone).toBe('+56999998888');
    expect(respuesta.body.order.status).toBe('asignado_repartidor');
  });

  it('403 para roles distintos de REPARTIDOR', async () => {
    const { cookie: cliente } = await sesionCliente(
      entorno,
      'delivery-current-403-cliente@foodvoice.test',
    );
    await entorno.http().get('/api/v1/delivery/orders/current').set('Cookie', cliente).expect(403);

    const negocio = await sesionNegocio(entorno, 'delivery-current-403-negocio@foodvoice.test');
    await entorno.http().get('/api/v1/delivery/orders/current').set('Cookie', negocio).expect(403);

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().get('/api/v1/delivery/orders/current').set('Cookie', admin).expect(403);
  });
});
