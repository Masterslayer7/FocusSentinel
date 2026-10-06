import { CreateMLCEngine, type MLCEngineInterface, hasModelInCache, deleteModelAllInfoInCache } from "@mlc-ai/web-llm";
import { buildPrompt, trimTrailingIncompleteSentence } from "./PromptBuilder";
import type { LlmPreset, EvaluatorContext } from "./PromptBuilder";

export type { LlmPreset, EvaluatorContext };

export type LlmState = 'uninitialized' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error';

export interface LlmStatusUpdate {
  state: LlmState;
  progress: number; // Percentage value (0 to 100)
  message?: string; // Informational logs (e.g. download details)
}

export type LlmStateListener = (status: LlmStatusUpdate) => void;

/** evaluate() returns '' for distractions shorter than this. Exported so callers can gate on the same value. */
export const MIN_DISTRACTION_SECONDS = 5;

export class LlmEvaluator {
  private listeners = new Set<LlmStateListener>();
  private currentState: LlmState = 'uninitialized';
  private currentProgress = 0;
  private currentMessage = '';

  private engine: MLCEngineInterface | null = null;
  private currentModelId: string | null = null;

  // Time-based thresholds and state trackers
  private lastSpeechTime = 0;                    // timestamp in milliseconds
  private readonly speechCooldown = 120000;       // in milliseconds (2 minutes)
  private readonly minDistractionDuration = MIN_DISTRACTION_SECONDS;
  private isAborted = false;

  /**
   * Retrieves the current state of the LLM service.
   */
  public getState(): LlmState {
    return this.currentState;
  }

  /**
   * Retrieves the current loading/download progress percentage.
   */
  public getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Retrieves the current status or log message.
   */
  public getMessage(): string {
    return this.currentMessage;
  }

  /**
   * Subscribes a listener callback to receive updates on state, progress, and logs.
   * Returns an unsubscribe function to safely clear the registration.
   */
  public subscribe(listener: LlmStateListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify the new subscriber of the current status
    listener({
      state: this.currentState,
      progress: this.currentProgress,
      message: this.currentMessage
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Updates the internal service status and notifies all registered listeners.
   */
  private updateStatus(state: LlmState, progress = 0, message = ''): void {
    this.currentState = state;
    this.currentProgress = progress;
    this.currentMessage = message;

    const status: LlmStatusUpdate = {
      state,
      progress,
      message
    };

    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[LlmEvaluator] Error in listener callback:', err);
      }
    });
  }

  /**
   * Whether a model's weights are already in the browser cache, so loading it
   * needs no download. A lookup failure counts as "not cached".
   */
  public async isModelCached(modelId: string): Promise<boolean> {
    try {
      return await hasModelInCache(modelId);
    } catch {
      return false;
    }
  }

