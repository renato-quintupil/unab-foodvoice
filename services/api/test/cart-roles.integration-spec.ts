/**
 * Solo el rol CLIENTE tiene carrito (RN-001, D-042). Los otros tres roles
 * reciben 403 en los cinco endpoints.
 */
import { Role } from '@prisma/client';
import { crearEntorno, sesionDeRol, type Entorno } from './helpers';

describe('Solo CLIENTE puede usar /cart/**', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  const OTROS_ROLES = [Role.NEGOCIO, Role.REPARTIDOR, Role.ADMINISTRADOR];

  it.each(OTROS_ROLES)('%s recibe 403 en GET /cart', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en POST /cart/lines', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', cookie)
      .send({ productId: '99999999-9999-4999-8999-999999999999' })
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en PATCH /cart/lines/:productId', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .patch('/api/v1/cart/lines/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .send({ quantity: 1 })
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en DELETE /cart/lines/:productId', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .delete('/api/v1/cart/lines/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en DELETE /cart', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno.http().delete('/api/v1/cart').set('Cookie', cookie).expect(403);
  });
});
