import { ITtsProvider, TtsVoice } from './types';

export class WebSpeechProvider implements ITtsProvider {
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('[WebSpeechProvider] Speech synthesis is not supported in this environment.');
    }
    this.isInitialized = true;
  }

  public async getAvailableVoices(): Promise<TtsVoice[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return [];
    }

    const synth = window.speechSynthesis;

    return new Promise<TtsVoice[]>((resolve) => {
      const retrieveAndFilterVoices = () => {
        const nativeVoices = synth.getVoices();
        // Filter for English (en) voices as a baseline
        const englishVoices = nativeVoices.filter((voice) =>
          voice.lang.toLowerCase().startsWith('en')
        );

        const mappedVoices: TtsVoice[] = englishVoices.map((voice) => ({
          id: voice.name,
          name: voice.name,
          provider: 'webspeech',
        }));

        resolve(mappedVoices);
      };

      const voices = synth.getVoices();
      if (voices.length > 0) {
        retrieveAndFilterVoices();
        return;
      }

      // If voices are not yet loaded, wait for the event
      const handleVoicesChanged = () => {
        // Remove listener once we get the voices
        synth.onvoiceschanged = null;
        retrieveAndFilterVoices();
      };

      synth.onvoiceschanged = handleVoicesChanged;

      // Safe timeout logic in case the browser never fires onvoiceschanged
      setTimeout(() => {
        if (synth.onvoiceschanged === handleVoicesChanged) {
          synth.onvoiceschanged = null;
          retrieveAndFilterVoices();
        }
      }, 1500);
    });
  }

  public async speak(
    text: string,
    voiceId: string,
    options?: { pitch?: number; rate?: number }
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      throw new Error('[WebSpeechProvider] Speech synthesis is not supported in this environment.');
    }

    const synth = window.speechSynthesis;

    // Cancel any ongoing speech to start clean   
    synth.cancel();

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      if (options?.pitch !== undefined) {
        utterance.pitch = options.pitch;
      }
      if (options?.rate !== undefined) {
        utterance.rate = options.rate;
      }

      if (voiceId) {
        const nativeVoices = synth.getVoices();
        const matchedVoice = nativeVoices.find((voice) => voice.name === voiceId);
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      utterance.onend = () => {
        resolve();
      };

      utterance.onerror = (event) => {
        reject(new Error(`[WebSpeechProvider] Speech synthesis error: ${event.error}`));
      };

      synth.speak(utterance);
    });
  }
}
