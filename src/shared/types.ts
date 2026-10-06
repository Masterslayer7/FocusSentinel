// Types shared across process boundaries (main → preload → renderer).
// Keep this file strictly types: no consts, enums, or functions. The renderer
// imports it across vite's `root` boundary, which is safe only because
// type-only imports are erased before anything tries to resolve them.

/**
 * One observation of the foreground window. Produced in the main process,
 * carried over IPC, consumed by FocusTracker in the renderer.
 *
 * windowTitle is personal activity data: compare it in memory, never render,
 * log, or persist it. See context.md constraint 1.
 */
export interface WindowSample {
  appName: string;
  windowTitle: string;
  timestamp: number; // ms since epoch, supplied by the sampler
}

/** Why the sampler cannot currently report samples. */
export interface SamplerError {
  reason: 'addon-unavailable' | 'query-failed';
  message: string;
}

/** Everything the sampler sends to the renderer, as a discriminated union. */
export type SamplerEvent =
  | { kind: 'sample'; sample: WindowSample }
  | { kind: 'error'; error: SamplerError };
