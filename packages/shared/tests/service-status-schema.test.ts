import { describe, expect, it } from 'vitest';
import { MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO } from '../src/messages/es';
import { PauseServiceSchema } from '../src/schemas/service-status';

function mensajes(resultado: { success: boolean; error?: unknown }): string[] {
  if (resultado.success) return [];
  return (resultado.error as { issues: { message: string }[] }).issues.map((i) => i.message);
}

describe('PauseServiceSchema (E8, HU-07 Historia 3, FR-009)', () => {
  it('acepta un motivo de al menos 10 caracteres', () => {
    expect(PauseServiceSchema.safeParse({ reason: 'Corte de luz en el local' }).success).toBe(true);
  });

  it('rechaza un motivo vacío con el mensaje del campo', () => {
    const resultado = PauseServiceSchema.safeParse({ reason: '' });
    expect(resultado.success).toBe(false);
    expect(mensajes(resultado)).toContain(MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO);
  });

  it('rechaza un motivo compuesto solo de espacios, igual que uno vacío', () => {
    const resultado = PauseServiceSchema.safeParse({ reason: '          ' });
    expect(mensajes(resultado)).toContain(MSG_MOTIVO_ADMINISTRATIVO_REQUERIDO);
  });

  it('rechaza un motivo de más de 500 caracteres', () => {
    expect(PauseServiceSchema.safeParse({ reason: 'a'.repeat(501) }).success).toBe(false);
  });
});
