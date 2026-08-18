/**
 * Alta de direcciones (HU11-E01, E02, E04, FR-012, FR-013, FR-015).
 */
import { crearEntorno, sesionCliente, type Entorno } from './helpers';

describe('POST /addresses', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('la primera dirección queda guardada y predeterminada automáticamente (HU11-E01)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-create-1@foodvoice.test');
    const respuesta = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123, depto 4B' })
      .expect(201);

    expect(respuesta.body.isDefault).toBe(true);
    expect(respuesta.body.active).toBe(true);
  });

  it('una segunda dirección no es predeterminada y ambas aparecen en la lista (HU11-E02)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-create-2@foodvoice.test');
    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    const segunda = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Departamento de mi papá', text: 'Otra calle 456' })
      .expect(201);

    expect(segunda.body.isDefault).toBe(false);

    const lista = await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(200);
    expect(lista.body.items).toHaveLength(2);
  });

  it('rechaza etiqueta vacía y texto vacío, asociados al campo (HU11-E04)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-create-3@foodvoice.test');
    const sinEtiqueta = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: '', text: 'Los Aromos 123' })
      .expect(400);
    expect(sinEtiqueta.body.error.code).toBe('VALIDATION_ERROR');

    await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: '   ' })
      .expect(400);
  });
});
