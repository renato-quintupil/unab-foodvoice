/**
 * Unicidad normalizada de etiqueta, entre activas y desactivadas (HU11-E03, FR-014).
 */
import { crearEntorno, sesionCliente, type Entorno } from './helpers';

describe('Unicidad de etiqueta (FR-014)', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('rechaza «casa» cuando ya existe «Casa» (HU11-E03)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-unique-1@foodvoice.test');
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });

    const respuesta = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'casa', text: 'Otra dirección' })
      .expect(409);

    expect(respuesta.body.error.code).toBe('ADDRESS_LABEL_ALREADY_EXISTS');
    expect(respuesta.body.error.fields).toHaveProperty('label');
  });

  it('pliega tildes y espacios: «Trabajo» y «  trabajo  » colisionan', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-unique-2@foodvoice.test');
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Trabajo', text: 'Oficina Piso 4' });

    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: '  trabajo  ', text: 'Otra oficina' })
      .expect(409);
  });

  it('la unicidad alcanza a una etiqueta desactivada', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-unique-3@foodvoice.test');
    const primera = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    await entorno
      .http()
      .put(`/api/v1/addresses/${primera.body.id}/status`)
      .set('Cookie', cookie)
      .send({ active: false });

    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'casa', text: 'Otra dirección' })
      .expect(409);
  });

  it('permite la misma etiqueta entre dos clientes distintos', async () => {
    const { cookie: cookieA } = await sesionCliente(entorno, 'addr-unique-a@foodvoice.test');
    const { cookie: cookieB } = await sesionCliente(entorno, 'addr-unique-b@foodvoice.test');
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookieA)
      .send({ label: 'Casa', text: 'Los Aromos 123' })
      .expect(201);
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookieB)
      .send({ label: 'Casa', text: 'Otra calle 456' })
      .expect(201);
  });

  it('editar a una etiqueta que colisiona se rechaza (FR-016)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-unique-edit@foodvoice.test');
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

    const respuesta = await entorno
      .http()
      .patch(`/api/v1/addresses/${trabajo.body.id}`)
      .set('Cookie', cookie)
      .send({ label: 'casa', text: 'Oficina Piso 4' })
      .expect(409);

    expect(respuesta.body.error.code).toBe('ADDRESS_LABEL_ALREADY_EXISTS');
  });
});
