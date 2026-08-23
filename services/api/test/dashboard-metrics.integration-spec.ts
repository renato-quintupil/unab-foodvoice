/**
 * Métricas del panel (T106, FR-019, FR-023, D-012, data CHK030).
 */
import { Role, UserStatus } from '@prisma/client';
import { OrderStatus } from '@foodvoice/shared';
import {
  conSesion,
  crearEntorno,
  crearPedido,
  crearUsuario,
  iniciarSesion,
  type Entorno,
} from './helpers';

let entorno: Entorno;
let sesionAdmin: string;

beforeAll(async () => {
  entorno = await crearEntorno();
});

beforeEach(async () => {
  await crearUsuario({
    fullName: 'Admin Uno',
    email: 'admin@ejemplo.cl',
    role: Role.ADMINISTRADOR,
  });
  sesionAdmin = await iniciarSesion(entorno, 'admin@ejemplo.cl');
});

afterAll(async () => {
  await entorno.app.close();
});

function metricas() {
  return entorno
    .http()
    .get('/api/v1/admin/dashboard/metrics')
    .set('Cookie', conSesion(sesionAdmin));
}

describe('Usuarios activos por rol (FR-019)', () => {
  it('el conteo coincide con el padrón', async () => {
    await crearUsuario({ email: 'c1@ejemplo.cl', role: Role.CLIENTE });
    await crearUsuario({ email: 'c2@ejemplo.cl', role: Role.CLIENTE });
    await crearUsuario({ email: 'n1@ejemplo.cl', role: Role.NEGOCIO });

    const respuesta = await metricas().expect(200);

    expect(respuesta.body.activeUsersByRole).toEqual({
      [Role.CLIENTE]: 2,
      [Role.NEGOCIO]: 1,
      [Role.REPARTIDOR]: 0,
      [Role.ADMINISTRADOR]: 1,
    });
  });

  it('cuenta solo los ACTIVOS: los desactivados no suman', async () => {
    await crearUsuario({ email: 'c1@ejemplo.cl', role: Role.CLIENTE });
    await crearUsuario({
      email: 'c2@ejemplo.cl',
      role: Role.CLIENTE,
      status: UserStatus.DESACTIVADO,
    });

    const respuesta = await metricas().expect(200);
    expect(respuesta.body.activeUsersByRole[Role.CLIENTE]).toBe(1);
  });

  it('un rol SIN NINGÚN usuario activo devuelve cero, no una clave ausente', async () => {
    // Es lo que ocurriría si se devolviera el `GROUP BY` tal cual: el motor
    // omite las filas sin coincidencias, y una clave ausente obligaría a la
    // interfaz a distinguir «cero» de «no informado» (data CHK030).
    const respuesta = await metricas().expect(200);

    expect(Object.keys(respuesta.body.activeUsersByRole).sort()).toEqual(
      Object.values(Role).sort(),
    );
    expect(respuesta.body.activeUsersByRole[Role.REPARTIDOR]).toBe(0);
    expect(respuesta.body.activeUsersByRole[Role.NEGOCIO]).toBe(0);
  });

  it('con el padrón entero desactivado devuelve los cuatro roles en cero', async () => {
    // Salvo el administrador, que sigue activo por ser quien consulta.
    await crearUsuario({
      email: 'c1@ejemplo.cl',
      role: Role.CLIENTE,
      status: UserStatus.DESACTIVADO,
    });

    const respuesta = await metricas().expect(200);
    expect(respuesta.body.activeUsersByRole).toEqual({
      [Role.CLIENTE]: 0,
      [Role.NEGOCIO]: 0,
      [Role.REPARTIDOR]: 0,
      [Role.ADMINISTRADOR]: 1,
    });
  });
});

describe('Pedidos por estado (FR-019, FR-023)', () => {
  it('los seis estados aparecen siempre, todos en cero', async () => {
    const respuesta = await metricas().expect(200);

    expect(respuesta.body.ordersByStatus).toEqual({
      [OrderStatus.CREADO]: 0,
      [OrderStatus.EN_PREPARACION]: 0,
      [OrderStatus.ASIGNADO_REPARTIDOR]: 0,
      [OrderStatus.ENTREGADO]: 0,
      [OrderStatus.CERRADO]: 0,
      [OrderStatus.RECHAZADO]: 0,
    });
  });

  it('cuenta los pedidos reales por estado cuando E2/E4 ya existen', async () => {
    const cliente = await crearUsuario({ email: 'metricas-pedidos@ejemplo.cl' });
    await crearPedido({ userId: cliente.id });
    await crearPedido({ userId: cliente.id, status: 'en_preparacion' });
    await crearPedido({ userId: cliente.id, status: 'rechazado' });

    const respuesta = await metricas().expect(200);

    expect(respuesta.body.ordersByStatus).toMatchObject({
      [OrderStatus.CREADO]: 1,
      [OrderStatus.EN_PREPARACION]: 1,
      [OrderStatus.RECHAZADO]: 1,
      [OrderStatus.ENTREGADO]: 0,
    });
  });

  it('los estados son los de la máquina compartida, sin ninguno propio', async () => {
    const respuesta = await metricas().expect(200);

    expect(Object.keys(respuesta.body.ordersByStatus).sort()).toEqual(
      Object.values(OrderStatus).sort(),
    );
    expect(Object.keys(respuesta.body.ordersByStatus)).not.toContain('cancelado');
  });
});

describe('Forma de la respuesta', () => {
  it('devuelve exactamente las dos claves del contrato', async () => {
    const respuesta = await metricas().expect(200);
    expect(Object.keys(respuesta.body).sort()).toEqual(
      ['activeUsersByRole', 'ordersByStatus'].sort(),
    );
  });

  it('las diez cifras están siempre presentes', async () => {
    const respuesta = await metricas().expect(200);
    const cifras = [
      ...Object.values(respuesta.body.activeUsersByRole),
      ...Object.values(respuesta.body.ordersByStatus),
    ];
    expect(cifras).toHaveLength(10);
    for (const cifra of cifras) expect(typeof cifra).toBe('number');
  });
});
