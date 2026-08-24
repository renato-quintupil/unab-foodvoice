import { describe, expect, it } from 'vitest';
import { SearchChannel, SearchIntent } from '../src/enums/search';
import { SearchRequestSchema } from '../src/schemas/search';

describe('SearchRequestSchema (E6, FR-014, FR-015)', () => {
  it('acepta una frase válida con canal de texto', () => {
    const resultado = SearchRequestSchema.safeParse({
      query: 'quiero algo económico y sano',
      channel: SearchChannel.TEXT,
    });
    expect(resultado.success).toBe(true);
  });

  it('acepta el canal de voz', () => {
    expect(
      SearchRequestSchema.safeParse({ query: 'una napolitana', channel: SearchChannel.VOICE })
        .success,
    ).toBe(true);
  });

  it('recorta espacios al borde de la frase', () => {
    const resultado = SearchRequestSchema.safeParse({
      query: '  quiero pizza  ',
      channel: SearchChannel.TEXT,
    });
    expect(resultado.success && resultado.data.query).toBe('quiero pizza');
  });

  it('usa SEARCH como intent por omisión', () => {
    const resultado = SearchRequestSchema.safeParse({ query: 'pizza', channel: SearchChannel.TEXT });
    expect(resultado.success && resultado.data.intent).toBe(SearchIntent.SEARCH);
  });

  it('acepta intent ADD explícito', () => {
    const resultado = SearchRequestSchema.safeParse({
      query: 'agrégame una pizza',
      channel: SearchChannel.VOICE,
      intent: SearchIntent.ADD,
    });
    expect(resultado.success && resultado.data.intent).toBe(SearchIntent.ADD);
  });

  it('rechaza una frase vacía', () => {
    expect(SearchRequestSchema.safeParse({ query: '', channel: SearchChannel.TEXT }).success).toBe(
      false,
    );
  });

  it('rechaza una frase de solo espacios', () => {
    expect(
      SearchRequestSchema.safeParse({ query: '   ', channel: SearchChannel.TEXT }).success,
    ).toBe(false);
  });

  it('rechaza una frase de más de 300 caracteres', () => {
    expect(
      SearchRequestSchema.safeParse({ query: 'a'.repeat(301), channel: SearchChannel.TEXT })
        .success,
    ).toBe(false);
  });

  it('acepta una frase de exactamente 300 caracteres', () => {
    expect(
      SearchRequestSchema.safeParse({ query: 'a'.repeat(300), channel: SearchChannel.TEXT })
        .success,
    ).toBe(true);
  });

  it('rechaza un canal desconocido', () => {
    expect(SearchRequestSchema.safeParse({ query: 'pizza', channel: 'AUDIO' }).success).toBe(
      false,
    );
  });

  it('rechaza un intent desconocido', () => {
    expect(
      SearchRequestSchema.safeParse({ query: 'pizza', channel: SearchChannel.TEXT, intent: 'BUY' })
        .success,
    ).toBe(false);
  });
});
