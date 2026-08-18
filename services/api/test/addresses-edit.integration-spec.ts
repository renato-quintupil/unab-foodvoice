/**
 * Editar etiqueta/texto sin alterar flags ni snapshots de pedidos sembrados
 * (HU11-E06, E09, FR-016).
 */
import { crearEntorno, crearPedido, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('PATCH /addresses/:id', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('edita el texto y la lista lo muestra bajo la misma etiqueta (HU11-E06)', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-edit-1@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });

    const respuesta = await entorno
      .http()
      .patch(`/api/v1/addresses/${casa.body.id}`)
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 456' })
      .expect(200);

    expect(respuesta.body.label).toBe('Casa');
    expect(respuesta.body.text).toBe('Los Aromos 456');
  });

  it('editar no altera isDefault ni active', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-edit-2@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    expect(casa.body.isDefault).toBe(true);

    const respuesta = await entorno
      .http()
      .patch(`/api/v1/addresses/${casa.body.id}`)
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Otro texto valido' })
      .expect(200);

    expect(respuesta.body.isDefault).toBe(true);
    expect(respuesta.body.active).toBe(true);
  });

  it('editar una dirección ya usada en un pedido no altera ese pedido (HU11-E09)', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'addr-edit-3@foodvoice.test');
    const casa = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' });
    const pedido = await crearPedido({ userId: usuario.id, addressText: 'Los Aromos 123' });

    await entorno
      .http()
      .patch(`/api/v1/addresses/${casa.body.id}`)
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 456' })
      .expect(200);

    const pedidoTrasEditar = await prisma.order.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(pedidoTrasEditar.addressText).toBe('Los Aromos 123');
  });

  it('404 si la dirección no existe o no es del cliente', async () => {
    const { cookie } = await sesionCliente(entorno, 'addr-edit-4@foodvoice.test');
    await entorno
      .http()
      .patch('/api/v1/addresses/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 123' })
      .expect(404);
  });
});
