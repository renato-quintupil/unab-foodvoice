/**
 * Reactivar direcciones (HU11-E13–E14).
 */
import { crearEntorno, sesionCliente, type Entorno } from './helpers';

describe('PUT /addresses/:id/status → active: true', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('reactivar sin ninguna otra activa la deja predeterminada (HU11-E13)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-react-1@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    await entorno
      .http()
      .put(`/api/v1/addresses/${casa.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: false });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/addresses/${casa.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: true })
      .expect(200);

    expect(respuesta.body.active).toBe(true);
    expect(respuesta.body.isDefault).toBe(true);
  });

  it('reactivar con otra activa predeterminada no la cambia (HU11-E14)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-react-2@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    await entorno
      .http()
      .put(`/api/v1/addresses/${casa.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: false });
    const trabajo = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Trabajo', text: 'Oficina Piso 4' });
    expect(trabajo.body.isDefault).toBe(true);

    const respuesta = await entorno
      .http()
      .put(`/api/v1/addresses/${casa.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: true })
      .expect(200);

    expect(respuesta.body.isDefault).toBe(false);

    const lista = await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(200);
    const predeterminadas = lista.body.items.filter((d: { isDefault: boolean }) => d.isDefault);
    expect(predeterminadas).toHaveLength(1);
    expect(predeterminadas[0].id).toBe(trabajo.body.id);
  });
});
