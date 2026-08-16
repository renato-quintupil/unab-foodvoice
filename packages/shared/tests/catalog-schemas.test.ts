import { describe, expect, it } from 'vitest';
import { Dimension } from '../src/enums/dimension';
import {
  ChangeCategoryStatusSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from '../src/schemas/category';
import {
  ChangeAvailabilitySchema,
  ChangeProductStatusSchema,
  CreateProductSchema,
  UpdateProductSchema,
} from '../src/schemas/product';
import {
  ListCategoriesQuerySchema,
  ListProductsQuerySchema,
  MenuQuerySchema,
} from '../src/schemas/query';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

const categoriaValida = {
  dimension: Dimension.TIPO_COMIDA,
  name: 'Pizzas',
  description: 'Masa delgada horneada con distintas combinaciones de queso, salsa y verduras.',
};

const productoValido = {
  name: 'Pizza Napolitana',
  description: 'Masa delgada con salsa de tomate, mozzarella fresca y albahaca.',
  ingredients: 'Masa, tomate, mozzarella, albahaca',
  price: 8990,
  foodTypeCategoryId: UUID_A,
  healthProfileCategoryId: UUID_B,
};

describe('CreateCategorySchema (FR-002, FR-003)', () => {
  it('acepta una categoría completa', () => {
    expect(CreateCategorySchema.safeParse(categoriaValida).success).toBe(true);
  });

  it('recorta los espacios del nombre', () => {
    const r = CreateCategorySchema.safeParse({ ...categoriaValida, name: '  Pizzas  ' });
    expect(r.success && r.data.name).toBe('Pizzas');
  });

  it('aplana la descripción antes de guardarla (D-033)', () => {
    const r = CreateCategorySchema.safeParse({
      ...categoriaValida,
      description: 'Masa delgada horneada\ncon queso,\tsalsa y verduras variadas del dia.',
    });
    expect(r.success && r.data.description).toBe(
      'Masa delgada horneada con queso, salsa y verduras variadas del dia.',
    );
  });

  it('rechaza un nombre de un solo carácter y otro de más de 60', () => {
    expect(CreateCategorySchema.safeParse({ ...categoriaValida, name: 'P' }).success).toBe(false);
    expect(
      CreateCategorySchema.safeParse({ ...categoriaValida, name: 'x'.repeat(61) }).success,
    ).toBe(false);
  });

  it('acepta los extremos inclusivos del nombre: 2 y 60 caracteres', () => {
    expect(CreateCategorySchema.safeParse({ ...categoriaValida, name: 'Po' }).success).toBe(true);
    expect(
      CreateCategorySchema.safeParse({ ...categoriaValida, name: 'x'.repeat(60) }).success,
    ).toBe(true);
  });

  it('rechaza una dimensión que no es de las dos fijas (FR-001)', () => {
    const r = CreateCategorySchema.safeParse({ ...categoriaValida, dimension: 'PICANTE' });
    expect(r.success).toBe(false);
  });

  it('rechaza una descripción de menos de 30 caracteres y asocia el error a su campo (SC-008)', () => {
    const r = CreateCategorySchema.safeParse({ ...categoriaValida, description: 'Pizzas ricas' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['description']);
      expect(r.error.issues[0]?.message).toContain('30 caracteres');
    }
  });

  it('rechaza una descripción que solo repite el nombre (FR-039, SC-031)', () => {
    const r = CreateCategorySchema.safeParse({
      ...categoriaValida,
      name: 'Pizzas Napolitanas Especiales Grandes',
      description: 'Pizzas Napolitanas Especiales Grandes Pizzas Napolitanas',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['description']);
  });
});

describe('UpdateCategorySchema (FR-006)', () => {
  it('acepta nombre y descripción', () => {
    const r = UpdateCategorySchema.safeParse({
      name: categoriaValida.name,
      description: categoriaValida.description,
    });
    expect(r.success).toBe(true);
  });

  it('**descarta la dimensión en silencio**: no es editable ni enviándola a mano', () => {
    const r = UpdateCategorySchema.safeParse({
      name: categoriaValida.name,
      description: categoriaValida.description,
      dimension: Dimension.PERFIL_SALUD,
    });
    expect(r.success).toBe(true);
    expect(r.success && 'dimension' in r.data).toBe(false);
  });

  it('aplica las mismas reglas de descripción que el alta', () => {
    const r = UpdateCategorySchema.safeParse({ name: 'Pizzas', description: 'corta' });
    expect(r.success).toBe(false);
  });
});

describe('ChangeCategoryStatusSchema (FR-007, FR-008)', () => {
  it('acepta los dos valores booleanos', () => {
    expect(ChangeCategoryStatusSchema.safeParse({ active: true }).success).toBe(true);
    expect(ChangeCategoryStatusSchema.safeParse({ active: false }).success).toBe(true);
  });

  it('rechaza una cadena: el estado no se infiere de «true»', () => {
    expect(ChangeCategoryStatusSchema.safeParse({ active: 'true' }).success).toBe(false);
  });
});

describe('CreateProductSchema (FR-012, FR-013)', () => {
  it('acepta un producto completo', () => {
    expect(CreateProductSchema.safeParse(productoValido).success).toBe(true);
  });

  it('acepta un producto **sin ingredientes** y los normaliza a null (FR-017)', () => {
    const { ingredients: _omitido, ...sinIngredientes } = productoValido;
    const r = CreateProductSchema.safeParse(sinIngredientes);
    expect(r.success && r.data.ingredients).toBeNull();
  });

  it('trata como ausente un campo de ingredientes con solo espacios (CHK034)', () => {
    const r = CreateProductSchema.safeParse({ ...productoValido, ingredients: '   ' });
    expect(r.success && r.data.ingredients).toBeNull();
  });

  it('conserva los saltos de línea de los ingredientes: son texto libre', () => {
    const r = CreateProductSchema.safeParse({
      ...productoValido,
      ingredients: 'Masa\nTomate\nMozzarella',
    });
    expect(r.success && r.data.ingredients).toBe('Masa\nTomate\nMozzarella');
  });

  it('rechaza ingredientes de más de 500 caracteres', () => {
    const r = CreateProductSchema.safeParse({ ...productoValido, ingredients: 'x'.repeat(501) });
    expect(r.success).toBe(false);
  });

  it('**no admite `active` ni `available`**: el alta los fija (RN-007)', () => {
    const r = CreateProductSchema.safeParse({
      ...productoValido,
      active: false,
      available: false,
    });
    expect(r.success).toBe(true);
    expect(r.success && 'active' in r.data).toBe(false);
    expect(r.success && 'available' in r.data).toBe(false);
  });

  it('no admite ningún campo de tramo de precio: no existe como dato (FR-032)', () => {
    const r = CreateProductSchema.safeParse({ ...productoValido, priceTier: 'ECONOMICO' });
    expect(r.success && 'priceTier' in r.data).toBe(false);
  });
});

describe('CreateProductSchema · precio (FR-015, RN-006, SC-012)', () => {
  const conPrecio = (price: unknown) => CreateProductSchema.safeParse({ ...productoValido, price });

  it('rechaza el cero, con el mensaje asociado al campo del precio', () => {
    const r = conPrecio(0);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['price']);
      expect(r.error.issues[0]?.message).toBe('El precio debe ser mayor que cero.');
    }
  });

  it('rechaza un negativo', () => {
    const r = conPrecio(-100);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('El precio debe ser mayor que cero.');
  });

  it('**rechaza los decimales sin redondearlos** (FR-015)', () => {
    const r = conPrecio(4990.5);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('El precio no puede tener decimales.');
  });

  it('rechaza un valor no numérico', () => {
    const r = conPrecio('abc');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['price']);
  });

  it('rechaza un precio por encima del máximo declarado', () => {
    expect(conPrecio(10_000_001).success).toBe(false);
  });

  it('acepta los dos extremos inclusivos: 1 y 10.000.000', () => {
    expect(conPrecio(1).success).toBe(true);
    expect(conPrecio(10_000_000).success).toBe(true);
  });

  it('convierte la cadena de un formulario en número', () => {
    const r = conPrecio('4990');
    expect(r.success && r.data.price).toBe(4990);
  });

  it('rechaza una cadena con separadores de miles: se ingresa el entero desnudo', () => {
    expect(conPrecio('4.990').success).toBe(false);
  });
});

