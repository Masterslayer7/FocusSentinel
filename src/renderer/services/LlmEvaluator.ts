import { CreateMLCEngine, type EngineInterface, hasModelInCache, deleteModelAllInfoInCache } from "@mlc-ai/web-llm";

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

  private engine: EngineInterface | null = null;
  private currentModelId: string | null = null;

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
  public updateStatus(state: LlmState, progress = 0, message = ''): void {
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
   * Placeholder text generation method stub (implemented in Step 2.4/2.5).
   */
  public async evaluate(prompt: string): Promise<string> {
    if (!this.engine) {
      throw new Error("Cannot evaluate: WebGPU engine is not initialized.");
    }
    this.updateStatus('generating', 100, `Evaluating prompt: ${prompt}`);
    const mockResponse = `Stub response to: ${prompt}`;
    this.updateStatus('ready', 100, 'Evaluation complete');
    return mockResponse;
  }

  /**
   * Placeholder cancellation method stub (implemented in Step 2.5/2.6).
   */
  public cancel(): void {
    this.updateStatus('ready', 100, 'Active generation request cancelled');
  }
}

// Export the singleton evaluator service as default
const llmEvaluator = new LlmEvaluator();
export default llmEvaluator;
