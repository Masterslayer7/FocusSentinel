import { vi } from 'vitest';

// Mock of what preload exposes on window.api, for Vitest's jsdom environment.
// Typed against global.d.ts, so it fails to compile if the two drift apart.
const mockApi: Window['api'] = {
  onFocusEvent: vi.fn(() => () => {}),
  loadState: vi.fn(async () => ({})),
  saveState: vi.fn(async () => {}),
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
};

// Main-process tests run in a Node environment with no window.
if (typeof window !== 'undefined') {
  window.api = mockApi;
}
