import { describe, expect, it } from 'vitest';
import { AddCartLineSchema, UpdateCartLineQuantitySchema } from '../src/schemas/cart';

describe('AddCartLineSchema (FR-002, FR-004)', () => {
  it('acepta un UUID de producto', () => {
    expect(
      AddCartLineSchema.safeParse({ productId: '11111111-1111-1111-1111-111111111111' }).success,
    ).toBe(true);
  });

  it('rechaza un productId que no es UUID', () => {
    expect(AddCartLineSchema.safeParse({ productId: 'no-es-un-uuid' }).success).toBe(false);
  });

  it('rechaza la ausencia de productId', () => {
    expect(AddCartLineSchema.safeParse({}).success).toBe(false);
  });
});

describe('UpdateCartLineQuantitySchema (FR-003)', () => {
  it('acepta un entero mayor o igual a 0', () => {
    expect(UpdateCartLineQuantitySchema.safeParse({ quantity: 0 }).success).toBe(true);
    expect(UpdateCartLineQuantitySchema.safeParse({ quantity: 3 }).success).toBe(true);
  });

  it('coacciona la cantidad desde una cadena', () => {
    const resultado = UpdateCartLineQuantitySchema.safeParse({ quantity: '3' });
    expect(resultado.success && resultado.data.quantity).toBe(3);
  });

  it('rechaza cantidades negativas', () => {
    expect(UpdateCartLineQuantitySchema.safeParse({ quantity: -1 }).success).toBe(false);
  });

  it('rechaza cantidades no enteras', () => {
    expect(UpdateCartLineQuantitySchema.safeParse({ quantity: 1.5 }).success).toBe(false);
  });
});
