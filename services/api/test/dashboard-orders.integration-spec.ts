/**
 * Reporte de pedidos (T107, FR-020, SC-009, api CHK018, api CHK026).
 *
 * En E1 la lista es **siempre vacía por construcción** (D-012): no existe la
 * entidad `Pedido`. Lo que estos casos verifican es la **forma** de la
 * superficie y la **semántica de los filtros**, que es lo que el contrato fija
 * por completo y lo que quedaría sin definir si se pospusiera.
 */
import { Role } from '@prisma/client';
import { MSG_RANGO_FECHAS_INVALIDO, OrderStatus, PAGE_SIZE } from '@foodvoice/shared';
import { conSesion, crearEntorno, crearUsuario, iniciarSesion, type Entorno } from './helpers';

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

function pedidos(consulta: Record<string, string | number> = {}) {
  return entorno
    .http()
    .get('/api/v1/admin/dashboard/orders')
    .query(consulta)
    .set('Cookie', conSesion(sesionAdmin));
}

describe('Forma paginada compartida (api CHK018)', () => {
  it('devuelve la MISMA forma que el listado de usuarios, sin campos propios', async () => {
    const reporte = await pedidos().expect(200);
    const usuarios = await entorno
      .http()
      .get('/api/v1/admin/users')
      .set('Cookie', conSesion(sesionAdmin))
      .expect(200);

    expect(Object.keys(reporte.body).sort()).toEqual(Object.keys(usuarios.body).sort());
    expect(reporte.body.pageSize).toBe(usuarios.body.pageSize);
    expect(reporte.body.pageSize).toBe(PAGE_SIZE);
  });

  it('devuelve lista vacía con total cero, que no es un error (SC-009)', async () => {
    const respuesta = await pedidos().expect(200);
    expect(respuesta.body.items).toEqual([]);
    expect(respuesta.body.total).toBe(0);
  });
});

describe('Filtros combinables (FR-020)', () => {
  it('acepta status, from y to a la vez', async () => {
    await pedidos({
      status: OrderStatus.ENTREGADO,
      from: '2026-08-01',
      to: '2026-08-31',
    }).expect(200);
  });

  it('acepta cada extremo por separado', async () => {
    await pedidos({ from: '2026-08-01' }).expect(200);
    await pedidos({ to: '2026-08-31' }).expect(200);
  });

  it('`from = to` consulta el día completo y no devuelve un error', async () => {
    // Con extremos exclusivos devolvería cero y parecería un defecto.
    const respuesta = await pedidos({ from: '2026-08-15', to: '2026-08-15' }).expect(200);
    expect(respuesta.body.items).toEqual([]);
  });

  it('los filtros no arrastran datos ajenos: la lista sigue vacía', async () => {
    for (const estado of Object.values(OrderStatus)) {
      const respuesta = await pedidos({ status: estado }).expect(200);
      expect(respuesta.body.items).toEqual([]);
      expect(respuesta.body.total).toBe(0);
    }
  });
});

describe('Validación de las fechas (FR-020, api CHK026)', () => {
  it('una fecha mal formada produce 400 con mensaje en español', async () => {
    const respuesta = await pedidos({ from: '15-08-2026' }).expect(400);
    expect(respuesta.body.error.code).toBe('VALIDATION_ERROR');
    expect(respuesta.body.error.fields.from).toBe(
      'Debes ingresar una fecha con el formato AAAA-MM-DD.',
    );
  });

  it('un día inexistente produce 400', async () => {
    const respuesta = await pedidos({ from: '2026-02-30' }).expect(400);
    expect(respuesta.body.error.fields.from).toBe('Esa fecha no existe.');
  });

  it('`from > to` produce 400 con MSG_RANGO_FECHAS_INVALIDO', async () => {
    const respuesta = await pedidos({ from: '2026-08-16', to: '2026-08-15' }).expect(400);
    expect(respuesta.body.error.message).toBe(MSG_RANGO_FECHAS_INVALIDO);
  });

  it('un rango de amplitud extrema se acepta y devuelve el conjunto vacío', async () => {
    // No se limita la amplitud: la respuesta está paginada y devuelve como
    // mucho una página. Rechazarlos exigiría un máximo arbitrario que el
    // administrador no puede prever y que ningún requisito respalda.
    const respuesta = await pedidos({ from: '1976-01-01', to: '2076-01-01' }).expect(200);
    expect(respuesta.body.items).toEqual([]);
  });

  it('un rango enteramente futuro se acepta y devuelve el conjunto vacío', async () => {
    const respuesta = await pedidos({ from: '2090-01-01', to: '2090-12-31' }).expect(200);
    expect(respuesta.body.items).toEqual([]);
  });

  it('un estado inventado se rechaza: no hay estados propios (FR-023)', async () => {
    await pedidos({ status: 'cancelado' }).expect(400);
  });
});

describe('Interpretación de los días en el huso de referencia (ux CHK026)', () => {
  it('la conversión ocurre en el servicio y no en el esquema', async () => {
    // Un pedido de las 22:00 en Chile debe figurar en su día, no en el
    // siguiente. La regla se ejerce aquí para que quede fijada y verificada
    // antes de que E4/E2 aporten pedidos.
    const { intervaloDeConsulta } = await import('../src/dashboard/dashboard.service');

    const { desde, hasta } = intervaloDeConsulta('2026-08-15', '2026-08-15');

    expect(desde).not.toBeNull();
    expect(hasta).not.toBeNull();
    // Chile va detrás de UTC, así que el primer instante del día local cae ya
    // entrado el 15 en UTC, y el último se pasa al 16.
    expect(hasta!.getTime()).toBeGreaterThan(desde!.getTime());
    expect(hasta!.getTime() - desde!.getTime()).toBe(24 * 60 * 60 * 1000 - 1);

    // Ambos extremos caen dentro del **mismo día del calendario** en el huso de
    // referencia. Se comparan las partes y no la cadena formateada porque el
    // formato corto de `es-CL` usa guiones y no barras: aquí se verifica a qué
    // día pertenece el instante, no cómo se escribe.
    const diaEnHuso = (instante: Date) => {
      const partes = new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(instante);
      const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
      return `${valor('year')}-${valor('month')}-${valor('day')}`;
    };

    expect(diaEnHuso(desde!)).toBe('2026-08-15');
    expect(diaEnHuso(hasta!)).toBe('2026-08-15');
  });

  it('sin extremos, el intervalo es abierto por ambos lados', async () => {
    const { intervaloDeConsulta } = await import('../src/dashboard/dashboard.service');
    expect(intervaloDeConsulta(undefined, undefined)).toEqual({ desde: null, hasta: null });
  });
});
