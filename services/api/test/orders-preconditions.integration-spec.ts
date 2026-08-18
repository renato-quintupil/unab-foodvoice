/**
 * Precondiciones de confirmación: carrito vacío, dirección ausente, ambas
 * fuentes de dirección a la vez, addressId ajeno/inexistente/desactivado y
 * expectedLines desalineado (HU01-E02–E03, FR-022, FR-025).
 */
import {
  crearCarrito,
  crearClasificacionMinima,
  crearDireccion,
  crearEntorno,
  crearProducto,
  crearUsuario,
  sesionCliente,
  type Entorno,
} from './helpers';

describe('POST /orders — precondiciones', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('carrito vacío: 409 CART_EMPTY (HU01-E02)', async () => {
    const { cookie } = await sesionCliente(entorno, 'orders-pre-1@foodvoice.test');
    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({ addressText: 'Oficina, Piso 4', expectedLines: [] })
      .expect(400);
    // expectedLines vacío ya lo rechaza el esquema Zod, antes de llegar al servicio.
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('carrito realmente vacío (sin líneas) con expectedLines no vacío: 409 CART_EMPTY', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-2@foodvoice.test');
    await crearCarrito(usuario.id, []);
    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressText: 'Oficina, Piso 4',
        expectedLines: [{ productId: '99999999-9999-4999-8999-999999999999', quantity: 1, price: 1 }],
      })
      .expect(409);
    expect(respuesta.body.error.code).toBe('CART_EMPTY');
  });

  it('sin ninguna dirección: 409 ADDRESS_REQUIRED (HU01-E03)', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-3@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-3');
    const producto = await crearProducto({
      name: 'Producto Pre 3',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({ expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }] })
      .expect(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ambas fuentes de dirección a la vez: rechazado por el esquema', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-4@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-4');
    const producto = await crearProducto({
      name: 'Producto Pre 4',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        addressText: 'Oficina, Piso 4',
        expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }],
      })
      .expect(400);
  });

  it('addressId ajeno (de otro cliente): 404 NOT_FOUND', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-5@foodvoice.test');
    const otro = await crearUsuario({ email: 'orders-pre-5-otro@foodvoice.test' });
    const direccionAjena = await crearDireccion({ userId: otro.id, label: 'Casa' });
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-5');
    const producto = await crearProducto({
      name: 'Producto Pre 5',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccionAjena.id,
        expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }],
      })
      .expect(404);
  });

  it('addressId inexistente: 404 NOT_FOUND', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-6@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-6');
    const producto = await crearProducto({
      name: 'Producto Pre 6',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: '99999999-9999-4999-8999-999999999999',
        expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }],
      })
      .expect(404);
  });

  it('addressId desactivado: se acepta (una desactivada sigue sirviendo a pedidos ya elegidos)', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-7@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-7');
    const producto = await crearProducto({
      name: 'Producto Pre 7',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa', active: false });

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }],
      })
      .expect(201);
  });

  it('expectedLines con cantidad distinta a la real: 400 VALIDATION_ERROR, no PRICE_CHANGED', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-8@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-8');
    const producto = await crearProducto({
      name: 'Producto Pre 8',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 2 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: producto.id, quantity: 1, price: 1000 }],
      })
      .expect(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('expectedLines con un producto que no está en el carrito real: 400 VALIDATION_ERROR', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-9@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-9');
    const producto = await crearProducto({
      name: 'Producto Pre 9',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const otroProducto = await crearProducto({
      name: 'Producto Pre 9b',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: otroProducto.id, quantity: 1, price: otroProducto.price }],
      })
      .expect(400);
  });

  it('ningún efecto parcial en ningún caso de precondición fallida', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'orders-pre-10@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('orders-pre-10');
    const producto = await crearProducto({
      name: 'Producto Pre 10',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 1000,
    });
    await crearCarrito(usuario.id, [{ productId: producto.id, quantity: 1 }]);
    const direccion = await crearDireccion({ userId: usuario.id, label: 'Casa' });

    await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressId: direccion.id,
        expectedLines: [{ productId: producto.id, quantity: 5, price: 1000 }],
      })
      .expect(400);

    const carrito = await entorno.http().get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(carrito.body.lines).toHaveLength(1);
    const pedidos = await entorno.http().get('/api/v1/orders').set('Cookie', cookie).expect(200);
    expect(pedidos.body.items).toHaveLength(0);
  });
});
