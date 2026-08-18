/**
 * Eliminar direcciones (FR-019, D-039, D-049).
 */
import { crearEntorno, crearPedido, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('DELETE /addresses/:id', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('borra sin dejar rastro una dirección que nunca se usó', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-delete-1@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });

    await entorno.http().delete(`/api/v1/addresses/${casa.body.id}`).set('Cookie', cookie).expect(204);

    const lista = await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(200);
    expect(lista.body.items).toHaveLength(0);
  });

  it('impide borrar una dirección ya usada en un pedido', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'addr-delete-2@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });

    // Simula el efecto de confirmar un pedido con esta dirección (D-039): en
    // producción lo marca `OrdersService`; aquí se sella directo para no
    // depender de que HU-01 (Fase 5) ya exista.
    await prisma.address.update({ where: { id: casa.body.id }, data: { usedInOrder: true } });
    await crearPedido({ userId: usuario.id, addressText: 'Los Aromos 123' });

    const respuesta = await entorno
      .http()
      .delete(`/api/v1/addresses/${casa.body.id}`)
      .set('Cookie', cookie)
      .expect(409);
    expect(respuesta.body.error.code).toBe('ADDRESS_IN_USE');
  });

  it('no deja sin predeterminada si quedan activas: eliminar una no predeterminada no afecta a la otra', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-delete-3@foodvoice.test');
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

    await entorno
      .http()
      .delete(`/api/v1/addresses/${trabajo.body.id}`)
      .set('Cookie', cookie)
      .expect(204);

    const lista = await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(200);
    expect(lista.body.items).toHaveLength(1);
    expect(lista.body.items[0].id).toBe(casa.body.id);
    expect(lista.body.items[0].isDefault).toBe(true);
  });

  it('404 si la dirección no existe o no es del cliente', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-delete-4@foodvoice.test');
    await entorno
      .http()
      .delete('/api/v1/addresses/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(404);
  });
});