  /**
   * Initializes the MLC Engine and loads model weights into VRAM.
   * Leverages progress callbacks to update download and loading status.
   */
  public async initialize(modelId: string): Promise<void> {
    // If the requested model is already loaded, skip initialization
    if (this.engine && this.currentModelId === modelId) {
      this.updateStatus('ready', 100, `Model ${modelId} is already initialized and cached in VRAM`);
      return;
    }

    // If another model is currently loaded, unload it first
    if (this.engine) {
      this.updateStatus('loading', 0, `Unloading existing model ${this.currentModelId} before loading ${modelId}...`);
      await this.unloadModel();
    }

    this.updateStatus('loading', 0, `Starting WebGPU engine loader for: ${modelId}`);

    try {
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          // Parse percentage from logs (e.g. "Fetch 3/8: 45%")
          const progressMatch = report.text.match(/(\d+)%/);
          const progress = progressMatch ? parseInt(progressMatch[1], 10) : 0;

          // Categorize state as downloading if network fetch is happening, otherwise loading (compilation)
          const isFetching = report.text.toLowerCase().includes('fetch');
          const state = isFetching ? 'downloading' : 'loading';

          this.updateStatus(state, progress, report.text);
        }
      });

      this.engine = engine;
      this.currentModelId = modelId;
      this.updateStatus('ready', 100, `Model ${modelId} successfully loaded in VRAM`);
    } catch (err: any) {
      this.updateStatus('error', 0, `Failed to load model: ${err?.message || err}`);
      throw err;
    }
  }

  /**
   * Unloads the model weights and releases graphics memory (VRAM).
   */
  public async unloadModel(): Promise<void> {
    if (this.engine) {
      this.updateStatus('loading', 100, `Unloading ${this.currentModelId} and clearing VRAM...`);
      try {
        await this.engine.unload();
      } catch (err) {
        console.error('[LlmEvaluator] Error unloading engine:', err);
      }
      this.engine = null;
      this.currentModelId = null;
    }
    this.updateStatus('uninitialized', 0, 'Model weights cleared from VRAM');
  }

  /**
   * Programmatically deletes the model's files from the browser's Cache Storage.
   */
  public async deleteModelFromDisk(modelId: string): Promise<void> {
    this.updateStatus('loading', 0, `Purging local disk cache directories for: ${modelId}`);
    try {
      const inCache = await hasModelInCache(modelId);
      let responseMsg = '';

      if (inCache) {
        await deleteModelAllInfoInCache(modelId);
        responseMsg = `Successfully purged model cache for ${modelId} from disk`;
      } else {
        responseMsg = `No local cache directory found for ${modelId}`;
      }

      // If the currently loaded model cache was deleted, reset local engine contexts
      if (this.currentModelId === modelId) {
        this.engine = null;
        this.currentModelId = null;
      }

      this.updateStatus('uninitialized', 0, responseMsg);
    } catch (err: any) {
      this.updateStatus('error', 0, `Failed to delete model cache directories: ${err?.message || err}`);
      throw err;
    }
  }

  /**
   * Text generation method. Compiles prompts from the preset and context, 
   * invokes the local WebGPU model, and yields the trimmed spoken response.
   * Includes debounce, cooldown, and abort handling logic.
   */
  public async evaluate(preset: LlmPreset, context: EvaluatorContext): Promise<string> {
    if (!this.engine) {
      throw new Error("Cannot evaluate: WebGPU engine is not initialized.");
    }

    // Debounce Guard: verify distraction duration threshold
    if (context.distractionDuration < this.minDistractionDuration) {
      this.updateStatus('ready', 100, `Evaluation skipped: distraction duration (${context.distractionDuration}s) below ${this.minDistractionDuration}s`);
      return '';
    }

    // Cooldown Guard: verify time since last speech
    const now = Date.now();
    if (now - this.lastSpeechTime < this.speechCooldown) {
      this.updateStatus('ready', 100, 'Evaluation skipped: cooldown active');
      return '';
    }

    // Reset Abort Status
    this.isAborted = false;
    this.updateStatus('generating', 100, `Generating check-in using preset: ${preset}...`);
    const engine = this.engine;

    try {
      const { systemPrompt, userPrompt } = buildPrompt(preset, context);

      const response = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 96, // two spoken sentences, with room to finish the second
      });
      const modelReply = response.choices[0]?.message?.content ?? '';

      // cancel() interrupts generation, which can still resolve with a partial reply.
      if (this.isAborted) {
        throw new Error("Evaluation aborted");
      }

      const reply = trimTrailingIncompleteSentence(modelReply);
      this.lastSpeechTime = Date.now(); // Record success timestamp
      this.updateStatus('ready', 100, 'Evaluation complete');
      return reply;
    } catch (err: any) {
      // If aborted, update status accordingly, otherwise transition to error
      if (this.isAborted) {
        this.updateStatus('ready', 100, 'Generation aborted by user action');
      } else {
        this.updateStatus('error', 0, `Failed to generate response: ${err?.message || err}`);
      }
      throw err;
    }
  }

  /**
   * Cancels active text generation immediately and signals the WebGPU engine to stop.
   */
  public cancel(): void {
    this.isAborted = true;
    if (this.engine) {
      // MLCEngineInterface types this as void, but MLCEngine returns a Promise.
      Promise.resolve(this.engine.interruptGenerate()).catch((err: unknown) => {
        console.error('[LlmEvaluator] Error interrupting WebLLM generation:', err);
      });
    }
    this.updateStatus('ready', 100, 'Active generation request cancelled');
  }
}

// Export the singleton evaluator service as default
const llmEvaluator = new LlmEvaluator();
export default llmEvaluator;
