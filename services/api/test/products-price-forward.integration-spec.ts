/**
 * Todo cambio de precio rige hacia adelante (T041, HU02-E13, FR-024, RN-010,
 * SC-023).
 *
 * E3 entrega **su mitad** del contrato hacia E2: el catálogo guarda el precio
 * vigente y **no toca el pasado**. La otra mitad —que el pedido conserve el precio
 * con el que se creó cada línea— se verifica cuando existan los pedidos
 * (§ Entrega por fases), porque en E3 no hay ninguna entidad `Pedido` que
 * consultar.
 *
 * Lo que sí es comprobable hoy, y es lo que esta batería fija: que cambiar un
 * precio **no modifique ninguna otra fila ni ninguna otra columna**, y que no
 * exista ninguna tabla de histórico que E3 escriba.
 */
import { crearClasificacionMinima, crearEntorno, crearProducto, sesionNegocio, type Entorno } from './helpers';
import { prisma } from './setup';

const RUTA = '/api/v1/business/products';
const DESCRIPCION_OK = 'Masa delgada con salsa de tomate, mozzarella fresca y hojas de albahaca.';

describe('Un cambio de precio no reescribe nada (FR-024, SC-023)', () => {
  let entorno: Entorno;
  let negocio: string;
  let clasificacion: Awaited<ReturnType<typeof crearClasificacionMinima>>;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  beforeEach(async () => {
    negocio = await sesionNegocio(entorno);
    clasificacion = await crearClasificacionMinima();
  });

  it('el catálogo pasa a mostrar el precio nuevo (HU02-E13)', async () => {
    const producto = await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: clasificacion.foodType.id,
      healthProfileCategoryId: clasificacion.healthProfile.id,
      price: 5000,
    });

    const respuesta = await entorno
      .http()
      .patch(`${RUTA}/${producto.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 6000,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(200);

    expect(respuesta.body.price).toBe(6000);
  });

  it('**ninguna otra columna del producto cambia**, salvo el precio y `updated_at`', async () => {
    const producto = await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: clasificacion.foodType.id,
      healthProfileCategoryId: clasificacion.healthProfile.id,
      price: 5000,
      available: false,
    });
    const antes = await prisma.product.findUniqueOrThrow({ where: { id: producto.id } });

    await entorno
      .http()
      .patch(`${RUTA}/${producto.id}`)
      .set('Cookie', negocio)
      .send({
        name: antes.name,
        description: antes.description,
        ingredients: antes.ingredients,
        price: 6000,
        foodTypeCategoryId: antes.foodTypeCategoryId,
        healthProfileCategoryId: antes.healthProfileCategoryId,
      })
      .expect(200);

    const despues = await prisma.product.findUniqueOrThrow({ where: { id: producto.id } });

    const { price: _p1, updatedAt: _u1, ...restoAntes } = antes;
    const { price: _p2, updatedAt: _u2, ...restoDespues } = despues;
    expect(restoDespues).toEqual(restoAntes);
    // En particular, el estado de los dos interruptores se respeta: editar el
    // precio de un producto agotado no lo repone.
    expect(despues.available).toBe(false);
    expect(despues.active).toBe(true);
  });

  it('**ninguna otra fila del catálogo cambia** al cambiar un precio', async () => {
    const uno = await crearProducto({
      name: 'Pizza Uno',
      foodTypeCategoryId: clasificacion.foodType.id,
      healthProfileCategoryId: clasificacion.healthProfile.id,
      price: 5000,
    });
    const otro = await crearProducto({
      name: 'Pizza Dos',
      foodTypeCategoryId: clasificacion.foodType.id,
      healthProfileCategoryId: clasificacion.healthProfile.id,
      price: 7000,
    });
    const categoriaAntes = await prisma.category.findUniqueOrThrow({
      where: { id: clasificacion.foodType.id },
    });

    await entorno
      .http()
      .patch(`${RUTA}/${uno.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Uno',
        description: DESCRIPCION_OK,
        price: 9000,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(200);

    const otroDespues = await prisma.product.findUniqueOrThrow({ where: { id: otro.id } });
    expect(otroDespues).toEqual(otro);

    const categoriaDespues = await prisma.category.findUniqueOrThrow({
      where: { id: clasificacion.foodType.id },
    });
    expect(categoriaDespues).toEqual(categoriaAntes);
  });

  it('**no existe ninguna tabla de histórico de precios** que E3 escriba', async () => {
    // El historial de cambios del catálogo está declarado fuera de alcance: quién
    // cambió qué precio y cuándo no se registra en v1.
    const tablas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const nombres = tablas.map((t) => t.table_name);

    expect(nombres.sort()).toEqual(
      [
        '_prisma_migrations',
        // E6 · Búsqueda por voz: aptitudes dietéticas y bitácora de búsquedas
        // (data-model.md de 006-busqueda-por-voz), ninguna de las dos es un
        // histórico de precios.
        '_productDietaryTags',
        'address',
        'admin_audit_log',
        'cart',
        'cart_line',
        'category',
        'dietary_tag',
        'login_attempt_control',
        'order',
        'order_line',
        'order_status_event',
        'product',
        'search_log',
        'session',
        'user',
      ].sort(),
    );
    expect(nombres.filter((n) => n.includes('price'))).toHaveLength(0);
    expect(nombres.filter((n) => n.includes('history') || n.includes('historial'))).toHaveLength(0);
  });

  it('**la bitácora de E1 no crece** con las acciones del catálogo (fuera de alcance)', async () => {
    const producto = await crearProducto({
      name: 'Pizza Napolitana',
      foodTypeCategoryId: clasificacion.foodType.id,
      healthProfileCategoryId: clasificacion.healthProfile.id,
      price: 5000,
    });

    await entorno
      .http()
      .patch(`${RUTA}/${producto.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Napolitana',
        description: DESCRIPCION_OK,
        price: 6000,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(200);

    // `admin_audit_log` cubre solo las acciones administrativas sobre usuarios y
    // no se amplía en esta épica.
    expect(await prisma.adminAuditLog.count()).toBe(0);
  });

  it('el cambio de precio **recalcula los tramos por sí solo** (FR-032, SC-016)', async () => {
    // Es la otra cara de que el tramo no se persista: nadie tiene que editar los
    // demás productos para que su tramo siga siendo correcto.
    for (const [nombre, precio] of [
      ['Pizza Barata', 2000],
      ['Pizza Media', 5000],
      ['Pizza Cara', 12000],
    ] as const) {
      await crearProducto({
        name: nombre,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
        price: precio,
      });
    }

    const antes = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    const mediaAntes = antes.body.items.find((p: { name: string }) => p.name === 'Pizza Media');
    expect(mediaAntes.priceTier).toBe('MEDIO');

    // Se abarata la cara: ahora «Pizza Media» pasa a ser la más cara.
    const cara = antes.body.items.find((p: { name: string }) => p.name === 'Pizza Cara');
    await entorno
      .http()
      .patch(`${RUTA}/${cara.id}`)
      .set('Cookie', negocio)
      .send({
        name: 'Pizza Cara',
        description: DESCRIPCION_OK,
        price: 2500,
        foodTypeCategoryId: clasificacion.foodType.id,
        healthProfileCategoryId: clasificacion.healthProfile.id,
      })
      .expect(200);

    const despues = await entorno.http().get(RUTA).set('Cookie', negocio).expect(200);
    const mediaDespues = despues.body.items.find((p: { name: string }) => p.name === 'Pizza Media');
    expect(mediaDespues.priceTier).toBe('CARO');
    // Y su fila no se tocó: solo cambió el tramo derivado.
    expect(mediaDespues.price).toBe(5000);
  });
});
