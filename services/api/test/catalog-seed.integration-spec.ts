/**
 * Semilla del catálogo (T077, FR-036, D-028, SC-026).
 *
 * Se ejecuta el script real con `tsx`, no la función importada: lo que FR-036
 * promete es que **`pnpm --filter api db:seed` deja el entorno listo**, y probar
 * la función sola dejaría sin verificar justo el enlace que T076 añadió.
 *
 * La parte que un test de «no falla dos veces» dejaría pasar es la segunda
 * ejecución: un script que sobrescribiera cada registro también terminaría sin
 * error, y aun así habría borrado el trabajo de quien estuviera cargando el
 * catálogo real (supuesto 15). Por eso se comprueba que **nada cambió**, y no
 * solo que nada se duplicó.
 */
import { execFileSync } from 'node:child_process';
import { Dimension } from '@prisma/client';
// `PriceTier` no es un enum de la base: el tramo se deriva en cada consulta y no
// hay columna que lo guarde (D-023). Viene del paquete compartido.
import { PriceTier, normalizarBusqueda } from '@foodvoice/shared';
import { prisma } from './setup';

const CORREO = 'admin.semilla@ejemplo.cl';
const PASSWORD = 'semilla-8caracteres';

function ejecutarSemilla(): void {
  execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
    cwd: `${__dirname}/..`,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: { ...process.env, ADMIN_SEED_EMAIL: CORREO, ADMIN_SEED_PASSWORD: PASSWORD },
  });
}

