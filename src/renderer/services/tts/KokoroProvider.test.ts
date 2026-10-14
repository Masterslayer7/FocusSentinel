import { describe, test, expect, vi } from 'vitest';
import { KokoroProvider, KOKORO_VOICES, type KokoroModel, type PlayAudio } from './KokoroProvider';

const AUDIO = { audio: new Float32Array([0.1, 0.2]), sampling_rate: 24000 };

/** A model whose generate() can be held open, and playback that ends when the test says. */
function setup() {
  let releaseGenerate: (() => void) | null = null;
  let holdGenerate = false;
  const model: KokoroModel = {
    generate: vi.fn(async () => {
      if (holdGenerate) await new Promise<void>((resolve) => (releaseGenerate = resolve));
      return AUDIO;
    }),
  };
  const loadModel = vi.fn(async () => model);

  const endings: (() => void)[] = [];
  const play = vi.fn<PlayAudio>(() => {
    let end!: () => void;
    const done = new Promise<void>((resolve) => (end = resolve));
    endings.push(end);
    return { done, stop: end };
  });

  const provider = new KokoroProvider(loadModel, play);
  const endPlayback = () => endings.shift()?.();
  const hold = () => (holdGenerate = true);
  const release = () => releaseGenerate?.();
  // Lets awaited model loading and generation settle.
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { provider, model, loadModel, play, endPlayback, hold, release, flush };
}

describe('KokoroProvider', () => {
  test('lists its English voices without downloading the model', async () => {
    const { provider, loadModel } = setup();

    const voices = await provider.getAvailableVoices();

    expect(voices).toEqual(KOKORO_VOICES);
    expect(voices.every((voice) => voice.provider === 'kokoro')).toBe(true);
    expect(loadModel).not.toHaveBeenCalled();
  });

  test('speaks by generating audio in the voice, at the rate, then playing it to the end', async () => {
    const { provider, model, play, endPlayback, flush } = setup();

    let finished = false;
    const speaking = provider.speak('Back to work!', 'am_fenrir', { rate: 1.2, pitch: 0.6 }).then(() => (finished = true));
    await flush();

    expect(model.generate).toHaveBeenCalledWith('Back to work!', { voice: 'am_fenrir', speed: 1.2 });
    expect(play).toHaveBeenCalledWith(AUDIO.audio, AUDIO.sampling_rate);
    expect(finished).toBe(false);

    endPlayback();
    await speaking;
    expect(finished).toBe(true);
  });

  test('an empty voice id means the default voice, at normal speed', async () => {
    const { provider, model, endPlayback, flush } = setup();

    const speaking = provider.speak('Hi', '');
    await flush();
    endPlayback();
    await speaking;

    expect(model.generate).toHaveBeenCalledWith('Hi', { voice: 'af_heart', speed: 1 });
  });

  test('loads the model once, on initialize or first speak, and reuses it', async () => {
    const { provider, loadModel, endPlayback, flush } = setup();

    await provider.initialize();
    const speaking = provider.speak('One', 'af_heart');
    await flush();
    endPlayback();
    await speaking;

    expect(loadModel).toHaveBeenCalledTimes(1);
  });

  test('a failed download is retried on the next speak', async () => {
    const { provider, loadModel, endPlayback, flush } = setup();
    loadModel.mockRejectedValueOnce(new Error('offline'));

    await expect(provider.speak('One', 'af_heart')).rejects.toThrow('offline');

    const speaking = provider.speak('Two', 'af_heart');
    await flush();
    endPlayback();
    await speaking;
    expect(loadModel).toHaveBeenCalledTimes(2);
  });

  test('stop cuts off playback and ends the speak', async () => {
    const { provider, flush } = setup();

    const speaking = provider.speak('A long lecture', 'af_heart');
    await flush();
    provider.stop();

    await expect(speaking).resolves.toBeUndefined();
  });

  test('a sentence stopped while still being generated is never played', async () => {
    const { provider, play, hold, release, flush } = setup();
    hold();

    const speaking = provider.speak('Too late', 'af_heart');
    await flush();
    provider.stop();
    release();
    await speaking;

    expect(play).not.toHaveBeenCalled();
  });

  test('its voice list never changes, so the subscription is a no-op', () => {
    const { provider } = setup();
    const listener = vi.fn();

    const unsubscribe = provider.onVoicesChanged(listener);

    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});
