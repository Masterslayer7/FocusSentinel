import { useCallback, useEffect, useRef, useState } from 'react';
import type { LlmStatusUpdate } from './LlmEvaluator';

/** The slice of LlmEvaluator this hook needs; lets tests pass a fake. */
export interface ModelLoader {
  subscribe(listener: (status: LlmStatusUpdate) => void): () => void;
  initialize(modelId: string): Promise<void>;
  isModelCached(modelId: string): Promise<boolean>;
}

/** Models offered in the picker, smallest first. All are web-llm prebuilt ids. */
export const MODEL_CHOICES = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 0.5B — smallest, fastest' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 1B' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 1.5B' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 3B — best wording, needs more VRAM' },
] as const;

/**
 * Model status and loading for the Coach panel. Once saved state is ready, the
 * saved model is loaded automatically only if its weights are already cached:
 * a download only ever starts from an explicit load().
 */
export function useLlmModel(loader: ModelLoader, savedModelId: string | null, isStateLoaded: boolean) {
  const [status, setStatus] = useState<LlmStatusUpdate>({ state: 'uninitialized', progress: 0 });
  const autoLoadTried = useRef(false);

  useEffect(() => loader.subscribe(setStatus), [loader]);

  const load = useCallback(
    async (modelId: string) => {
      try {
        await loader.initialize(modelId);
      } catch {
        // The evaluator has already published an 'error' status with the reason.
      }
    },
    [loader],
  );

  useEffect(() => {
    if (!isStateLoaded || !savedModelId || autoLoadTried.current) return;
    autoLoadTried.current = true;
    loader.isModelCached(savedModelId).then((cached) => {
      if (cached) void load(savedModelId);
    });
  }, [isStateLoaded, savedModelId, loader, load]);

  return { status, load };
}
