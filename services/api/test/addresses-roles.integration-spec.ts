/**
 * Solo CLIENTE tiene direcciones (D-042).
 */
import { Role } from '@prisma/client';
import { crearEntorno, sesionDeRol, type Entorno } from './helpers';

describe('Solo CLIENTE puede usar /addresses/**', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  const OTROS_ROLES = [Role.NEGOCIO, Role.REPARTIDOR, Role.ADMINISTRADOR];

  it.each(OTROS_ROLES)('%s recibe 403 en GET /addresses', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en POST /addresses', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' })
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en PATCH /addresses/:id', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .patch('/api/v1/addresses/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' })
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en PUT /addresses/:id/default', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .put('/api/v1/addresses/99999999-9999-4999-8999-999999999999/default')
      .set('Cookie', cookie)
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en PUT /addresses/:id/status', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .put('/api/v1/addresses/99999999-9999-4999-8999-999999999999/status')
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(403);
  });

  it.each(OTROS_ROLES)('%s recibe 403 en DELETE /addresses/:id', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .delete('/api/v1/addresses/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(403);
  });
});
