import type { SamplerEvent } from '../shared/types';

// What preload.ts exposes through contextBridge. Keep the two in step.
declare global {
  interface Window {
    api: {
      onFocusEvent: (callback: (event: SamplerEvent) => void) => () => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}
