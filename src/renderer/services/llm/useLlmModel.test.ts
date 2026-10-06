import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLlmModel, type ModelLoader } from './useLlmModel';
import type { LlmStatusUpdate } from './LlmEvaluator';

describe('useLlmModel', () => {
  let listener: (status: LlmStatusUpdate) => void;
  let loader: ModelLoader;
  let initialize: ReturnType<typeof vi.fn<ModelLoader['initialize']>>;
  let isModelCached: ReturnType<typeof vi.fn<ModelLoader['isModelCached']>>;

  beforeEach(() => {
    initialize = vi.fn<ModelLoader['initialize']>().mockResolvedValue(undefined);
    isModelCached = vi.fn<ModelLoader['isModelCached']>().mockResolvedValue(false);
    loader = {
      subscribe: (callback) => {
        listener = callback;
        callback({ state: 'uninitialized', progress: 0, message: '' });
        return () => {};
      },
      initialize,
      isModelCached,
    };
  });

  test('mirrors the evaluator status', () => {
    const { result } = renderHook(() => useLlmModel(loader, null, false));

    act(() => listener({ state: 'downloading', progress: 40, message: 'Fetching 3/8: 40%' }));

    expect(result.current.status).toEqual({ state: 'downloading', progress: 40, message: 'Fetching 3/8: 40%' });
  });

  test('load initializes the chosen model', async () => {
    const { result } = renderHook(() => useLlmModel(loader, null, false));

    await act(async () => result.current.load('Qwen2.5-0.5B-Instruct-q4f16_1-MLC'));

    expect(initialize).toHaveBeenCalledWith('Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  });

  test('a failed load does not throw into the UI', async () => {
    initialize.mockRejectedValue(new Error('No WebGPU adapter'));
    const { result } = renderHook(() => useLlmModel(loader, null, false));

    await expect(act(async () => result.current.load('x'))).resolves.not.toThrow();
  });

  test('auto-loads the saved model once state has loaded, if it is already downloaded', async () => {
    isModelCached.mockResolvedValue(true);
    const { rerender } = renderHook(({ ready }) => useLlmModel(loader, 'saved-model', ready), {
      initialProps: { ready: false },
    });
    expect(isModelCached).not.toHaveBeenCalled();

    rerender({ ready: true });

    await waitFor(() => expect(initialize).toHaveBeenCalledWith('saved-model'));
  });

  test('never starts a download on its own', async () => {
    isModelCached.mockResolvedValue(false);
    renderHook(() => useLlmModel(loader, 'saved-model', true));

    await waitFor(() => expect(isModelCached).toHaveBeenCalledWith('saved-model'));
    expect(initialize).not.toHaveBeenCalled();
  });
});
