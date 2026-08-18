/**
 * Concurrencia de dirección predeterminada (D-049): dos primeras altas y dos
 * reactivaciones simultáneas terminan con exactamente una predeterminada activa.
 */
import { crearEntorno, sesionCliente, type Entorno } from './helpers';
import { prisma } from './setup';

describe('Concurrencia de dirección predeterminada', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('dos primeras altas simultáneas del mismo cliente: ambas se crean, una sola predeterminada', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'addr-concurrency-1@foodvoice.test');

    const resultados = await Promise.allSettled([
      entorno
        .http()
        .post('/api/v1/addresses')
        .set('Cookie', cookie)
        .send({ label: 'Casa', text: 'Los Aromos 123' }),
      entorno
        .http()
        .post('/api/v1/addresses')
        .set('Cookie', cookie)
        .send({ label: 'Trabajo', text: 'Oficina Piso 4' }),
    ]);

    expect(resultados.every((r) => r.status === 'fulfilled')).toBe(true);

    const activasPredeterminadas = await prisma.address.count({
      where: { userId: usuario.id, active: true, isDefault: true },
    });
    expect(activasPredeterminadas).toBe(1);
  });

  it('dos reactivaciones simultáneas sin ninguna otra activa: exactamente una predeterminada', async () => {
    const { cookie, usuario } = await sesionCliente(entorno, 'addr-concurrency-2@foodvoice.test');
    const a = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Dir A', text: 'Direccion A de prueba' });
    const b = await entorno
      .http()
      .post('/api/v1/addresses')
      .set('Cookie', cookie)
      .send({ label: 'Dir B', text: 'Direccion B de prueba' });
    await entorno.http().put(`/api/v1/addresses/${a.body.id}/status`).set('Cookie', cookie).send({ active: false });
    await entorno.http().put(`/api/v1/addresses/${b.body.id}/status`).set('Cookie', cookie).send({ active: false });

    await Promise.allSettled([
      entorno
        .http()
        .put(`/api/v1/addresses/${a.body.id}/status`)
        .set('Cookie', cookie)
        .send({ active: true }),
      entorno
        .http()
        .put(`/api/v1/addresses/${b.body.id}/status`)
        .set('Cookie', cookie)
        .send({ active: true }),
    ]);

    const activasPredeterminadas = await prisma.address.count({
      where: { userId: usuario.id, active: true, isDefault: true },
    });
    expect(activasPredeterminadas).toBe(1);
    const activas = await prisma.address.count({ where: { userId: usuario.id, active: true } });
    expect(activas).toBe(2);
  });
});
