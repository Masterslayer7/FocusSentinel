// All voices, regardless of where they come from, will look like this to the UI
export interface TtsVoice {
  id: string;          // e.g., "en-US-JennyNeural" or "openai-alloy"
  name: string;        // e.g., "Microsoft Jenny" or "OpenAI Alloy"
  provider: 'webspeech' | 'cloud' | 'piper';
  isPremium: boolean;
}

export interface ITtsProvider {
  /** Initialize the engine (e.g., validate API keys, or download Piper models) */
  initialize(config?: any): Promise<void>;
  
  /** Return a list of voices this provider supports so the UI can display them */
  getAvailableVoices(): Promise<TtsVoice[]>;
  
  /** Convert text to audio and play it to completion */
  speak(text: string, voiceId: string, options?: { pitch?: number; rate?: number }): Promise<void>;
}
