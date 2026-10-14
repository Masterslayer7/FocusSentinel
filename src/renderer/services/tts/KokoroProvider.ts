import { playThroughSpeakers } from './playAudio';
import type { ITtsProvider, TtsVoice } from './types';

/** The slice of kokoro-js's KokoroTTS this provider uses; lets tests pass a fake. */
export interface KokoroModel {
  generate(text: string, options: { voice: string; speed: number }): Promise<{ audio: Float32Array; sampling_rate: number }>;
}

/** Audio that is playing: done resolves when it ends or is stopped. */
export interface Playback {
  done: Promise<void>;
  stop(): void;
}

export type PlayAudio = (samples: Float32Array, sampleRate: number) => Playback;

const DEFAULT_VOICE = 'af_heart';

const kokoro = (id: string, name: string): TtsVoice => ({ id, name, provider: 'kokoro' });

/** The better-graded English voices of Kokoro-82M v1.0, best first within each group. */
export const KOKORO_VOICES: TtsVoice[] = [
  kokoro('af_heart', 'Heart (US female)'),
  kokoro('af_bella', 'Bella (US female)'),
  kokoro('af_nicole', 'Nicole (US female, soft)'),
  kokoro('af_sarah', 'Sarah (US female)'),
  kokoro('am_fenrir', 'Fenrir (US male, deep)'),
  kokoro('am_michael', 'Michael (US male)'),
  kokoro('am_puck', 'Puck (US male)'),
  kokoro('bf_emma', 'Emma (UK female)'),
  kokoro('bf_isabella', 'Isabella (UK female)'),
  kokoro('bm_george', 'George (UK male)'),
  kokoro('bm_fable', 'Fable (UK male)'),
];

// Loaded on first use as its own chunk, so the app starts without kokoro-js.
const loadKokoro = () => import('./loadKokoro').then((module) => module.loadKokoro());

/**
 * Kokoro-82M, a neural TTS model, run on the GPU in the renderer. The model
 * (~300 MB) downloads once on first use and is cached by the browser. Pitch is
 * ignored: Kokoro has speed but no pitch control.
 */
export class KokoroProvider implements ITtsProvider {
  private model: Promise<KokoroModel> | null = null;
  private playback: Playback | null = null;
  // Bumped by stop(), so a sentence still being generated is never played.
  private generation = 0;

  constructor(
    private readonly loadModel: () => Promise<KokoroModel> = loadKokoro,
    private readonly play: PlayAudio = playThroughSpeakers,
  ) {}

  /** Starts the model download early, so the first check-in is not kept waiting. */
  public async initialize(): Promise<void> {
    await this.getModel();
  }

  public async getAvailableVoices(): Promise<TtsVoice[]> {
    return KOKORO_VOICES;
  }

  public onVoicesChanged(_listener: () => void): () => void {
    return () => {}; // the voice list is fixed
  }

  public async speak(text: string, voiceId: string, options?: { pitch?: number; rate?: number }): Promise<void> {
    const generation = this.generation;
    const model = await this.getModel();
    const { audio, sampling_rate } = await model.generate(text, {
      voice: voiceId || DEFAULT_VOICE,
      speed: options?.rate ?? 1,
    });
    if (generation !== this.generation) return;

    this.playback?.stop();
    const playback = this.play(audio, sampling_rate);
    this.playback = playback;
    await playback.done;
    if (this.playback === playback) this.playback = null;
  }

  public stop(): void {
    this.generation++;
    this.playback?.stop();
    this.playback = null;
  }

  private getModel(): Promise<KokoroModel> {
    this.model ??= this.loadModel().catch((error: unknown) => {
      this.model = null; // let the next call try the download again
      throw error;
    });
    return this.model;
  }
}
