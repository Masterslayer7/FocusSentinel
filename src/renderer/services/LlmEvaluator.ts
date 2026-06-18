export type LlmState = 'uninitialized' | 'downloading' | 'loading' | 'ready' | 'generating' | 'error';

// Represents the LLMs status at a point in time
export interface LlmStatusUpdate {
  state: LlmState;
  progress: number; // Percentage value (0 to 100)
  message?: string; // Informational logs (e.g. download details)
}

//
export type LlmStateListener = (status: LlmStatusUpdate) => void;

export class LlmEvaluator {
  private listeners = new Set<LlmStateListener>();
  private currentState: LlmState = 'uninitialized';
  private currentProgress = 0;
  private currentMessage = '';

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
   * Placeholder loader method stub (implemented in Step 2.3).
   */
  public async initialize(modelId: string): Promise<void> {
    this.updateStatus('loading', 0, `Initializing model loader for: ${modelId}`);
    // Async loader tasks will be added here
    this.updateStatus('ready', 100, `Model ${modelId} ready for evaluation`);
  }

  /**
   * Placeholder text generation method stub (implemented in Step 2.4/2.5).
   */
  public async evaluate(prompt: string): Promise<string> {
    this.updateStatus('generating', 100, `Evaluating prompt: ${prompt}`);
    // Generation task will be added here
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
