import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import App from './App';

describe('FocusSentinel App React UI', () => {
  let telemetryCallback: (data: any) => void = () => {};

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Intercept the telemetry callback to simulate incoming events in tests
    (window.api.onTelemetry as any).mockImplementation((cb: any) => {
      telemetryCallback = cb;
      return vi.fn(); // unsubscribe mockup
    });
  });

  test('should render headers, controls, and telemetry gauges', () => {
    render(<App />);
    
    expect(screen.getByText((content, element) => element?.textContent === 'FocusSentinel')).toBeDefined();
    expect(screen.getByText('Focus Mode')).toBeDefined();
    expect(screen.getByText('IPC Control Board')).toBeDefined();
    expect(screen.getByText('Computer Vision Telemetry')).toBeDefined();
    expect(screen.getByText('Inactive (Camera Off)')).toBeDefined();
  });

  test('should toggle focus switch and invoke window.api.sendCommand', async () => {
    render(<App />);
    
    const toggle = screen.getByRole('checkbox') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    
    // Toggle ON (Focus Active)
    await act(async () => {
      fireEvent.click(toggle);
    });
    
    expect(toggle.checked).toBe(true);
    expect(window.api.sendCommand).toHaveBeenCalledWith('change_state', { state: 'FOCUS' });
    expect(await screen.findByText('Active (Camera On)')).toBeDefined();

    // Toggle OFF (Break Active)
    await act(async () => {
      fireEvent.click(toggle);
    });
    
    expect(toggle.checked).toBe(false);
    expect(window.api.sendCommand).toHaveBeenCalledWith('change_state', { state: 'BREAK' });
    expect(await screen.findByText('Inactive (Camera Off)')).toBeDefined();
  });

  test('should update UI when telemetry indicates phone is detected', async () => {
    render(<App />);
    
    // Simulate telemetry packet inside act() block to trigger state updates
    await act(async () => {
      telemetryCallback({
        type: 'telemetry',
        data: {
          phone_detected: true
        }
      });
    });
    
    expect(await screen.findByText('Phone Detected!')).toBeDefined();
  });

  test('should update status badge when camera is released', async () => {
    render(<App />);
    
    // Simulate status change inside act() block
    await act(async () => {
      telemetryCallback({
        type: 'status',
        camera: 'released'
      });
    });
    
    expect(await screen.findByText('Camera Released (Low Power)')).toBeDefined();
  });
});
