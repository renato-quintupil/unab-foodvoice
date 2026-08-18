import { describe, expect, it } from 'vitest';
import {
  MSG_DIRECCION_REQUERIDA,
  MSG_DIRECCION_TEXTO_VACIO,
  MSG_MOTIVO_RECHAZO_REQUERIDO,
} from '../src/messages/es';
import { ConfirmOrderSchema, RejectOrderSchema } from '../src/schemas/order';

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const ADDRESS_ID = '22222222-2222-2222-2222-222222222222';

function mensajes(resultado: { success: boolean; error?: unknown }): string[] {
  if (resultado.success) return [];
  return (resultado.error as { issues: { message: string }[] }).issues.map((i) => i.message);
}

describe('ConfirmOrderSchema (FR-022, FR-025, D-036)', () => {
  const expectedLines = [{ productId: PRODUCT_ID, quantity: 1, price: 4990 }];

  it('acepta addressId con expectedLines', () => {
    expect(
      ConfirmOrderSchema.safeParse({ addressId: ADDRESS_ID, expectedLines }).success,
    ).toBe(true);
  });

  it('acepta addressText con expectedLines', () => {
    expect(
      ConfirmOrderSchema.safeParse({
        addressText: 'Oficina, Piso 4',
        expectedLines,
      }).success,
    ).toBe(true);
  });

  it('rechaza cuando no llega ninguna dirección', () => {
    const resultado = ConfirmOrderSchema.safeParse({ expectedLines });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_REQUERIDA);
  });

  it('rechaza cuando llegan ambas direcciones a la vez', () => {
    const resultado = ConfirmOrderSchema.safeParse({
      addressId: ADDRESS_ID,
      addressText: 'Oficina, Piso 4',
      expectedLines,
    });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_REQUERIDA);
  });

  it('rechaza addressText de menos de 10 caracteres con el mensaje del campo, en español', () => {
    const resultado = ConfirmOrderSchema.safeParse({
      addressText: 'Corta',
      expectedLines,
    });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_TEXTO_VACIO);
  });

  it('rechaza expectedLines vacío', () => {
    expect(
      ConfirmOrderSchema.safeParse({ addressId: ADDRESS_ID, expectedLines: [] }).success,
    ).toBe(false);
  });

  it('rechaza un precio negativo en expectedLines', () => {
    expect(
      ConfirmOrderSchema.safeParse({
        addressId: ADDRESS_ID,
        expectedLines: [{ productId: PRODUCT_ID, quantity: 1, price: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe('RejectOrderSchema (FR-033, RN-007)', () => {
  it('acepta un motivo de al menos 10 caracteres', () => {
    expect(RejectOrderSchema.safeParse({ reason: 'Se acabó el ingrediente' }).success).toBe(true);
  });

  it('rechaza un motivo vacío con el mensaje del campo', () => {
    const resultado = RejectOrderSchema.safeParse({ reason: '' });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_MOTIVO_RECHAZO_REQUERIDO);
  });

  it('rechaza un motivo compuesto solo de espacios, igual que uno vacío', () => {
    const resultado = RejectOrderSchema.safeParse({ reason: '          ' });
    expect(mensajes(resultado)).toContain(MSG_MOTIVO_RECHAZO_REQUERIDO);
  });

  it('rechaza un motivo de más de 500 caracteres', () => {
    expect(RejectOrderSchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
  });
});
