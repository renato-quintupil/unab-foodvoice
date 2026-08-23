/**
 * Adaptador Anthropic (D-057, D-065). Unitario: el SDK se sustituye por un
 * doble — nunca llama a la red real. Cubre lo que **no** verifica ninguna
 * prueba de integración (esas usan `ProveedorDeIntencionDePrueba`, nunca este
 * adaptador): la validación Zod de la salida, el reintento único ante JSON
 * inválido, y el cálculo de `tokensUsed`.
 */
process.env.DATABASE_URL ??= 'postgresql://foodvoice:test@localhost:5432/foodvoice_unit_test';
process.env.LLM_API_KEY ??= 'sk-test-unit';

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import { AnthropicSemanticIntentProvider } from './anthropic-semantic-intent.provider';
import type { ContextoBusqueda } from './semantic-intent.provider';

const CONTEXTO: ContextoBusqueda = {
  query: 'quiero algo económico y sano',
  categories: [],
  products: [],
};

function respuestaConTool(input: unknown, usage = { input_tokens: 100, output_tokens: 20 }) {
  return {
    content: [{ type: 'tool_use', id: 'toolu_1', name: 'resolver_busqueda', input }],
    usage,
  };
}

describe('AnthropicSemanticIntentProvider', () => {
  let proveedor: AnthropicSemanticIntentProvider;

  beforeEach(() => {
    mockCreate.mockReset();
    proveedor = new AnthropicSemanticIntentProvider();
  });

  describe('interpretarBusqueda', () => {
    it('mapea una respuesta RESULTS válida y calcula tokensUsed', async () => {
      mockCreate.mockResolvedValueOnce(
        respuestaConTool({
          status: 'RESULTS',
          priceTier: 'ECONOMICO',
          foodTypeCategoryId: 'cat-1',
          healthProfileCategoryId: null,
          vegan: null,
          productTerms: [],
          openRecommendation: false,
          productIds: ['p1', 'p2'],
        }),
      );

      const resultado = await proveedor.interpretarBusqueda(CONTEXTO);

      expect(resultado).toMatchObject({
        kind: 'RESULTS',
        productIds: ['p1', 'p2'],
        tokensUsed: 120,
      });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const [cuerpo, opciones] = mockCreate.mock.calls[0];
      expect(cuerpo.tool_choice).toEqual({ type: 'tool', name: 'resolver_busqueda' });
      expect(cuerpo.temperature).toBe(0);
      expect(opciones).toMatchObject({ timeout: expect.any(Number) });
    });

    it('mapea CLARIFICATION', async () => {
      mockCreate.mockResolvedValueOnce(
        respuestaConTool({
          status: 'CLARIFICATION',
          question: '¿Saludable o económico?',
          options: ['Saludable', 'Económico'],
        }),
      );

      const resultado = await proveedor.interpretarBusqueda(CONTEXTO);
      expect(resultado).toMatchObject({
        kind: 'CLARIFICATION',
        question: '¿Saludable o económico?',
        options: ['Saludable', 'Económico'],
      });
    });

    it('mapea NO_RESULTS', async () => {
      mockCreate.mockResolvedValueOnce(
        respuestaConTool({
          status: 'NO_RESULTS',
          priceTier: null,
          foodTypeCategoryId: null,
          healthProfileCategoryId: null,
          vegan: null,
          productTerms: ['hamburguesa'],
          openRecommendation: false,
        }),
      );

      const resultado = await proveedor.interpretarBusqueda(CONTEXTO);
      expect(resultado.kind).toBe('NO_RESULTS');
    });

    it('reintenta una vez si la primera respuesta no cumple el esquema, y tiene éxito con la segunda', async () => {
      mockCreate
        .mockResolvedValueOnce(respuestaConTool({ status: 'RESULTS' })) // falta priceTier, etc.
        .mockResolvedValueOnce(
          respuestaConTool({
            status: 'NO_RESULTS',
            priceTier: null,
            foodTypeCategoryId: null,
            healthProfileCategoryId: null,
            vegan: null,
            productTerms: [],
            openRecommendation: false,
          }),
        );

      const resultado = await proveedor.interpretarBusqueda(CONTEXTO);
      expect(resultado.kind).toBe('NO_RESULTS');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('lanza un error recuperable si ambos intentos devuelven una salida inválida', async () => {
      mockCreate.mockResolvedValue(respuestaConTool({ status: 'RESULTS' }));

      await expect(proveedor.interpretarBusqueda(CONTEXTO)).rejects.toThrow();
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('lanza un error recuperable si el SDK rechaza la llamada (timeout/red)', async () => {
      mockCreate.mockRejectedValue(new Error('timeout'));

      await expect(proveedor.interpretarBusqueda(CONTEXTO)).rejects.toThrow();
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('lanza un error recuperable si la respuesta no trae ningún bloque tool_use', async () => {
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'hola' }], usage: null });

      await expect(proveedor.interpretarBusqueda(CONTEXTO)).rejects.toThrow();
    });
  });

  describe('interpretarAgregado', () => {
    it('mapea RESOLVED', async () => {
      mockCreate.mockResolvedValueOnce(
        respuestaConTool({ status: 'RESOLVED', productId: 'p1', quantity: 2 }),
      );

      const resultado = await proveedor.interpretarAgregado(CONTEXTO);
      expect(resultado).toMatchObject({ kind: 'RESOLVED', productId: 'p1', quantity: 2 });
    });

    it('mapea NOT_FOUND', async () => {
      mockCreate.mockResolvedValueOnce(respuestaConTool({ status: 'NOT_FOUND' }));

      const resultado = await proveedor.interpretarAgregado(CONTEXTO);
      expect(resultado.kind).toBe('NOT_FOUND');
    });

    it('mapea CLARIFICATION', async () => {
      mockCreate.mockResolvedValueOnce(
        respuestaConTool({
          status: 'CLARIFICATION',
          question: '¿Cuál de estas pizzas?',
          options: ['Napolitana', 'Margarita'],
        }),
      );

      const resultado = await proveedor.interpretarAgregado(CONTEXTO);
      expect(resultado.kind).toBe('CLARIFICATION');
    });
  });
});
