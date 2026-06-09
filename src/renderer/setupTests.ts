import { vi } from 'vitest';

// Define the window.api mock interface for Vitest's jsdom environment
const mockApi = {
  onTelemetry: vi.fn(() => {
    // Returns a mock unsubscribe function
    return vi.fn();
  }),
  sendCommand: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
};

// Expose the mock interface globally
(global as any).window = global.window || {};
(global.window as any).api = mockApi;
