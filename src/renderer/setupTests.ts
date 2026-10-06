import { vi } from 'vitest';

// Mock of what preload exposes on window.api, for Vitest's jsdom environment.
// Typed against global.d.ts, so it fails to compile if the two drift apart.
const mockApi: Window['api'] = {
  onFocusEvent: vi.fn(() => () => {}),
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
};

window.api = mockApi;