describe('CreateProductSchema · clasificación (FR-012, RN-011, D-024)', () => {
  it('exige las dos categorías', () => {
    const { foodTypeCategoryId: _a, ...sinTipo } = productoValido;
    expect(CreateProductSchema.safeParse(sinTipo).success).toBe(false);

    const { healthProfileCategoryId: _b, ...sinPerfil } = productoValido;
    expect(CreateProductSchema.safeParse(sinPerfil).success).toBe(false);
  });

  it('asocia el error al campo de la dimensión que falta (HU14-E06)', () => {
    const r = CreateProductSchema.safeParse({ ...productoValido, foodTypeCategoryId: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['foodTypeCategoryId']);
      expect(r.error.issues[0]?.message).toBe('Debes seleccionar un tipo de comida.');
    }
  });

  it('rechaza un identificador que no es UUID', () => {
    expect(
      CreateProductSchema.safeParse({ ...productoValido, healthProfileCategoryId: 'pizzas' })
        .success,
    ).toBe(false);
  });
});

describe('UpdateProductSchema (FR-018, FR-022)', () => {
  it('acepta los mismos campos que el alta: reclasificar es cambiar las dos claves', () => {
    expect(UpdateProductSchema.safeParse(productoValido).success).toBe(true);
  });

  it('aplica idéntica validación de descripción que el alta (§ Límites)', () => {
    const r = UpdateProductSchema.safeParse({ ...productoValido, description: 'rica' });
    expect(r.success).toBe(false);
  });
});

