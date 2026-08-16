/**
 * Ficha de producto del menú (T061, FR-034, FR-017, D-032, SC-020).
 *
 * El corazón de esta batería es que el `404` sea **idéntico** para un producto
 * dado de baja y para un identificador que nunca existió. Cualquier diferencia
 * —otro código, otro mensaje, otro tiempo de respuesta observable en el cuerpo—
 * revelaría que el identificador existe, que es justo lo que FR-028 evita al
 * exigir que un producto retirado no aparezca «ni accediendo directamente a su
 * ficha por su dirección».
 */
import { Role } from '@prisma/client';
import {
  crearClasificacionMinima,
  crearEntorno,
  crearProducto,
  sesionDeRol,
  sesionNegocio,
  type Entorno,
} from './helpers';

const MENU = '/api/v1/menu/products';
const INEXISTENTE = '99999999-9999-4999-8999-999999999999';

describe('GET /menu/products/:id · producto activo (FR-034, FR-017)', () => {
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

  it('devuelve nombre, descripción, precio, estado, clasificación e ingredientes', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Margarita',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      price: 8990,
    });

    const respuesta = await entorno
      .http()
      .get(`${MENU}/${producto.id}`)
      .set('Cookie', sesion)
      .expect(200);

    expect(respuesta.body).toMatchObject({
      id: producto.id,
      name: 'Pizza Margarita',
      description: producto.description,
      ingredients: 'Masa, tomate, mozzarella, albahaca',
      price: 8990,
      status: 'DISPONIBLE',
      foodTypeCategory: { id: foodType.id, name: foodType.name },
      healthProfileCategory: { id: healthProfile.id, name: healthProfile.name },
    });
    // Detalles de almacenamiento que no cruzan la frontera (D-021).
    expect(respuesta.body).not.toHaveProperty('nameNormalized');
    expect(respuesta.body).not.toHaveProperty('updatedAt');
  });

  it('los ingredientes **no declarados** viajan como `null` (FR-017, RN-019)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Sin Detalle',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      ingredients: null,
    });

    const respuesta = await entorno
      .http()
      .get(`${MENU}/${producto.id}`)
      .set('Cookie', sesion)
      .expect(200);

    // `null` y no cadena vacía: la ausencia es un dato, y la advertencia de
    // RN-019 la pone la interfaz sobre él.
    expect(respuesta.body.ingredients).toBeNull();
  });

  it('la descripción viaja **completa**: el recorte es solo presentación (D-033)', async () => {
    const larga = `Preparación al horno de leña con masa madre fermentada durante dos días, ${'salsa de tomates cocidos a fuego lento con albahaca fresca, '.repeat(4)}y aceite de oliva.`;
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Detallada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      description: larga,
    });

    const respuesta = await entorno
      .http()
      .get(`${MENU}/${producto.id}`)
      .set('Cookie', sesion)
      .expect(200);

    expect(respuesta.body.description).toBe(larga);
    expect(respuesta.body.description).not.toContain('…');
  });

  it('los **cuatro roles** consultan la misma ficha (supuesto 12, § Roles de usuario)', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Margarita',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    for (const rol of [Role.CLIENTE, Role.REPARTIDOR, Role.ADMINISTRADOR]) {
      const cookie = await sesionDeRol(entorno, rol);
      const respuesta = await entorno
        .http()
        .get(`${MENU}/${producto.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(respuesta.body.name).toBe('Pizza Margarita');
    }
  });

  it('exige sesión: sin cookie responde `401`', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const producto = await crearProducto({
      name: 'Pizza Margarita',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });

    await entorno.http().get(`${MENU}/${producto.id}`).expect(401);
  });
});

describe('El `404` es idéntico existiendo o no el identificador (D-032, FR-034)', () => {
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

  it('un producto dado de baja y un identificador inexistente responden **lo mismo**', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const baja = await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    const deBaja = await entorno.http().get(`${MENU}/${baja.id}`).set('Cookie', sesion).expect(404);
    const inexistente = await entorno
      .http()
      .get(`${MENU}/${INEXISTENTE}`)
      .set('Cookie', sesion)
      .expect(404);

    expect(deBaja.body).toEqual(inexistente.body);
  });

  it('el mensaje **no revela** que el producto existió ni que fue retirado', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const baja = await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    const respuesta = await entorno
      .http()
      .get(`${MENU}/${baja.id}`)
      .set('Cookie', sesion)
      .expect(404);

    expect(respuesta.body.error.code).toBe('NOT_FOUND');
    expect(respuesta.body.error.message).not.toMatch(/baja|retirad|desactivad|inactiv|elimina/i);
  });

  it('el producto **sigue existiendo** en la administración: el 404 es del menú, no un borrado', async () => {
    const { foodType, healthProfile } = await crearClasificacionMinima();
    const baja = await crearProducto({
      name: 'Pizza Retirada',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
      active: false,
    });

    await entorno.http().get(`${MENU}/${baja.id}`).set('Cookie', sesion).expect(404);

    const administracion = await entorno
      .http()
      .get('/api/v1/business/products?status=DADO_DE_BAJA')
      .set('Cookie', sesion)
      .expect(200);
    expect(administracion.body.items.map((i: { id: string }) => i.id)).toContain(baja.id);
  });
});
