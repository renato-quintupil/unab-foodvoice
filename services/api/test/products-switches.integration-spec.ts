/**
 * Los dos interruptores del producto (T040, HU02-E07, E08, E09, SC-002, SC-003,
 * FR-019, FR-020).
 *
 * `active` y `available` **no son el mismo interruptor** y esta batería lo fija:
 * agotar deja el producto visible y marcado; dar de baja lo retira del menú.
 * Ninguno de los dos borra nada.
 */
import { crearClasificacionMinima, crearEntorno, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('Agotar y reponer (FR-019, HU02-E07, HU02-E08)', () => {
  let entorno: Entorno;
  let negocio: string;
  let productoId: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    const clasificacion = await crearClasificacionMinima();
    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(201);
    productoId = creado.body.id;
  });

  const disponibilidad = (available: boolean) =>
    entorno
      .http()
      .put(`${RUTA}/${productoId}/availability`)
      .set('Cookie', negocio)
      .send({ available });

  it('marcar agotado **conserva `active`** y cambia el estado visible (HU02-E07)', async () => {
    const respuesta = await disponibilidad(false).expect(200);

    expect(respuesta.body.active).toBe(true);
    expect(respuesta.body.available).toBe(false);
    expect(respuesta.body.status).toBe('AGOTADO');
  });

  it('reponer devuelve el producto a disponible (HU02-E08)', async () => {
    await disponibilidad(false).expect(200);
    const respuesta = await disponibilidad(true).expect(200);

    expect(respuesta.body.status).toBe('DISPONIBLE');
  });

  it('el cambio rige para **la consulta siguiente**, sin ningún paso de publicación (SC-003)', async () => {
    await disponibilidad(false).expect(200);
    const listado = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    expect(listado.body.items[0].status).toBe('AGOTADO');
  });

  it('poner el valor que ya tiene es **una petición sin efecto**, no un error (FR-026)', async () => {
    const respuesta = await disponibilidad(true).expect(200);
    expect(respuesta.body.available).toBe(true);
  });

  it('dos peticiones simultáneas de agotar dejan un solo efecto (SC-027)', async () => {
    const respuestas = await Promise.all([disponibilidad(false), disponibilidad(false)]);
    for (const r of respuestas) expect(r.status).toBe(200);

    const guardado = await prisma.product.findUnique({ where: { id: productoId } });
    expect(guardado?.available).toBe(false);
  });

  it('**no comprueba las categorías**: agotar no cambia la clasificación (FR-019)', async () => {
    // Es deliberado: comprobarlas impediría marcar «Agotado» un producto cuya
    // categoría alguien desactivó, que es justo cuando más se necesita.
    const producto = await prisma.product.findUniqueOrThrow({ where: { id: productoId } });
    await prisma.category.update({
      where: { id: producto.foodTypeCategoryId },
      data: { active: false },
    });

    await disponibilidad(false).expect(200);
  });

  it('devuelve 404 para un producto inexistente', async () => {
    await entorno
      .http()
      .put(`${RUTA}/99999999-9999-4999-8999-999999999999/availability`)
      .set('Cookie', negocio)
      .send({ available: false })
      .expect(404);
  });

  it('rechaza un cuerpo sin `available`', async () => {
    await entorno
      .http()
      .put(`${RUTA}/${productoId}/availability`)
      .set('Cookie', negocio)
      .send({})
      .expect(400);
  });
});

describe('Dar de baja y reactivar (FR-020, HU02-E09)', () => {
  let entorno: Entorno;
  let negocio: string;
  let productoId: string;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    const clasificacion = await crearClasificacionMinima();
    const creado = await entorno
      .http()
      .post(RUTA)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        ingredients: 'Masa, tomate, mozzarella',
        price: 8990,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(201);
    productoId = creado.body.id;
  });

  const estado = (active: boolean) =>
    entorno.http().put(`${RUTA}/${productoId}/status`).set('Cookie', negocio).send({ active });

  it('la baja **no elimina** el producto ni sus datos (RN-004, FR-020)', async () => {
    const respuesta = await estado(false).expect(200);

    expect(respuesta.body.active).toBe(false);
    expect(respuesta.body.status).toBe('DADO_DE_BAJA');

    const guardado = await prisma.product.findUnique({ where: { id: productoId } });
    expect(guardado).not.toBeNull();
    expect(guardado?.description).toBe(DESCRIPCION_OK);
    expect(guardado?.ingredients).toBe('Masa, tomate, mozzarella');
    expect(guardado?.price).toBe(8990);
  });

  it('la baja **conserva `available` tal como estaba**', async () => {
    await entorno
      .http()
      .put(`${RUTA}/${productoId}/availability`)
      .set('Cookie', negocio)
      .send({ available: false })
      .expect(200);

    await estado(false).expect(200);
    const guardado = await prisma.product.findUnique({ where: { id: productoId } });
    expect(guardado?.available).toBe(false);
  });

  it('**la reactivación devuelve el producto a disponible**, con sus datos intactos (FR-020)', async () => {
    await entorno
      .http()
      .put(`${RUTA}/${productoId}/availability`)
      .set('Cookie', negocio)
      .send({ available: false })
      .expect(200);
    await estado(false).expect(200);

    const respuesta = await estado(true).expect(200);

    // No hereda un «Agotado» de hace meses: vuelve al menú listo para pedirse.
    expect(respuesta.body.status).toBe('DISPONIBLE');
    expect(respuesta.body.description).toBe(DESCRIPCION_OK);
    expect(respuesta.body.ingredients).toBe('Masa, tomate, mozzarella');
    expect(respuesta.body.price).toBe(8990);
  });

  it('el producto dado de baja **desaparece del listado sin filtros** (FR-023)', async () => {
    await estado(false).expect(200);

    const sinFiltros = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    expect(sinFiltros.body.items).toHaveLength(0);

    const conFiltro = await entorno
      .http()
      .get(`${RUTA}?status=DADO_DE_BAJA`)
      .set('Cookie', negocio)
      .expect(200);
    expect(conFiltro.body.items).toHaveLength(1);
  });

  it('poner el estado que ya tiene no es un error (FR-026)', async () => {
    const respuesta = await estado(true).expect(200);
    expect(respuesta.body.active).toBe(true);
  });

  it('dos bajas simultáneas dejan un solo efecto (SC-027)', async () => {
    const respuestas = await Promise.all([estado(false), estado(false)]);
    for (const r of respuestas) expect(r.status).toBe(200);

    const guardado = await prisma.product.findUnique({ where: { id: productoId } });
    expect(guardado?.active).toBe(false);
  });

  it('**dar de baja no comprueba las categorías**: retirar siempre es posible', async () => {
    const producto = await prisma.product.findUniqueOrThrow({ where: { id: productoId } });
    await prisma.category.update({
      where: { id: producto.foodTypeCategoryId },
      data: { active: false },
    });

    await estado(false).expect(200);
  });

  it('devuelve 404 para un producto inexistente', async () => {
    await entorno
      .http()
      .put(`${RUTA}/99999999-9999-4999-8999-999999999999/status`)
      .set('Cookie', negocio)
      .send({ active: false })
      .expect(404);
  });
});