describe('Los mínimos exigibles de FR-036 (SC-026)', () => {
  beforeEach(() => {
    ejecutarSemilla();
  });

  it('carga **al menos tres categorías activas por dimensión**', async () => {
    for (const dimension of Object.values(Dimension)) {
      const cuantas = await prisma.category.count({ where: { dimension, active: true } });
      expect(cuantas).toBeGreaterThanOrEqual(3);
    }
  });

  it('carga **al menos doce productos activos**', async () => {
    expect(await prisma.product.count({ where: { active: true } })).toBeGreaterThanOrEqual(12);
  });

  it('**todos** sus productos declaran ingredientes, pese a ser opcionales (FR-017)', async () => {
    const sinIngredientes = await prisma.product.count({ where: { ingredients: null } });
    expect(sinIngredientes).toBe(0);
  });

  it('cada campo de ingredientes enumera **al menos tres componentes** (SC-032)', async () => {
    const productos = await prisma.product.findMany({ select: { name: true, ingredients: true } });

    for (const producto of productos) {
      const componentes = (producto.ingredients ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c !== '');
      // El criterio operativo de SC-032: tres componentes reconocibles, no
      // adjetivos. Que sean reconocibles es revisión humana; que sean tres se
      // comprueba aquí.
      expect(componentes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('**cada categoría tiene al menos un producto**: ningún filtro nace vacío', async () => {
    const categorias = await prisma.category.findMany();

    for (const categoria of categorias) {
      const cuantos = await prisma.product.count({
        where: {
          active: true,
          OR: [{ foodTypeCategoryId: categoria.id }, { healthProfileCategoryId: categoria.id }],
        },
      });
      expect(cuantos).toBeGreaterThanOrEqual(1);
    }
  });

  it('cubre los **tres tramos de precio**, y ninguno se queda vacío (FR-032)', async () => {
    // Los cortes se derivan igual que en la API: el precio en el primer y el
    // segundo tercio del catálogo activo ordenado.
    const precios = (
      await prisma.product.findMany({
        where: { active: true },
        select: { price: true },
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      })
    ).map((p) => p.price);

    const n = precios.length;
    const c1 = precios[Math.ceil(n / 3) - 1]!;
    const c2 = precios[Math.ceil((2 * n) / 3) - 1]!;

    // Si todos valieran lo mismo no habría tramos y SC-026 no se cumpliría.
    expect(c1).toBeLessThan(c2);
    expect(c2).toBeLessThan(precios[n - 1]!);

    const porTramo: Record<PriceTier, number> = {
      [PriceTier.ECONOMICO]: precios.filter((p) => p <= c1).length,
      [PriceTier.MEDIO]: precios.filter((p) => p > c1 && p <= c2).length,
      [PriceTier.CARO]: precios.filter((p) => p > c2).length,
    };

    for (const tramo of Object.values(PriceTier)) {
      expect(porTramo[tramo]).toBeGreaterThanOrEqual(1);
    }
  });

  it('sus descripciones **superan holgadamente el mínimo mecánico** de FR-039', async () => {
    const categorias = await prisma.category.findMany({ select: { description: true } });
    const productos = await prisma.product.findMany({ select: { description: true } });

    // No es la validación de FR-039 —esa ya la cubren los unitarios de
    // `validarDescripcion`—, sino el criterio de SC-032: una descripción que se
    // limita al mínimo no es contenido revisado.
    for (const { description } of categorias) expect(description.length).toBeGreaterThan(60);
    for (const { description } of productos) expect(description.length).toBeGreaterThan(60);
  });

  it('todo lo que carga queda **activo y disponible**, sin ningún paso de publicación', async () => {
    expect(await prisma.category.count({ where: { active: false } })).toBe(0);
    expect(await prisma.product.count({ where: { OR: [{ active: false }, { available: false }] } })).toBe(
      0,
    );
  });
});

describe('Idempotencia (FR-036, D-028, SC-026)', () => {
  it('ejecutada dos veces **no duplica** ningún registro', async () => {
    ejecutarSemilla();
    const categorias = await prisma.category.count();
    const productos = await prisma.product.count();

    ejecutarSemilla();

    expect(await prisma.category.count()).toBe(categorias);
    expect(await prisma.product.count()).toBe(productos);
  });

  it('**no modifica** los registros ya existentes: respeta los cambios hechos a mano', async () => {
    ejecutarSemilla();

    const antes = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    const categoriasAntes = await prisma.category.findMany({ orderBy: { name: 'asc' } });

    ejecutarSemilla();

    // Se comparan las filas **enteras**, `updatedAt` incluido: un script que
    // reescribiera con los mismos valores dejaría el mismo contenido y una marca
    // de tiempo distinta, y eso ya sería sobrescribir.
    expect(await prisma.product.findMany({ orderBy: { name: 'asc' } })).toEqual(antes);
    expect(await prisma.category.findMany({ orderBy: { name: 'asc' } })).toEqual(categoriasAntes);
  });

  it('un producto **editado a mano** sobrevive a la siguiente ejecución (supuesto 15)', async () => {
    ejecutarSemilla();

    const producto = await prisma.product.findFirstOrThrow({ orderBy: { name: 'asc' } });
    const descripcionPropia =
      'Descripción escrita por el local, distinta de la que trae el catálogo de referencia.';
    await prisma.product.update({
      where: { id: producto.id },
      data: { description: descripcionPropia, price: 12345 },
    });

    ejecutarSemilla();

    const despues = await prisma.product.findUniqueOrThrow({ where: { id: producto.id } });
    expect(despues.description).toBe(descripcionPropia);
    expect(despues.price).toBe(12345);
  });

  it('reconoce un registro existente por su nombre **normalizado** (D-028)', async () => {
    // «pizza napolitana» en minúsculas es el mismo producto que «Pizza
    // Napolitana»: reconocer por identificador lo habría duplicado.
    const { foodType, healthProfile } = await crearParDeCategorias();
    await prisma.product.create({
      data: {
        name: 'pizza napolitana',
        nameNormalized: normalizarBusqueda('pizza napolitana'),
        description:
          'Versión propia del local, cargada a mano antes de ejecutar la semilla por primera vez.',
        ingredients: 'Masa, tomate, mozzarella',
        price: 7777,
        foodTypeCategoryId: foodType,
        healthProfileCategoryId: healthProfile,
        active: true,
        available: true,
      },
    });

    ejecutarSemilla();

    const napolitanas = await prisma.product.findMany({
      where: { nameNormalized: normalizarBusqueda('Pizza Napolitana') },
    });
    expect(napolitanas).toHaveLength(1);
    expect(napolitanas[0]?.price).toBe(7777);
  });

  it('reconoce una categoría por **`(dimensión, nombre normalizado)`**', async () => {
    await prisma.category.create({
      data: {
        dimension: Dimension.TIPO_COMIDA,
        name: 'PIZZAS',
        nameNormalized: normalizarBusqueda('PIZZAS'),
        description: 'Descripción propia del local para su agrupación de masas horneadas al horno.',
        active: true,
      },
    });

    ejecutarSemilla();

    const pizzas = await prisma.category.findMany({
      where: { dimension: Dimension.TIPO_COMIDA, nameNormalized: normalizarBusqueda('Pizzas') },
    });
    expect(pizzas).toHaveLength(1);
    expect(pizzas[0]?.name).toBe('PIZZAS');
  });
});

/** Par mínimo de categorías para colgar de él un producto cargado a mano. */
async function crearParDeCategorias(): Promise<{ foodType: string; healthProfile: string }> {
  const foodType = await prisma.category.create({
    data: {
      dimension: Dimension.TIPO_COMIDA,
      name: 'Masas Del Local',
      nameNormalized: normalizarBusqueda('Masas Del Local'),
      description: 'Agrupación propia del local para sus preparaciones horneadas de masa y queso.',
      active: true,
    },
  });
  const healthProfile = await prisma.category.create({
    data: {
      dimension: Dimension.PERFIL_SALUD,
      name: 'Para Compartir',
      nameNormalized: normalizarBusqueda('Para Compartir'),
      description: 'Agrupación propia del local para porciones pensadas para más de una persona.',
      active: true,
    },
  });
  return { foodType: foodType.id, healthProfile: healthProfile.id };
}
