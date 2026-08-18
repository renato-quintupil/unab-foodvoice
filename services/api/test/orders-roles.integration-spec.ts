/**
 * Matriz de roles en confirmación, aceptación/rechazo y ausencia de edición
 * (HU01-E10–E11, SC-008, RN-001).
 */
import { Role } from '@prisma/client';
import { crearCarrito, crearClasificacionMinima, crearDireccion, crearEntorno, crearPedido, crearProducto, sesionCliente, sesionDeRol, sesionNegocio, type Entorno } from './helpers';

describe('Roles en pedidos', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  const NO_CLIENTES = [Role.NEGOCIO, Role.REPARTIDOR, Role.ADMINISTRADOR];

  it.each(NO_CLIENTES)('%s no puede confirmar un pedido (HU01-E11)', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({ addressText: 'Oficina, Piso 4', expectedLines: [{ productId: '99999999-9999-4999-8999-999999999999', quantity: 1, price: 1 }] })
      .expect(403);
  });

  it.each(NO_CLIENTES)('%s no puede ver GET /orders (RN-001)', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno.http().get('/api/v1/orders').set('Cookie', cookie).expect(403);
  });

  const NO_CLIENTE_NI_NEGOCIO = [Role.CLIENTE, Role.REPARTIDOR, Role.ADMINISTRADOR];

  it.each(NO_CLIENTE_NI_NEGOCIO)('%s no puede aceptar/rechazar (HU01-E10)', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno
      .http()
      .put('/api/v1/business/orders/99999999-9999-4999-8999-999999999999/accept')
      .set('Cookie', cookie)
      .expect(403);
    await entorno
      .http()
      .put('/api/v1/business/orders/99999999-9999-4999-8999-999999999999/reject')
      .set('Cookie', cookie)
      .send({ reason: 'Motivo cualquiera' })
      .expect(403);
  });

  it.each(NO_CLIENTE_NI_NEGOCIO)('%s no puede ver la bandeja del negocio', async (role) => {
    const cookie = await sesionDeRol(entorno, role);
    await entorno.http().get('/api/v1/business/orders').set('Cookie', cookie).expect(403);
  });

  it('el cliente confirma correctamente cuando el flujo completo se ejerce con su rol', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-roles-cliente@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-roles-cliente');
    const producto = await crearProducto({
      name: 'Producto Roles Cliente',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({ addressId: direccion.id, expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }] })
      .expect(201);
  });

  it('el negocio acepta correctamente cuando el flujo completo se ejerce con su rol', async () => {
    const { usuario } = await sesionCliente(entorno, 'orders-roles-negocio-cliente@foodvoice.test');
    const pedido = await crearPedido({ userId: usuario.id });
    const negocio = await sesionNegocio(entorno, 'orders-roles-negocio@foodvoice.test');

    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedido.id}/accept`)
      .set('Cookie', negocio)
      .expect(200);
  });
});
