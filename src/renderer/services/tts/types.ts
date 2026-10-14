// All voices, regardless of where they come from, will look like this to the UI
export interface TtsVoice {
  id: string;
  name: string;
  provider: 'webspeech' | 'cloud' | 'piper';
}

export interface ITtsProvider {
  /** Initialize the engine (e.g., validate API keys, or download Piper models) */
  initialize(config?: any): Promise<void>;
  
  /** Return a list of voices this provider supports so the UI can display them */
  getAvailableVoices(): Promise<TtsVoice[]>;
  
  /** Convert text to audio and play it to completion */
  speak(text: string, voiceId: string, options?: { pitch?: number; rate?: number }): Promise<void>;

  /** Cut off whatever is speaking now. Safe to call when nothing is. */
  stop(): void;

  /**
   * Call listener whenever the installed voices change; returns an unsubscribe.
   * Windows can take seconds to report its voices after the app starts.
   */
  onVoicesChanged(listener: () => void): () => void;
}
