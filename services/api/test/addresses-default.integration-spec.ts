/**
 * Cambiar la dirección predeterminada (HU11-E05, FR-015, FR-024).
 */
import { crearEntorno, sesionCliente, type Entorno } from './helpers';

describe('PUT /addresses/:id/default', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('marca la nueva predeterminada y quita la marca a la anterior (HU11-E05)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-default-1@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    const trabajo = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Trabajo', text: 'Oficina Piso 4' });

    expect(casa.body.isDefault).toBe(true);
    expect(trabajo.body.isDefault).toBe(false);

    const respuesta = await entorno
      .http()
      .put(`/api/v1/addresses/${trabajo.body.id}/default`)
      .set('Cookie', cookie)
      .expect(200);
    expect(respuesta.body.isDefault).toBe(true);

    const lista = await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(200);
    const activas = lista.body.items.filter((d: { isDefault: boolean }) => d.isDefault);
    expect(activas).toHaveLength(1);
    expect(activas[0].id).toBe(trabajo.body.id);
  });

  it('404 si la dirección no existe o no es del cliente', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-default-2@foodvoice.test');
    await entorno
      .http()
      .put('/api/v1/addresses/99999999-9999-4999-8999-999999999999/default')
      .set('Cookie', cookie)
      .expect(404);
  });
});
