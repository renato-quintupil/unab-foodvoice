/**
 * El carrito persiste sin pérdida al cerrar sesión y volver a iniciar sesión
 * (HU12-E07, FR-011).
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, crearUsuario, iniciarSesion, conSesion, type Entorno } from './helpers';
import { Role } from '@prisma/client';

describe('El carrito sobrevive a cerrar y reabrir sesión', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('conserva productos y cantidades tras un nuevo inicio de sesión', async () => {
    const email = 'cart-persist@foodvoice.test';
    await crearUsuario({ email, role: Role.CLIENTE });
    const primeraCookie = conSesion(await iniciarSesion(entorno, email));

    const { foodType, healthProfile } = await crearClasificacionMinima('cart-persist');
    const producto = await crearProducto({
      name: 'Producto Persistente',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await entorno
      .http()
      .post('/api/v1/cart/lines')
      .set('Cookie', primeraCookie)
      .send({ productId: producto.id });
    await entorno
      .http()
      .patch(`/api/v1/cart/lines/${producto.id}`)
      .set('Cookie', primeraCookie)
      .send({ quantity: 3 });

    // «Cerrar sesión y volver a iniciar sesión» se modela iniciando una
    // segunda sesión del mismo usuario: el carrito es del `userId`, no de la
    // sesión (FR-001), así que sobrevive aunque la cookie cambie.
    const segundaCookie = conSesion(await iniciarSesion(entorno, email));

    const respuesta = await entorno.http().get('/api/v1/cart').set('Cookie', segundaCookie).expect(200);
    expect(respuesta.body.lines).toEqual([
      {
        productId: producto.id,
        productName: 'Producto Persistente',
        price: producto.price,
        quantity: 3,
        available: true,
      },
    ]);
  });
});
