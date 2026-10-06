import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import App from './App';
import type { SamplerEvent, StoredState } from '../shared/types';

describe('FocusSentinel App React UI', () => {
  // Several hooks subscribe (tracker, usage); deliver to all, as preload does.
  let listeners: ((event: SamplerEvent) => void)[] = [];
  const emit = (event: SamplerEvent) => listeners.forEach((listener) => listener(event));

  const renderApp = async (stored: StoredState = {}) => {
    vi.mocked(window.api.loadState).mockResolvedValue(stored);
    render(<App />);
    await act(async () => {}); // let the saved state load
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.api.saveState).mockResolvedValue(undefined);
    listeners = [];
    vi.mocked(window.api.onFocusEvent).mockImplementation((callback) => {
      listeners.push(callback);
      return () => {
        listeners = listeners.filter((listener) => listener !== callback);
      };
    });
  });

  const sample = (appName: string, windowTitle: string, offsetSeconds: number): SamplerEvent => ({
    kind: 'sample',
    sample: { appName, windowTitle, timestamp: 1_700_000_000_000 + offsetSeconds * 1000 },
  });

  const startFocusBlock = () => fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

  test('renders the header without crashing', async () => {
    await renderApp();
    expect(screen.getByText((content, element) => element?.textContent === 'FocusSentinel')).toBeDefined();
  });

  test('wires window control buttons to window.api', async () => {
    await renderApp();

    fireEvent.click(screen.getByTitle('Minimize'));
    expect(window.api.minimize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Maximize'));
    expect(window.api.maximize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Close'));
    expect(window.api.close).toHaveBeenCalled();
  });

  test('distractions do not count until a focus block is running', async () => {
    await renderApp();

    act(() => emit(sample('Discord', 'general', 0)));
    act(() => emit(sample('Discord', 'general', 6)));

    expect(screen.getByTestId('focus-state').textContent).toBe('Paused');
    expect(screen.getByTestId('focus-violations').textContent).toBe('0');
  });

  test('shows live focus status as samples arrive during a focus block', async () => {
    await renderApp();
    startFocusBlock();

    act(() => emit(sample('Discord', 'general', 0)));
    act(() => emit(sample('Discord', 'general', 6)));

    expect(screen.getByTestId('focus-state').textContent).toBe('Distracted');
    expect(screen.getByTestId('focus-app').textContent).toBe('Discord');
    expect(screen.getByTestId('focus-duration').textContent).toBe('6s');
    expect(screen.getByTestId('focus-violations').textContent).toBe('1');
  });

  test('the timer starts and pauses', async () => {
    await renderApp();

    startFocusBlock();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Start' })).toBeDefined();
  });

  test('goals can be added, ticked off and removed', async () => {
    await renderApp();
    openTab('Goals');

    fireEvent.change(screen.getByLabelText('New goal'), { target: { value: 'Write the ADR' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add goal' }));

    const goal = screen.getByLabelText('Write the ADR');
    fireEvent.click(goal);
    expect((goal as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Write the ADR' }));
    expect(screen.queryByLabelText('Write the ADR')).toBeNull();
  });

  test('saved goals, persona and usage appear after loading', async () => {
    await renderApp({
      goals: [{ id: 'g1', text: 'Finish chapter 2', done: false }],
      persona: 'Drill Sergeant',
      appUsage: { Discord: { seconds: 125, lastSeen: 1 } },
    });

    openTab('Goals');
    expect(screen.getByLabelText('Finish chapter 2')).toBeDefined();

    openTab('Coach');
    expect((screen.getByLabelText('Personality') as HTMLSelectElement).value).toBe('Drill Sergeant');

    openTab('Apps');
    const row = screen.getByTestId('app-row-Discord');
    expect(within(row).getByText('2m 5s')).toBeDefined();
  });

  test('an app marked as focus on the Apps tab stops counting as a distraction', async () => {
    await renderApp({ appUsage: { Discord: { seconds: 60, lastSeen: 1 } } });
    startFocusBlock();
    openTab('Apps');

    const select = within(screen.getByTestId('app-row-Discord')).getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('distraction');
    fireEvent.change(select, { target: { value: 'focus' } });

    act(() => emit(sample('Discord', 'general', 0)));
    expect(screen.getByTestId('focus-state').textContent).toBe('Focused');
  });

  test('changes are saved', async () => {
    vi.useFakeTimers();
    try {
      await renderApp();
      openTab('Coach');
      fireEvent.change(screen.getByLabelText('Personality'), { target: { value: 'Sarcastic Critic' } });
      await act(async () => vi.advanceTimersByTime(1000));

      expect(window.api.saveState).toHaveBeenCalled();
      expect(vi.mocked(window.api.saveState).mock.calls.at(-1)?.[0].persona).toBe('Sarcastic Critic');
    } finally {
      vi.useRealTimers();
    }
  });

  test('a sustained distraction triggers a check-in; an unloaded model is reported, not fatal', async () => {
    await renderApp();
    startFocusBlock();

    act(() => emit(sample('Discord', 'general', 0)));
    act(() => emit(sample('Discord', 'general', 6)));

    openTab('Coach');
    await screen.findByText(/not initialized/);

    act(() => emit(sample('Discord', 'general', 8)));
    expect(screen.getByTestId('focus-duration').textContent).toBe('8s');
  });

  test('never renders a window title anywhere', async () => {
    await renderApp();
    startFocusBlock();

    act(() => emit(sample('Google Chrome', 'SECRET-TITLE - YouTube', 0)));
    for (const tab of ['Goals', 'Apps', 'Coach', 'Log']) {
      openTab(tab);
      expect(document.body.textContent).not.toContain('SECRET-TITLE');
    }
  });

  test('a sampler error is shown, not silently read as focused', async () => {
    await renderApp();

    act(() => emit({ kind: 'error', error: { reason: 'addon-unavailable', message: 'addon missing' } }));

    expect(screen.getByRole('alert').textContent).toContain('addon missing');
  });
});
