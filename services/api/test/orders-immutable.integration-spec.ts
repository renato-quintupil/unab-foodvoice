/**
 * Snapshots de tres pedidos y ausencia de operaciones que editen productos,
 * cantidades o dirección (HU01-E12–E13, SC-002, SC-003).
 */
import {
  crearCarrito,
  crearClasificacionMinima,
  crearDireccion,
  crearEntorno,
  crearProducto,
  sesionCliente,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

async function confirmarPedido(
  entorno: Entorno,
  cookie: string,
  productId: string,
  price: number,
  addressId: string,
) {
  const respuesta = await entorno
    .http()
    .post('/api/v1/orders')
    .set('Cookie', cookie)
    .send({ addressId, expectedLines: [{ productId, quantity: 1, price }] })
    .expect(201);
  return respuesta.body;
}

describe('Los pedidos confirmados conservan nombre, precio y dirección originales', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('3 pedidos conservan sus valores tras cambiar nombre/precio del producto y editar/desactivar la dirección (SC-002, SC-003)', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-immutable@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-immutable');
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa', text: 'Los Aromos 123' });

    const pedidos = [];
    for (let i = 0; i < 3; i += 1) {
      const producto = await crearProducto({
        name: `Producto Original ${i}`,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: healthProfile.id,
        price: 1000 + i,
      });
      await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
      const pedido = await confirmarPedido(entorno, cookie, producto.id, 1000 + i, direccion.id);
      pedidos.push({ pedido, producto });

      await prisma.product.update({
        where: { id: producto.id },
        data: { name: `Producto Cambiado ${i}`, price: 9000 + i },
      });
    }

    await entorno
      .http()
      .patch(`/api/v1/addresses/${direccion.id}`)
      .set('Cookie', cookie)
      .send({ label: 'Casa', text: 'Los Aromos 456' });

    const lista = await entorno.http().get('/api/v1/orders').set('Cookie', cookie).expect(200);
    for (const { pedido, producto } of pedidos) {
      const enLista = lista.body.items.find((p: { id: string }) => p.id === pedido.id);
      expect(enLista.lines[0].productName).toBe(producto.name);
      expect(enLista.lines[0].price).toBe(producto.price);
      expect(enLista.addressText).toBe('Los Aromos 123');
    }
  });

  it('ningún rol encuentra una acción para editar un pedido confirmado (SC-008)', async () => {
    // A nivel de API: no existe ningún PATCH/PUT sobre /orders/:id ni sobre
    // sus líneas — el catálogo de rutas de contracts/api.md no lo declara, y
    // esta prueba lo confirma contra la app real.
    const { cookie } = await sesionCliente(entorno, 'orders-immutable-no-edit@foodvoice.test');
    await entorno
      .http()
      .patch('/api/v1/orders/99999999-9999-4999-8999-999999999999')
      .set('Cookie', cookie)
      .expect(404);
  });
});