describe('ChangeAvailabilitySchema y ChangeProductStatusSchema (FR-019, FR-020)', () => {
  it('agotar y reponer viajan como un booleano', () => {
    expect(ChangeAvailabilitySchema.safeParse({ available: false }).success).toBe(true);
    expect(ChangeAvailabilitySchema.safeParse({ available: true }).success).toBe(true);
  });

  it('dar de baja y reactivar también', () => {
    expect(ChangeProductStatusSchema.safeParse({ active: false }).success).toBe(true);
    expect(ChangeProductStatusSchema.safeParse({ active: true }).success).toBe(true);
  });

  it('los dos exigen el campo', () => {
    expect(ChangeAvailabilitySchema.safeParse({}).success).toBe(false);
    expect(ChangeProductStatusSchema.safeParse({}).success).toBe(false);
  });
});

describe('Consultas del catálogo (FR-010, FR-023, FR-031)', () => {
  it('ListCategoriesQuery admite dimensión y estado, ambos opcionales', () => {
    expect(ListCategoriesQuerySchema.safeParse({}).success).toBe(true);
    const r = ListCategoriesQuerySchema.safeParse({
      dimension: Dimension.PERFIL_SALUD,
      active: 'false',
    });
    expect(r.success && r.data.active).toBe(false);
  });

  it('ListCategoriesQuery deja `active` indefinido cuando no se pide: se devuelven todas', () => {
    const r = ListCategoriesQuerySchema.safeParse({});
    expect(r.success && r.data.active).toBeUndefined();
  });

  it('ListProductsQuery aplica la página 1 por omisión y acepta la combinación de filtros', () => {
    const r = ListProductsQuerySchema.safeParse({});
    expect(r.success && r.data.page).toBe(1);

    const combinada = ListProductsQuerySchema.safeParse({
      search: '  napolitana ',
      status: 'AGOTADO',
      categoryId: UUID_A,
      page: '3',
    });
    expect(combinada.success).toBe(true);
    expect(combinada.success && combinada.data.search).toBe('napolitana');
    expect(combinada.success && combinada.data.page).toBe(3);
  });

  it('ListProductsQuery **no expone `pageSize` ni orden**, igual que el listado de usuarios', () => {
    const r = ListProductsQuerySchema.safeParse({ pageSize: 100, sort: 'price' });
    expect(r.success && 'pageSize' in r.data).toBe(false);
    expect(r.success && 'sort' in r.data).toBe(false);
  });

  it('ListProductsQuery rechaza una página menor que 1', () => {
    expect(ListProductsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('MenuQuery **no tiene `page`**: el menú no se pagina (D-029)', () => {
    const r = MenuQuerySchema.safeParse({ page: 2 });
    expect(r.success && 'page' in r.data).toBe(false);
  });

  it('MenuQuery admite los tres filtros combinados (FR-031)', () => {
    const r = MenuQuerySchema.safeParse({
      foodTypeCategoryId: UUID_A,
      healthProfileCategoryId: UUID_B,
      priceTier: 'ECONOMICO',
    });
    expect(r.success).toBe(true);
  });

  it('MenuQuery rechaza un tramo que no es de los tres', () => {
    expect(MenuQuerySchema.safeParse({ priceTier: 'BARATISIMO' }).success).toBe(false);
  });
});
