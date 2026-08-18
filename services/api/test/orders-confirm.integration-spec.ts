/**
 * Confirmación con dirección guardada o puntual, snapshots, vaciado de
 * carrito y marca `usedInOrder` (HU01-E01, HU11-E07, E10, FR-025–FR-027).
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

describe('POST /orders', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('confirma con dirección guardada: crea el pedido en creado y vacía el carrito (HU01-E01)', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-confirm-1@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-confirm-1');
    const producto = await crearProducto({
      name: 'Producto Confirm 1',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 4990,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 2 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa', text: 'Los Aromos 123' });

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: producto.id, quantity: 2, price: 4990 }],
      })
      .expect(201);

    expect(respuesta.body.status).toBe('creado');
    expect(respuesta.body.addressText).toBe('Los Aromos 123');
    expect(respuesta.body.lines).toEqual([
      { productId: producto.id, productName: 'Producto Confirm 1', price: 4990, quantity: 2 },
    ]);

    const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(carrito.body.lines).toEqual([]);

    const direccionTrasConfirmar = await prisma.address.findUniqueOrThrow({
      where: { id: direccion.id },
    });
    expect(direccionTrasConfirmar.usedInOrder).toBe(true);
  });

  it('confirma con dirección puntual sin guardarla en la lista (FR-017)', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-confirm-2@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-confirm-2');
    const producto = await crearProducto({
      name: 'Producto Confirm 2',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 3000,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressText: 'Oficina, Piso 4',
        expectedLines: [{ productId: producto.id, quantity: 1, price: 3000 }],
      })
      .expect(201);

    expect(respuesta.body.addressText).toBe('Oficina, Piso 4');

    const direcciones = await entorno.http().get('/api/v1/addresses').set('Cookie', cookie).expect(200);
    expect(direcciones.body.items).toHaveLength(0);
  });
});
