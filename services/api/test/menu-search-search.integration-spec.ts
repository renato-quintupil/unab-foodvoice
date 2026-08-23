/**
 * Búsqueda por voz — `intent: 'SEARCH'` (E6, Historia 1). El proveedor real
 * nunca se llama: `entorno.proveedorLlm` es un doble de prueba (D-009).
 */
import {
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionCliente,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

async function sessionIdDe(userId: string): Promise<string> {
  const sesion = await prisma.session.findFirstOrThrow({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return sesion.id;
}

describe('POST /menu/search · intent SEARCH', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('devuelve solo productos activos y disponibles entre los sugeridos por el proveedor', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima('-search-a');
    const napolitana = await crearProducto({
      name: 'Pizza Napolitana Search A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearProducto({
      name: 'Pizza Agotada Search A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      available: false,
    });

    entorno.proveedorLlm.configurarBusqueda(() => ({
      kind: 'RESULTS',
      interpretation: {
        priceTier: null,
        foodTypeCategoryId: foodType.id,
        healthProfileCategoryId: null,
        vegan: null,
        productTerms: [],
        openRecommendation: false,
      },
      productIds: [napolitana.id],
      tokensUsed: 42,
    }));

    const { usuario, cookie } = await sesionCliente(entorno, 'menu-search-a@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'quiero una pizza', channel: 'TEXT' })
      .expect(200);

    expect(respuesta.body.status).toBe('RESULTS');
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0].id).toBe(napolitana.id);

    const log = await prisma.searchLog.findFirst({
      where: { sessionId: await sessionIdDe(usuario.id) },
    });
    expect(log).toMatchObject({ channel: 'TEXT', intent: 'SEARCH', outcome: 'RESULTS' });
    expect(log?.tokensUsed).toBe(42);
  });

  it('descarta cualquier ID que el proveedor sugiera fuera de la proyección enviada (allowlist)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima('-search-b');
    const disponible = await crearProducto({
      name: 'Pizza Real Search B',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    const agotada = await crearProducto({
      name: 'Pizza Fantasma Search B',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      available: false,
    });

    entorno.proveedorLlm.configurarBusqueda(() => ({
      kind: 'RESULTS',
      interpretation: {
        priceTier: null,
        foodTypeCategoryId: null,
        healthProfileCategoryId: null,
        vegan: null,
        productTerms: [],
        openRecommendation: true,
      },
      // `agotada.id` nunca formó parte de la proyección (no es active&&available):
      // un ID inventado o ajeno debe descartarse igual, sin tocar la base fuera
      // de la allowlist.
      productIds: [disponible.id, agotada.id, 'id-inventado-por-el-modelo'],
      tokensUsed: 10,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-search-b@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'sugiéreme algo', channel: 'TEXT' })
      .expect(200);

    expect(respuesta.body.items.map((item: { id: string }) => item.id)).toEqual([disponible.id]);
  });

  it('pide aclaración cuando el proveedor indica ambigüedad', async () => {
    entorno.proveedorLlm.configurarBusqueda(() => ({
      kind: 'CLARIFICATION',
      question: '¿Te refieres a algo saludable o a una porción pequeña?',
      options: ['Saludable', 'Porción pequeña'],
      tokensUsed: 15,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-search-c@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'algo liviano', channel: 'TEXT' })
      .expect(200);

    expect(respuesta.body).toEqual({
      status: 'CLARIFICATION',
      question: '¿Te refieres a algo saludable o a una porción pequeña?',
      options: ['Saludable', 'Porción pequeña'],
    });
  });

  it('comunica NO_RESULTS sin relajar condiciones', async () => {
    entorno.proveedorLlm.configurarBusqueda(() => ({
      kind: 'NO_RESULTS',
      interpretation: {
        priceTier: 'ECONOMICO',
        foodTypeCategoryId: null,
        healthProfileCategoryId: null,
        vegan: null,
        productTerms: ['hamburguesa'],
        openRecommendation: false,
      },
      tokensUsed: 12,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-search-d@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'quiero una hamburguesa barata', channel: 'TEXT' })
      .expect(200);

    expect(respuesta.body.status).toBe('NO_RESULTS');
    expect(respuesta.body.items).toBeUndefined();
  });

  it('rechaza una búsqueda vacía con 400', async () => {
    const { cookie } = await sesionCliente(entorno, 'menu-search-e@foodvoice.test');

    await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: '   ', channel: 'TEXT' })
      .expect(400)
      .expect((respuesta) => {
        expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
      });
  });

  it('rechaza una búsqueda de más de 300 caracteres con 400', async () => {
    const { cookie } = await sesionCliente(entorno, 'menu-search-f@foodvoice.test');

    await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'a'.repeat(301), channel: 'TEXT' })
      .expect(400);
  });

  it('limita a 20 búsquedas cada 5 minutos por sesión (FR-014)', async () => {
    const { cookie } = await sesionCliente(entorno, 'menu-search-g@foodvoice.test');

    for (let i = 0; i < 20; i += 1) {
      await entorno
        .http()
        .post('/api/v1/menu/search')
        .set('Cookie', cookie)
        .send({ query: `búsqueda número ${i}`, channel: 'TEXT' })
        .expect(200);
    }

    await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'búsqueda número 21', channel: 'TEXT' })
      .expect(429)
      .expect((respuesta) => {
        expect(respuesta.body.error.code).toBe('TOO_MANY_REQUESTS');
      });
  }, 30000);
});
