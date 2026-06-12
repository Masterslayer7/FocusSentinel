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

  test('should render headers, controls, and telemetry gauges', async () => {
    render(<App />);
    expect(await screen.findByLabelText('Active Camera Source')).toBeDefined();
    
    expect(screen.getByText((content, element) => element?.textContent === 'FocusSentinel')).toBeDefined();
    expect(screen.getByText('Focus Mode')).toBeDefined();
    expect(screen.getByText('IPC Control Board')).toBeDefined();
    expect(screen.getByText('Computer Vision Telemetry')).toBeDefined();
    expect(screen.getByText('Inactive (Camera Off)')).toBeDefined();
  });

  test('should toggle focus switch and invoke window.api.sendCommand', async () => {
    render(<App />);
    expect(await screen.findByLabelText('Active Camera Source')).toBeDefined();
    
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
    expect(await screen.findByLabelText('Active Camera Source')).toBeDefined();
    
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
    expect(await screen.findByLabelText('Active Camera Source')).toBeDefined();
    
    // Simulate status change inside act() block
    await act(async () => {
      telemetryCallback({
        type: 'status',
        camera: 'released'
      });
    });
    
    expect(await screen.findByText('Camera Released (Low Power)')).toBeDefined();
  });

  test('should render camera options and trigger window.api.sendCommand when camera is changed', async () => {
    render(<App />);
    
    // Wait for the mock devices to be enumerated and rendered
    const select = await screen.findByLabelText('Active Camera Source') as HTMLSelectElement;
    expect(select).toBeDefined();
    
    // Check that both cameras are listed
    expect(screen.getByText('FaceTime HD Camera')).toBeDefined();
    expect(screen.getByText('USB Web Camera')).toBeDefined();
    expect(select.value).toBe('0'); // Default to camera index 0
    
    // Change selected camera option to index 1
    await act(async () => {
      fireEvent.change(select, { target: { value: '1' } });
    });
    
    expect(select.value).toBe('1');
    expect(window.api.sendCommand).toHaveBeenCalledWith('change_camera', { index: 1 });
  });

  test('should render threshold slider and trigger sendCommand when threshold changes', async () => {
    render(<App />);
    const slider = await screen.findByLabelText('Detection Confidence') as HTMLInputElement;
    expect(slider).toBeDefined();
    expect(slider.value).toBe('0.75'); // Default value

    await act(async () => {
      fireEvent.change(slider, { target: { value: '0.6' } });
    });

    expect(slider.value).toBe('0.6');
    expect(window.api.sendCommand).toHaveBeenCalledWith('change_threshold', { threshold: 0.6 });
  });

  test('should render model selector and trigger sendCommand when model changes', async () => {
    render(<App />);
    const select = await screen.findByLabelText('Vision Model Weights') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('yolo11l.pt'); // Default value

    await act(async () => {
      fireEvent.change(select, { target: { value: 'yolo26s.pt' } });
    });

    expect(select.value).toBe('yolo26s.pt');
    expect(window.api.sendCommand).toHaveBeenCalledWith('change_model', { model: 'yolo26s.pt' });
  });

  test('should render resolution selector and trigger sendCommand when imgsz changes', async () => {
    render(<App />);
    const select = await screen.findByLabelText('Detection Range (Resolution)') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('640'); // Default value

    await act(async () => {
      fireEvent.change(select, { target: { value: '960' } });
    });

    expect(select.value).toBe('960');
    expect(window.api.sendCommand).toHaveBeenCalledWith('change_imgsz', { imgsz: 960 });
  });
});
