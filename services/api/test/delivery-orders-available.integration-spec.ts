/**
 * `GET /delivery/orders/available` (E5, HU-04, FR-001, FR-006, FR-010).
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

describe('GET /delivery/orders/available', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve solo pedidos en_preparacion sin repartidor asignado', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'delivery-avail-cliente@foodvoice.test');
    const { usuario: otroRepartidor } = await sesionRepartidor(
      entorno,
      'delivery-avail-otro-repartidor@foodvoice.test',
    );

    const disponible = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });
    const yaAsignado = await crearPedido({
      userId: cliente.id,
      status: 'asignado_repartidor',
      deliveryUserId: otroRepartidor.id,
    });
    const pendiente = await crearPedido({ userId: cliente.id, status: 'creado' });

    const { cookie: repartidor } = await sesionRepartidor(
      entorno,
      'delivery-avail-repartidor@foodvoice.test',
    );

    const respuesta = await entorno
      .http()
      .get('/api/v1/delivery/orders/available')
      .set('Cookie', repartidor)
      .expect(200);

    const ids = respuesta.body.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(disponible.id);
    expect(ids).not.toContain(yaAsignado.id);
    expect(ids).not.toContain(pendiente.id);
  });

  it('devuelve items: [] cuando no hay ninguno disponible', async () => {
    const { cookie: repartidor } = await sesionRepartidor(
      entorno,
      'delivery-avail-vacio@foodvoice.test',
    );

    const respuesta = await entorno
      .http()
      .get('/api/v1/delivery/orders/available')
      .set('Cookie', repartidor)
      .expect(200);

    expect(respuesta.body.items).toEqual([]);
  });

  it('nunca incluye el teléfono del cliente (SC-007)', async () => {
    const { usuario: cliente } = await sesionCliente(
      entorno,
      'delivery-avail-telefono@foodvoice.test',
    );
    await crearPedido({ userId: cliente.id, status: 'en_preparacion' });
    const { cookie: repartidor } = await sesionRepartidor(
      entorno,
      'delivery-avail-telefono-repartidor@foodvoice.test',
    );

    const respuesta = await entorno
      .http()
      .get('/api/v1/delivery/orders/available')
      .set('Cookie', repartidor)
      .expect(200);

    for (const pedido of respuesta.body.items) {
      expect(pedido).not.toHaveProperty('customerPhone');
    }
  });

  it('403 para roles distintos de REPARTIDOR', async () => {
    const negocio = await sesionNegocio(entorno, 'delivery-avail-negocio@foodvoice.test');
    await entorno.http().get('/api/v1/delivery/orders/available').set('Cookie', negocio).expect(403);

    const { cookie: cliente } = await sesionCliente(entorno, 'delivery-avail-cliente-403@foodvoice.test');
    await entorno.http().get('/api/v1/delivery/orders/available').set('Cookie', cliente).expect(403);

    // Verificación cruzada con el helper genérico de roles.
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().get('/api/v1/delivery/orders/available').set('Cookie', admin).expect(403);
  });
});
