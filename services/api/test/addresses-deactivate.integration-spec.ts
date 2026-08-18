/**
 * Desactivar direcciones (HU11-E11–E12, FR-018, FR-020).
 */
import { crearEntorno, sesionCliente, type Entorno } from './helpers';

describe('PUT /addresses/:id/status → active: false', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('impide retirar la predeterminada si hay otra activa (HU11-E11, FR-020)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-deact-1@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Trabajo', text: 'Oficina Piso 4' });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/addresses/${casa.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(409);

    expect(respuesta.body.error.code).toBe('ADDRESS_NEEDS_NEW_DEFAULT');
  });

  it('permite desactivar la última dirección activa (HU11-E12)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-deact-2@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });

    const respuesta = await entorno
      .http()
      .put(`/api/v1/addresses/${casa.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);

    expect(respuesta.body.active).toBe(false);
    expect(respuesta.body.isDefault).toBe(false);
  });

  it('desactivar una no predeterminada, con otra activa, no exige elegir nueva predeterminada', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-deact-3@foodvoice.test');
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    const trabajo = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Trabajo', text: 'Oficina Piso 4' });

    await entorno
      .http()
      .put(`/api/v1/addresses/${trabajo.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(200);
  });
});
