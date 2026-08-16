/**
 * Un producto no ofrecible **no sale por ninguna vía** (T060, FR-028, FR-029,
 * RN-018, RN-003, HU02-E10, HU14-E16, SC-004, SC-005).
 *
 * RN-018 es una propiedad de la **consulta**, no de la pantalla: por eso se
 * verifica agotando todas las vías —listado, cada filtro, cada tramo y la ficha
 * directa— en lugar de comprobar una sola. Si la regla viviera en la interfaz,
 * bastaría una ruta nueva —la voz de E6, por ejemplo— para saltársela.
 *
 * Y el contrapunto: un producto **agotado sí sale**, marcado (FR-029, RN-003).
 * Ocultarlo sería el error opuesto y haría que el cliente creyera que el local
 * dejó de ofrecerlo.
 */
import { Dimension } from '@prisma/client';
import { crearCategoria, crearEntorno, crearProducto, sesionNegocio, type Entorno } from './helpers';

const MENU = '/api/v1/menu/products';

describe('Un producto dado de baja no sale por ninguna vía (RN-018, SC-005)', () => {
  let entorno: Entorno;
  let sesion: string;
  let pizzas: string;
  let saludable: string;
  let bajaId: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);
    pizzas = (await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' })).id;
    saludable = (await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable' })).id;

    // Tres activos para que haya tramos, y uno dado de baja al que se intentará
    // llegar por todas partes.
    for (const [i, price] of [1000, 5000, 9000].entries()) {
      await crearProducto({
        name: `Producto ${i}`,
        foodTypeCategoryId: pizzas,
        healthProfileCategoryId: saludable,
        price,
      });
    }
    bajaId = (
      await crearProducto({
        name: 'Pizza Retirada',
        foodTypeCategoryId: pizzas,
        healthProfileCategoryId: saludable,
        price: 5000,
        active: false,
      })
    ).id;
  });

  const nombres = async (consulta = ''): Promise<string[]> => {
    const respuesta = await entorno
      .http()
      .get(`${MENU}${consulta}`)
      .set('Cookie', sesion)
      .expect(200);
    return respuesta.body.items.map((i: { name: string }) => i.name);
  };

  it('no está en el listado sin filtros', async () => {
    expect(await nombres()).not.toContain('Pizza Retirada');
  });

  it('no está filtrando por **su** categoría de tipo de comida', async () => {
    expect(await nombres(`?foodTypeCategoryId=${pizzas}`)).not.toContain('Pizza Retirada');
  });

  it('no está filtrando por **su** categoría de perfil de salud', async () => {
    expect(await nombres(`?healthProfileCategoryId=${saludable}`)).not.toContain('Pizza Retirada');
  });

  it('no está en **ninguno** de los tres tramos', async () => {
    for (const tramo of ['ECONOMICO', 'MEDIO', 'CARO']) {
      expect(await nombres(`?priceTier=${tramo}`)).not.toContain('Pizza Retirada');
    }
  });

  it('no está accediendo **directamente a su ficha** (FR-028, D-032)', async () => {
    await entorno.http().get(`${MENU}/${bajaId}`).set('Cookie', sesion).expect(404);
  });

  it('**no cuenta para los tramos**: no forma parte del catálogo vigente', async () => {
    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    // Quedan 1000, 5000 y 9000 activos; si el retirado contara, los cortes serían
    // otros.
    expect(respuesta.body.priceTiers).toEqual({ c1: 1000, c2: 5000 });
  });
});

describe('Un producto agotado **sí** sale, marcado (FR-029, RN-003, SC-004)', () => {
  let entorno: Entorno;
  let sesion: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);
  });

  const sembrarAgotado = async () => {
    const pizzas = (await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas' })).id;
    const saludable = (await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable' }))
      .id;
    return crearProducto({
      name: 'Pizza Agotada',
      foodTypeCategoryId: pizzas,
      healthProfileCategoryId: saludable,
      available: false,
    });
  };

  it('aparece en el menú con `status: AGOTADO` (HU02-E10, HU14-E16)', async () => {
    await sembrarAgotado();

    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    expect(respuesta.body.items).toHaveLength(1);
    expect(respuesta.body.items[0]).toMatchObject({
      name: 'Pizza Agotada',
      active: true,
      available: false,
      status: 'AGOTADO',
    });
  });

  it('su ficha se consulta con normalidad: agotado no es retirado', async () => {
    const producto = await sembrarAgotado();

    const respuesta = await entorno
      .http()
      .get(`${MENU}/${producto.id}`)
      .set('Cookie', sesion)
      .expect(200);
    expect(respuesta.body.status).toBe('AGOTADO');
  });

  it('**ninguna respuesta ofrece acción alguna para pedirlo**: el DTO no la lleva', async () => {
    await sembrarAgotado();

    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    const claves = Object.keys(respuesta.body.items[0]).join(' ');
    expect(claves).not.toMatch(/pedir|order|addToCart|carrito/i);
  });
});

describe('Un producto con categoría desactivada sigue el estado que tiene (RN-009)', () => {
  let entorno: Entorno;
  let sesion: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    sesion = await sesionNegocio(entorno);
  });

  it('la categoría desactivada no se ofrece, pero el menú **no** se queda sin sus productos activos', async () => {
    // Solo puede ocurrir con un producto dado de baja: FR-007 impide desactivar
    // una categoría de la que dependa un producto activo. Es la comprobación de
    // que las dos reglas no se contradicen entre sí.
    const pizzas = (
      await crearCategoria({ dimension: Dimension.TIPO_COMIDA, name: 'Pizzas', active: false })
    ).id;
    const saludable = (await crearCategoria({ dimension: Dimension.PERFIL_SALUD, name: 'Saludable' }))
      .id;
    await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: pizzas,
      healthProfileCategoryId: saludable,
      active: false,
    });

    const respuesta = await entorno.http().get(MENU).set('Cookie', sesion).expect(200);
    expect(respuesta.body.items).toHaveLength(0);
  });
});
