// Our model picker offers q4f16 builds. Their shaders open with `enable f16;`,
// which fails to compile ("Invalid ShaderModule ... index_kernel") on a GPU
// whose WebGPU adapter lacks shader-f16. web-llm ships a q4f32 build of each,
// which compiles everywhere at the cost of roughly double the VRAM.

const F16_MARKER = 'q4f16_1';
const F32_MARKER = 'q4f32_1';

/** The model id to actually load, given whether the GPU can run f16 shaders. */
export function pickModelVariant(modelId: string, hasShaderF16: boolean): string {
  if (hasShaderF16 || !modelId.includes(F16_MARKER)) {
    return modelId;
  }
  return modelId.replace(F16_MARKER, F32_MARKER);
}

// The slice of the WebGPU API we touch. TypeScript's DOM lib has no WebGPU
// types, and this is too small to justify adding @webgpu/types.
interface GpuNavigator {
  gpu?: { requestAdapter(): Promise<{ features: ReadonlySet<string> } | null> };
}

/** Whether the default WebGPU adapter supports f16 shaders. No WebGPU counts as "no". */
export async function supportsShaderF16(): Promise<boolean> {
  try {
    const adapter = await (navigator as GpuNavigator).gpu?.requestAdapter();
    return adapter?.features.has('shader-f16') ?? false;
  } catch {
    return false;
  }
}
