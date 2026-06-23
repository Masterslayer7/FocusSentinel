import { CreateMLCEngine, type MLCEngineInterface, hasModelInCache, deleteModelAllInfoInCache } from "@mlc-ai/web-llm";
import { LlmPreset, EvaluatorContext, buildPrompt, trimTrailingIncompleteSentence } from "./PromptBuilder";

export { LlmPreset, EvaluatorContext };

export type LlmState = 'uninitialized' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error';

export interface LlmStatusUpdate {
  state: LlmState;
  progress: number; // Percentage value (0 to 100)
  message?: string; // Informational logs (e.g. download details)
}

export type LlmStateListener = (status: LlmStatusUpdate) => void;

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
  private readonly minDistractionDuration = 5;    // in seconds
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
      this.updateStatus('ready', 100, `Evaluation skipped: distraction duration (${context.distractionDuration}s) below 5s`);
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
    this.updateStatus('generating', 100, `Generating reprimand using preset: ${preset}...`);

    try {
      const { systemPrompt, userPrompt } = buildPrompt(preset, context);

      // During Phase 2 Step 2.4 and 2.5, we will return a structured stub that includes
      // the system and user prompts to verify correctness in tests and UI console logs.
      const mockReply = `[Stub] [System: ${preset}] [User: ${userPrompt.replace(/\n/g, ' ')}]`;
      
      // Simulate async delay to allow testing cancellation/abort mid-generation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Abort Check post-completion (or post-mock)
      if (this.isAborted) {
        throw new Error("Evaluation aborted");
      }

      const reply = trimTrailingIncompleteSentence(mockReply);
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
      this.engine.interruptGenerate().catch((err) => {
        console.error('[LlmEvaluator] Error interrupting WebLLM generation:', err);
      });
    }
    this.updateStatus('ready', 100, 'Active generation request cancelled');
  }
}

// Export the singleton evaluator service as default
const llmEvaluator = new LlmEvaluator();
export default llmEvaluator;
