/**
 * Aptitud dietética "Vegano" (E6, Historia 3, FR-012, FR-013). El filtro real
 * es `dietaryTags`, nunca una heurística sobre `ingredients` — ni el proveedor
 * ni el servidor pueden inferirlo (D-059, Clarifications de spec.md).
 */
import {
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionCliente,
  type Entorno,
} from './helpers';

describe('POST /menu/search · aptitud vegana', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('solo devuelve productos marcados como veganos, nunca uno sin la marca aunque no declare ingredientes de origen animal', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima('-vegan-a');
    const vegano = await crearProducto({
      name: 'Ensalada Vegana A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      dietaryTags: ['Vegano'],
    });
    const noMarcado = await crearProducto({
      name: 'Ensalada Sin Marcar A',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      // Sin ingredientes de origen animal declarados, pero nunca marcada —
      // la ausencia de marca no debe interpretarse como "sí es apta" (RN-013).
      ingredients: 'Lechuga, tomate, palta',
    });

    entorno.proveedorLlm.configurarBusqueda(() => ({
      kind: 'RESULTS',
      interpretation: {
        priceTier: null,
        foodTypeCategoryId: null,
        healthProfileCategoryId: null,
        vegan: true,
        productTerms: [],
        openRecommendation: false,
      },
      // El modelo podría, por error, sugerir ambos; el servidor filtra igual.
      productIds: [vegano.id, noMarcado.id],
      tokensUsed: 25,
    }));

    const { cookie } = await sesionCliente(entorno, 'menu-vegan-a@foodvoice.test');

    const respuesta = await entorno
      .http()
      .post('/api/v1/menu/search')
      .set('Cookie', cookie)
      .send({ query: 'quiero algo para vegano', channel: 'TEXT' })
      .expect(200);

    expect(respuesta.body.status).toBe('RESULTS');
    expect(respuesta.body.items.map((item: { id: string }) => item.id)).toEqual([vegano.id]);
    expect(
      respuesta.body.items[0].dietaryTags,
    ).toEqual(['Vegano']);
  });
});
