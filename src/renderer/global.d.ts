import type { PersistedState, SamplerEvent, StoredState } from '../shared/types';

// What preload.ts exposes through contextBridge. Keep the two in step.
declare global {
  interface Window {
    api: {
      onFocusEvent: (callback: (event: SamplerEvent) => void) => () => void;
      loadState: () => Promise<StoredState>;
      saveState: (state: PersistedState) => Promise<void>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
    };
  }
}
