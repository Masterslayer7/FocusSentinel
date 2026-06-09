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

// Mock the navigator.mediaDevices API globally for testing environment
const mockMediaDevices = {
  enumerateDevices: vi.fn().mockResolvedValue([
    { kind: 'videoinput', label: 'FaceTime HD Camera', deviceId: 'cam-1' },
    { kind: 'videoinput', label: 'USB Web Camera', deviceId: 'cam-2' }
  ]),
  getUserMedia: vi.fn().mockResolvedValue({
    getTracks: () => [
      { stop: vi.fn() }
    ]
  })
};

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: mockMediaDevices,
  writable: true,
  configurable: true
});
