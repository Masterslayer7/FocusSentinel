import type { Playback } from './KokoroProvider';

/** Plays mono samples through the default output device. Not unit tested: jsdom has no AudioContext. */
export function playThroughSpeakers(samples: Float32Array, sampleRate: number): Playback {
  const context = new AudioContext();
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);

  const done = new Promise<void>((resolve) => {
    source.onended = () => {
      void context.close();
      resolve();
    };
  });
  source.start();
  return { done, stop: () => source.stop() };
}
