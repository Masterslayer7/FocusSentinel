import { CreateMLCEngine } from "@mlc-ai/web-llm";

export async function checkWebGPUSupport(): Promise<{ supported: boolean; details?: string }> {
  if (!navigator.gpu) {
    return {
      supported: false,
      details: "WebGPU is not supported in this environment (navigator.gpu is undefined)."
    };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        details: "Failed to resolve WebGPU adapter."
      };
    }
    return {
      supported: true,
      details: `Adapter: ${adapter.name || "Unknown GPU"}`
    };
  } catch (err: any) {
    return {
      supported: false,
      details: `WebGPU adapter error: ${err?.message || err}`
    };
  }
}

export async function runWebGPUVerification(
  logCallback: (msg: string) => void,
  progressCallback: (percentage: number) => void
): Promise<void> {
  logCallback("Starting WebGPU verification check...");
  const support = await checkWebGPUSupport();
  logCallback(`WebGPU status: ${support.supported ? "SUPPORTED" : "UNSUPPORTED"} (${support.details})`);
  
  if (!support.supported) {
    throw new Error("WebGPU is not supported.");
  }
  
  // Qwen2.5-0.5B-Instruct-q4f16_1-MLC is a lightweight model (~390MB) optimal for dev verification
  const modelId = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
  logCallback(`Requesting model loading for: ${modelId}`);
  
  try {
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        logCallback(`MLC Loader: ${report.text}`);
        const match = report.text.match(/(\d+)%/);
        if (match) {
          progressCallback(parseInt(match[1], 10));
        }
      }
    });
    
    logCallback("Model initialized in VRAM successfully! Generating test completion...");
    const messages = [
      { role: "user" as const, content: "Say the word 'Focus' to confirm you are online." }
    ];
    
    const response = await engine.chat.completions.create({
      messages,
      temperature: 0.1,
      max_tokens: 10
    });
    
    const reply = response.choices[0].message.content;
    logCallback(`LLM Response: "${reply}"`);
    
    logCallback("Purging model to release GPU memory (VRAM)...");
    await engine.unload();
    logCallback("Verification successfully completed. VRAM released.");
  } catch (err: any) {
    logCallback(`MLC Engine error: ${err?.message || err}`);
    throw err;
  }
}
