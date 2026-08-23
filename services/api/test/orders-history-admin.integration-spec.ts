/** Consulta del historial por administración (E4, FR-006, FR-009). */
import { Role } from '@prisma/client';
import { crearEntorno, crearPedido, crearUsuario, sesionDeRol, type Entorno } from './helpers';

describe('GET /admin/dashboard/orders/:id · administración', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve el detalle de cualquier pedido sin restricción de pertenencia', async () => {
    const cliente = await crearUsuario({
      email: 'orders-history-admin-client@foodvoice.test',
      fullName: 'Cliente Del Pedido',
    });
    const pedido = await crearPedido({ userId: cliente.id });
    const cookie = await sesionDeRol(entorno, Role.ADMINISTRADOR);

    const respuesta = await entorno
      .http()
      .get(`/api/v1/admin/dashboard/orders/${pedido.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: pedido.id,
      status: 'creado',
      history: [
        {
          previousStatus: null,
          resultingStatus: 'creado',
          actorName: 'Cliente Del Pedido',
          actorRole: 'CLIENTE',
        },
      ],
    });
  });

  it('responde 404 NOT_FOUND solo cuando el pedido no existe', async () => {
    const cookie = await sesionDeRol(entorno, Role.ADMINISTRADOR);

    const respuesta = await entorno
      .http()
      .get('/api/v1/admin/dashboard/orders/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(404);

    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });
});
