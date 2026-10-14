import { describe, test, expect, vi, afterEach } from 'vitest';
import { pickModelVariant, supportsShaderF16 } from './modelVariant';

describe('pickModelVariant', () => {
  test('keeps the f16 model when the GPU supports shader-f16', () => {
    expect(pickModelVariant('Qwen2.5-0.5B-Instruct-q4f16_1-MLC', true)).toBe('Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  });

  test('swaps an f16 model for its f32 build when the GPU lacks shader-f16', () => {
    expect(pickModelVariant('Qwen2.5-0.5B-Instruct-q4f16_1-MLC', false)).toBe('Qwen2.5-0.5B-Instruct-q4f32_1-MLC');
    expect(pickModelVariant('Llama-3.2-3B-Instruct-q4f16_1-MLC', false)).toBe('Llama-3.2-3B-Instruct-q4f32_1-MLC');
  });

  test('leaves a model that has no f16 marker alone', () => {
    expect(pickModelVariant('Qwen2.5-0.5B-Instruct-q4f32_1-MLC', false)).toBe('Qwen2.5-0.5B-Instruct-q4f32_1-MLC');
  });
});

describe('supportsShaderF16', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubAdapter = (adapter: unknown) => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn().mockResolvedValue(adapter) } });
  };

  test('is true when the adapter lists shader-f16', async () => {
    stubAdapter({ features: new Set(['shader-f16']) });
    expect(await supportsShaderF16()).toBe(true);
  });

  test('is false when the adapter does not list shader-f16', async () => {
    stubAdapter({ features: new Set() });
    expect(await supportsShaderF16()).toBe(false);
  });

  test('is false when there is no adapter or no WebGPU at all', async () => {
    stubAdapter(null);
    expect(await supportsShaderF16()).toBe(false);

    vi.stubGlobal('navigator', {});
    expect(await supportsShaderF16()).toBe(false);
  });
});
