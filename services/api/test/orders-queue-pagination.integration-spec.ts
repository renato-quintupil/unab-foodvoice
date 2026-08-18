/**
 * Bandeja vacía y 21 pedidos intercalados: reparto 20/1 y orden total
 * `createdAt ASC, id ASC` (HU01-E14–E15, FR-041, D-043).
 */
import { crearEntorno, crearPedido, crearUsuario, sesionNegocio, type Entorno } from './helpers';

describe('GET /business/orders — bandeja', () => {
  let entorno: Entorno;

  beforeAll(async () => {
    entorno = await crearEntorno();
  });

  afterAll(async () => {
    await entorno.app.close();
  });

  it('sin pedidos pendientes, la bandeja llega vacía (HU01-E14)', async () => {
    const negocio = await sesionNegocio(entorno, 'orders-queue-vacia@foodvoice.test');
    const respuesta = await entorno.http().get('/api/v1/business/orders').set('Cookie', negocio).expect(200);
    expect(respuesta.body.items).toEqual([]);
    expect(respuesta.body.total).toBe(0);
  });

  it('21 pedidos intercalados con en_preparacion: 20 en la página 1, 1 en la página 2, sin repetidos ni omitidos (HU01-E15)', async () => {
    const cliente = await crearUsuario({ email: 'orders-queue-cliente@foodvoice.test' });
    const negocio = await sesionNegocio(entorno, 'orders-queue-negocio@foodvoice.test');

    const creados: string[] = [];
    for (let i = 0; i < 21; i += 1) {
      // Intercala creado y en_preparacion (ambos deben aparecer en la bandeja
      // combinada, D-043) con marcas de tiempo estrictamente crecientes.
      const status = i % 3 === 0 ? 'en_preparacion' : 'creado';
      const pedido = await crearPedido({
        userId: cliente.id,
        status,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
      creados.push(pedido.id);
    }

    const pagina1 = await entorno
      .http()
      .get('/api/v1/business/orders?page=1')
      .set('Cookie', negocio)
      .expect(200);
    expect(pagina1.body.items).toHaveLength(20);
    expect(pagina1.body.total).toBe(21);
    expect(pagina1.body.totalPages).toBe(2);

    const pagina2 = await entorno
      .http()
      .get('/api/v1/business/orders?page=2')
      .set('Cookie', negocio)
      .expect(200);
    expect(pagina2.body.items).toHaveLength(1);

    const vistos = [...pagina1.body.items, ...pagina2.body.items] as {
      id: string;
      createdAt: string;
    }[];
    const idsVistos = vistos.map((p) => p.id);

    // Sin repetidos ni omitidos: el mismo conjunto de 21 identificadores.
    expect(new Set(idsVistos).size).toBe(21);
    expect(idsVistos.slice().sort()).toEqual([...creados].sort());

    // Del más antiguo al más reciente: cada marca de tiempo es mayor o igual
    // que la anterior (FR-041). Se compara por fecha y no por posición contra
    // `creados`, que solo garantiza el conjunto, no el orden de inserción real.
    const marcas = vistos.map((p) => new Date(p.createdAt).getTime());
    for (let i = 1; i < marcas.length; i += 1) {
      expect(marcas[i]).toBeGreaterThanOrEqual(marcas[i - 1]!);
    }
    expect(marcas[0]).toBe(Date.UTC(2026, 0, 1, 0, 0, 0));
    expect(marcas[marcas.length - 1]).toBe(Date.UTC(2026, 0, 1, 0, 0, 20));
  });
});
