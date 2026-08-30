/**
 * `GET /admin/service/status`, `PUT /admin/service/pause`,
 * `PUT /admin/service/resume` (E8, HU-07 Historia 3, FR-009 a FR-013).
 */
import { AdminAction, Role } from '@prisma/client';
import {
  crearCarrito,
  crearEntorno,
  crearPedido,
  crearProducto,
  crearClasificacionMinima,
  sesionCliente,
  sesionDeRol,
  sesionNegocio,
  sesionRepartidor,
  type Entorno,
} from './helpers';
import { prisma } from './setup';

const MOTIVO = 'Corte de luz en el local.';

describe('Pausar y reanudar el servicio', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('GET /admin/service/status devuelve paused: false por defecto', async () => {
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    const respuesta = await entorno.http().get('/api/v1/admin/service/status').set('Cookie', admin).expect(200);
    expect(respuesta.body).toEqual({ paused: false, reason: null, pausedAt: null });
  });

  it('PUT /admin/service/pause deja paused: true con el motivo y registra la bitácora', async () => {
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);

    const respuesta = await entorno
      .http()
      .put('/api/v1/admin/service/pause')
      .set('Cookie', admin)
      .send({ reason: MOTIVO })
      .expect(200);
    expect(respuesta.body.paused).toBe(true);
    expect(respuesta.body.reason).toBe(MOTIVO);

    const entrada = await prisma.adminAuditLog.findFirst({
      where: { action: AdminAction.PAUSAR_SERVICIO },
    });
    expect(entrada?.reason).toBe(MOTIVO);
    expect(entrada?.targetUserId).toBeNull();
  });

  it('POST /orders responde 409 SERVICE_PAUSED mientras está pausado, sin alterar el carrito', async () => {
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().put('/api/v1/admin/service/pause').set('Cookie', admin).send({ reason: MOTIVO }).expect(200);

    const { usuario: cliente, cookie } = await sesionCliente(entorno, 'pausa-cliente@foodvoice.test');
    const { foodType, healthProfile } = await crearClasificacionMinima('-pausa');
    const producto = await crearProducto({
      name: 'Producto de prueba de pausa',
      foodTypeCategoryId: foodType.id,
      healthProfileCategoryId: healthProfile.id,
    });
    await crearCarrito(cliente.id, [{ productId: producto.id, quantity: 1 }]);

    const respuesta = await entorno
      .http()
      .post('/api/v1/orders')
      .set('Cookie', cookie)
      .send({
        addressText: 'Los Aromos 123, depto 4B',
        expectedLines: [{ productId: producto.id, quantity: 1, price: producto.price }],
      })
      .expect(409);
    expect(respuesta.body.error.code).toBe('SERVICE_PAUSED');

    const lineasCarrito = await prisma.cartLine.findMany({ where: { cart: { userId: cliente.id } } });
    expect(lineasCarrito).toHaveLength(1);
  });

  it('los pedidos ya en curso siguen operables con normalidad mientras el servicio está pausado (FR-011)', async () => {
    const { usuario: cliente } = await sesionCliente(entorno, 'pausa-en-curso-cliente@foodvoice.test');
    const negocio = await sesionNegocio(entorno, 'pausa-en-curso-negocio@foodvoice.test');
    const pedidoPendiente = await crearPedido({ userId: cliente.id });
    const pedidoDisponible = await crearPedido({ userId: cliente.id, status: 'en_preparacion' });

    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().put('/api/v1/admin/service/pause').set('Cookie', admin).send({ reason: MOTIVO }).expect(200);

    // El negocio sigue aceptando pedidos que ya estaban en creado.
    await entorno
      .http()
      .put(`/api/v1/business/orders/${pedidoPendiente.id}/accept`)
      .set('Cookie', negocio)
      .expect(200);

    // El repartidor sigue tomando pedidos que ya estaban en_preparacion.
    const { cookie: cookieRepartidor } = await sesionRepartidor(entorno, 'pausa-en-curso-repartidor@foodvoice.test');
    await entorno
      .http()
      .put(`/api/v1/delivery/orders/${pedidoDisponible.id}/take`)
      .set('Cookie', cookieRepartidor)
      .expect(200);
  });

  it('PUT /admin/service/resume restablece paused: false sin exigir motivo y registra la bitácora', async () => {
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().put('/api/v1/admin/service/pause').set('Cookie', admin).send({ reason: MOTIVO }).expect(200);

    const respuesta = await entorno.http().put('/api/v1/admin/service/resume').set('Cookie', admin).expect(200);
    expect(respuesta.body).toEqual({ paused: false, reason: null, pausedAt: null });

    const entrada = await prisma.adminAuditLog.findFirst({
      where: { action: AdminAction.REANUDAR_SERVICIO },
    });
    expect(entrada?.reason).toBeNull();
  });

  it('400 VALIDATION_ERROR al pausar sin motivo', async () => {
    const admin = await sesionDeRol(entorno, Role.ADMINISTRADOR);
    await entorno.http().put('/api/v1/admin/service/pause').set('Cookie', admin).send({ reason: '   ' }).expect(400);
  });

  it('403 FORBIDDEN con sesión distinta de ADMINISTRADOR en las tres rutas', async () => {
    const { cookie } = await sesionCliente(entorno, 'pausa-403-cliente@foodvoice.test');

    await entorno.http().get('/api/v1/admin/service/status').set('Cookie', cookie).expect(403);
    await entorno
      .http()
      .put('/api/v1/admin/service/pause')
      .set('Cookie', cookie)
      .send({ reason: MOTIVO })
      .expect(403);
    await entorno.http().put('/api/v1/admin/service/resume').set('Cookie', cookie).expect(403);
  });
});
