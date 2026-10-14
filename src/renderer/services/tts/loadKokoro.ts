import { KokoroTTS, env, type GenerateOptions } from 'kokoro-js';
// The ONNX runtime, bundled rather than fetched from a CDN (see the
// 'ort-runtime' alias in vite.config.ts).
import wasmUrl from 'ort-runtime/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsUrl from 'ort-runtime/ort-wasm-simd-threaded.jsep.mjs?url';
import type { KokoroModel } from './KokoroProvider';

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

/**
 * Downloads (first time) and loads Kokoro onto the GPU. WebGPU only: on this
 * page WASM runs single-threaded and is slower than real time, while WebGPU
 * generates ~7x faster than real time. The LLM needs WebGPU anyway.
 */
export async function loadKokoro(): Promise<KokoroModel> {
  env.wasmPaths = {
    wasm: new URL(wasmUrl, location.href).href,
    mjs: new URL(mjsUrl, location.href).href,
  };
  const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, { dtype: 'fp32', device: 'webgpu' });
  return {
    // Voice ids come from KOKORO_VOICES, which only lists real Kokoro voices.
    generate: (text, { voice, speed }) => tts.generate(text, { voice: voice as GenerateOptions['voice'], speed }),
  };
}
