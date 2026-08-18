import { describe, expect, it } from 'vitest';
import { MSG_DIRECCION_ETIQUETA_VACIA, MSG_DIRECCION_TEXTO_VACIO } from '../src/messages/es';
import {
  ChangeAddressStatusSchema,
  CreateAddressSchema,
  UpdateAddressSchema,
} from '../src/schemas/address';

function mensajes(resultado: { success: boolean; error?: unknown }): string[] {
  if (resultado.success) return [];
  return (resultado.error as { issues: { message: string }[] }).issues.map((i) => i.message);
}

describe('CreateAddressSchema (FR-012, FR-013, Supuesto 2)', () => {
  it('acepta etiqueta y texto válidos, recortados', () => {
    const resultado = CreateAddressSchema.safeParse({
      label: '  Casa  ',
      text: '  Los Aromos 123, depto 4B  ',
    });
    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data).toEqual({
      label: 'Casa',
      text: 'Los Aromos 123, depto 4B',
    });
  });

  it('rechaza etiqueta vacía con el mensaje asociado al campo', () => {
    const resultado = CreateAddressSchema.safeParse({ label: '', text: 'Los Aromos 123' });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_ETIQUETA_VACIA);
  });

  it('rechaza una etiqueta compuesta solo de espacios, igual que vacía', () => {
    const resultado = CreateAddressSchema.safeParse({ label: '   ', text: 'Los Aromos 123' });
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_ETIQUETA_VACIA);
  });

  it('rechaza texto vacío con el mensaje asociado al campo', () => {
    const resultado = CreateAddressSchema.safeParse({ label: 'Casa', text: '' });
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_TEXTO_VACIO);
  });

  it('rechaza un texto compuesto solo de espacios o saltos de línea', () => {
    const resultado = CreateAddressSchema.safeParse({ label: 'Casa', text: '   \n\n   ' });
    expect(mensajes(resultado)).toContain(MSG_DIRECCION_TEXTO_VACIO);
  });

  it('acepta el mínimo de 2 caracteres de etiqueta y 10 de texto', () => {
    expect(CreateAddressSchema.safeParse({ label: 'Ab', text: '1234567890' }).success).toBe(true);
  });

  it('rechaza una etiqueta de más de 60 caracteres', () => {
    expect(
      CreateAddressSchema.safeParse({ label: 'a'.repeat(61), text: '1234567890' }).success,
    ).toBe(false);
  });

  it('rechaza un texto de más de 500 caracteres', () => {
    expect(
      CreateAddressSchema.safeParse({ label: 'Casa', text: 'a'.repeat(501) }).success,
    ).toBe(false);
  });

  it('acepta saltos de línea dentro del texto (indicaciones adicionales)', () => {
    expect(
      CreateAddressSchema.safeParse({
        label: 'Casa',
        text: 'Los Aromos 123\nTocar el segundo timbre',
      }).success,
    ).toBe(true);
  });
});

describe('UpdateAddressSchema (FR-016)', () => {
  it('exige los dos campos completos, no una edición parcial', () => {
    expect(UpdateAddressSchema.safeParse({ label: 'Casa' }).success).toBe(false);
    expect(
      UpdateAddressSchema.safeParse({ label: 'Casa', text: '1234567890' }).success,
    ).toBe(true);
  });
});

describe('ChangeAddressStatusSchema (FR-018)', () => {
  it('acepta un booleano explícito', () => {
    expect(ChangeAddressStatusSchema.safeParse({ active: true }).success).toBe(true);
    expect(ChangeAddressStatusSchema.safeParse({ active: false }).success).toBe(true);
  });

  it('rechaza la ausencia del campo', () => {
    expect(ChangeAddressStatusSchema.safeParse({}).success).toBe(false);
  });
});
