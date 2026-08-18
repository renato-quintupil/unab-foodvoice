/**
 * Listar solo rechazados, con motivo y orden descendente (FR-039).
 */
import { crearEntorno, crearPedido, crearUsuario, sesionNegocio, type Entorno } from './helpers';

describe('GET /business/orders/rejected', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('mensaje vacío cuando no hay rechazados', async () => {
    const negocio = await sesionNegocio(entorno, 'orders-rejected-vacio@foodvoice.test');
    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/rejected')
      .set('Cookie', negocio)
      .expect(200);
    expect(respuesta.body.items).toEqual([]);
  });

  it('lista solo los rechazados, con motivo, sin incluir creado ni en_preparacion', async () => {
    const cliente = await crearUsuario({ email: 'orders-rejected-cliente@foodvoice.test' });
    const negocio = await sesionNegocio(entorno, 'orders-rejected-negocio@foodvoice.test');

    const rechazado1 = await crearPedido({
      userId: cliente.id,
      status: 'rechazado',
      rejectionReason: 'Motivo uno',
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    });
    const rechazado2 = await crearPedido({
      userId: cliente.id,
      status: 'rechazado',
      rejectionReason: 'Motivo dos',
      createdAt: new Date('2026-08-02T10:00:00.000Z'),
    });
    await crearPedido({ userId: cliente.id, status: 'creado' });
    await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/rejected')
      .set('Cookie', negocio)
      .expect(200);

    expect(respuesta.body.items).toHaveLength(2);
    expect(respuesta.body.items.map((p: { id: string }) => p.id)).toEqual([
      rechazado2.id,
      rechazado1.id,
    ]);
    expect(respuesta.body.items[0].rejectionReason).toBe('Motivo dos');
  });
});
