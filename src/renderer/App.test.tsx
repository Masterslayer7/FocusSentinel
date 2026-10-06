import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import App from './App';
import type { SamplerEvent } from '../shared/types';

describe('FocusSentinel App React UI', () => {
  let emit: (event: SamplerEvent) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.api.onFocusEvent).mockImplementation((callback) => {
      emit = callback;
      return () => {};
    });
  });

  const sample = (appName: string, windowTitle: string, offsetSeconds: number): SamplerEvent => ({
    kind: 'sample',
    sample: { appName, windowTitle, timestamp: 1_700_000_000_000 + offsetSeconds * 1000 },
  });

  test('renders the header without crashing', () => {
    render(<App />);
    expect(screen.getByText((content, element) => element?.textContent === 'FocusSentinel')).toBeDefined();
  });

  test('wires window control buttons to window.api', () => {
    render(<App />);

    fireEvent.click(screen.getByTitle('Minimize'));
    expect(window.api.minimize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Maximize'));
    expect(window.api.maximize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Close'));
    expect(window.api.close).toHaveBeenCalled();
  });

  test('shows live focus status as samples arrive', () => {
    render(<App />);

    act(() => emit(sample('Discord', 'general', 0)));
    act(() => emit(sample('Discord', 'general', 6)));

    expect(screen.getByTestId('focus-state').textContent).toBe('Distracted');
    expect(screen.getByTestId('focus-app').textContent).toBe('Discord');
    expect(screen.getByTestId('focus-duration').textContent).toBe('6s');
    expect(screen.getByTestId('focus-violations').textContent).toBe('1');
  });

  test('logs one line per change of app or state, not one per sample', () => {
    render(<App />);

    act(() => emit(sample('Visual Studio Code', 'main.ts', 0)));
    act(() => emit(sample('Visual Studio Code', 'main.ts', 2)));
    act(() => emit(sample('Discord', 'general', 4)));
    act(() => emit(sample('Discord', 'general', 6)));

    expect(document.querySelectorAll('.log-line')).toHaveLength(2);
  });

  test('never renders a window title anywhere', () => {
    render(<App />);

    act(() => emit(sample('Google Chrome', 'SECRET-TITLE - YouTube', 0)));

    expect(document.body.textContent).not.toContain('SECRET-TITLE');
    expect(screen.getByTestId('focus-app').textContent).toBe('Google Chrome');
  });

  test('a sustained distraction triggers a check-in; an unloaded model is logged, not fatal', async () => {
    render(<App />);

    act(() => emit(sample('Discord', 'general', 0)));
    act(() => emit(sample('Discord', 'general', 6)));

    await screen.findByText(/check-in #1 failed: .*not initialized/);

    // The tracker keeps working after the failed check-in.
    act(() => emit(sample('Discord', 'general', 8)));
    expect(screen.getByTestId('focus-duration').textContent).toBe('8s');
  });

  test('a sampler error is shown, not silently read as focused', () => {
    render(<App />);

    act(() => emit({ kind: 'error', error: { reason: 'addon-unavailable', message: 'addon missing' } }));

    expect(screen.getByRole('alert').textContent).toContain('addon missing');
  });
});
