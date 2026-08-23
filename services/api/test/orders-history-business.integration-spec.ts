/** Consulta del historial por el negocio mono-local (E4, FR-004, D-053). */
import { Role } from '@prisma/client';
import {
  conSesion,
  crearEntorno,
  crearPedido,
  crearUsuario,
  iniciarSesion,
  type Entorno,
} from './helpers';

describe('GET /business/orders/:id · negocio', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve cualquier pedido existente con el mismo OrderDetailDto', async () => {
    const cliente = await crearUsuario({
      email: 'orders-history-business-client@foodvoice.test',
      fullName: 'Cliente Ajeno A La Gestión',
    });
    const negocio = await crearUsuario({
      email: 'orders-history-business@foodvoice.test',
      fullName: 'Local De Prueba',
      role: Role.NEGOCIO,
    });
    const cookie = conSesion(await iniciarSesion(entorno, negocio.email));
    const pedido = await crearPedido({
      userId: cliente.id,
      status: 'en_preparacion',
      negocioActorId: negocio.id,
    });

    const respuesta = await entorno
      .http()
      .get(`/api/v1/business/orders/${pedido.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: pedido.id,
      status: 'en_preparacion',
      history: [
        { actorName: 'Cliente Ajeno A La Gestión', actorRole: 'CLIENTE' },
        { actorName: 'Local De Prueba', actorRole: 'NEGOCIO' },
      ],
    });
  });

  it('responde 404 NOT_FOUND únicamente cuando el pedido no existe', async () => {
    const negocio = await crearUsuario({
      email: 'orders-history-business-not-found@foodvoice.test',
      role: Role.NEGOCIO,
    });
    const cookie = conSesion(await iniciarSesion(entorno, negocio.email));

    const respuesta = await entorno
      .http()
      .get('/api/v1/business/orders/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(404);

    expect(respuesta.body.error.code).toBe('NOT_FOUND');
  });
});
