/**
 * Agregar al carrito por voz — `intent: 'ADD'` (E6, Historia 2). Nunca debe
 * escribir en `cart` ni `cart_line`: solo resuelve producto y cantidad
 * (D-063). El proveedor real nunca se llama (D-009).
 */
import {
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionCliente,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

describe('POST /menu/search · intent ADD', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('resuelve un único producto con cantidad 1 por omisión (FR-024)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima('-add-a');
    const napolitana = await crearProducto({
      name: 'Pizza Napolitana Add A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    entorno.proveedorLlm.configurarAgregado(() => ({
      kind: 'RESOLVED',
      productId: napolitana.id,
      quantity: 1,
      tokensUsed: 20,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-add-a@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'agrégame una napolitana', channel: 'VOICE', intent: 'ADD' })
      .expect(200);

    expect(respuesta.body).toMatchObject({
      status: 'RESOLVED',
      quantity: 1,
      item: { id: napolitana.id },
    });

    // Ninguna llamada a este endpoint agrega nada al carrito (FR-008, D-063).
    const carrito = await prisma.cart.findMany();
    const lineas = await prisma.cartLine.findMany();
    expect(carrito).toHaveLength(0);
    expect(lineas).toHaveLength(0);
  });

  it('pide aclaración cuando hay más de un producto candidato razonable', async () => {
    entorno.proveedorLlm.configurarAgregado(() => ({
      kind: 'CLARIFICATION',
      question: '¿Cuál de estas pizzas?',
      options: ['Napolitana', 'Margarita'],
      tokensUsed: 18,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-add-b@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'agrégame una pizza', channel: 'VOICE', intent: 'ADD' })
      .expect(200);

    expect(respuesta.body).toEqual({
      status: 'CLARIFICATION',
      question: '¿Cuál de estas pizzas?',
      options: ['Napolitana', 'Margarita'],
    });
  });

  it('responde NOT_FOUND cuando ningún candidato existe', async () => {
    entorno.proveedorLlm.configurarAgregado(() => ({ kind: 'NOT_FOUND', tokensUsed: 5 }));

    const { cookie } = await sesionCliente(entorno, 'menu-add-c@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'agrégame una hamburguesa', channel: 'VOICE', intent: 'ADD' })
      .expect(200);

    expect(respuesta.body).toEqual({ status: 'NOT_FOUND' });
  });

  it('responde NOT_FOUND si el producto que el proveedor sugirió se agotó antes de responder (FR-021)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima('-add-d');
    const agotada = await crearProducto({
      name: 'Pizza Agotada Add D',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      available: false,
    });

    entorno.proveedorLlm.configurarAgregado(() => ({
      kind: 'RESOLVED',
      productId: agotada.id,
      quantity: 1,
      tokensUsed: 8,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-add-d@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'agrégame esa pizza', channel: 'VOICE', intent: 'ADD' })
      .expect(200);

    // El producto no formaba parte de la proyección permitida (no estaba
    // active && available), así que ya se descarta por allowlist (D-062).
    expect(respuesta.body).toEqual({ status: 'NOT_FOUND' });
  });
});
